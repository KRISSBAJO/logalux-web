import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/markdown";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { api } from "@/lib/api";

type Page = { slug: string; title: string; body: string; updated_at: string };
const OTHERS: [string, string][] = [["terms", "Terms"], ["privacy", "Privacy"], ["cancellation", "Cancellation policy"], ["accessibility", "Accessibility"]];

async function get(slug: string): Promise<Page | null> {
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return null;
  try {
    return (await api.get<{ page: Page }>(`/v1/pages/${slug}`)).page;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const page = await get((await params).slug);
  return { title: page?.title ?? "Page not found" };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const page = await get((await params).slug);
  if (!page) notFound();
  return (
    <>
      <SiteHeader />
      <main className="container-x grid gap-10 py-14 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Legal pages" className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1">
          {OTHERS.map(([s, l]) => (
            <Link key={s} href={`/legal/${s}`} aria-current={s === page.slug ? "page" : undefined} className={`whitespace-nowrap rounded-xl px-3.5 py-2.5 text-[14.5px] font-medium ${s === page.slug ? "bg-ink text-cream" : "text-muted hover:bg-cream-2 hover:text-ink"}`}>{l}</Link>
          ))}
          <Link href="/help" className="whitespace-nowrap rounded-xl px-3.5 py-2.5 text-[14.5px] font-medium text-wine hover:bg-cream-2">Contact us</Link>
        </nav>
        <article className="max-w-[760px]">
          <div className="eyebrow !text-wine">LogaLuxe</div>
          <h1 className="serif mt-3 text-[44px] font-medium leading-[1.05] md:text-[56px]">{page.title}</h1>
          <p className="mb-9 mt-3 text-[13.5px] text-muted">Last updated {new Date(page.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</p>
          <Markdown source={page.body} />
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
