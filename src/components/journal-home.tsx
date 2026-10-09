import Link from "next/link";
import { ArticleCover, ArticleMeta, CategoryChip, FeaturedCover } from "@/components/journal-cards";
import { journalHome } from "@/lib/journal";

/**
 * "From the Journal" on the landing page: the featured piece large on the
 * left, the three latest on the right. Reads GET /v1/journal/home for the
 * country being browsed, and renders nothing while there is nothing to show.
 */
export async function JournalHomeSection({ scope }: { scope: string }) {
  const home = await journalHome(scope);
  if (!home) return null;
  const lead = home.featured ?? home.latest[0] ?? null;
  if (!lead) return null;
  const side = home.latest.filter((a) => a.slug !== lead.slug).slice(0, 3);

  return (
    <section className="border-y border-line bg-[#F7F2EB] py-16 md:py-24" id="journal" aria-labelledby="journal-heading">
      <div className="container-x">
        <div data-reveal className="mb-10 flex flex-wrap items-end justify-between gap-8">
          <div>
            <div className="eyebrow !text-wine">From the Journal</div>
            <h2 id="journal-heading" className="serif mt-3 text-[40px] font-medium leading-[1.05] tracking-tight md:text-[52px]">Know before you <em className="text-wine">book.</em></h2>
          </div>
          <p className="max-w-[420px] text-[16px] leading-relaxed text-muted">Plain guides to braids, barbering, nails, lashes, skin and makeup: what to ask for, how to care for it, and what a first visit costs.</p>
        </div>
        <div className={`grid gap-6 ${side.length ? "lg:grid-cols-[1.35fr_1fr]" : ""}`}>
          <div data-reveal className="min-w-0"><FeaturedCover a={lead} tall={side.length > 0} /></div>
          {side.length > 0 && (
            <div data-stagger className="flex flex-col gap-4">
              {side.map((a) => (
                <Link key={a.slug} href={`/journal/${a.slug}`} className="card lift group flex flex-1 items-stretch overflow-hidden rounded-[22px]">
                  <div className="relative w-[120px] flex-none overflow-hidden sm:w-[160px]"><div className="zoom absolute inset-0"><ArticleCover a={a} /></div></div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2 p-4 sm:p-5">
                    <CategoryChip a={a} />
                    <h3 className="serif text-[20px] leading-[1.15] sm:text-[22px] lg:text-[19px]">{a.title}</h3>
                    {/* The dek fits beside the picture on a tablet; in the narrow side column of a desktop it is left out so nothing is cut off. */}
                    {a.dek && <p className="line-clamp-2 text-[13.5px] leading-relaxed text-muted max-sm:hidden lg:hidden">{a.dek}</p>}
                    <ArticleMeta a={a} className="mt-auto text-muted" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="mt-10 flex justify-center"><Link href="/journal" className="btn btn-out">Read the Journal{home.count > 0 ? ` · ${home.count} ${home.count === 1 ? "article" : "articles"}` : ""}</Link></div>
      </div>
    </section>
  );
}
