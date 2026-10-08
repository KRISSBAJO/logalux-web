import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { LogoMark } from "@/components/logo-mark";
import type { Pin } from "@/components/results-map";
import { SearchBar } from "@/components/search-bar";
import { SearchResults, type ResultCard } from "@/components/search-results";
import { api, duration, money, type Business } from "@/lib/api";
import { firstByRef, siteMedia } from "@/lib/media";

export const metadata = { title: "Find a professional" };

type Hours = Record<string, [string, string] | null>;
type Result = Business & { promoted?: boolean; timezone: string; hours: Hours | null; staff_count: number; lat: number | null; lng: number | null; services: { name: string; price_cents: number; duration_min: number }[] };
type ApiPin = { slug: string; name: string; rating: number; currency: string; lat: number; lng: number; from_cents: number | null };
type SP = { q?: string; where?: string; category?: string; market?: string; sort?: string; when?: string; page?: string };

const PER_PAGE = 20;
const CATEGORIES: [string, string][] = [["hair", "Hair"], ["braids", "Braids & locs"], ["barber", "Barber"], ["nails", "Nails"], ["lashes", "Lashes & brows"], ["skin", "Skin"], ["makeup", "Makeup"], ["spa", "Spa"]];
const SORTS: [string, string][] = [["", "Top rated"], ["reviews", "Most reviewed"], ["price", "Lowest price"]];
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_NAME: Record<string, string> = { sun: "Sunday", mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday" };

const clock = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
};

