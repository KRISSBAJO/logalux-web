import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Icon } from "@/components/icons";
import { LogoMark } from "@/components/logo-mark";
import { Motion, MotionBoot } from "@/components/motion";
import { FeaturedCover, JournalGrid } from "@/components/journal-cards";
import { JOURNAL_CATEGORIES, journalCategoryLabel, journalList, listQuery, type Article } from "@/lib/journal";
import { inCountry } from "@/lib/place";
import { whereAmI } from "@/lib/places";

export const PAGE_SIZE = 12;

export type FrontProps = { category?: string; q?: string; tag?: string; all?: boolean };

/** The address of the front with some filters: the category pages have addresses of their own. */
export function frontHref({ category = "", q = "", tag = "", all = false }: FrontProps) {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (tag) p.set("tag", tag);
  if (all) p.set("all", "1");
  const s = p.toString();
  return `${category ? `/journal/category/${category}` : "/journal"}${s ? `?${s}` : ""}`;
}

/**
 * The magazine front: the featured piece large, a strip of categories with
 * counts, the latest as cards with "Load more", a search field, and the
 * reader's country from the place cookie.
 */
export async function JournalFront({ category = "", q = "", tag = "", all = false }: FrontProps) {
  const where = await whereAmI();
  const scope = where.scope;
  const country = all ? "" : scope;
  const list = await journalList({ category, country, q, tag, limit: PAGE_SIZE + 1 });

  const articles: Article[] = list?.articles ?? [];
  // The featured piece opens the page. A search is a list, and has no cover.
  const cover = !q ? articles.find((a) => a.featured) ?? (articles.length > 0 && !category ? articles[0] : undefined) : undefined;
  const rest = cover ? articles.filter((a) => a.slug !== cover.slug) : articles;
  const total = list?.total ?? 0;
  const counts = new Map((list?.categories ?? []).map((c) => [c.key, c]));
  const chips = JOURNAL_CATEGORIES.filter((c) => (counts.get(c.key)?.count ?? 0) > 0 || c.key === category);
  const catLabel = category ? counts.get(category)?.label || journalCategoryLabel(category) : "";
  const subject = q ? `“${q}”` : tag ? `#${tag}` : catLabel;
  const filtered = !!(q || tag || category);

  return (
    <>
      <MotionBoot />
      <Motion />
      <div className="hero-glow pb-10 text-[#F4ECE3]">
        <SiteHeader active="journal" transparent />
        <div className="container-x pt-6 md:pt-10">
          <div className="eyebrow rise" style={{ "--i": 0 } as React.CSSProperties}>{category ? <Link href="/journal" className="hover:text-white">The Journal</Link> : "The Journal"}{total > 0 ? ` · ${total} ${total === 1 ? "article" : "articles"}` : ""}</div>
          <h1 className="serif rise mt-4 text-[44px] leading-[.98] md:text-[72px]" style={{ "--i": 1 } as React.CSSProperties}>
            {subject ? <>{q ? "Articles about " : ""}<em className="text-gold-2">{subject}</em></> : <>Read before <em className="text-gold-2">you book.</em></>}
          </h1>
          <p className="rise mt-5 max-w-[560px] text-[17px] leading-relaxed text-[#C9BCB0]" style={{ "--i": 2 } as React.CSSProperties}>
            {category && JOURNAL_CATEGORIES.find((c) => c.key === category)
              ? `Articles about ${JOURNAL_CATEGORIES.find((c) => c.key === category)!.phrase}, written for the United States and Nigeria.`
              : "Useful articles about hair, braids, barbering, nails, lashes, skin, makeup, spa, and running a beauty business. Each one ends with real professionals you can book."}
          </p>
          <form action={category ? `/journal/category/${category}` : "/journal"} role="search" className="rise mt-7 flex max-w-[520px] items-center gap-2 rounded-full bg-cream p-1.5 pl-4 text-ink" style={{ "--i": 3 } as React.CSSProperties}>
            {all && <input type="hidden" name="all" value="1" />}
            <Icon.Search className="flex-none text-muted" />
            <input name="q" defaultValue={q} placeholder="Search the Journal" aria-label="Search the Journal" className="h-10 w-full min-w-0 bg-transparent text-[15px] outline-none placeholder:text-muted-2" />
            <button className="btn btn-ink btn-sm">Search</button>
          </form>
        </div>
      </div>

      <div className="sticky top-0 z-30 border-b border-line bg-cream/90 backdrop-blur-md">
        <div className="container-x flex items-center gap-3 py-2.5">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Link href={frontHref({ all })} className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition ${!category ? "border-ink bg-ink text-cream" : "border-line bg-white hover:border-ink"}`}>All</Link>
            {chips.map((c) => (
              <Link key={c.key} href={frontHref({ category: category === c.key ? "" : c.key, all })} aria-current={category === c.key ? "true" : undefined} className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition ${category === c.key ? "border-ink bg-ink text-cream" : "border-line bg-white hover:border-ink"}`}>
                {counts.get(c.key)?.label || c.label}{counts.get(c.key)?.count ? <span className={`ml-1.5 text-[11.5px] ${category === c.key ? "text-cream/70" : "text-muted"}`}>{counts.get(c.key)!.count}</span> : null}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <main className="container-x py-8 pb-24">
        {/* The reader sees their country's pieces and the shared ones, and can see everything. */}
        {scope && list && (
          <p className="mb-6 text-[14px] text-muted">
            {all ? "Showing all articles" : `Showing articles for ${inCountry(scope)}`}
            <span aria-hidden className="mx-2 text-muted-2">·</span>
            <Link href={frontHref({ category, q, tag, all: !all })} className="font-semibold text-wine hover:underline">{all ? `Only ${inCountry(scope)}` : "All articles"}</Link>
          </p>
        )}

        {!list && (
          <div role="alert" className="card mx-auto max-w-[600px] rounded-[26px] p-10 text-center">
            <LogoMark className="mx-auto h-12 w-auto text-gold" />
            <h2 className="serif mt-5 text-[30px] leading-tight">The Journal could not be loaded</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">Try again in a moment.</p>
            <div className="mt-6"><Link href="/journal" className="btn btn-ink">Try again</Link></div>
          </div>
        )}

        {list && articles.length === 0 && (
          <div className="card mx-auto max-w-[600px] rounded-[26px] p-10 text-center">
            <LogoMark className="mx-auto h-12 w-auto text-gold" />
            <h2 className="serif mt-5 text-[30px] leading-tight">{filtered ? "Nothing matched that" : "Nothing published yet"}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              {filtered ? `No article ${q ? `matches “${q}”` : tag ? `is tagged ${tag}` : `is filed under ${catLabel}`}${!all && scope ? ` for ${inCountry(scope)}` : ""}.` : "The first articles are on their way."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              {filtered && <Link href={frontHref({ all })} className="btn btn-ink">Show every article</Link>}
              {!all && scope && filtered && <Link href={frontHref({ category, q, tag, all: true })} className="btn btn-out">Include other countries</Link>}
              <Link href="/search" className="btn btn-out">Book a service</Link>
            </div>
          </div>
        )}

        {cover && (
          <div data-reveal className="mb-12"><FeaturedCover a={cover} eager /></div>
        )}

        {list && rest.length > 0 && (
          <>
            <div data-reveal className="mb-8 flex flex-wrap items-end justify-between gap-6">
              <h2 className="serif text-[32px] font-medium leading-[1.05] tracking-tight md:text-[40px]">{q ? "Matches" : cover ? "The latest" : catLabel || "The latest"}</h2>
              {filtered && <Link href={frontHref({ all })} className="text-[14px] font-semibold text-wine hover:underline">Clear filters</Link>}
            </div>
            <JournalGrid key={`${category}|${q}|${tag}|${country}`} initial={rest} total={Math.max(0, total - (cover ? 1 : 0))} query={listQuery({ category, country, q, tag })} pageSize={PAGE_SIZE} offsetBase={cover ? 1 : 0} />
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
