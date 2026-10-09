import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { LogoMark } from "@/components/logo-mark";
import { PlacePicker } from "@/components/place-picker";
import type { Area, Pin } from "@/components/results-map";
import { SearchBar } from "@/components/search-bar";
import { SearchResults, type ResultCard } from "@/components/search-results";
import type { Metadata } from "next";
import { api } from "@/lib/api";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
import { toCard, toPin, type Found, type GeoInfo, type Listing } from "@/lib/listings";
import { firstByRef, siteMedia } from "@/lib/media";
import { inCountry, people, shortName, whereLine, type Place } from "@/lib/place";
import { getPlace, pickerWhere, whereAmI } from "@/lib/places";

type SP = { q?: string; category?: string; sort?: string; when?: string; page?: string; place?: string; bbox?: string; market?: string; where?: string };

const PER_PAGE = 20;

/** The box of a "search this area", when the address carries a sound one. */
function areaOf(raw: string | undefined): Area | null {
  const n = (raw ?? "").split(",").map((x) => Number(x));
  if (n.length !== 4 || n.some((x) => !Number.isFinite(x)) || n[0] >= n[2] || n[1] >= n[3] || Math.abs(n[0]) > 90 || Math.abs(n[2]) > 90 || Math.abs(n[1]) > 180 || Math.abs(n[3]) > 180) return null;
  return n as Area;
}

/**
 * What is being searched: the place named in the address if there is one
 * (a link someone shared, or a place page's "search with filters"), else the
 * place the visitor is looking in. Only the country being browsed is shown.
 */
async function target(sp: SP) {
  const me = await whereAmI();
  // ?market=NG is the older way to say "all of Nigeria".
  const slug = (sp.place ?? "").trim().toLowerCase() || (sp.market === "NG" ? "nigeria" : sp.market === "US" ? "united-states" : "");
  if (slug) {
    const found = await getPlace(slug);
    if (found) return { place: found.place, canonical: found.canonical, named: true, device: false, me, scope: found.place.country };
  }
  return { place: me.place, canonical: "", named: false, device: me.source === "device", me, scope: me.scope };
}

/** "in Nashville, TN", "near you", "in Tennessee", "across Nigeria", "in this part of the map". */
function whereWords(place: Place | null, device: boolean, area: boolean) {
  if (area) return "in this part of the map";
  if (!place) return "";
  if (device) return `near ${shortName(place)}`;
  if (place.kind === "country") return `across ${inCountry(place.country)}`;
  return `in ${place.label}`;
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const one = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const q = one(sp.q), category = one(sp.category);
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const t = await target(sp);
  const area = !!areaOf(sp.bbox);
  const catName = categoryLabel(category);
  const words = whereWords(t.place, t.device, area);
  const subject = q ? `"${q}"` : catName ?? "Beauty professionals";
  const title = `${subject}${words ? ` ${words}` : ""}${page > 1 ? ` · page ${page}` : ""}`;
  const description = q
    ? `Professionals ${words} matching "${q}" on LogaLuxe. See prices and the next free times, and book online.`
    : `${catName ? `${catName} professionals` : "Beauty professionals"} ${words} on LogaLuxe. See prices, reviews from real visits and the next free times, and book online.`;
  // The lists worth finding have pages of their own (/nashville-tn, /nashville-tn/braids). Search itself has one address
  // for search engines; what it shows depends on who is looking, so everything narrower stays out of them.
  const plain = !q && !category && page === 1 && !sp.place && !sp.bbox && !sp.market && !sp.where && !sp.sort && !sp.when;
  return {
    title,
    description,
    alternates: plain ? { canonical: "/search" } : undefined,
    robots: plain ? undefined : { index: false, follow: true },
    openGraph: { title, description, url: "/search", siteName: "LogaLuxe", type: "website" },
    twitter: { card: "summary", title, description },
  };
}

/** The "When" of the search bar: a window the results are sorted by. Anything else means any time. */
const WHENS = ["today", "tomorrow", "weekend"] as const;
type When = (typeof WHENS)[number];

