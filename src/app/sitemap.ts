import type { MetadataRoute } from "next";
import { CATEGORY_PAGES } from "@/lib/categories";
import type { Place } from "@/lib/place";
import { allListings } from "@/lib/listings";
import { isTestArticle, journalCategory, journalList } from "@/lib/journal";
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

/** A page for every place that has businesses, and for each kind of service found there. The places come from the API. */
async function placePages(): Promise<Entry[]> {
  const data = await getJson<{ places?: Place[]; countries?: { code: string; name: string; businesses: number }[] }>("/v1/places");
  const places = data?.places ?? [];
  if (!places.length) return [];
  const out: Entry[] = [{ url: absoluteUrl("/places"), changeFrequency: "daily", priority: 0.8 }];
  for (const c of data?.countries ?? []) if (c.businesses > 0) out.push({ url: absoluteUrl(`/${c.name.toLowerCase().replace(/[^a-z]+/g, "-")}`), changeFrequency: "daily", priority: 0.7 });
  for (const p of places) {
    out.push({ url: absoluteUrl(`/${p.slug}`), changeFrequency: "daily", priority: 0.8 });
    for (const c of CATEGORY_PAGES) if ((p.categories?.[c.id] ?? 0) > 0) out.push({ url: absoluteUrl(`/${p.slug}/${c.slug}`), changeFrequency: "daily", priority: 0.8 });
  }
  return out;
}

/** Every business that is listed, wherever it is. */
async function businessPages(): Promise<Entry[]> {
  const list = (await allListings({ maxPages: 400, revalidate })).businesses;
  return list.map((b) => ({ url: absoluteUrl(`/b/${encodeURIComponent(b.slug)}`), changeFrequency: "weekly" as const, priority: 0.7 }));
}

/** The Journal: its front, a page for each kind of article that has one, and every published article. */
async function journalPages(): Promise<Entry[]> {
  const list = await journalList({ limit: 500, quiet: true }, revalidate);
  if (!list) return [];
  const out: Entry[] = [{ url: absoluteUrl("/journal"), changeFrequency: "daily", priority: 0.8 }];
  for (const c of list.categories) if (c.count > 0 && journalCategory(c.key)) out.push({ url: absoluteUrl(`/journal/category/${c.key}`), changeFrequency: "weekly", priority: 0.6 });
  for (const a of list.articles) {
    if (isTestArticle(a)) continue;
    const at = a.published_at ? new Date(a.published_at) : null;
    out.push({ url: absoluteUrl(`/journal/${encodeURIComponent(a.slug)}`), lastModified: at && !Number.isNaN(at.getTime()) ? at : undefined, changeFrequency: "monthly", priority: 0.7 });
  }
  return out;
}

/** Every product on sale in one of the two shops: the dollar shop, or the naira shop. */
async function productPages(currency: "USD" | "NGN"): Promise<Entry[]> {
  const out: Entry[] = [];
  for (let page = 1; page <= 200; page++) {
    const data = await getJson<{ products?: { slug: string; name: string }[]; total?: number; per_page?: number }>(`/v1/products?per=60&page=${page}${currency === "NGN" ? "&currency=NGN" : ""}`);
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
  ];
  // Each part answers with what it could read. With the API down that is nothing, and the fixed pages still go out.
  const [legal, places, businesses, products, naira, journal] = await Promise.all([legalPages().catch(() => []), placePages().catch(() => []), businessPages().catch(() => []), productPages("USD").catch(() => []), productPages("NGN").catch(() => []), journalPages().catch(() => [])]);
  // Each country's shop has its own address, and is listed only when it sells something.
  const shops: Entry[] = [
    ...(products.length ? [{ url: absoluteUrl("/shop?country=us"), changeFrequency: "daily" as const, priority: 0.8 }] : []),
    ...(naira.length ? [{ url: absoluteUrl("/shop?country=ng"), changeFrequency: "daily" as const, priority: 0.8 }] : []),
  ];
  return [...fixed, ...shops, ...legal, ...places, ...businesses, ...products, ...naira, ...journal];
}
