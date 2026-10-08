"use server";

import { adminFetch } from "@/lib/admin-api";
import { backTo, cents, del, id, int, on, post, put, run, str } from "@/lib/action-helpers";

// Promo codes, gift cards, the support inbox, bulk messages and site pages.

export async function createPromo(fd: FormData) {
  const kind = str(fd, "kind");
  const max = str(fd, "max_uses");
  await run(fd, "Promo code created. It works straight away.", () =>
    post("/promos", {
      code: str(fd, "code"), description: str(fd, "description"), kind, value: kind === "percent" ? int(fd, "value") : cents(fd, "value"), currency: str(fd, "currency"),
      applies_to: str(fd, "applies_to"), min_cents: cents(fd, "min"), max_uses: max === "" ? null : int(fd, "max_uses"), starts_at: str(fd, "starts_at"), ends_at: str(fd, "ends_at"),
    }));
}
export async function togglePromo(fd: FormData) {
  const active = str(fd, "active") === "1";
  await run(fd, active ? "Promo code switched on." : "Promo code switched off.", () => put(`/promos/${id(fd)}`, { active }));
}
export async function deletePromo(fd: FormData) {
  await run(fd, "Promo code deleted.", () => del(`/promos/${id(fd)}`));
}

export async function issueGiftCard(fd: FormData) {
  let message = "", error = "";
  try {
    const out = await adminFetch<{ email: string }>("/gift-cards", {
      method: "POST",
      body: { amount_cents: cents(fd, "amount"), currency: str(fd, "currency"), recipient_name: str(fd, "recipient_name"), recipient_email: str(fd, "recipient_email"), note: str(fd, "note"), expires_on: str(fd, "expires_on"), send_email: on(fd, "send_email") },
    });
    message = "Gift card issued. Its code is at the top of the list." + (out.email === "sent" ? " The recipient has been emailed." : out.email === "logged" ? " Email is not set up, so the message was only written to the log. Send them the code yourself." : out.email === "failed" ? " The email failed. Send them the code yourself." : "");
  } catch (e) {
    error = (e as Error).message;
  }
  return error ? backTo(fd, "err", error) : backTo(fd, "ok", message);
}
export async function voidGiftCard(fd: FormData) {
  await run(fd, "Gift card cancelled. Its balance is now zero.", () => post(`/gift-cards/${id(fd)}/void`, { reason: str(fd, "note") }));
}

export async function replyTicket(fd: FormData) {
  const internal = str(fd, "kind") === "note";
  const close = str(fd, "kind") === "close";
  let message = "", error = "";
  try {
    const out = await adminFetch<{ email: string }>(`/support/${id(fd)}/reply`, { method: "POST", body: { body: str(fd, "body"), internal, close } });
    message = internal ? "Note added. The customer does not see it."
      : out.email === "sent" ? "Reply sent by email."
      : out.email === "logged" ? "Reply saved. Email is not set up, so it was not sent. Contact them another way."
      : out.email === "failed" ? "Reply saved, but the email failed. Contact them another way."
      : "Reply saved. There is no email on file, so contact them by phone.";
    if (close) message += " Ticket closed.";
  } catch (e) {
    error = (e as Error).message;
  }
  return error ? backTo(fd, "err", error) : backTo(fd, "ok", message);
}
export async function updateTicket(fd: FormData) {
  const body: Record<string, string> = {};
  for (const k of ["status", "priority", "assigned_to"]) if (fd.has(k)) body[k] = str(fd, k);
  await run(fd, "Ticket updated.", () => put(`/support/${id(fd)}`, body));
}

export async function draftBroadcast(fd: FormData) {
  let message = "", error = "";
  try {
    const out = await adminFetch<{ recipients: number; reachable: number }>("/broadcasts", {
      method: "POST",
      body: { audience: str(fd, "audience"), market: str(fd, "market"), plan: str(fd, "plan"), channel: str(fd, "channel"), subject: str(fd, "subject"), body: str(fd, "body") },
    });
    message = `Draft saved. It matches ${out.recipients} ${out.recipients === 1 ? "person" : "people"}; ${out.reachable} can be reached on this channel. A super admin sends it.`;
  } catch (e) {
    error = (e as Error).message;
  }
  return error ? backTo(fd, "err", error) : backTo(fd, "ok", message);
}
export async function sendBroadcast(fd: FormData) {
  let message = "", error = "";
  try {
    const out = await adminFetch<{ recipients: number; reachable: number; mode: string }>(`/broadcasts/${id(fd)}/send`, { method: "POST", body: {} });
    message = out.mode === "log"
      ? `Recorded for ${out.recipients} people, but not delivered: this channel is not connected yet.`
      : `Sending to ${out.reachable} of ${out.recipients} people now. Refresh in a moment for the result.`;
  } catch (e) {
    error = (e as Error).message;
  }
  return error ? backTo(fd, "err", error) : backTo(fd, "ok", message);
}
export async function deleteBroadcast(fd: FormData) {
  await run(fd, "Draft deleted.", () => del(`/broadcasts/${id(fd)}`));
}

export async function savePage(fd: FormData) {
  // Text areas send Windows line endings; store plain ones.
  const body = String(fd.get("body") ?? "").replace(/\r\n/g, "\n");
  await run(fd, on(fd, "published") ? "Page saved and live." : "Page saved and hidden from the site.", () => put(`/pages/${encodeURIComponent(str(fd, "slug"))}`, { title: str(fd, "title"), body, published: on(fd, "published") }));
}
