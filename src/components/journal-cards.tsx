"use client";

import Link from "next/link";
import { useState } from "react";
import { CategoryIcon } from "./category-icons";
import { Icon } from "./icons";
import { articleDate, journalCategoryLabel, readingLabel, type Article, type JournalList } from "@/lib/journal";

/** The colour behind each kind of article when it has no cover, in the storefront's own range. */
const TONES: Record<string, string> = {
  hair: "#4A2A2A", braids: "#7A1F2B", barber: "#1F2A33", nails: "#2E2538", lashes: "#3B1D22", skin: "#4A3426", makeup: "#5A1420", spa: "#1F3A33", business: "#2C2522", guide: "#1F4B7A",
};
export const categoryTone = (key: string) => TONES[key] ?? "#3B1D22";

/**
 * A drawn stand-in for a cover: the category's line drawing, large and faint,
 * on the category's colour. Fills its parent, which needs `position: relative`.
 */
export function CategoryMotif({ category, className = "" }: { category: string; className?: string }) {
  return (
    <div aria-hidden className={`absolute inset-0 overflow-hidden ${className}`} style={{ background: `radial-gradient(90% 70% at 85% 10%, rgba(212,175,90,.22), transparent 60%), linear-gradient(150deg, ${categoryTone(category)}, #120e0d 150%)` }}>
      <i className="absolute inset-3 rounded-[inherit] border border-gold/25" />
      <CategoryIcon id={category} className="absolute left-1/2 top-1/2 h-[58%] w-auto -translate-x-1/2 -translate-y-1/2 text-gold/60" strokeWidth={0.9} />
    </div>
  );
}

/** The cover photo, or the category motif. Fills its parent. */
export function ArticleCover({ a, eager, className = "" }: { a: Pick<Article, "cover_media_id" | "cover_alt" | "category" | "title">; eager?: boolean; className?: string }) {
  if (!a.cover_media_id) return <CategoryMotif category={a.category} className={className} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/media/${a.cover_media_id}`} alt={a.cover_alt || ""} loading={eager ? "eager" : "lazy"} decoding="async" className={`absolute inset-0 h-full w-full object-cover ${className}`} />;
}

const label = (a: Article) => a.category_label || journalCategoryLabel(a.category);

/** A small chip naming the category, in the colour of the ground it sits on. */
export function CategoryChip({ a, light }: { a: Article; light?: boolean }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[.08em] ${light ? "bg-cream/90 text-ink" : "bg-cream-2 text-wine"}`}>{label(a)}</span>;
}

/** One line of facts: date and reading time. */
export function ArticleMeta({ a, className = "" }: { a: Article; className?: string }) {
  return <span className={`text-[13px] ${className}`}>{[articleDate(a.published_at), readingLabel(a.reading_minutes)].filter(Boolean).join(" · ")}</span>;
}

/** One article in the grid. */
export function ArticleCard({ a, compact }: { a: Article; compact?: boolean }) {
  return (
    <Link href={`/journal/${a.slug}`} className="card lift group flex flex-col overflow-hidden rounded-[22px]">
      <div className={`relative overflow-hidden ${compact ? "aspect-[16/10]" : "aspect-[4/3]"}`}>
        <div className="zoom absolute inset-0"><ArticleCover a={a} /></div>
        <span className="absolute left-3.5 top-3.5"><CategoryChip a={a} light /></span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className={`serif leading-[1.12] ${compact ? "text-[21px]" : "text-[24px]"}`}>{a.title}</h3>
        {!compact && a.dek && <p className="line-clamp-2 text-[14.5px] leading-relaxed text-muted">{a.dek}</p>}
        <div className="mt-auto flex items-center justify-between gap-3 pt-2 text-muted">
          <ArticleMeta a={a} />
          <span className="flex items-center gap-1 text-[13px] font-semibold text-wine transition group-hover:gap-2">Read<Icon.Arrow width={13} height={13} /></span>
        </div>
      </div>
    </Link>
  );
}

/** The featured piece: a wide cover with the title over a dark wash. */
export function FeaturedCover({ a, eager, tall }: { a: Article; eager?: boolean; tall?: boolean }) {
  return (
    <Link href={`/journal/${a.slug}`} className={`lift group relative block overflow-hidden rounded-[28px] bg-ink-2 text-[#F4ECE3] ${tall ? "aspect-[4/5] sm:aspect-[4/3] lg:aspect-auto lg:h-full lg:min-h-[480px]" : "aspect-[4/5] sm:aspect-[16/10] lg:aspect-[21/9]"}`}>
      <div className="zoom absolute inset-0"><ArticleCover a={a} eager={eager} /></div>
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#120e0d] via-[#120e0d]/55 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-3 p-6 sm:p-8 lg:p-10">
        <span className="flex flex-wrap items-center gap-2">
          <CategoryChip a={a} light />
          {a.featured && <span className="eyebrow !text-gold-2 !text-[11px]">Featured</span>}
        </span>
        <h2 className={`serif max-w-[760px] leading-[1.02] ${tall ? "text-[32px] sm:text-[40px]" : "text-[32px] sm:text-[44px] lg:text-[56px]"}`}>{a.title}</h2>
        {a.dek && <p className={`max-w-[620px] leading-relaxed text-[#E9DED3]/85 ${tall ? "text-[15px]" : "text-[15px] sm:text-[17px]"}`}>{a.dek}</p>}
        <ArticleMeta a={a} className="text-[#C9BCB0]" />
      </div>
    </Link>
  );
}

/**
 * The grid of the Journal front, with a "Load more" that reads the next page
 * from /api/journal and adds it under what is already there.
 */
export function JournalGrid({ initial, total, query, pageSize, offsetBase = 0 }: { initial: Article[]; total: number; /** The list filters, as a query string without limit or offset. */ query: string; pageSize: number; /** Articles already read from the list that are shown elsewhere on the page (the featured cover). */ offsetBase?: number }) {
  const [list, setList] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const more = list.length < total;

  async function loadMore() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/journal?${query}${query ? "&" : ""}limit=${pageSize}&offset=${offsetBase + list.length}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as JournalList;
      const seen = new Set(list.map((a) => a.slug));
      setList([...list, ...(data.articles ?? []).filter((a) => !seen.has(a.slug))]);
    } catch {
      setError("More articles could not be loaded. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div data-stagger className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((a) => <ArticleCard key={a.slug} a={a} />)}
      </div>
      <div className="mt-10 flex flex-col items-center gap-3">
        <p className="text-[13.5px] text-muted" aria-live="polite">Showing {list.length} of {total} {total === 1 ? "article" : "articles"}</p>
        {error && <p role="alert" className="text-[14px] font-medium text-bad">{error}</p>}
        {more && <button type="button" onClick={loadMore} disabled={loading} className="btn btn-out">{loading ? "Loading…" : "Load more"}</button>}
      </div>
    </>
  );
}
