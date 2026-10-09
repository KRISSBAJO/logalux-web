// The Journal as the API describes it, and how the web reads it. Public reads
// go through GET /v1/journal; the admin console has its own calls in
// app/admin/journal/actions.ts. Nothing here throws on a network fault: a
// page gets null and shows that the Journal could not be loaded.
import type { Found } from "./listings";
import { isTestEntry } from "./site";

const BASE = process.env.LOGALUXE_API_URL ?? "http://127.0.0.1:18080";

/**
 * A short-lived copy of the staff token, set by the console's Preview button
 * and sent only to /journal, so a draft can be read on its public page.
 */
export const PREVIEW_COOKIE = "lx_journal_preview";

export type JournalCategory = { key: string; label: string; phrase: string; service: boolean; cta: string };

/** The kinds of article, in the order they are offered. `service` ones have professionals to book at the end. */
export const JOURNAL_CATEGORIES: JournalCategory[] = [
  // The labels are the API's own (category_label); these stand in when a page has no answer from it.
  { key: "hair", label: "Hair", phrase: "hair", service: true, cta: "Find a hair stylist near you" },
  { key: "braids", label: "Braids", phrase: "braids and locs", service: true, cta: "Find a braider near you" },
  { key: "barber", label: "Barber", phrase: "barbering", service: true, cta: "Find a barber near you" },
  { key: "nails", label: "Nails", phrase: "nails", service: true, cta: "Find a nail technician near you" },
  { key: "lashes", label: "Lashes and brows", phrase: "lashes and brows", service: true, cta: "Find a lash technician near you" },
  { key: "skin", label: "Skin", phrase: "skin care", service: true, cta: "Find a skin specialist near you" },
  { key: "makeup", label: "Makeup", phrase: "makeup", service: true, cta: "Find a makeup artist near you" },
  { key: "spa", label: "Spa", phrase: "spa and massage", service: true, cta: "Find a spa near you" },
  { key: "business", label: "For professionals", phrase: "running a beauty business", service: false, cta: "List your business on LogaLuxe" },
  { key: "guide", label: "Using LogaLuxe", phrase: "using LogaLuxe", service: false, cta: "Book your next visit" },
];
export const journalCategory = (key: string) => JOURNAL_CATEGORIES.find((c) => c.key === key);
export const journalCategoryLabel = (key: string) => journalCategory(key)?.label ?? (key ? key.charAt(0).toUpperCase() + key.slice(1) : "");

/** The two countries, and "both". */
export const JOURNAL_COUNTRIES: [string, string][] = [["", "Both countries"], ["US", "United States"], ["NG", "Nigeria"]];
export const ARTICLE_STATUSES = ["draft", "scheduled", "published", "archived"] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

/** One article as the public list gives it. */
export type Article = {
  id: string; slug: string; title: string; dek: string; category: string; category_label?: string; tags: string[];
  author_name: string; author_role: string; author_media_id: string | null; cover_media_id: string | null; cover_alt: string;
  country: string; featured: boolean; reading_minutes: number; view_count: number; published_at: string | null;
};
/** The article in full, as the read endpoint and the admin give it. */
export type ArticleFull = Article & {
  body_md: string; seo_title: string; seo_description: string; related_category: string | null; cta_text: string;
  status?: ArticleStatus; sort?: number; created_by?: string; created_at?: string; updated_at?: string;
};
export type CategoryCount = { key: string; label: string; count: number };
export type JournalList = { articles: Article[]; total: number; categories: CategoryCount[] };
export type JournalHome = { featured: Article | null; latest: Article[]; count: number };
export type ArticleRead = { article: ArticleFull; related: Article[]; next: Article | null };

async function getJson<T>(path: string, init: RequestInit & { revalidate?: number } = {}): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
  try {
    const { revalidate, ...rest } = init;
    const res = await fetch(`${BASE}${path}`, { ...rest, ...(revalidate === undefined ? { cache: "no-store" } : { next: { revalidate } }) });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, status: 0 };
  }
}

export type ListParams = { category?: string; country?: string; q?: string; tag?: string; limit?: number; offset?: number; featured?: boolean; quiet?: boolean };

