"use server";

import { adminFetch } from "@/lib/admin-api";
import { backTo, clearFlash, id, post, run, setFlash, str } from "@/lib/action-helpers";

// The signed-in admin's own password and two-step sign-in.

export async function changePassword(fd: FormData) {
  const next = String(fd.get("new") ?? "");
  if (next !== String(fd.get("again") ?? "")) return backTo(fd, "err", "The two new passwords do not match.");
  await run(fd, "Password changed. Other devices have been signed out.", () => post("/password", { current: String(fd.get("current") ?? ""), new: next }));
}

/** Step one: get a key to add to an authenticator app. Shown for ten minutes. */
export async function startTwoStep(fd: FormData) {
  let error = "";
  try {
    const out = await adminFetch<{ secret: string; uri: string }>("/2fa/setup", { method: "POST", body: {} });
    await setFlash({ setup: out }, 600);
  } catch (e) {
    error = (e as Error).message;
  }
  return error ? backTo(fd, "err", error) : backTo(fd, "ok", "Add the key to your authenticator app, then enter a code to finish.");
}

/** Step two: prove the app works. The recovery codes are shown once, for five minutes. */
export async function finishTwoStep(fd: FormData) {
  let error = "";
  try {
    const out = await adminFetch<{ recovery_codes: string[] }>("/2fa/enable", { method: "POST", body: { code: str(fd, "code") } });
    await setFlash({ recovery: out.recovery_codes }, 300);
  } catch (e) {
    error = (e as Error).message;
  }
  return error ? backTo(fd, "err", error) : backTo(fd, "ok", "Two-step sign-in is on. Save your recovery codes now.");
}

export async function cancelTwoStepSetup(fd: FormData) {
  await clearFlash();
  backTo(fd, "ok", "Setup cancelled. Nothing changed.");
}

export async function stopTwoStep(fd: FormData) {
  await clearFlash();
  await run(fd, "Two-step sign-in is off.", () => post("/2fa/disable", { password: String(fd.get("password") ?? "") }));
}

export async function dismissRecoveryCodes(fd: FormData) {
  await clearFlash();
  backTo(fd, "ok", "Done. Keep those codes somewhere safe.");
}

/** Super admin: for a colleague who lost their phone. */
export async function resetTwoStepFor(fd: FormData) {
  await run(fd, "Two-step sign-in reset. They can sign in with their password and set it up again.", () => post(`/team/${id(fd)}/reset-2fa`, {}));
}

/** Super admin: for someone who runs a business and lost both their phone and their recovery codes. */
export async function resetMerchantTwoStep(fd: FormData) {
  await run(fd, "Two-step sign-in reset for that business sign-in. They are signed out everywhere and can sign in with their password.", () => post("/merchants/reset-2fa", { email: str(fd, "email") }));
}
