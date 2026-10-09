import Link from "next/link";
import { LogoMark } from "@/components/logo-mark";
import { AccountMenu } from "@/components/account-menu";
import { BrowsingBanner, PlacePicker } from "@/components/place-picker";
import { getMe } from "@/lib/merchant-api";
import { getCustomer } from "@/lib/customer";
import { livePlaces, pickerWhere, whereAmI } from "@/lib/places";
import { signOutMerchant } from "@/app/business/(app)/actions";
import { signOut } from "@/app/account/actions";

export function Logo({ light = true, size = 26 }: { light?: boolean; size?: number }) {
  return (
    <Link href="/" aria-label="LogaLuxe home" className="serif inline-flex items-center gap-[.42em] leading-none" style={{ fontSize: size, color: light ? "#F4ECE3" : "#1A1513" }}>
      <LogoMark className={`h-[1.2em] w-auto flex-none ${light ? "text-gold" : "text-wine"}`} />
      LogaLuxe
    </Link>
  );
}

/**
 * The site header. It shows "Sign in" to a guest and an account menu to a signed-in customer,
 * and the place the visitor is looking in, which they can change from any page.
 * `placePage`: this page belongs to one place, so choosing another goes to that place's page.
 */
export async function SiteHeader({ active, transparent = false, placePage = false }: { active?: "book" | "shop" | "journal" | "pros"; transparent?: boolean; placePage?: boolean }) {
  const [me, where, picked, business] = await Promise.all([getCustomer(), whereAmI(), pickerWhere(), getMe().catch(() => null)]);
  const link = (href: string, label: string, key: string) => (
    <Link href={href} className="text-[14px] font-medium hover:text-white" style={{ color: active === key ? "#FFFFFF" : "#E9DED3", fontWeight: active === key ? 600 : 500 }}>
      {label}
    </Link>
  );
  const picker = (align: "left" | "right") => (
    <PlacePicker look="header" align={align} after={placePage ? "place" : "auto"} where={picked} />
  );
  const account = (me || business) ? <AccountMenu firstName={me?.first_name || business!.merchant.name.split(" ")[0]} email={me?.email || business!.merchant.email} customer={!!me} business={business?.merchant.business} signOut={signOut} signOutBusiness={business ? signOutMerchant : undefined} /> : <Link href="/signin" className="text-[14px] font-medium text-[#E9DED3] hover:text-white">Sign in</Link>;
  const cart = <Link href="/cart" aria-label="Shopping cart" title="Shopping cart" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#E9DED3] transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3h2l2.4 12a2 2 0 0 0 2 1.6H18a2 2 0 0 0 2-1.6L21 7H6"/><circle cx="10" cy="21" r="1"/><circle cx="18" cy="21" r="1"/></svg></Link>;
  return (
    <>
    <header className={`relative z-40 text-[#F4ECE3] ${transparent ? "" : "bg-ink-2"}`}>
      <nav className="container-x flex h-[76px] items-center gap-4 md:gap-6" aria-label="Main">
        <Logo />
        <div className="max-lg:hidden">{picker("left")}</div>
        <div className="ml-auto flex items-center gap-5 max-lg:hidden">
          {link("/search", "Book a service", "book")}
          {link("/shop", "Shop", "shop")}
          {link("/journal", "Journal", "journal")}
          <details className="group relative">
            <summary className="cursor-pointer list-none text-[14px] font-medium text-[#E9DED3] hover:text-white">For professionals <span aria-hidden="true" className="ml-1 text-[10px]">▾</span></summary>
            <nav aria-label="For professionals" className="absolute right-0 top-full mt-3 w-56 rounded-2xl border border-white/15 bg-ink-2 p-2 shadow-xl">
              <Link href={business ? "/business" : "/business/signin"} className="block rounded-xl px-4 py-3 text-sm font-semibold text-gold hover:bg-white/10">{business ? "Business dashboard" : "Business sign in"}</Link>
              <Link href="/business/signup" className="block rounded-xl px-4 py-3 text-sm hover:bg-white/10">List your business</Link>
              <Link href="/#pros" className="block rounded-xl px-4 py-3 text-sm hover:bg-white/10">Explore business tools</Link>
            </nav>
          </details>
          {cart}
          <Link href="/search" className="btn btn-gold btn-sm">Book now</Link>
          {account}
        </div>
        <div className="ml-auto flex items-center gap-3 lg:hidden">
          {cart}
          {account}
          <Link href="/search" className="btn btn-gold btn-sm">Book</Link>
        </div>
      </nav>
      {/* On a phone the place has a line of its own under the bar. */}
      <div className="container-x -mt-2 flex items-center justify-between gap-3 pb-3 lg:hidden">{picker("left")}{!business && <Link href="/business/signin" className="shrink-0 text-[13px] font-semibold text-gold">Business sign in</Link>}</div>
    </header>
    {/* Browsing a country other than their own, on purpose: say so on every page, with the way back. */}
    {where.abroad && <BrowsingBanner scope={where.scope} home={where.home} />}
    </>
  );
}

/** The footer. Its links to places are the busiest places there are, read from the API. */
export async function SiteFooter() {
  const [{ places: all, countries }, where] = await Promise.all([livePlaces(), whereAmI()]);
  const served = countries.filter((c) => c.businesses > 0);
  // The places of the country being browsed.
  const places = all.filter((p) => !where.scope || p.country === where.scope);
  // One link for each destination that really exists.
  const columns: [string, ...[string, string][]][] = [
    ["Clients", ["Browse services", "/search"], ...places.slice(0, 4).map((p): [string, string] => [`Beauty in ${p.city}`, `/${p.slug}`]), ...(places.length > 0 ? [["All places", "/places"] as [string, string]] : []), ["Shop", "/shop"], ["Gift cards", "/gift-cards"], ["The Journal", "/journal"], ["How it works", "/#how"], ["Help and contact", "/help"]],
    ["Professionals", ["List your business", "/business/signup"], ["Business sign in", "/business/signin"], ["Business tools", "/#pros"], ["Business articles", "/journal/category/business"]],
    ["Legal", ["Terms", "/legal/terms"], ["Privacy", "/legal/privacy"], ["Cancellation policy", "/legal/cancellation"], ["Accessibility", "/legal/accessibility"]],
  ];
  return (
    <footer className="bg-ink-2 py-16 text-[#C9BCB0]">
      <div className="container-x grid gap-10 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <Logo size={28} />
          <p className="mt-4 max-w-xs text-[15px] leading-relaxed">Beauty booking and business tools for professionals and the clients who trust them, across the United States and Nigeria.</p>
          <p className="mt-4 text-[13px] text-muted-2">LogaXP · 1108 Berry Street, Old Hickory, TN 37138</p>
        </div>
        {columns.map(([title, ...links]) => (
          <div key={title}>
            <h4 className="mb-4 text-[14px] font-semibold uppercase tracking-[.1em] text-[#F4ECE3]">{title}</h4>
            {links.map(([l, h]) => (
              <Link key={l + h} href={h} className="mb-3 block text-[15px] text-[#C9BCB0] hover:text-white">{l}</Link>
            ))}
          </div>
        ))}
      </div>
      <div className="container-x mt-14 flex flex-wrap justify-between gap-6 border-t border-white/10 pt-7 text-[13px] text-muted-2">
        <span>© 2026 LogaXP. All rights reserved.</span>
        <span>{["English", ...served.map((c) => c.name)].join(" · ")}{served.length > 0 ? ` · ${served.map((c) => c.currency).join(" / ")}` : ""}</span>
      </div>
    </footer>
  );
}
