import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { CATEGORY_PAGES } from "@/lib/categories";
import { inCountry, people } from "@/lib/place";
import { livePlaces, whereAmI } from "@/lib/places";

const DESCRIPTION = "Every city where you can book a verified beauty professional on LogaLuxe, in the United States and Nigeria.";

export const metadata: Metadata = {
  title: "Places",
  description: DESCRIPTION,
  alternates: { canonical: "/places" },
  openGraph: { title: "Places", description: DESCRIPTION, url: "/places", siteName: "LogaLuxe", type: "website" },
};
export const dynamic = "force-dynamic";

// Every place that has professionals, by country. This is the one page that shows both countries at once:
// it is the directory, and where someone goes to look somewhere else on purpose.
export default async function Places() {
  const [{ places, countries }, where] = await Promise.all([livePlaces(), whereAmI()]);
  // The country being browsed comes first.
  const order = [...countries].filter((c) => c.businesses > 0).sort((a, b) => Number(b.code === where.scope) - Number(a.code === where.scope));
  return (
    <>
      <div className="hero-glow pb-9 text-[#F4ECE3]">
        <SiteHeader active="book" transparent />
        <div className="container-x pt-4">
          <h1 className="serif text-[32px] leading-[1.05] md:text-[44px]">Places <em className="text-gold-2">with professionals</em></h1>
          <p className="mt-4 max-w-[640px] text-[16px] leading-relaxed text-[#C9BCB0]">Wherever a verified professional takes bookings on LogaLuxe. A business anywhere in the United States or Nigeria can list itself.</p>
        </div>
      </div>
      <main className="container-x py-10 pb-24">
        {order.length === 0 && <div className="card mx-auto max-w-[560px] rounded-[26px] p-10 text-center text-muted">We could not load the places just now. Try again in a moment.</div>}
        {order.map((c) => {
          const list = places.filter((p) => p.country === c.code);
          const slug = c.name.toLowerCase().replace(/[^a-z]+/g, "-");
          return (
            <section key={c.code} aria-labelledby={`in-${c.code}`} className="mb-12">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
                <h2 id={`in-${c.code}`} className="serif text-[30px] leading-tight">{c.name}</h2>
                <p className="text-[14px] text-muted">{people(c.businesses)} in {list.length} {list.length === 1 ? "place" : "places"} · prices in {c.currency} · <Link href={`/${slug}`} className="font-semibold text-wine hover:underline">All of {inCountry(c.code)}</Link></p>
              </div>
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((p) => (
                  <li key={p.slug} className="card rounded-[20px] p-5">
                    <Link href={`/${p.slug}`} className="flex items-baseline justify-between gap-3"><b className="serif text-[23px] font-medium leading-tight hover:text-wine">{p.label}</b><small className="flex-none text-[13px] text-muted">{people(p.businesses)}</small></Link>
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {CATEGORY_PAGES.filter((cat) => (p.categories?.[cat.id] ?? 0) > 0).map((cat) => (
                        <li key={cat.slug}><Link href={`/${p.slug}/${cat.slug}`} className="inline-flex rounded-full border border-line bg-white px-3 py-1 text-[12.5px] font-semibold transition hover:border-ink">{cat.label}</Link></li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        <div className="card flex flex-wrap items-center justify-between gap-4 rounded-[22px] p-6">
          <p className="text-[15.5px]"><b className="font-semibold">Is your city missing?</b> <span className="text-muted">A place appears here as soon as a business there is live.</span></p>
          <Link href="/business/signup" className="btn btn-ink">List your business</Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
