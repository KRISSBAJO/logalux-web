"use server";

import { redirect } from "next/navigation";

const BASE = process.env.LOGALUXE_API_URL ?? "http://127.0.0.1:18080";

/** The contact form. Creates a ticket in the support inbox. */
export async function sendToSupport(fd: FormData) {
  const v = (k: string) => String(fd.get(k) ?? "").trim();
  // Real people leave this hidden field empty. A bot that fills it gets a polite thank-you and no ticket.
  if (v("website")) redirect("/help?sent=SP-0000");

  let ref = "", error = "";
  try {
    const res = await fetch(`${BASE}/v1/support`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: v("name"), email: v("email"), phone: v("phone"), role: v("role"), business_slug: v("business_slug"), subject: v("subject"), message: v("message") }),
      cache: "no-store",
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) ref = body.ref;
    else error = body.error ?? "We could not send that. Try again.";
  } catch {
    error = "We could not reach the service. Try again in a moment.";
  }
  redirect(error ? `/help?err=${encodeURIComponent(error)}` : `/help?sent=${encodeURIComponent(ref)}`);
}
