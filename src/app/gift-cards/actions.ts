"use server";

import { customerApi } from "@/lib/customer";

const v = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const sentence = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) + (/[.!?]$/.test(s) ? "" : ".") : s);

/** What the gift card form is told after it is sent: a payment page to go to, or the address the code went to. */
export type GiftState = { error: string; url?: string; sentTo?: string; amountCents?: number };

/** Buys a gift card. The code is only ever emailed, so it is never part of the answer. */
export async function buyGiftCard(_prev: GiftState, fd: FormData): Promise<GiftState> {
  const amountCents = Math.round(Number(v(fd, "amount_cents")));
  const note = v(fd, "note");
  if (!Number.isFinite(amountCents) || amountCents < 1000 || amountCents > 50000) return { error: "Choose an amount between $10 and $500." };
  if (!v(fd, "recipient_name")) return { error: "Say who the card is for." };
  if (note.length > 300) return { error: "Keep the message under 300 characters." };
  if (!/^\S+@\S+\.\S+$/.test(v(fd, "buyer_email"))) return { error: "Add your email, for the receipt." };
  let out: { sent_to?: string; payment?: { url?: string } };
  try {
    // A signed-in customer's token goes along, so the API can fill in a name or email left empty.
    out = await customerApi("/gift-cards/buy", {
      method: "POST",
      body: { amount_cents: amountCents, recipient_name: v(fd, "recipient_name"), recipient_email: v(fd, "recipient_email"), note, buyer_name: v(fd, "buyer_name"), buyer_email: v(fd, "buyer_email") },
    });
  } catch (e) {
    return { error: sentence((e as Error).message) };
  }
  if (out.payment?.url) return { error: "", url: out.payment.url, amountCents };
  return { error: "", sentTo: out.sent_to ?? "", amountCents };
}
