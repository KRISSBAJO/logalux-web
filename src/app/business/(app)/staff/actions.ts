"use server";

import { mFetch, type Row } from "@/lib/merchant-api";
import { cents, fid, mDel, mPost, mPut, mRun, num, on, str } from "@/lib/merchant-actions";

// The team: who works here, when, what they can do, and who can sign in.

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function fromForm(fd: FormData) {
  const body: Record<string, unknown> = {
    name: str(fd, "name"), role: str(fd, "role") || "staff", level: str(fd, "level") || "senior", tone: str(fd, "tone"),
    bookable: on(fd, "bookable"), email: str(fd, "email"), phone: str(fd, "phone"),
    commission_pct: num(fd, "commission"), retail_commission_pct: num(fd, "retail_commission"),
  };
  // Pay, rental terms and permissions are only sent when the form showed them; what is left out is kept.
  const renter = on(fd, "renter") || str(fd, "pay_type") === "renter";
  if (renter) body.pay_type = "renter";
  else if (str(fd, "pay_type")) {
    body.pay_type = str(fd, "pay_type");
    body.hourly_cents = cents(fd, "hourly");
    body.salary_cents = cents(fd, "salary");
  }
  if (renter && str(fd, "has_rent")) {
    body.trading_name = str(fd, "trading_name");
    body.rent_cents = cents(fd, "rent");
    body.rent_period = str(fd, "rent_period") === "monthly" ? "monthly" : "weekly";
    body.rent_days = fd.getAll("rent_days").map(String).filter((d) => DAYS.includes(d));
  }
  if (str(fd, "has_perms")) body.permissions = { see_all_calendars: on(fd, "see_all_calendars"), take_payments: on(fd, "take_payments"), see_reports: on(fd, "see_reports") };
  return body;
}

export async function staffCreate(fd: FormData) {
  await mRun(fd, on(fd, "renter") ? "Chair renter added. Their rent is listed under Chair rental from the next period." : "Added to the team. They can do every service until you say otherwise.", async () => {
    const out = await mPost("/staff", fromForm(fd));
    const url = new URL(str(fd, "back") || "/business/staff", "http://merchant");
    url.searchParams.set("staff", String(out.id ?? ""));
    url.searchParams.delete("new");
    fd.set("back", url.pathname + url.search);
    return out;
  });
}

export async function staffSave(fd: FormData) {
  const body: Record<string, unknown> = fromForm(fd);
  if (str(fd, "has_services")) body.service_ids = fd.getAll("svc").map(String).filter(Boolean);
  await mRun(fd, "Saved.", () => mPut(`/staff/${fid(fd)}`, body));
}

/** Sets a person's own week, or puts them back on the hours of the location. Nothing else about them changes. */
export async function staffHours(fd: FormData) {
  const id = str(fd, "id"), follow = on(fd, "follow");
  await mRun(fd, follow ? "They follow the location hours. Breaks are saved." : "Their week and breaks are saved. They repeat until you change them.", async () => {
    const p = (((await mFetch("/staff")).staff ?? []) as Row[]).find((x) => x.id === id);
    if (!p) throw new Error("That person is no longer on your team.");
    const body: Record<string, unknown> = {
      name: p.name, role: p.role, level: p.level, tone: p.tone, bookable: p.bookable, email: p.email, phone: p.phone,
      commission_pct: p.commission_pct, retail_commission_pct: p.retail_commission_pct,
    };
    if (follow) body.use_location_hours = true;
    else {
      const hours: Record<string, string[]> = {};
      for (const d of DAYS) if (on(fd, `open_${d}`)) hours[d] = [str(fd, `from_${d}`), str(fd, `to_${d}`)];
      body.hours = hours;
    }
    const breaks: Record<string, string[][]> = {};
    for (const d of DAYS) {
      const a = fd.getAll(`bf_${d}`).map(String), z = fd.getAll(`bt_${d}`).map(String);
      const list = a.map((v, i) => [v, z[i] ?? ""]).filter((b) => b[0] && b[1]);
      if (list.length) breaks[d] = list;
    }
    body.breaks = breaks;
    return mPut(`/staff/${encodeURIComponent(id)}`, body);
  });
}

export async function staffAction(fd: FormData) {
  const action = str(fd, "action");
  await mRun(fd, action === "archive" ? "Removed from the team. Their past bookings and sales are kept, and their sign-in no longer opens this business." : "Back on the team and taking bookings.", () => mPost(`/staff/${fid(fd)}/action`, { action }));
}

export async function staffInvite(fd: FormData) {
  const email = str(fd, "email");
  const manager = str(fd, "login_role") === "manager";
  await mRun(fd, (out) => {
    if (str(fd, "change")) return `Sign-in updated. ${email} now signs in as a ${manager ? "manager" : "team member"}.`;
    if (!out.new_account) return `${email} already has a LogaLuxe account. It can open this business now with its own password. No email was sent.`;
    return out.mail_mode && out.mail_mode !== "log"
      ? `Sign-in created. We emailed ${email} a link to choose a password. It works for 7 days.`
      : `Sign-in created for ${email}. Email is not set up on this server, so the link was written to the log and not sent.`;
  }, () => mPost(`/staff/${fid(fd)}/invite`, { email, role: manager ? "manager" : "staff" }));
}

export async function staffUninvite(fd: FormData) {
  await mRun(fd, "Sign-in removed. They can no longer open this business.", () => mDel(`/staff/${fid(fd)}/invite`));
}

export async function timeOffCreate(fd: FormData) {
  await mRun(fd, (out) => (out.status === "approved" ? "Time off added. They cannot be booked on those days." : "Request sent. A manager will approve or decline it."),
    () => mPost("/time-off", { staff_id: str(fd, "staff_id"), starts_on: str(fd, "starts_on"), ends_on: str(fd, "ends_on") || str(fd, "starts_on"), reason: str(fd, "reason") }));
}

/** Approves time off and moves that person's bookings on those days to others who do the same services and are free. */
export async function timeOffReassign(fd: FormData) {
  await mRun(fd, (out) => {
    const moved = Number(out.moved ?? 0), left = Number(out.left ?? 0);
    if (!moved && !left) return "Time off approved. There were no bookings to move.";
    const a = moved ? `${moved} ${moved === 1 ? "booking was" : "bookings were"} moved to other team members` : "No booking could be moved";
    const b = left ? `${left} still ${left === 1 ? "needs" : "need"} you: open the calendar to move or cancel ${left === 1 ? "it" : "them"}` : "none are left over";
    return `Time off approved. ${a}, ${b}.`;
  }, () => mPost(`/time-off/${fid(fd)}`, { decision: "approve", reassign: true }));
}

const RENT_DONE: Record<string, string> = { paid: "Rent marked as paid.", waive: "Rent waived for that period.", reopen: "Rent is back to owing." };

/** Records what happened to one period's rent. LogaLuxe does not collect it. */
export async function rentAction(fd: FormData) {
  const action = str(fd, "action");
  await mRun(fd, RENT_DONE[action] ?? "Saved.", () => mPost(`/rent/${fid(fd)}`, { action, method: action === "paid" ? str(fd, "method") : "", note: str(fd, "note") }));
}
