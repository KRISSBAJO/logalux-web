// Images uploaded in the admin console. A page asks for a whole slot in one
// call and picks out what it needs by ref (a category id or a slug).
import { api } from "./api";

export type Media = { id: string; ref: string; alt: string; caption?: string; caption_pos?: string };
export type MediaSlot = "hero" | "category" | "business" | "product";

/** Never throws: a page still renders, with its colour placeholders, if images cannot be loaded. */
export async function siteMedia(slot: MediaSlot, ref?: string): Promise<Media[]> {
  try {
    const q = new URLSearchParams({ slot, ...(ref ? { ref } : {}) });
    return (await api.get<{ media: Media[] }>(`/v1/site/media?${q}`)).media ?? [];
  } catch {
    return [];
  }
}

/** The first image for each ref, for list pages that show one picture per card. */
export function firstByRef(list: Media[]): Map<string, Media> {
  const map = new Map<string, Media>();
  for (const m of list) if (!map.has(m.ref)) map.set(m.ref, m);
  return map;
}

export const mediaUrl = (id: string) => `/media/${id}`;