export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim(), category = sp.category ?? "";
  const when: When | "" = (WHENS as readonly string[]).includes(sp.when ?? "") ? (sp.when as When) : "";
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const area = areaOf(sp.bbox);
  const [t, picker] = await Promise.all([target(sp), pickerWhere()]);
  const { place, device, me, scope } = t;
  // An old address for a place goes to its new one: /search?place=nashville is /search?place=nashville-tn.
  if (t.canonical && sp.place && t.canonical !== sp.place) {
    const p = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string" && v) as [string, string][]);
    p.set("place", t.canonical);
    redirect(`/search?${p}`);
  }

  // A point to measure from: the device's position, or the middle of the city being looked in.
  const point = !area && place && (device || place.kind === "city" || place.kind === "point") && (place.lat !== 0 || place.lng !== 0) ? { lat: place.lat, lng: place.lng } : null;
  // With a point the list can be nearest first. From a device that is the natural order; from the middle of a city, rating is.
  const SORTS: [string, string][] = [...(point ? ([device ? ["", "Nearest"] : ["distance", "Nearest"]] as [string, string][]) : []), [device ? "top" : "", "Top rated"], ["reviews", "Most reviewed"], ["price", "Lowest price"]];
  const sort = SORTS.some(([v]) => v === sp.sort) ? sp.sort! : "";

  const params = new URLSearchParams({ limit: String(PER_PAGE), offset: String((page - 1) * PER_PAGE) });
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  if (scope) params.set("scope", scope); // someone in the United States is not shown a barber in Nigeria unless they ask
  if (area) params.set("bbox", area.join(","));
  else if (point) { params.set("lat", String(point.lat)); params.set("lng", String(point.lng)); }
  else if (place?.slug) params.set("place", place.slug);
  if (device && area && place) { params.set("lat", String(place.lat)); params.set("lng", String(place.lng)); } // distances still, inside the box
  const apiSort = sort || (point && !device ? "top" : "");
  if (apiSort) params.set("sort", apiSort);

  let error = "";
  const [found, coverMedia] = await Promise.all([
    api.get<Found>(`/v1/businesses?${params}`).catch((e) => { error = (e as Error).message; return { businesses: [] as Listing[], total: 0, pins: [] } as Found; }),
    siteMedia("business"),
  ]);
  const geo: GeoInfo | undefined = found.geo;
  const cover = firstByRef(coverMedia);
  const total = found.total ?? found.businesses.length;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  // A distance from the visitor reads "2.3 mi away". One from the middle of a city only matters when the search had to look further out.
  const from = device ? "" : place ? shortName(place) : "";
  const showDistance = device || !!geo?.widened;
  const cards: ResultCard[] = found.businesses.map((b) => toCard(showDistance ? b : { ...b, distance_text: "" }, cover, from));
  const pins: Pin[] = (found.pins ?? []).map(toPin);

  const catName = categoryLabel(category);
  const subject = q ? `“${q}”` : catName ?? "Beauty professionals";
  const words = whereWords(place, device, !!area);
  /** A link to this page with some filters changed. Changing a filter goes back to the first page. */
  const href = (change: Partial<SP>) => {
    const next = { q, category, sort, place: t.named ? place?.slug ?? "" : "", bbox: sp.bbox ?? "", when, page: "", ...change } as Record<string, string | undefined>;
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v && !(k === "page" && v === "1")) p.set(k, v);
    const s = p.toString();
    return s ? `/search?${s}` : "/search";
  };
  const filtered = !!(q || category);
  const first = total === 0 ? 0 : (page - 1) * PER_PAGE + 1, last = Math.min(total, page * PER_PAGE);
  // Page numbers to show: the ends, and two either side of where you are.
  const numbers = [...new Set([1, 2, page - 2, page - 1, page, page + 1, page + 2, pages - 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const nearby = (geo?.nearest_places ?? []).filter((p) => p.slug !== place?.slug);
  const centre = place && (place.lat !== 0 || place.lng !== 0) ? { lat: place.lat, lng: place.lng } : undefined;
  const pastEnd = page > 1 && total > 0;
  // A named place in another country than the visitor's own: they are looking abroad for this page.
  const abroadHere = t.named && !!me.home && !!scope && scope !== me.home && !me.abroad;

  return (
    <>
      <div className="hero-glow pb-8 text-[#F4ECE3]">
        <SiteHeader active="book" transparent />
        <div className="container-x pt-4">
          <h1 className="serif mb-3 text-[32px] leading-[1.05] md:text-[44px]">{subject} {words && <em className="text-gold-2">{words}</em>}</h1>
          {/* A guess is said to be a guess, with the way to change it beside it. */}
          {!t.named && !area && place && (
            <div className="mb-4 flex flex-wrap items-center gap-x-2 text-[14.5px] text-[#C9BCB0] [&>div>button]:!text-gold-2">
              <span>{me.elsewhere ? `We do not serve ${me.elsewhere} yet. Showing ${place.label}` : whereLine(picker, place.kind, place.country)}</span>
              <span aria-hidden>·</span>
              <PlacePicker look="change" where={picker} />
            </div>
          )}
          {abroadHere && <p className="mb-4 text-[14.5px] text-[#C9BCB0]">You are looking in {inCountry(scope)}. Prices there are in {scope === "NG" ? "naira" : "US dollars"}. <Link href={href({ place: "" })} className="font-semibold text-gold-2 underline underline-offset-2">Back to {inCountry(me.home)}</Link></p>}
          <div className="max-w-[680px]"><SearchBar initial={{ q, when }} where={t.named && place ? { ...picker, label: place.label, source: "chosen" } : picker} keep={{ category, sort }} /></div>
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
            {SORTS.map(([v, l]) => <Link key={l} href={href({ sort: v })} className={`whitespace-nowrap rounded-full px-3 py-1 text-[12.5px] font-semibold ${sort === v ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}>{l}</Link>)}
          </div>
          {/* On narrower screens the same choices sit in a small menu. */}
          <details className="relative flex-none xl:hidden">
            <summary className="cursor-pointer list-none whitespace-nowrap rounded-full bg-[#EFE5DA] px-3.5 py-2 text-[12.5px] font-semibold text-ink hover:bg-[#E6DCD2] [&::-webkit-details-marker]:hidden">Sort: {SORTS.find(([v]) => v === sort)?.[1] ?? SORTS[0][1]}</summary>
            <nav aria-label="Sort" className="absolute right-0 top-full z-40 mt-2 flex w-44 flex-col rounded-2xl border border-line bg-white p-1.5 shadow-xl">
              {SORTS.map(([v, l]) => <Link key={l} href={href({ sort: v })} aria-current={sort === v ? "true" : undefined} className={`rounded-xl px-3 py-2 text-[13px] font-semibold ${sort === v ? "bg-cream-2 text-ink" : "text-muted hover:bg-cream-2 hover:text-ink"}`}>{l}</Link>)}
            </nav>
          </details>
          {area && <Link href={href({ bbox: "" })} className="flex-none rounded-full bg-[#EFE5DA] px-3.5 py-2 text-[12.5px] font-semibold text-ink hover:bg-[#E6DCD2]">Clear the map area</Link>}
        </div>
      </div>

      <main className="container-x py-6 pb-24">
        {error && <div role="alert" className="card mb-6 p-6 text-bad">We could not load results just now. Try again in a moment.</div>}

        {/* Said plainly when little or nothing was nearby and the search looked further out. */}
        {!error && geo?.notice && cards.length > 0 && (
          <div role="status" className="card mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[18px] px-5 py-3.5 text-[14.5px]">
            <span><b className="font-semibold">{geo.notice}</b>{!device && place ? ` Distances are from the middle of ${shortName(place)}.` : ""}</span>
            <Link href="/business/signup" className="flex-none font-semibold text-wine hover:underline">Are you a professional here? List your business</Link>
          </div>
        )}

        {cards.length > 0 && (
          <SearchResults
            cards={cards} pins={pins} q={q} near={device ? "on" : "off"} home={me.home} centre={centre} area={area ?? undefined} areaBase={href({ bbox: "", place: "", page: "" })}
            when={when || undefined} anyTimeHref={href({ when: "" })}
            header={(
              <p>
                <b className="text-ink">{total.toLocaleString("en-US")}</b> {total === 1 ? "professional" : "professionals"}
                {geo?.mode === "near" && geo.radius_used ? ` within ${geo.radius_used} ${geo.unit === "mi" ? "miles" : "kilometres"}` : ""}
                {pages > 1 ? ` · showing ${first} to ${last}` : ""}
                {filtered && <> · <Link href={href({ q: "", category: "" })} className="font-semibold text-wine">Clear filters</Link></>}
              </p>
            )}
          />
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
          <div className="card mx-auto mt-6 max-w-[600px] rounded-[26px] p-10 text-center">
            <LogoMark className="mx-auto h-12 w-auto text-gold" />
            <h2 className="serif mt-5 text-[30px] leading-tight">{pastEnd ? "No more results" : filtered ? "Nothing matched that" : area ? "Nobody in this part of the map" : `Nobody listed ${words || "here"} yet`}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              {pastEnd ? "You have gone past the last page."
                : filtered ? `No professional ${words || "here"} matches ${q ? `“${q}”` : catName ?? "that"}${geo?.mode === "near" && scope ? `, and none anywhere else in ${inCountry(scope)}` : ""}.`
                : geo?.notice || `No professional takes bookings ${words || "here"} on LogaLuxe yet.`}
            </p>
            {!pastEnd && nearby.length > 0 && (
              <div className="mt-5">
                <p className="text-[12px] font-semibold uppercase tracking-[.1em] text-muted">The nearest places with professionals</p>
                <ul className="mt-2.5 flex flex-wrap justify-center gap-2">
                  {nearby.map((p) => (
                    <li key={p.slug}><Link href={`/${p.slug}`} className="inline-flex items-baseline gap-1.5 rounded-full border border-line bg-white px-3.5 py-1.5 text-[13.5px] font-semibold transition hover:border-ink">{p.label}<small className="font-medium text-muted">{p.distance_text ? `${p.distance_text} · ` : ""}{people(p.businesses)}</small></Link></li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              {pastEnd ? <Link href={href({ page: "" })} className="btn btn-ink">Back to the first page</Link> : (
                <>
                  {filtered && <Link href={href({ q: "", category: "" })} className="btn btn-ink">Show everyone {words || "here"}</Link>}
                  {area && <Link href={href({ bbox: "" })} className="btn btn-ink">Clear the map area</Link>}
                  <Link href="/business/signup" className="btn btn-out">List your business here</Link>
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
