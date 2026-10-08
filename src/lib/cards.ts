// Server only. The cards a signed-in customer kept, and what a paying screen may offer.
import { cache } from "react";
import type { PayFeatures, SavedCard } from "@/components/pay-bits";
import { customerApi, userToken } from "./customer";
import { getFeatures } from "./features";

/** `enabled` is false while saved cards are switched off: then nothing about them is shown. `failed` means the list could not be read. */
export const myCards = cache(async (): Promise<{ enabled: boolean; cards: SavedCard[]; failed: boolean }> => {
  if (!(await userToken()) || !(await getFeatures()).saved_cards) return { enabled: false, cards: [], failed: false };
  try {
    const out = await customerApi<{ enabled?: boolean; cards?: SavedCard[] | null }>("/auth/cards");
    return { enabled: out.enabled === true, cards: out.enabled === true ? out.cards ?? [] : [], failed: false };
  } catch {
    return { enabled: true, cards: [], failed: true };
  }
});

/** What a paying screen is told. `signedIn` decides whether kept cards are offered at all. */
export async function payFeatures(signedIn: boolean): Promise<PayFeatures> {
  const features = await getFeatures();
  const mine = signedIn ? await myCards() : { enabled: false, cards: [] };
  return { saved: signedIn && mine.enabled, wallets: features.wallets, cards: mine.cards };
}

/** Only a signed-in customer, with saved cards switched on, may send the two card fields. Otherwise they are dropped. */
export async function cardFields<T extends Record<string, unknown>>(body: T): Promise<T> {
  const out = { ...body } as Record<string, unknown>;
  const allowed = !!(await userToken()) && (await getFeatures()).saved_cards;
  const id = typeof out.card_id === "string" ? out.card_id.trim() : "";
  delete out.card_id;
  const keep = out.save_card === true;
  delete out.save_card;
  if (allowed && id) out.card_id = id;
  else if (allowed && keep) out.save_card = true;
  return out as T;
}
