// Server only. The message a page shows after an action (?ok= and ?err= in the address).
// The address carries a short code, never the words themselves, so a crafted link cannot put
// its own sentence in the site's own message box. A sentence the API wrote is kept for two
// minutes in a cookie under a one-off code.
import { randomBytes } from "crypto";
import { cookies } from "next/headers";

export const MESSAGES: Record<string, string> = {
  // the account
  details: "Your details are saved.",
  devices: "Other sign-in access has been removed.",
  password: "Password changed. Other devices have been signed out.",
  "password-set": "Password set. You can sign in with your email and this password.",
  mismatch: "The two new passwords do not match.",
  cancelled: "Booking cancelled. The time has been released and nothing is owed.",
  "cancelled-refund": "Booking cancelled. Your deposit is being returned to the card or account you paid with.",
  "cancelled-kept": "Booking cancelled. It was past the free cancellation time, so the business keeps the deposit.",
  "no-series": "There are no upcoming visits in this series to cancel.",
  "no-time": "Choose a new time.",
  unsaved: "Removed from your saved businesses.",
  "unsaved-product": "Removed from your saved products.",
  "order-cancelled": "Order cancelled. Nothing was charged.",
  verified: "Your email is already confirmed.",
  sent: "Message sent.",
  phone: "Your number is confirmed. You can sign in with a code sent to it.",
  "channel-email": "Saved. You will hear about bookings by email.",
  "channel-sms": "Saved. You will hear about bookings by text, and by email.",
  "channel-whatsapp": "Saved. You will hear about bookings on WhatsApp, and by email.",
  // signing in
  reset: "Password changed. Sign in with the new one.",
  passwords: "The two passwords do not match.",
  // the shop
  reviewed: "Thank you. Your review is published.",
  // help
  "send-failed": "We could not send that. Try again.",
  unreachable: "We could not reach the service. Try again in a moment.",
};

const KEPT = "lx_msg";
const codeOf = new Map(Object.entries(MESSAGES).map(([code, text]) => [text, code]));

/** The code that stands for a sentence: a fixed one when there is one, else a one-off code for a sentence kept in a cookie. */
export async function messageCode(text: string): Promise<string> {
  const fixed = codeOf.get(text);
  if (fixed) return fixed;
  const nonce = randomBytes(6).toString("hex");
  (await cookies()).set(KEPT, JSON.stringify({ n: nonce, t: text.slice(0, 2000) }), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 120 });
  return `m-${nonce}`;
}

/** The sentence a code stands for. Nothing for a code that is unknown, made up, or older than two minutes. */
export async function readMessage(code: string | undefined): Promise<string> {
  if (!code) return "";
  if (MESSAGES[code]) return MESSAGES[code];
  if (!/^m-[0-9a-f]{12}$/.test(code)) return "";
  try {
    const raw = (await cookies()).get(KEPT)?.value;
    if (!raw) return "";
    const kept = JSON.parse(raw) as { n?: string; t?: string };
    return kept.n === code.slice(2) && typeof kept.t === "string" ? kept.t : "";
  } catch {
    return "";
  }
}
