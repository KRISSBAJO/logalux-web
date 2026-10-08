// Server only. What LogaLuxe staff have switched on in the console. A feature is offered only
// while the API says it is live; when the API cannot be reached, nothing extra is offered.
import { cache } from "react";

const BASE = process.env.LOGALUXE_API_URL ?? "http://127.0.0.1:18080";

export type Features = { sms_login: boolean; sms_messages: boolean; whatsapp: boolean; wallets: boolean; saved_cards: boolean };
export const NO_FEATURES: Features = { sms_login: false, sms_messages: false, whatsapp: false, wallets: false, saved_cards: false };

/** Read fresh for every request, so a switch in the console shows on the next page load. */
export const getFeatures = cache(async (): Promise<Features> => {
  try {
    const res = await fetch(`${BASE}/v1/features`, { cache: "no-store" });
    if (!res.ok) return NO_FEATURES;
    const f = ((await res.json()) as { features?: Partial<Features> }).features ?? {};
    return { sms_login: f.sms_login === true, sms_messages: f.sms_messages === true, whatsapp: f.whatsapp === true, wallets: f.wallets === true, saved_cards: f.saved_cards === true };
  } catch {
    return NO_FEATURES;
  }
});
