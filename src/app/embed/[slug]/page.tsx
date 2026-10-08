import "@/app/cx-css/book.css";
import { notFound } from "next/navigation";
import { customerApi } from "@/lib/customer";
import { BookView, EmbedFoot, EmbedHead, type BookSearch } from "@/app/b/[slug]/book/view";
import type { Payload } from "@/app/b/[slug]/shared";
import { EmbedServices } from "./booking";

// One business's booking, made to sit in a frame on the business's own website (see /embed.js).
// It is the same booking flow as /b/<slug>/book without the site's header and footer, with a list
// of services in front of it. This is the only part of the site other websites may put in a frame.
export const dynamic = "force-dynamic";
export const metadata = { title: "Book", robots: { index: false } };

export default async function EmbedPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<BookSearch & { choose?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  // With services chosen (or a finished booking to show), the booking flow takes over.
  if (sp.booking || (sp.services && !sp.choose)) return <BookView slug={slug} sp={sp} embed />;

  let data: Payload;
  try {
    data = await customerApi<Payload>(`/businesses/${encodeURIComponent(slug)}`, { auth: false });
  } catch {
    notFound();
  }
  const { business: b, services } = data;
  const display = data.display ?? {}, policy = data.policy ?? {};
  return (
    <div className="cx pg-book embed">
      <main className="wrap">
        <EmbedHead name={b.name} tone={b.tone} logoId={b.logo_id} />
        <EmbedServices
          slug={b.slug} currency={b.currency} multi={policy.multi_service !== false} showDurations={display.show_durations !== false}
          services={services.map((s) => ({ id: s.id, name: s.name, category: s.category, description: s.description, duration_min: s.duration_min + s.processing_min, price_cents: s.price_cents, deposit_cents: s.deposit_cents }))}
          picked={(sp.services ?? "").split(",").filter((id) => services.some((s) => s.id === id))}
        />
        <EmbedFoot />
      </main>
    </div>
  );
}
