import "@/app/cx-css/shop.css";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { getCustomer } from "@/lib/customer";
import { GiftForm } from "./gift-form";

const DESCRIPTION = "A LogaLuxe gift card, from $10 to $500, emailed to the person it is for and spent at checkout in the LogaLuxe shop.";

export const metadata: Metadata = {
  title: "Gift cards",
  description: DESCRIPTION,
  alternates: { canonical: "/gift-cards" },
  openGraph: { title: "Gift cards", description: DESCRIPTION, url: "/gift-cards", siteName: "LogaLuxe", type: "website" },
};
export const dynamic = "force-dynamic";

export default async function GiftCards() {
  const me = await getCustomer();
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
              <p>Choose an amount and say who it is for. We email them the code, and they spend it at checkout in the LogaLuxe shop.</p>
              <div className="herobtns">
                <Link href="/shop" className="btn btn-ghost">Back to the shop</Link>
              </div>
            </div>
          </div>
        </section>
      </div>
      <main className="container-x max-w-[1040px] py-10 pb-20">
        <GiftForm me={me ? { name: `${me.first_name} ${me.last_name}`.trim(), email: me.email ?? "" } : undefined} />
      </main>
      <SiteFooter />
    </>
  );
}
