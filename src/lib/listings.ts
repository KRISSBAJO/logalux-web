// Businesses as GET /v1/businesses lists them, and how one becomes a result
// card. Search and the city pages share this so a card reads the same on both.
import type { Pin } from "@/components/results-map";
import type { ResultCard } from "@/components/search-results";
import { duration, money, type Business } from "@/lib/api";
import type { Media } from "@/lib/media";
import { isTestEntry } from "@/lib/site";

export type Hours = Record<string, [string, string] | null>;
export type Listing = Business & { promoted?: boolean; timezone: string; hours: Hours | null; staff_count: number; lat: number | null; lng: number | null; services: { name: string; price_cents: number; duration_min: number }[] };
export type ApiPin = { slug: string; name: string; rating: number; currency: string; lat: number; lng: number; from_cents: number | null };

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_NAME: Record<string, string> = { sun: "Sunday", mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday" };

const clock = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
};

/** Whether the business is open right now, in its own time zone, and what happens next. */
export function openState(hours: Hours | null, timeZone: string): { open: boolean; text: string } | null {
  if (!hours) return null;
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  } catch {
    return null;
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const today = get("weekday").toLowerCase().slice(0, 3);
  const now = `${get("hour")}:${get("minute")}`;
  const h = hours[today];
  if (h && now >= h[0] && now < h[1]) return { open: true, text: `Open until ${clock(h[1])}` };
  if (h && now < h[0]) return { open: false, text: `Opens ${clock(h[0])}` };
  const start = DAYS.indexOf(today);
  for (let i = 1; i <= 7; i++) {
    const d = DAYS[(start + i) % 7];
    if (hours[d]) return { open: false, text: `Opens ${i === 1 ? "tomorrow" : DAY_NAME[d]} ${clock(hours[d]![0])}` };
  }
  return { open: false, text: "Closed this week" };
}

/** One business as a result card. `cover` is the first uploaded photo of each business, by slug. */
export function toCard(b: Listing, cover: Map<string, Media>): ResultCard {
  const state = openState(b.hours, b.timezone);
  const img = cover.get(b.slug);
  return {
    slug: b.slug, name: b.name, tagline: b.tagline, tone: b.tone, rating: Number(b.rating), reviews: b.review_count, verified: b.verification_status === "verified", promoted: !!b.promoted,
    area: [b.area, b.city && b.city !== b.area ? b.city : ""].filter(Boolean).join(", "),
    open: state ? state.open : null, openText: state?.text ?? "",
    from: b.from_cents ? money(b.from_cents, b.currency) : "",
    team: b.staff_count > 1 ? `${b.staff_count} professionals` : "Independent",
    coverId: img?.id, coverAlt: img?.alt, timezone: b.timezone,
    services: (b.services ?? []).slice(0, 2).map((s) => ({ name: s.name, length: duration(s.duration_min), price: money(s.price_cents, b.currency) })),
  };
}

export const toPin = (p: ApiPin): Pin => ({ slug: p.slug, name: p.name, rating: Number(p.rating), lat: p.lat, lng: p.lng, label: p.from_cents ? money(p.from_cents, p.currency) : p.name.slice(0, 1) });

const BASE = process.env.LOGALUXE_API_URL ?? "http://127.0.0.1:18080";
const PAGE_SIZE = 60; // the most the API gives in one answer

export type Listings = { businesses: Listing[]; total: number; complete: boolean };

/**
 * Every listed business of a city, or of one category in it, without leftover
 * test data. The API pages its answer, so this reads page after page up to
 * `maxPages`. `total` is exact when `complete` is true. It throws when the API
 * cannot be reached.
 */
export async function allListings({ market, category = "", maxPages = 5, revalidate }: { market: string; category?: string; maxPages?: number; revalidate?: number }): Promise<Listings> {
  const out: Listing[] = [];
  let apiTotal = 0, read = 0;
  for (let page = 0; page < maxPages; page++) {
    const q = new URLSearchParams({ market, limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
    if (category) q.set("category", category);
    if (revalidate !== undefined) q.set("quiet", "1"); // a cached read for the sitemap is not a person looking at the list
    const res = await fetch(`${BASE}/v1/businesses?${q}`, revalidate === undefined ? { cache: "no-store" } : { next: { revalidate } });
    if (!res.ok) throw new Error(`businesses answered ${res.status}`);
    const body = (await res.json()) as { businesses?: Listing[]; total?: number };
    const list = body.businesses ?? [];
    apiTotal = body.total ?? apiTotal;
    read += list.length;
    out.push(...list.filter((b) => !isTestEntry(b.name, b.slug)));
    if (list.length < PAGE_SIZE || read >= apiTotal) break;
  }
  const complete = read >= apiTotal;
  // When there was more than could be read, what was not read is counted as it stands.
  return { businesses: out, total: complete ? out.length : apiTotal - (read - out.length), complete };
}

/** The lowest and highest starting price among some businesses, as text, or "" when none has a price. */
export function priceSpan(list: Listing[]): { low: string; high: string } | null {
  const priced = list.filter((b) => typeof b.from_cents === "number" && b.from_cents > 0);
  if (!priced.length) return null;
  const currency = priced[0].currency;
  const cents = priced.filter((b) => b.currency === currency).map((b) => b.from_cents as number);
  return { low: money(Math.min(...cents), currency), high: money(Math.max(...cents), currency) };
}
