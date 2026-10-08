"use server";

import { customerApi, getCustomer } from "@/lib/customer";

/** A signed-in client saves a business, or takes it off their saved list. */
export async function setSaved(slug: string, save: boolean): Promise<{ saved: boolean; error?: string; signedOut?: boolean }> {
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(slug)) return { saved: !save, error: "We could not find that business." };
  if (!(await getCustomer())) return { saved: false, signedOut: true };
  try {
    const r = await customerApi<{ saved?: boolean }>(`/auth/favourites/${encodeURIComponent(slug)}`, { method: save ? "PUT" : "DELETE" });
    return { saved: !!r.saved };
  } catch (e) {
    return { saved: !save, error: (e as Error).message };
  }
}
