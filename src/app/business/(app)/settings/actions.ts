"use server";

import { fid, mBackTo, mClearFlash, mDel, mPost, mPut, mRun, mSetFlash, num, on, str } from "@/lib/merchant-actions";
import { locationBody, pinWords } from "@/lib/location-form";
import { mUpload, qs } from "@/lib/merchant-api";

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
  const body: Record<string, unknown> = { name: str(fd, "name"), ...locationBody(fd), arrival_notes: str(fd, "arrival_notes") };
  if (fd.has("hours_set")) {
    const hours: Record<string, string[]> = {};
    for (const d of DAYS) if (on(fd, `open_${d}`)) hours[d] = [str(fd, `from_${d}`), str(fd, `to_${d}`)];
    body.hours = hours;
  }
  await mRun(
    fd,
    (out) => (!id ? `Location added. It opens Monday to Saturday to start with: set its real hours next.${pinWords(String(out.position ?? ""))}` : `Location saved.${out.position === "kept" ? "" : pinWords(String(out.position ?? ""))}`),
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

/** Two-step sign-in, step one: get a key to add to an authenticator app. It is shown for ten minutes. */
export async function startTwoStep(fd: FormData) {
  let error = "";
  try {
    await mSetFlash({ setup: await mPost("/2fa/setup") as { secret: string; uri: string } }, 600);
  } catch (e) {
    error = (e as Error).message;
  }
  return error ? mBackTo(fd, "err", error) : mBackTo(fd, "ok", "Add the key to your authenticator app, then enter a code to finish.");
}

/** Step two: prove the app works. The recovery codes are shown once, for five minutes. */
export async function finishTwoStep(fd: FormData) {
  let error = "";
  try {
    const out = await mPost("/2fa/enable", { code: str(fd, "code") }) as { recovery_codes: string[] };
    await mSetFlash({ recovery: out.recovery_codes }, 300);
  } catch (e) {
    error = (e as Error).message;
  }
  return error ? mBackTo(fd, "err", error) : mBackTo(fd, "ok", "Two-step sign-in is on. Save your recovery codes now: they are shown only once.");
}

export async function cancelTwoStepSetup(fd: FormData) {
  await mClearFlash();
  return mBackTo(fd, "ok", "Setup cancelled. Nothing changed.");
}

export async function dismissRecoveryCodes(fd: FormData) {
  await mClearFlash();
  return mBackTo(fd, "ok", "Two-step sign-in is on.");
}

export async function stopTwoStep(fd: FormData) {
  await mClearFlash();
  await mRun(fd, "Two-step sign-in is off. Your password alone signs you in.", () => mPost("/2fa/disable", { password: String(fd.get("password") ?? "") }));
}

// ----- calendar sync: a person's bookings in their own calendar, and their busy times kept out of their bookings -----

/** Whose calendar this is about: the signed-in person, or the team member a manager chose. */
const calWho = (fd: FormData) => qs({ staff_id: str(fd, "staff") });

/** Makes the private calendar address. Making another one stops the old one working. */
export async function calFeedMake(fd: FormData) {
  const again = on(fd, "again");
  await mRun(fd, again ? "New address made. The old one has stopped working, so add the new one to your calendar." : "The calendar address is ready. Add it to your calendar to see the bookings there.", () => mPost("/calendar-sync/feed" + calWho(fd)));
}

export async function calFeedOff(fd: FormData) {
  await mRun(fd, "Turned off. The address no longer works.", () => mDel("/calendar-sync/feed" + calWho(fd)));
}

/** The API saves the address and reads it at once. Its note says how the read went, so a read that failed is shown as a problem. */
async function calRead(fd: FormData, call: () => Promise<unknown>): Promise<never> {
  let error = "", note = "";
  try {
    note = String(((await call()) as { cal_import_note?: string })?.cal_import_note ?? "");
  } catch (e) {
    error = (e as Error).message || "Something went wrong.";
  }
  if (error) return mBackTo(fd, "err", error);
  return /^Read /.test(note) ? mBackTo(fd, "ok", note) : mBackTo(fd, "err", note || "Nothing was read. Check the address and try again.");
}

export async function calImportSave(fd: FormData) {
  // The address is a secret: it goes straight to the API and is never shown again.
  const url = str(fd, "url");
  if (!url) return mBackTo(fd, "err", "Paste the private address of the calendar first.");
  await calRead(fd, () => mPut("/calendar-sync/import" + calWho(fd), { url }));
}

export async function calImportRun(fd: FormData) {
  await calRead(fd, () => mPost("/calendar-sync/import/run" + calWho(fd)));
}

export async function calImportStop(fd: FormData) {
  await mRun(fd, "Stopped. The busy times from that calendar have been removed.", () => mPut("/calendar-sync/import" + calWho(fd), { url: "" }));
}

export async function uploadProfilePhoto(fd: FormData) {await mRun(fd,"Your profile photo is saved.",()=>mUpload("/account/photo",fd));}
export async function removeProfilePhoto(fd: FormData) {await mRun(fd,"Your profile photo is removed.",()=>mDel("/account/photo"));}
