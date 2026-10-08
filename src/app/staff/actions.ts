"use server";

import { redirect } from "next/navigation";

// Password reset for console staff. These pages sit outside /admin because the
// person using them is, by definition, not signed in.

const BASE = process.env.LOGALUXE_API_URL ?? "http://127.0.0.1:18080";

async function call(path: string, body: unknown): Promise<string> {
  try {
    const res = await fetch(`${BASE}/v1/admin${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
    if (res.ok) return "";
    return (await res.json().catch(() => ({}))).error ?? "Something went wrong.";
  } catch {
    return "The service is not reachable. Try again in a moment.";
  }
}

export async function requestReset(fd: FormData) {
  const error = await call("/forgot", { email: String(fd.get("email") ?? "").trim() });
  // The same answer whether or not the account exists.
  redirect(error ? `/staff/forgot?err=${encodeURIComponent(error)}` : "/staff/forgot?sent=1");
}

export async function setNewPassword(fd: FormData) {
  const token = String(fd.get("token") ?? "");
  const password = String(fd.get("password") ?? "");
  const again = String(fd.get("again") ?? "");
  const fail = (m: string): never => redirect(`/staff/reset?token=${encodeURIComponent(token)}&err=${encodeURIComponent(m)}`);
  if (password !== again) fail("The two passwords do not match.");
  const error = await call("/reset", { token, password });
  if (error) fail(error);
  redirect(`/admin?ok=${encodeURIComponent("Password changed. Sign in with the new one.")}`);
}
