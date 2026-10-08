"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { backTo, cents, id, num, post, run, str } from "@/lib/action-helpers";
import { SESSION_COOKIE, adminFetch, adminUpload, signIn } from "@/lib/admin-api";

// ---- session ----

export async function login(fd: FormData) {
  let error = "";
  try {
    const s = await signIn(str(fd, "email").toLowerCase(), String(fd.get("password") ?? ""), str(fd, "code"));
    (await cookies()).set(SESSION_COOKIE, s.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/admin", maxAge: s.expires_in });
  } catch (e) {
    error = (e as Error).message;
  }
  redirect(error ? `/admin?err=${encodeURIComponent(error)}` : "/admin");
}

export async function logout() {
  try {
    await post("/logout", {});
  } catch {}
  (await cookies()).delete({ name: SESSION_COOKIE, path: "/admin" });
  redirect("/admin");
}

// ---- queues ----

export async function decideVerification(fd: FormData) {
  await run(fd, "Decision saved.", () => post(`/verification/${id(fd)}/decide`, { decision: str(fd, "decision"), note: str(fd, "note") }));
}
export async function decideModeration(fd: FormData) {
  await run(fd, "Review updated.", () => post(`/moderation/${id(fd)}/decide`, { action: str(fd, "decision"), reason: str(fd, "note") }));
}
export async function resolveDispute(fd: FormData) {
  await run(fd, "Dispute resolved.", () => post(`/disputes/${id(fd)}/resolve`, { outcome: str(fd, "decision"), amount_cents: cents(fd, "amount"), reason: str(fd, "note") }));
}

// ---- businesses ----

export async function setBusinessStatus(fd: FormData) {
  await run(fd, "Status changed.", () => post(`/businesses/${id(fd)}/status`, { status: str(fd, "decision"), reason: str(fd, "note") }));
}
export async function setBusinessPlan(fd: FormData) {
  await run(fd, "Plan changed.", () => adminFetch(`/businesses/${id(fd)}`, { method: "PATCH", body: { plan: str(fd, "plan") } }));
}
export async function setPayoutHold(fd: FormData) {
  const hold = str(fd, "hold") === "1";
  await run(fd, hold ? "Payouts are on hold." : "Payouts released.", () => post(`/businesses/${id(fd)}/payout-hold`, { hold, reason: str(fd, "note") }));
}
export async function addNote(fd: FormData) {
  await run(fd, "Note added.", () => post(`/businesses/${id(fd)}/notes`, { body: str(fd, "body") }));
}
export async function issueCredit(fd: FormData) {
  await run(fd, "Credit issued.", () => post(`/businesses/${id(fd)}/credits`, { amount_cents: cents(fd, "amount"), reason: str(fd, "note"), client_phone: str(fd, "client_phone") }));
}

// ---- bookings, clients, orders, products ----

export async function bookingAction(fd: FormData) {
  const action = str(fd, "decision");
  await run(fd, action === "reschedule" ? "Booking moved." : "Booking updated.", () => post(`/bookings/${id(fd)}/action`, { action, starts_at: str(fd, "starts_at"), reason: str(fd, "note") }));
}
export async function blockClient(fd: FormData) {
  const blocked = str(fd, "blocked") === "1";
  await run(fd, blocked ? "Number blocked." : "Number unblocked.", () => post("/clients/block", { phone: str(fd, "phone"), blocked, reason: str(fd, "note") }));
}
export async function setOrderStatus(fd: FormData) {
  await run(fd, "Order updated.", () => post(`/orders/${id(fd)}/status`, { status: str(fd, "status"), reason: str(fd, "note") }));
}
export async function setProductActive(fd: FormData) {
  const active = str(fd, "active") === "1";
  await run(fd, active ? "Product is back on sale." : "Product taken off sale.", () => post(`/products/${id(fd)}/active`, { active, reason: str(fd, "note") }));
}

// ---- money ----

export async function payoutAction(fd: FormData) {
  await run(fd, "Payout updated.", () => post(`/payouts/${id(fd)}/action`, { action: str(fd, "decision"), reason: str(fd, "note") }));
}
export async function proposeFee(fd: FormData) {
  const cap = str(fd, "transaction_cap");
  await run(fd, "Proposed. A second super admin must approve it.", () =>
    post("/fees", {
      market: str(fd, "market"),
      plan: str(fd, "plan"),
      transaction_pct: num(fd, "transaction_pct"),
      transaction_fixed_cents: cents(fd, "transaction_fixed"),
      transaction_cap_cents: cap === "" ? null : cents(fd, "transaction_cap"),
      new_client_pct: num(fd, "new_client_pct"),
      instant_payout_pct: num(fd, "instant_payout_pct"),
      marketplace_pct: num(fd, "marketplace_pct"),
      chargeback_cents: cents(fd, "chargeback"),
      plan_price_cents: cents(fd, "plan_price"),
      effective_from: str(fd, "effective_from"),
      note: str(fd, "note"),
    }));
}
export async function decideFee(fd: FormData) {
  const decision = str(fd, "decision");
  await run(fd, decision === "approve" ? "Fee change approved." : "Fee change rejected.", () =>
    post("/fees/decide", { market: str(fd, "market"), plan: str(fd, "plan"), effective_from: str(fd, "effective_from"), decision }));
}

// ---- platform ----

export async function createFlag(fd: FormData) {
  await run(fd, "Flag created. It starts switched off.", () => post("/flags", { key: str(fd, "key"), name: str(fd, "name"), description: str(fd, "description"), market: str(fd, "market"), plan: str(fd, "plan") }));
}
export async function updateFlag(fd: FormData) {
  const body: Record<string, unknown> = {};
  if (fd.has("enabled")) body.enabled = str(fd, "enabled") === "1";
  if (fd.has("rollout_pct")) body.rollout_pct = Math.max(0, Math.min(100, Math.round(num(fd, "rollout_pct"))));
  await run(fd, "Flag updated.", () => adminFetch(`/flags/${encodeURIComponent(str(fd, "key"))}`, { method: "PUT", body }));
}
export async function deleteFlag(fd: FormData) {
  await run(fd, "Flag deleted.", () => adminFetch(`/flags/${encodeURIComponent(str(fd, "key"))}`, { method: "DELETE" }));
}
export async function inviteAdmin(fd: FormData) {
  await run(fd, "Admin added.", () => post("/team", { email: str(fd, "email").toLowerCase(), name: str(fd, "name"), role: str(fd, "role"), password: String(fd.get("password") ?? "") }));
}
export async function updateAdmin(fd: FormData) {
  const body: Record<string, unknown> = {};
  if (fd.has("role")) body.role = str(fd, "role");
  if (fd.has("active")) body.active = str(fd, "active") === "1";
  if (fd.has("password")) body.password = String(fd.get("password") ?? "");
  await run(fd, "Admin updated.", () => adminFetch(`/team/${id(fd)}`, { method: "PUT", body }));
}

// ---- site images ----

export async function uploadMedia(fd: FormData) {
  const file = fd.get("file");
  await run(fd, "Image uploaded. It is live on the site.", async () => {
    if (!(file instanceof File) || file.size === 0) throw new Error("Choose an image to upload.");
    if (file.size > 8 * 1024 * 1024) throw new Error("The image is too large. The limit is 8 MB.");
    const out = new FormData();
    out.set("slot", str(fd, "slot"));
    out.set("ref", str(fd, "ref"));
    out.set("alt", str(fd, "alt"));
    if (fd.has("caption")) out.set("caption", str(fd, "caption"));
    if (fd.has("caption_pos")) out.set("caption_pos", str(fd, "caption_pos"));
    out.set("file", file, file.name);
    await adminUpload("/media", out);
    revalidatePath("/", "layout");
  });
}
export async function updateMedia(fd: FormData) {
  const body: Record<string, unknown> = {};
  if (fd.has("active")) body.active = str(fd, "active") === "1";
  if (fd.has("alt")) body.alt = str(fd, "alt");
  if (fd.has("sort")) body.sort = Math.round(num(fd, "sort"));
  if (fd.has("caption")) body.caption = str(fd, "caption");
  if (fd.has("caption_pos")) body.caption_pos = str(fd, "caption_pos");
  await run(fd, "Image updated.", async () => {
    await adminFetch(`/media/${id(fd)}`, { method: "PUT", body });
    revalidatePath("/", "layout");
  });
}
export async function deleteMedia(fd: FormData) {
  await run(fd, "Image deleted.", async () => {
    await adminFetch(`/media/${id(fd)}`, { method: "DELETE" });
    revalidatePath("/", "layout");
  });
}
