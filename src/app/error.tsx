"use client";

import Link from "next/link";
import { LogoMark } from "@/components/logo-mark";

/**
 * Shown when a page fails to render. It has no data of its own on purpose: the header here is a light one
 * with the logo and plain links, since the usual header reads the visitor's place from the API.
 */
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <>
      <header className="bg-ink-2 text-[#F4ECE3]">
        <nav className="container-x flex h-[76px] items-center gap-5" aria-label="Main">
          <Link href="/" aria-label="LogaLuxe home" className="serif inline-flex items-center gap-[.42em] text-[26px] leading-none text-[#F4ECE3]">
            <LogoMark className="h-[1.2em] w-auto flex-none text-gold" />LogaLuxe
          </Link>
          <div className="ml-auto flex items-center gap-5 text-[14px] font-medium text-[#E9DED3]">
            <Link href="/search" className="hover:text-white">Book a service</Link>
            <Link href="/shop" className="hover:text-white max-sm:hidden">Shop</Link>
            <Link href="/help" className="hover:text-white">Help</Link>
          </div>
        </nav>
      </header>
      <main className="container-x max-w-[760px] py-16 pb-24">
        <div className="eyebrow !text-wine">Something went wrong</div>
        <h1 className="serif mt-3 text-[40px] leading-[1.05] md:text-[52px]">This page did not load.</h1>
        <p role="alert" className="mt-4 max-w-[560px] text-[17px] leading-relaxed text-muted">Please try again. If you were making a payment, check your account before paying again.</p>
        <div className="mt-8 flex flex-wrap gap-2.5">
          <button type="button" onClick={reset} className="btn btn-ink">Try again</button>
          <Link href="/account" className="btn btn-out">Check my account</Link>
          <Link href="/help" className="btn btn-out">Get help</Link>
        </div>
      </main>
      <footer className="bg-ink-2 py-10 text-[13px] text-[#C9BCB0]">
        <div className="container-x flex flex-wrap justify-between gap-4">
          <span>© 2026 LogaXP. All rights reserved.</span>
          <span className="flex gap-4"><Link href="/legal/terms" className="hover:text-white">Terms</Link><Link href="/legal/privacy" className="hover:text-white">Privacy</Link></span>
        </div>
      </footer>
    </>
  );
}
