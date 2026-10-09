"use server";

import { api, money } from "@/lib/api";
import { customerApi } from "@/lib/customer";
import type { GiftOption } from "./gift-form";

const v = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const sentence = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) + (/[.!?]$/.test(s) ? "" : ".") : s);

/** What the gift card form is told after it is sent: a payment page to go to, or the address the code went to. */
export type GiftState = { error: string; url?: string; sentTo?: string; amountCents?: number; currency?: string };

/** The least and most a card can hold in one country's money, as the API says. Nothing is assumed when it cannot be read. */
async function bounds(country: string): Promise<GiftOption | null> {
  try {
    const { options = [] } = await api.get<{ options?: GiftOption[] }>("/v1/gift-cards/options", { revalidate: 300 });
    return options.find((o) => o.country === country) ?? null;
  } catch {
    return null;
  }
}

/** Buys a gift card. The code is only ever emailed, so it is never part of the answer. */
export async function buyGiftCard(_prev: GiftState, fd: FormData): Promise<GiftState> {
  const amountCents = Math.round(Number(v(fd, "amount_cents")));
  const note = v(fd, "note");
  // Where the person it is for will spend it decides the money: dollars in the United States, naira in Nigeria.
  const country = v(fd, "country") === "NG" ? "NG" : "US";
  const opt = await bounds(country);
  if (!opt) return { error: "Gift cards are not available just now. Try again in a moment." };
  if (!Number.isFinite(amountCents) || amountCents < opt.min_cents || amountCents > opt.max_cents) return { error: `Choose an amount between ${money(opt.min_cents, opt.currency)} and ${money(opt.max_cents, opt.currency)}.` };
  if (!v(fd, "recipient_name")) return { error: "Say who the card is for." };
  if (note.length > 300) return { error: "Keep the message under 300 characters." };
  if (!/^\S+@\S+\.\S+$/.test(v(fd, "buyer_email"))) return { error: "Add your email, for the receipt." };
  let out: { sent_to?: string; currency?: string; payment?: { url?: string } };
  try {
    // A signed-in customer's token goes along, so the API can fill in a name or email left empty.
    out = await customerApi("/gift-cards/buy", {
      method: "POST",
      body: { country, amount_cents: amountCents, recipient_name: v(fd, "recipient_name"), recipient_email: v(fd, "recipient_email"), note, buyer_name: v(fd, "buyer_name"), buyer_email: v(fd, "buyer_email") },
    });
  } catch (e) {
    return { error: sentence((e as Error).message) };
  }
  if (out.payment?.url) return { error: "", url: out.payment.url, amountCents, currency: out.currency };
  return { error: "", sentTo: out.sent_to ?? "", amountCents, currency: out.currency };
}
