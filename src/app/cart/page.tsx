import "@/app/cx-css/cart.css";
import Link from "next/link";
import { CartView } from "@/components/cart-view";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { getCustomer } from "@/lib/customer";

export const metadata = { title: "Your cart" };

export default async function CartPage() {
  const me = await getCustomer();
  return (
    <>
      <SiteHeader active="shop" />
      <div className="cx pg-cart">
        <main className="wrap">
          <div className="top">
            <Link href="/shop" className="btn btn-out btn-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 18-6-6 6-6" /></svg>
              Keep shopping
            </Link>
            <span className="secure">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" /></svg>
              Secure checkout · card details never touch LogaLuxe
            </span>
          </div>
          <CartView me={me ? { name: `${me.first_name} ${me.last_name}`.trim(), phone: me.phone ?? "", email: me.email ?? "" } : undefined} />
        </main>
      </div>
      <SiteFooter />
    </>
  );
}
