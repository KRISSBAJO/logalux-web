import type { MetadataRoute } from "next";
import { CATEGORY_PAGES, CITIES } from "@/lib/categories";
import { allListings } from "@/lib/listings";
import { absoluteUrl, isTestEntry } from "@/lib/site";

// Built from the live API and kept for an hour, so a crawler does not make the API list every business on each visit.
export const revalidate = 3600;

const BASE = process.env.LOGALUXE_API_URL ?? "http://127.0.0.1:18080";
const LEGAL = ["terms", "privacy", "cancellation", "accessibility"];
type Entry = MetadataRoute.Sitemap[number];

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, { next: { revalidate } });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Legal pages the API really has, with the day each was last changed. */
async function legalPages(): Promise<Entry[]> {
  const pages = await Promise.all(LEGAL.map((slug) => getJson<{ page?: { slug: string; updated_at?: string } }>(`/v1/pages/${slug}`)));
  return pages.flatMap((p) => {
    if (!p?.page?.slug) return [];
    const changed = p.page.updated_at ? new Date(p.page.updated_at) : null;
    return [{ url: absoluteUrl(`/legal/${p.page.slug}`), lastModified: changed && !Number.isNaN(changed.getTime()) ? changed : undefined, changeFrequency: "yearly" as const, priority: 0.2 }];
  });
}

/** Every business that is listed, and every city page that has at least one. */
async function businessPages(): Promise<Entry[]> {
  const out: Entry[] = [];
  for (const city of CITIES) {
    let list;
    try {
      list = (await allListings({ market: city.market, maxPages: 200, revalidate })).businesses;
    } catch {
      continue;
    }
    if (!list.length) continue;
    out.push({ url: absoluteUrl(`/${city.slug}`), changeFrequency: "daily", priority: 0.8 });
    for (const c of CATEGORY_PAGES) {
      if (list.some((b) => b.category === c.id)) out.push({ url: absoluteUrl(`/${city.slug}/${c.slug}`), changeFrequency: "daily", priority: 0.8 });
    }
    for (const b of list) out.push({ url: absoluteUrl(`/b/${encodeURIComponent(b.slug)}`), changeFrequency: "weekly", priority: 0.7 });
  }
  return out;
}

/** Every product on sale in the shop. */
async function productPages(): Promise<Entry[]> {
  const out: Entry[] = [];
  for (let page = 1; page <= 200; page++) {
    const data = await getJson<{ products?: { slug: string; name: string }[]; total?: number; per_page?: number }>(`/v1/products?per=60&page=${page}`);
    const list = data?.products ?? [];
    for (const p of list) if (!isTestEntry(p.name, p.slug)) out.push({ url: absoluteUrl(`/shop/${encodeURIComponent(p.slug)}`), changeFrequency: "weekly", priority: 0.6 });
    if (!data || list.length === 0 || page * (data.per_page ?? 60) >= (data.total ?? 0)) break;
  }
  return out;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixed: Entry[] = [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/search"), changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/shop"), changeFrequency: "daily", priority: 0.8 },
  ];
  // Each part answers with what it could read. With the API down that is nothing, and the fixed pages still go out.
  const [legal, businesses, products] = await Promise.all([legalPages().catch(() => []), businessPages().catch(() => []), productPages().catch(() => [])]);
  return [...fixed, ...legal, ...businesses, ...products];
}
