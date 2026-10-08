"use server";

import { fid, mPost, mPut, mRun, num, on, str } from "@/lib/merchant-actions";

// Settings: the business profile, its locations and hours, the rules clients
// book under, the plan, and the signed-in person's own account.

export async function saveProfile(fd: FormData) {
  await mRun(fd, "Business profile saved.", () =>
    mPut("/settings/profile", {
      name: str(fd, "name"), category: str(fd, "category"), phone: str(fd, "phone"), email: str(fd, "email"),
      about: str(fd, "about"), timezone: str(fd, "timezone"), sales_tax_pct: num(fd, "sales_tax_pct"),
    }));
}

/**
 * Saves some of the rules. `fields` names what this form holds, as
 * "group.key:kind" with kind b (switch), n (number) or s (choice), so a
 * switch that is off is still sent, and nothing the form does not show is touched.
 */
export async function saveRules(fd: FormData) {
  const body: Record<string, Record<string, boolean | number | string>> = {};
  for (const field of str(fd, "fields").split(",").filter(Boolean)) {
    const [name, kind] = field.split(":");
    const [group, key] = name.split(".");
    if (!group || !key) continue;
    body[group] ??= {};
    body[group][key] = kind === "b" ? on(fd, name) : kind === "n" ? Math.round(num(fd, name)) : str(fd, name);
  }
  await mRun(fd, "Saved.", () => mPut("/settings/rules", body));
}

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** Adds a location, or saves one. A day that is not ticked is closed. */
export async function saveLocation(fd: FormData) {
  const id = str(fd, "id");
  const body: Record<string, unknown> = { name: str(fd, "name"), address: str(fd, "address"), city: str(fd, "city"), region: str(fd, "region"), arrival_notes: str(fd, "arrival_notes") };
  if (fd.has("hours_set")) {
    const hours: Record<string, string[]> = {};
    for (const d of DAYS) if (on(fd, `open_${d}`)) hours[d] = [str(fd, `from_${d}`), str(fd, `to_${d}`)];
    body.hours = hours;
  }
  await mRun(
    fd,
    (out) => (!id ? "Location added. It opens Monday to Saturday to start with: set its real hours next." : out.position === "not found" ? "Saved. We could not place that address on the map, so check the street and city." : "Location saved."),
    () => (id ? mPut(`/locations/${encodeURIComponent(id)}`, body) : mPost("/locations", body)),
  );
}

export async function locationAction(fd: FormData) {
  const action = str(fd, "action");
  await mRun(fd, action === "primary" ? "This is now your main location." : "Location deleted.", () => mPost(`/locations/${fid(fd)}/action`, { action }));
}

/** The Pro fee is taken from the payout balance by the API; this only changes the plan. */
export async function changePlan(fd: FormData) {
  const plan = str(fd, "plan");
  await mRun(fd, plan === "pro" ? "You are on Pro. The monthly fee is taken from your payout balance, the first as soon as the balance can cover it." : "You are on the Free plan. No further Pro fees are taken, and nothing is refunded for the month already paid.", () => mPost("/plan", { plan }));
}

export async function setListing(fd: FormData) {
  const paused = on(fd, "paused");
  await mRun(fd, paused ? "Online booking is paused. Your data and existing bookings are kept." : "You are live again. Clients can find and book you.", () => mPost("/listing", { paused }));
}

export async function saveAccount(fd: FormData) {
  await mRun(fd, "Your details are saved.", () => mPut("/account", { name: str(fd, "name"), phone: str(fd, "phone") }));
}

export async function changePassword(fd: FormData) {
  // Passwords are sent as typed: a space at either end may be part of one.
  const current = String(fd.get("current") ?? ""), next = String(fd.get("new") ?? ""), again = String(fd.get("again") ?? "");
  await mRun(fd, "Password changed. Your other devices have been signed out.", async () => {
    if (next !== again) throw new Error("The two new passwords do not match.");
    return mPost("/password", { current, new: next });
  });
}
