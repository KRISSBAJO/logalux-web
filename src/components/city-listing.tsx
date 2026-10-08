// The page for a city ("/nashville") and for one kind of service in a city
// ("/nashville/braids"). Everything on it comes from the live list of
// businesses: the count, the prices and the cards.
import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { JsonLd, breadcrumbs } from "@/components/json-ld";
import { LogoMark } from "@/components/logo-mark";
import { SearchResults } from "@/components/search-results";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { CATEGORY_PAGES, CITIES, searchHref, type CategoryPage, type City } from "@/lib/categories";
import { allListings, priceSpan, toCard, toPin, type Listing, type Listings } from "@/lib/listings";
import { firstByRef, siteMedia } from "@/lib/media";
import { absoluteUrl } from "@/lib/site";

const SHOWN = 20; // cards on a city page; a category page shows everyone it read

type Loaded = Listings & { error: boolean };

/** Read once per request, so the page and its metadata share one answer. */
const load = cache(async (market: string, category: string): Promise<Loaded> => {
  try {
    return { ...(await allListings({ market, category })), error: false };
  } catch {
    return { businesses: [], total: 0, complete: false, error: true };
  }
});

const pathOf = (city: City, category?: CategoryPage) => `/${city.slug}${category ? `/${category.slug}` : ""}`;
const headingOf = (city: City, category?: CategoryPage) => `${category ? category.heading : "Beauty professionals"} in ${city.name}`;
const people = (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? "professional" : "professionals"}`;

/** One or two plain sentences: how many, how many verified, and what prices start at. */
function summary(city: City, category: CategoryPage | undefined, data: Loaded) {
  const { businesses, total, complete } = data;
  if (total === 0) return "";
  const verified = businesses.filter((b) => b.verification_status === "verified").length;
  const who = complete && verified === total ? `${total.toLocaleString("en-US")} verified ${total === 1 ? "professional" : "professionals"}` : complete && verified > 0 ? `${people(total)}, ${verified.toLocaleString("en-US")} of them verified,` : people(total);
  const verb = total === 1 ? (category ? "offers" : "takes") : category ? "offer" : "take";
  const first = category ? `${who} ${verb} ${category.phrase} in ${city.name} on LogaLuxe.` : `${who} ${verb} bookings in ${city.name} on LogaLuxe.`;
  const span = complete ? priceSpan(businesses) : null;
  const second = !span ? "" : span.low === span.high ? ` Prices start at ${span.low}.` : ` Starting prices run from ${span.low} to ${span.high}.`;
  return first + second;
}

export async function cityMetadata(city: City, category?: CategoryPage): Promise<Metadata> {
  const data = await load(city.market, category?.id ?? "");
  const title = headingOf(city, category);
  const facts = summary(city, category, data);
  const description = `${facts || `${title} on LogaLuxe.`} See prices and the next free times, and book online.`;
  const canonical = pathOf(city, category);
  return {
    title,
    description,
    alternates: { canonical },
    // A page with nobody on it is not worth a search engine's time.
    robots: data.total === 0 ? { index: false, follow: true } : undefined,
    openGraph: { title, description, url: canonical, siteName: "LogaLuxe", type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export async function CityListing({ city, category }: { city: City; category?: CategoryPage }) {
  const [data, coverMedia] = await Promise.all([load(city.market, category?.id ?? ""), siteMedia("business")]);
  const { businesses, total, complete, error } = data;
  const cover = firstByRef(coverMedia);
  const shown: Listing[] = category ? businesses : businesses.slice(0, SHOWN);
  const cards = shown.map((b) => toCard(b, cover));
  const pins = shown.filter((b) => typeof b.lat === "number" && typeof b.lng === "number").map((b) => toPin({ slug: b.slug, name: b.name, rating: Number(b.rating), currency: b.currency, lat: b.lat as number, lng: b.lng as number, from_cents: b.from_cents ?? null }));
  const heading = headingOf(city, category);
  const facts = summary(city, category, data);
  const other = CITIES.find((c) => c.slug !== city.slug);
  const fullSearch = searchHref(city, category?.id);
  // On a city page the whole city has been read, so each category can show how many it holds.
  const countIn = (id: string) => (!category && complete ? businesses.filter((b) => b.category === id).length : null);
  const categoryLinks = CATEGORY_PAGES.filter((c) => c.slug !== category?.slug).map((c) => ({ c, n: countIn(c.id) })).filter((x) => x.n === null || x.n > 0);

  const trail: [string, string][] = [["Home", absoluteUrl("/")], [city.name, absoluteUrl(pathOf(city))], ...(category ? [[category.heading, absoluteUrl(pathOf(city, category))] as [string, string]] : [])];
  const chip = "whitespace-nowrap rounded-full border border-line bg-white px-3.5 py-1.5 text-[13px] font-semibold transition hover:border-ink";

  return (
    <>
      <JsonLd data={breadcrumbs(trail)} />
      {shown.length > 0 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: heading,
            url: absoluteUrl(pathOf(city, category)),
            numberOfItems: shown.length,
            itemListElement: shown.map((b, i) => ({ "@type": "ListItem", position: i + 1, name: b.name, url: absoluteUrl(`/b/${b.slug}`) })),
          }}
        />
      )}

      <div className="hero-glow pb-9 text-[#F4ECE3]">
        <SiteHeader active="book" transparent />
        <div className="container-x pt-4">
          <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-2 text-[13px] text-[#C9BCB0]">
            <Link href="/" className="hover:text-white">Home</Link>
            <span aria-hidden>›</span>
            {category ? <Link href={pathOf(city)} className="hover:text-white">{city.name}</Link> : <span aria-current="page" className="text-[#F4ECE3]">{city.name}</span>}
            {category && <><span aria-hidden>›</span><span aria-current="page" className="text-[#F4ECE3]">{category.heading}</span></>}
          </nav>
          <h1 className="serif text-[32px] leading-[1.05] md:text-[44px]">{category ? category.heading : "Beauty professionals"} <em className="text-gold-2">in {city.name}</em></h1>
          {facts && <p className="mt-4 max-w-[640px] text-[16px] leading-relaxed text-[#C9BCB0]">{facts}</p>}
        </div>
      </div>

      <div className="border-b border-line bg-cream/90">
        <div className="container-x flex items-center gap-3 py-2.5">
          <nav aria-label={`Services in ${city.name}`} className="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {category ? <Link href={pathOf(city)} className={chip}>All in {city.name}</Link> : <span aria-current="page" className="whitespace-nowrap rounded-full border border-ink bg-ink px-3.5 py-1.5 text-[13px] font-semibold text-cream">All</span>}
            {category && <span aria-current="page" className="whitespace-nowrap rounded-full border border-ink bg-ink px-3.5 py-1.5 text-[13px] font-semibold text-cream">{category.label}</span>}
            {categoryLinks.map(({ c, n }) => (
              <Link key={c.slug} href={pathOf(city, c)} className={chip}>{c.label}{n !== null && <small className="ml-1.5 font-medium text-muted">{n}</small>}</Link>
            ))}
          </nav>
          {other && <Link href={pathOf(other, category)} className="flex-none rounded-full bg-[#EFE5DA] px-3.5 py-2 text-[12.5px] font-semibold text-ink hover:bg-[#E6DCD2]">{category ? `${category.heading} in ${other.name}` : other.name}</Link>}
        </div>
      </div>

      <main className="container-x py-6 pb-24">
        {error && <div role="alert" className="card mb-6 p-6 text-bad">We could not load this list just now. Try again in a moment.</div>}

        {cards.length > 0 && (
          <>
            <p className="mb-4 text-[13.5px] text-muted">
              <b className="text-ink">{people(total)}</b>{total > cards.length ? ` · showing the first ${cards.length}` : ""} · <Link href={fullSearch} className="font-semibold text-wine">{total > cards.length ? "See them all in search" : "Search with filters and a map"}</Link>
            </p>
            <SearchResults cards={cards} pins={pins} />
          </>
        )}

        {!error && cards.length === 0 && (
          <div className="card mx-auto mt-6 max-w-[560px] rounded-[26px] p-10 text-center">
            <LogoMark className="mx-auto h-12 w-auto text-gold" />
            <h2 className="serif mt-5 text-[30px] leading-tight">Nobody listed here yet</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">{category ? `No one offers ${category.phrase} in ${city.name} on LogaLuxe yet.` : `No one takes bookings in ${city.name} on LogaLuxe yet.`} Tell us who you would like to see here.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              {category && <Link href={pathOf(city)} className="btn btn-ink">Everyone in {city.name}</Link>}
              {other && <Link href={pathOf(other, category)} className="btn btn-out">{category ? `${category.heading} in ${other.name}` : `See ${other.name}`}</Link>}
              <Link href="/help" className="btn btn-out">Suggest a professional</Link>
            </div>
          </div>
        )}

        <section aria-labelledby="more-places" className="mt-14 border-t border-line pt-8">
          <h2 id="more-places" className="serif text-[26px] leading-tight">More in {city.name}{other ? ` and ${other.name}` : ""}</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {category && <li><Link href={pathOf(city)} className={chip}>All beauty professionals in {city.name}</Link></li>}
            {categoryLinks.map(({ c }) => <li key={c.slug}><Link href={pathOf(city, c)} className={chip}>{c.heading} in {city.name}</Link></li>)}
            {other && <li><Link href={pathOf(other, category)} className={chip}>{category ? category.heading : "Beauty professionals"} in {other.name}</Link></li>}
            <li><Link href={fullSearch} className={chip}>Search {category ? `${category.phrase} in ` : ""}{city.name} with filters</Link></li>
          </ul>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