export function listQuery(p: ListParams): string {
  const q = new URLSearchParams();
  if (p.category) q.set("category", p.category);
  if (p.country) q.set("country", p.country);
  if (p.q) q.set("q", p.q);
  if (p.tag) q.set("tag", p.tag);
  if (p.limit) q.set("limit", String(p.limit));
  if (p.offset) q.set("offset", String(p.offset));
  if (p.featured) q.set("featured", "1");
  if (p.quiet) q.set("quiet", "1");
  return q.toString();
}

/** Published articles. Null when the API cannot be reached or has no Journal yet. */
export async function journalList(p: ListParams, revalidate?: number): Promise<JournalList | null> {
  const r = await getJson<Partial<JournalList>>(`/v1/journal?${listQuery(p)}`, { revalidate });
  if (!r.ok) return null;
  return { articles: r.data.articles ?? [], total: r.data.total ?? (r.data.articles ?? []).length, categories: r.data.categories ?? [] };
}

/** What the home screens show: the featured piece and the three latest, in one call. */
export async function journalHome(country: string): Promise<JournalHome | null> {
  const r = await getJson<Partial<JournalHome>>(`/v1/journal/home${country ? `?country=${country}` : ""}`);
  if (!r.ok) return null;
  return { featured: r.data.featured ?? null, latest: r.data.latest ?? [], count: r.data.count ?? 0 };
}

/**
 * One article to read. `token` is a staff token for a draft preview; `quiet` stops the read being counted.
 * `status` 404 means there is no such article (or it is not published and no staff token was sent).
 */
export async function journalArticle(slug: string, opt: { token?: string; quiet?: boolean } = {}): Promise<{ ok: true; data: ArticleRead } | { ok: false; status: number }> {
  if (!/^[a-z0-9][a-z0-9-]{0,119}$/i.test(slug)) return { ok: false, status: 404 };
  const r = await getJson<ArticleRead>(`/v1/journal/${encodeURIComponent(slug)}${opt.quiet ? "?quiet=1" : ""}`, opt.token ? { headers: { Authorization: `Bearer ${opt.token}` } } : {});
  if (!r.ok) return r;
  if (!r.data.article) return { ok: false, status: 404 };
  return { ok: true, data: { article: r.data.article, related: r.data.related ?? [], next: r.data.next ?? null } };
}

/** The neighbours of an article by date: the newer one and the older one. Read from the list, kept for a minute. */
export async function journalNeighbours(slug: string, country: string): Promise<{ newer: Article | null; older: Article | null }> {
  const list = await journalList({ country, limit: 200, quiet: true }, 60);
  if (!list) return { newer: null, older: null };
  const byDate = [...list.articles].sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
  const i = byDate.findIndex((a) => a.slug === slug);
  if (i < 0) return { newer: null, older: null };
  return { newer: byDate[i - 1] ?? null, older: byDate[i + 1] ?? null };
}

/** The four professionals to book under an article: the same answer shape as GET /v1/businesses. */
export async function journalProfessionals(slug: string, p: { lat?: number; lng?: number; place?: string; scope?: string; /** A staff token, so a draft's preview shows its professionals too. */ token?: string }): Promise<Found | null> {
  const q = new URLSearchParams();
  if (p.lat !== undefined && p.lng !== undefined) { q.set("lat", String(p.lat)); q.set("lng", String(p.lng)); }
  if (p.place) q.set("place", p.place);
  if (p.scope) q.set("scope", p.scope);
  const r = await getJson<Found>(`/v1/journal/${encodeURIComponent(slug)}/professionals?${q}`, p.token ? { headers: { Authorization: `Bearer ${p.token}` } } : {});
  return r.ok ? { businesses: r.data.businesses ?? [], total: r.data.total ?? 0, pins: r.data.pins ?? [], geo: r.data.geo } : null;
}

// ---- words ----

/** "8 Oct 2026". The day it was published, the same wherever the server runs. */
export const articleDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }) : "";

/** "4 min read". */
export const readingLabel = (min: number) => `${Math.max(1, min || 1)} min read`;

/** "312 reads", or "" before anyone has read it. The count is the API's own. */
export const readsLabel = (n: number) => (n > 0 ? `${n.toLocaleString("en-US")} ${n === 1 ? "read" : "reads"}` : "");

/** Leftover test articles never reach a search engine. */
export const isTestArticle = (a: Pick<Article, "title" | "slug">) => isTestEntry(a.title, a.slug);

/** The article's own description for search engines: its SEO field, else its dek. */
export const articleDescription = (a: Pick<ArticleFull, "dek" | "seo_description">) => (a.seo_description || a.dek || "").trim();
