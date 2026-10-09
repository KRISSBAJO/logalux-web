// Server only. What LogaLuxe staff have switched on in the console. A feature is offered only
// while the API says it is live; when the API cannot be reached, nothing extra is offered.
import { cache } from "react";
import { api } from "./api";

export type Features = {
  sms_login: boolean; sms_messages: boolean; whatsapp: boolean; wallets: boolean; saved_cards: boolean;
  /** Where a text can really be sent: texts need a sender in that country as well as the switch. */
  texts_in: { US: boolean; NG: boolean };
};
export const NO_FEATURES: Features = { sms_login: false, sms_messages: false, whatsapp: false, wallets: false, saved_cards: false, texts_in: { US: false, NG: false } };

/** Kept for ten seconds, so a switch in the console shows within moments and a busy page does not ask on every request. */
export const getFeatures = cache(async (): Promise<Features> => {
  try {
    const out = await api.get<{ features?: Partial<Features>; texts_in?: Partial<Features["texts_in"]> }>("/v1/features", { revalidate: 10 });
    const f = out.features ?? {};
    return {
      sms_login: f.sms_login === true, sms_messages: f.sms_messages === true, whatsapp: f.whatsapp === true, wallets: f.wallets === true, saved_cards: f.saved_cards === true,
      texts_in: { US: out.texts_in?.US === true, NG: out.texts_in?.NG === true },
    };
  } catch {
    return NO_FEATURES;
  }
});
