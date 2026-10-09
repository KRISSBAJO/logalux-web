import "@/app/cx-css/shop.css";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { getCustomer } from "@/lib/customer";
import { GiftForm } from "./gift-form";
import { getFeatures } from "@/lib/features";
import { whereAmI } from "@/lib/places";
import type { GiftOption } from "./gift-form";

const BASE = process.env.LOGALUXE_API_URL ?? "http://127.0.0.1:18080";

const DESCRIPTION = "A LogaLuxe gift card for someone in the United States or in Nigeria, in their own money, emailed to them and spent at checkout in the LogaLuxe shop.";

export const metadata: Metadata = {
  title: "Gift cards",
  description: DESCRIPTION,
  alternates: { canonical: "/gift-cards" },
  openGraph: { title: "Gift cards", description: DESCRIPTION, url: "/gift-cards", siteName: "LogaLuxe", type: "website" },
};
export const dynamic = "force-dynamic";

export default async function GiftCards({ searchParams }: { searchParams: Promise<{ country?: string }> }) {
  const [me, where, sp] = await Promise.all([getCustomer(), whereAmI(), searchParams]);
  // What a card can be in each country. Without an answer the form offers nothing: the amounts come from the API alone.
  const options: GiftOption[] = await fetch(`${BASE}/v1/gift-cards/options`, { next: { revalidate: 300 } }).then((r) => (r.ok ? r.json() : null)).then((d) => d?.options ?? []).catch(() => []);
  // The card starts in the money of the country being browsed: someone browsing Nigeria is most likely buying for someone there.
  const asked = (sp.country ?? "").toUpperCase();
  const start = asked === "NG" || asked === "US" ? asked : where.scope === "NG" ? "NG" : "US";
  return (
    <>
      <SiteHeader active="shop" />
      {/* The same top as the shop, from the shop's own stylesheet. */}
      <div className="cx pg-shop !min-h-0">
        <section className="hero">
          <div className="wrap">
            <div>
              <div className="eyebrow"><i />The LogaLuxe shop</div>
              <h1 className="serif">Give a <em>gift card.</em></h1>
              <p>Choose where they live, an amount in their money, and who it is for. We email them the code, and they spend it at checkout in the LogaLuxe shop.</p>
              <div className="herobtns">
                <Link href="/shop" className="btn btn-ghost">Back to the shop</Link>
              </div>
            </div>
          </div>
        </section>
      </div>
      <main className="container-x max-w-[1040px] py-10 pb-20">
        <GiftForm options={options} start={start} wallets={(await getFeatures()).wallets} me={me ? { name: `${me.first_name} ${me.last_name}`.trim(), email: me.email ?? "" } : undefined} />
      </main>
      <SiteFooter />
    </>
  );
}
