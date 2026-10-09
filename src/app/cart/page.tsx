import "@/app/cx-css/cart.css";
import { KeepShopping } from "@/components/cart-ui";
import { CartView } from "@/components/cart-view";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { customerApi, getCustomer } from "@/lib/customer";
import { payFeatures } from "@/lib/cards";

export const metadata = { title: "Your cart" };

export default async function CartPage() {
  const me = await getCustomer();
  // Store credit is kept separately for each currency. The API applies only the matching balance.
  const credits = me ? await customerApi<{ credit_cents?: number; credit_balances?: Record<string,number> }>("/auth/wallet").then(w => w.credit_balances ?? {USD:w.credit_cents || 0,NGN:0}).catch(() => ({USD:0,NGN:0})) : {USD:0,NGN:0};
  // Kept cards for a signed-in customer, and wallets: each only while LogaLuxe staff have it switched on.
  const pay = await payFeatures(!!me);
  return (
    <>
      <SiteHeader active="shop" />
      <div className="cx pg-cart">
        <main className="wrap">
          <div className="top">
            <KeepShopping />
            <span className="secure">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" /></svg>
              Secure checkout · card details never touch LogaLuxe
            </span>
          </div>
          <CartView me={me ? { name: `${me.first_name} ${me.last_name}`.trim(), phone: me.phone ?? "", email: me.email ?? "" } : undefined} creditBalances={credits} pay={pay} />
        </main>
      </div>
      <SiteFooter />
    </>
  );
}