/** Whether the business is open right now, in its own time zone, and what happens next. */
function openState(hours: Hours | null, timeZone: string): { open: boolean; text: string } | null {
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

export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const market = sp.market === "NG" ? "NG" : "US";
  const q = (sp.q ?? "").trim(), where = (sp.where ?? "").trim(), category = sp.category ?? "";
  const sort = SORTS.some(([v]) => v === sp.sort) ? sp.sort! : "";
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);

  const params = new URLSearchParams({ market, limit: String(PER_PAGE), offset: String((page - 1) * PER_PAGE) });
  if (q) params.set("q", q);
  if (where) params.set("where", where);
  if (category) params.set("category", category);
  if (sort) params.set("sort", sort);

  let error = "";
  const [found, coverMedia] = await Promise.all([
    api.get<{ businesses: Result[]; total: number; pins: ApiPin[] }>(`/v1/businesses?${params}`).catch((e) => { error = (e as Error).message; return { businesses: [] as Result[], total: 0, pins: [] as ApiPin[] }; }),
    siteMedia("business"),
  ]);
  const cover = firstByRef(coverMedia);
  const total = found.total ?? found.businesses.length;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const cards: ResultCard[] = found.businesses.map((b) => {
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
  });
  const pins: Pin[] = (found.pins ?? []).map((p) => ({ slug: p.slug, name: p.name, rating: Number(p.rating), lat: p.lat, lng: p.lng, label: p.from_cents ? money(p.from_cents, p.currency) : p.name.slice(0, 1) }));

  const city = market === "NG" ? "Lagos" : "Nashville";
  const catName = CATEGORIES.find(([id]) => id === category)?.[1];
  const subject = q ? `“${q}”` : catName ?? "Beauty professionals";
  const place = where ? where.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : city;
  /** A link to this page with some filters changed. Changing a filter goes back to the first page. */
  const href = (change: Partial<SP>) => {
    const next = { q, where, category, market, sort, page: "", ...change } as Record<string, string | undefined>;
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v && !(k === "market" && v === "US") && !(k === "page" && v === "1")) p.set(k, v);
    const s = p.toString();
    return s ? `/search?${s}` : "/search";
  };
  const filtered = !!(q || where || category);
  const first = total === 0 ? 0 : (page - 1) * PER_PAGE + 1, last = Math.min(total, page * PER_PAGE);
  // Page numbers to show: the ends, and two either side of where you are.
  const numbers = [...new Set([1, 2, page - 2, page - 1, page, page + 1, page + 2, pages - 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);

  return (
    <>
      <div className="hero-glow pb-8 text-[#F4ECE3]">
        <SiteHeader active="book" transparent />
        <div className="container-x pt-4">
          <h1 className="serif mb-5 text-[32px] leading-[1.05] md:text-[44px]">{subject} <em className="text-gold-2">in {place}</em></h1>
          <div className="max-w-[680px]"><SearchBar initial={{ q, where, when: sp.when }} market={market} /></div>
        </div>
      </div>

      <div className="sticky top-0 z-30 border-b border-line bg-cream/90 backdrop-blur-md">
        <div className="container-x flex items-center gap-3 py-2.5">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Link href={href({ category: "" })} className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition ${!category ? "border-ink bg-ink text-cream" : "border-line bg-white hover:border-ink"}`}>All</Link>
            {CATEGORIES.map(([id, label]) => (
              <Link key={id} href={href({ category: category === id ? "" : id })} aria-current={category === id ? "true" : undefined} className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition ${category === id ? "border-ink bg-ink text-cream" : "border-line bg-white hover:border-ink"}`}>{label}</Link>
            ))}
          </div>
          <div className="hidden flex-none items-center gap-1 rounded-full bg-[#EFE5DA] p-1 xl:inline-flex" role="group" aria-label="Sort">
            {SORTS.map(([v, l]) => <Link key={v} href={href({ sort: v })} className={`whitespace-nowrap rounded-full px-3 py-1 text-[12.5px] font-semibold ${sort === v ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}>{l}</Link>)}
          </div>
          <div className="inline-flex flex-none rounded-full bg-[#EFE5DA] p-1" role="group" aria-label="City">
            {[["US", "Nashville"], ["NG", "Lagos"]].map(([m, l]) => <Link key={m} href={href({ market: m, where: "" })} className={`rounded-full px-3 py-1 text-[12.5px] font-semibold ${market === m ? "bg-ink text-cream" : "text-muted hover:text-ink"}`}>{l}</Link>)}
          </div>
        </div>
      </div>

      <main className="container-x py-6 pb-24">
        {error && <div role="alert" className="card mb-6 p-6 text-bad">We could not load results just now. Try again in a moment.</div>}

        {cards.length > 0 && (
          <>
            <p className="mb-4 text-[13.5px] text-muted">
              <b className="text-ink">{total.toLocaleString("en-US")}</b> verified {total === 1 ? "professional" : "professionals"}{pages > 1 ? ` · showing ${first} to ${last}` : ""}
              {filtered && <> · <Link href={href({ q: "", where: "", category: "" })} className="font-semibold text-wine">Clear filters</Link></>}
            </p>
            <SearchResults cards={cards} pins={pins} q={q} />
          </>
        )}

        {pages > 1 && cards.length > 0 && (
          <nav aria-label="Pages of results" className="mt-8 flex flex-wrap items-center gap-1.5 lg:max-w-[52%]">
            {page > 1 && <Link href={href({ page: String(page - 1) })} rel="prev" className="rounded-full border border-line bg-white px-4 py-2 text-[13.5px] font-semibold hover:border-ink">Previous</Link>}
            {numbers.map((n, i) => (
              <span key={n} className="flex items-center gap-1.5">
                {i > 0 && n - numbers[i - 1] > 1 && <span className="px-1 text-muted-2">…</span>}
                <Link href={href({ page: String(n) })} aria-current={n === page ? "page" : undefined} className={`flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-[13.5px] font-semibold ${n === page ? "bg-ink text-cream" : "border border-line bg-white hover:border-ink"}`}>{n}</Link>
              </span>
            ))}
            {page < pages && <Link href={href({ page: String(page + 1) })} rel="next" className="rounded-full border border-line bg-white px-4 py-2 text-[13.5px] font-semibold hover:border-ink">Next</Link>}
          </nav>
        )}

        {!error && cards.length === 0 && (
          <div className="card mx-auto mt-6 max-w-[560px] rounded-[26px] p-10 text-center">
            <LogoMark className="mx-auto h-12 w-auto text-gold" />
            <h2 className="serif mt-5 text-[30px] leading-tight">{page > 1 && total > 0 ? "No more results" : "Nothing matched that yet"}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">{page > 1 && total > 0 ? "You have gone past the last page." : `We are growing in ${city} every week. Try a wider search, or tell us who you would like to see here.`}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              {page > 1 && total > 0 ? <Link href={href({ page: "" })} className="btn btn-ink">Back to the first page</Link> : (
                <>
                  {filtered && <Link href={href({ q: "", where: "", category: "" })} className="btn btn-ink">Show everyone in {city}</Link>}
                  <Link href="/help" className="btn btn-out">Suggest a professional</Link>
                </>
              )}
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
