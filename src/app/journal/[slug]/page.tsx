import "@/app/cx-css/journal.css";
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Icon } from "@/components/icons";
import { JsonLd, breadcrumbs } from "@/components/json-ld";
import { JournalBlocks } from "@/components/journal-md";
import { ArticleCard, ArticleCover, CategoryChip } from "@/components/journal-cards";
import { LogoMark } from "@/components/logo-mark";
import { Motion, MotionBoot } from "@/components/motion";
import { headingsOf, parseMarkdown, wordCount } from "@/lib/journal-md";
import { PREVIEW_COOKIE, articleDate, articleDescription, isTestArticle, journalArticle, journalCategory, journalCategoryLabel, journalNeighbours, journalProfessionals, readingLabel, readsLabel, type Article } from "@/lib/journal";
import { toCard } from "@/lib/listings";
import { firstByRef, siteMedia } from "@/lib/media";
import { inCountry, shortName } from "@/lib/place";
import { whereAmI } from "@/lib/places";
import { absoluteUrl, clip } from "@/lib/site";
import { BookItCards } from "./book-it";
import { ShareButtons } from "./share";
import { TableOfContents } from "./toc";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> };

/** One read per request: the page and its metadata share it, so a visit counts once. A preview is read quietly. */
const load = cache(async (slug: string, token: string) => journalArticle(slug, token ? { token, quiet: true } : {}));

async function previewToken(preview: boolean): Promise<string> {
  if (!preview) return "";
  try {
    return (await cookies()).get(PREVIEW_COOKIE)?.value ?? "";
  } catch {
    return "";
  }
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const preview = sp.preview === "1";
  const r = await load(slug, await previewToken(preview));
  if (!r.ok) return { title: r.status === 404 ? "Not found" : "The Journal", robots: { index: false, follow: false } };
  const a = r.data.article;
  const title = a.seo_title || a.title;
  const description = clip(articleDescription(a) || a.title, 200);
  const canonical = `/journal/${a.slug}`;
  const images = a.cover_media_id ? [{ url: `/media/${a.cover_media_id}`, alt: a.cover_alt || a.title }] : undefined;
  const hidden = preview || isTestArticle(a) || (a.status && a.status !== "published");
  return {
    title,
    description,
    alternates: { canonical },
    robots: hidden ? { index: false, follow: false } : undefined,
    openGraph: { title, description, url: canonical, siteName: "LogaLuxe", type: "article", images, publishedTime: a.published_at ?? undefined, authors: a.author_name ? [a.author_name] : undefined, section: a.category_label || journalCategoryLabel(a.category), tags: a.tags },
    twitter: { card: images ? "summary_large_image" : "summary", title, description, images: images?.map((i) => i.url) },
  };
}

function Neighbour({ a, side }: { a: Article; side: "newer" | "older" }) {
  return (
    <Link href={`/journal/${a.slug}`} className={`card lift flex items-center gap-4 rounded-[20px] p-5 ${side === "older" ? "sm:flex-row-reverse sm:text-right" : ""}`}>
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-cream-2 text-wine">{side === "newer" ? <Icon.Back /> : <Icon.Arrow />}</span>
      <span className="min-w-0">
        <small className="block text-[11px] font-semibold uppercase tracking-[.1em] text-muted">{side === "newer" ? "Newer" : "Older"}</small>
        <b className="serif block text-[20px] font-normal leading-tight">{a.title}</b>
      </span>
    </Link>
  );
}

