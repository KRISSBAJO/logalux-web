import Link from "next/link";
import { LogoMark } from "@/components/logo-mark";
import { AccountMenu } from "@/components/account-menu";
import { BrowsingBanner, PlacePicker } from "@/components/place-picker";
import { getCustomer } from "@/lib/customer";
import { livePlaces, pickerWhere, whereAmI } from "@/lib/places";
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
export async function SiteHeader({ active, transparent = false, placePage = false }: { active?: "book" | "shop" | "pros"; transparent?: boolean; placePage?: boolean }) {
  const [me, where, picked] = await Promise.all([getCustomer(), whereAmI(), pickerWhere()]);
  const link = (href: string, label: string, key: string) => (
    <Link href={href} className="text-[14px] font-medium hover:text-white" style={{ color: active === key ? "#FFFFFF" : "#E9DED3", fontWeight: active === key ? 600 : 500 }}>
      {label}
    </Link>
  );
  const picker = (align: "left" | "right") => (
    <PlacePicker look="header" align={align} after={placePage ? "place" : "auto"} where={picked} />
  );
  return (
    <>
    <header className={`relative z-40 text-[#F4ECE3] ${transparent ? "" : "bg-ink-2"}`}>
      <nav className="container-x flex h-[76px] items-center gap-4 md:gap-6" aria-label="Main">
        <Logo />
        <div className="max-md:hidden">{picker("left")}</div>
        <div className="ml-auto flex items-center gap-5 max-md:hidden">
          {link("/search", "Book a service", "book")}
          {link("/shop", "Shop", "shop")}
          {link("/#pros", "For professionals", "pros")}
          <Link href="/cart" className="text-[14px] font-medium text-[#E9DED3] hover:text-white">Cart</Link>
          {!me && <Link href="/signin" className="text-[14px] font-medium text-[#E9DED3] hover:text-white">Sign in</Link>}
          <Link href="/#search" className="btn btn-gold btn-sm">Book now</Link>
          {me && <AccountMenu firstName={me.first_name} email={me.email} signOut={signOut} />}
        </div>
        <div className="ml-auto flex items-center gap-3 md:hidden">
          {me ? <AccountMenu firstName={me.first_name} email={me.email} signOut={signOut} /> : <Link href="/signin" className="text-[14px] font-medium text-[#E9DED3]">Sign in</Link>}
          <Link href="/#search" className="btn btn-gold btn-sm">Book</Link>
        </div>
      </nav>
      {/* On a phone the place has a line of its own under the bar. */}
      <div className="container-x -mt-2 flex pb-3 md:hidden">{picker("left")}</div>
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
  const columns: [string, ...[string, string][]][] = [
    ["Clients", ["Browse services", "/search"], ...places.slice(0, 4).map((p): [string, string] => [`Beauty in ${p.city}`, `/${p.slug}`]), ...(places.length > 0 ? [["All places", "/places"] as [string, string]] : []), ["Shop", "/shop"], ["How it works", "/#how"], ["Help", "/help"]],
    ["Professionals", ["List your business", "/business/signup"], ["Business sign in", "/business/signin"], ["Pricing", "/#pros"], ["Switch from another app", "/#pros"]],
    ["Company", ["About LogaXP", "/"], ["For professionals", "/#pros"], ["Help", "/help"], ["Contact", "/help"]],
    ["Legal", ["Terms", "/legal/terms"], ["Privacy", "/legal/privacy"], ["Cancellation policy", "/legal/cancellation"], ["Accessibility", "/legal/accessibility"]],
  ];
  return (
    <footer className="bg-ink-2 py-16 text-[#C9BCB0]">
      <div className="container-x grid gap-10 md:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
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
