import Link from "next/link";
import { LogoMark } from "@/components/logo-mark";
import { AccountMenu } from "@/components/account-menu";
import { getCustomer } from "@/lib/customer";
import { signOut } from "@/app/account/actions";

export function Logo({ light = true, size = 26 }: { light?: boolean; size?: number }) {
  return (
    <Link href="/" aria-label="LogaLuxe home" className="serif inline-flex items-center gap-[.42em] leading-none" style={{ fontSize: size, color: light ? "#F4ECE3" : "#1A1513" }}>
      <LogoMark className={`h-[1.2em] w-auto flex-none ${light ? "text-gold" : "text-wine"}`} />
      LogaLuxe
    </Link>
  );
}

/** The site header. It shows "Sign in" to a guest and an account menu to a signed-in customer. */
export async function SiteHeader({ active, transparent = false }: { active?: "book" | "shop" | "pros"; transparent?: boolean }) {
  const me = await getCustomer();
  const link = (href: string, label: string, key: string) => (
    <Link href={href} className="text-[14px] font-medium hover:text-white" style={{ color: active === key ? "#FFFFFF" : "#E9DED3", fontWeight: active === key ? 600 : 500 }}>
      {label}
    </Link>
  );
  return (
    <header className={`text-[#F4ECE3] ${transparent ? "" : "bg-ink-2"}`}>
      <nav className="container-x flex h-[76px] items-center gap-6" aria-label="Main">
        <Logo />
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
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-ink-2 py-16 text-[#C9BCB0]">
      <div className="container-x grid gap-10 md:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
        <div>
          <Logo size={28} />
          <p className="mt-4 max-w-xs text-[15px] leading-relaxed">Beauty booking and business tools for professionals and the clients who trust them. Nashville and Lagos first.</p>
          <p className="mt-4 text-[13px] text-muted-2">LogaXP · 1108 Berry Street, Old Hickory, TN 37138</p>
        </div>
        {[
          ["Clients", ["Browse services", "/search"], ["Shop", "/shop"], ["How it works", "/#how"], ["Help", "/help"]],
          ["Professionals", ["List your business", "/business/signup"], ["Business sign in", "/business/signin"], ["Pricing", "/#pros"], ["Switch from another app", "/#pros"]],
          ["Company", ["About LogaXP", "/"], ["For professionals", "/#pros"], ["Help", "/help"], ["Contact", "/help"]],
          ["Legal", ["Terms", "/legal/terms"], ["Privacy", "/legal/privacy"], ["Cancellation policy", "/legal/cancellation"], ["Accessibility", "/legal/accessibility"]],
        ].map(([title, ...links]) => (
          <div key={title as string}>
            <h4 className="mb-4 text-[14px] font-semibold uppercase tracking-[.1em] text-[#F4ECE3]">{title as string}</h4>
            {(links as [string, string][]).map(([l, h]) => (
              <Link key={l} href={h} className="mb-3 block text-[15px] text-[#C9BCB0] hover:text-white">{l}</Link>
            ))}
          </div>
        ))}
      </div>
      <div className="container-x mt-14 flex flex-wrap justify-between gap-6 border-t border-white/10 pt-7 text-[13px] text-muted-2">
        <span>© 2026 LogaXP. All rights reserved.</span>
        <span>English (US) · Nigeria · USD / NGN</span>
      </div>
    </footer>
  );
}
