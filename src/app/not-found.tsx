import Link from "next/link";
import { SearchBar } from "@/components/search-bar";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { pickerWhere } from "@/lib/places";

export const metadata = { title: "Page not found", robots: { index: false, follow: false } };

/** The page for an address that leads nowhere: the site's own top and bottom, one sentence, and the ways on. */
export default async function NotFound() {
  const where = await pickerWhere();
  return (
    <>
      <SiteHeader />
      <main className="container-x max-w-[760px] py-16 pb-24">
        <div className="eyebrow !text-wine">Page not found</div>
        <h1 className="serif mt-3 text-[40px] leading-[1.05] md:text-[52px]">There is nothing at this address.</h1>
        <p className="mt-4 max-w-[560px] text-[17px] leading-relaxed text-muted">The link may be old, or the page may have moved. Search for a professional, or go on to one of these.</p>
        <div className="mt-8 rounded-[24px] bg-ink-2 p-4"><SearchBar where={where} /></div>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <Link href="/search" className="btn btn-ink">Find a professional</Link>
          <Link href="/shop" className="btn btn-out">The shop</Link>
          <Link href="/journal" className="btn btn-out">The Journal</Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