export default async function ArticlePage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const preview = sp.preview === "1";
  const token = await previewToken(preview);
  const r = await load(slug, token);
  if (!r.ok && r.status === 404) notFound();

  if (!r.ok) {
    return (
      <>
        <SiteHeader active="journal" />
        <main className="container-x py-20">
          <div role="alert" className="card mx-auto max-w-[600px] rounded-[26px] p-10 text-center">
            <LogoMark className="mx-auto h-12 w-auto text-gold" />
            <h1 className="serif mt-5 text-[30px] leading-tight">This article could not be loaded</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">Try again in a moment.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2.5"><Link href={`/journal/${slug}`} className="btn btn-ink">Try again</Link><Link href="/journal" className="btn btn-out">The Journal</Link></div>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  const { article: a, related } = r.data;
  const where = await whereAmI();
  const place = where.place;
  const device = where.source === "device";
  const bookKey = a.related_category || a.category;
  const bookCat = journalCategory(bookKey);
  const service = !!bookCat?.service;
  const [found, businessMedia, neighbours] = await Promise.all([
    service ? journalProfessionals(a.slug, {
      ...(place && place.kind !== "state" && place.kind !== "country" && (place.lat || place.lng) ? { lat: place.lat, lng: place.lng } : place?.slug ? { place: place.slug } : {}),
      scope: where.scope,
      token,
    }) : Promise.resolve(null),
    service ? siteMedia("business") : Promise.resolve([]),
    journalNeighbours(a.slug, where.scope),
  ]);
  const cards = (found?.businesses ?? []).slice(0, 4).map((b) => toCard(b, firstByRef(businessMedia), device ? "" : place ? shortName(place) : ""));
  const nearName = place ? (place.kind === "country" ? inCountry(place.country) : shortName(place)) : "";
  const older = neighbours.older ?? r.data.next;
  const newer = neighbours.newer;
  const relatedShown = related.filter((x) => x.slug !== a.slug).slice(0, 3);

  const blocks = parseMarkdown(a.body_md ?? "");
  const headings = headingsOf(blocks);
  const path = `/journal/${a.slug}`;
  const url = absoluteUrl(path);
  const catLabel = a.category_label || journalCategoryLabel(a.category);
  const cta = a.cta_text || bookCat?.cta || "Book a service";
  const editorial = /logaluxe/i.test(a.author_name);
  const initials = (a.author_name || "L").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "@id": `${url}#article`,
      mainEntityOfPage: url,
      headline: a.title,
      ...(a.dek ? { description: a.dek } : {}),
      ...(a.cover_media_id ? { image: [absoluteUrl(`/media/${a.cover_media_id}`)] } : {}),
      ...(a.published_at ? { datePublished: a.published_at } : {}),
      ...(a.updated_at ? { dateModified: a.updated_at } : {}),
      author: editorial ? { "@type": "Organization", name: a.author_name || "LogaLuxe editorial", url: absoluteUrl("/journal") } : { "@type": "Person", name: a.author_name, ...(a.author_role ? { jobTitle: a.author_role } : {}) },
      publisher: { "@type": "Organization", name: "LogaLuxe", url: absoluteUrl("/"), logo: { "@type": "ImageObject", url: absoluteUrl("/icon.svg") } },
      articleSection: catLabel,
      ...(a.tags?.length ? { keywords: a.tags.join(", ") } : {}),
      wordCount: wordCount(a.body_md ?? ""),
      inLanguage: "en",
    },
    breadcrumbs([["Home", absoluteUrl("/")], ["The Journal", absoluteUrl("/journal")], [catLabel, absoluteUrl(`/journal/category/${a.category}`)], [a.title, url]]),
  ];

  return (
    <>
      <MotionBoot />
      <Motion />
      {!preview && <JsonLd data={jsonLd} />}
      <SiteHeader active="journal" />
      {preview && (
        <div role="status" className="border-b border-gold/40 bg-warn-bg">
          <div className="container-x flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[13.5px]">
            <b className="font-semibold">Preview.</b>
            <span className="text-muted">{a.status === "published" ? "This is how the article reads." : `This article is ${a.status ?? "not published"}; only staff can see this page.`}</span>
            <Link href={`/admin/journal/${a.id}`} className="ml-auto font-semibold text-wine hover:underline">Back to the editor</Link>
          </div>
        </div>
      )}

      <main>
        <article>
          <header className="container-x pt-10 md:pt-16">
            <div className="mx-auto flex max-w-[780px] flex-col items-center text-center">
              <div className="flex flex-wrap items-center justify-center gap-2 text-[13px] text-muted">
                <Link href="/journal" className="font-semibold text-wine hover:underline">The Journal</Link>
                <span aria-hidden>·</span>
                <Link href={`/journal/category/${a.category}`} className="hover:underline"><CategoryChip a={a} /></Link>
              </div>
              <h1 className="serif mt-6 text-[38px] leading-[1.02] md:text-[62px]">{a.title}</h1>
              {a.dek && <p className="mt-5 max-w-[640px] text-[18px] leading-relaxed text-muted md:text-[21px]">{a.dek}</p>}
              <div className="mt-7 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[14px]">
                <span className="flex items-center gap-2.5">
                  {a.author_media_id
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={`/media/${a.author_media_id}`} alt="" className="h-9 w-9 rounded-full object-cover" />
                    : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-wine text-[12px] font-semibold text-[#F4ECE3]">{editorial ? <LogoMark className="h-4 w-auto text-gold" /> : initials}</span>}
                  <span className="text-left leading-tight"><b className="block font-semibold">{a.author_name || "LogaLuxe editorial"}</b>{a.author_role && <span className="block text-[12.5px] text-muted">{a.author_role}</span>}</span>
                </span>
                <span aria-hidden className="max-sm:hidden text-muted-2">·</span>
                <span className="text-muted">{[articleDate(a.published_at), readingLabel(a.reading_minutes), readsLabel(a.view_count)].filter(Boolean).join(" · ")}</span>
              </div>
            </div>
            <div className={`relative mx-auto mt-10 max-w-[1100px] overflow-hidden rounded-[24px] md:mt-14 md:rounded-[28px] ${a.cover_media_id ? "aspect-[4/3] sm:aspect-[16/9]" : "aspect-[16/7] sm:aspect-[21/7]"}`}>
              <ArticleCover a={a} eager />
            </div>
          </header>

          <div className="container-x mt-12 md:mt-16">
            <div className="grid gap-10 xl:grid-cols-[200px_minmax(0,1fr)_200px] xl:gap-12">
              <aside className="max-xl:hidden"><TableOfContents headings={headings} /></aside>
              <div className="mx-auto w-full max-w-[680px]">
                <div className="jn-body"><JournalBlocks blocks={blocks} /></div>
                {(a.tags ?? []).length > 0 && (
                  <p className="mt-10 flex flex-wrap items-center gap-2 border-t border-line pt-6 text-[13px]">
                    {a.tags.map((t) => <Link key={t} href={`/journal?tag=${encodeURIComponent(t)}`} className="rounded-full border border-line bg-white px-3 py-1 font-semibold text-ink transition hover:border-ink">{t}</Link>)}
                  </p>
                )}
                <div className="mt-8 xl:hidden"><ShareButtons title={a.title} path={path} /></div>
              </div>
              <aside className="max-xl:hidden"><div className="sticky top-24 flex justify-center"><ShareButtons title={a.title} path={path} rail /></div></aside>
            </div>
          </div>
        </article>

        {/* The article ends where the booking begins: the four nearest professionals for what it is about. */}
        <section className="mt-20 bg-cream-2 py-20" id="book">
          <div className="container-x">
            <div data-reveal className="mb-8 flex flex-wrap items-end justify-between gap-6">
              <div>
                <div className="eyebrow !text-wine">Book it</div>
                <h2 className="serif mt-3 text-[34px] font-medium leading-[1.05] tracking-tight md:text-[46px]">{cta}</h2>
                {service && nearName && cards.length > 0 && <p className="mt-3 text-[15px] text-muted">{device ? "Nearest to you" : `Near ${nearName}`}{found?.geo?.fill_notice ? ` · ${found.geo.fill_notice}` : ""}</p>}
              </div>
              {service && <Link href={`/search?category=${bookKey}`} className="btn btn-out">See everyone</Link>}
            </div>
            {!service ? (
              <div className="card flex flex-wrap items-center justify-between gap-5 rounded-[24px] p-7 md:p-9">
                <p className="max-w-[560px] text-[16px] leading-relaxed text-muted">{bookKey === "business" ? "LogaLuxe is free for solo professionals: a booking link, deposits, reminders and daily payouts." : "Verified professionals, real openings, and a deposit that holds your time."}</p>
                <Link href={bookKey === "business" ? "/business/signup" : "/search"} className="btn btn-ink">{bookKey === "business" ? "List your business free" : "Find a professional"}</Link>
              </div>
            ) : cards.length > 0 ? (
              <BookItCards cards={cards} />
            ) : (
              <div className="card rounded-[24px] p-8 text-center">
                <p className="text-[17px] font-semibold">{found ? `No professional for this is listed ${nearName ? `near ${nearName}` : "near you"} yet.` : "The professionals could not be loaded just now."}</p>
                <p className="mt-2 text-[15px] text-muted">{found ? "Search across the country, or be the first to list here." : "Search for one instead."}</p>
                <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                  <Link href={`/search?category=${bookKey}`} className="btn btn-ink">Search {bookCat?.label.toLowerCase() ?? "professionals"}</Link>
                  {found && <Link href="/business/signup" className="btn btn-out">List your business</Link>}
                </div>
              </div>
            )}
          </div>
        </section>

        {(relatedShown.length > 0 || newer || older) && (
          <section className="py-20">
            <div className="container-x">
              {relatedShown.length > 0 && (
                <>
                  <div data-reveal className="mb-8">
                    <div className="eyebrow !text-wine">Keep reading</div>
                    <h2 className="serif mt-3 text-[34px] font-medium leading-[1.05] tracking-tight md:text-[46px]">Related articles</h2>
                  </div>
                  <div data-stagger className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {relatedShown.map((x) => <ArticleCard key={x.slug} a={x} compact />)}
                  </div>
                </>
              )}
              {(newer || older) && (
                <nav aria-label="Other articles" className={`grid gap-4 sm:grid-cols-2 ${relatedShown.length ? "mt-12" : ""}`}>
                  <div>{newer && <Neighbour a={newer} side="newer" />}</div>
                  <div>{older && <Neighbour a={older} side="older" />}</div>
                </nav>
              )}
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
