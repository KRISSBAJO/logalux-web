"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/** The signed-in customer's menu in the site header. `signOut` is a server action. */
export function AccountMenu({ firstName, email, signOut }: { firstName: string; email: string; signOut: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const item = "block rounded-lg px-3 py-2 text-[14px] font-medium text-ink hover:bg-cream-2";
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" className="flex items-center gap-2 rounded-full border border-white/15 py-1 pl-1 pr-3 text-[14px] font-medium text-[#F4ECE3] transition hover:border-gold">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold text-[13px] font-bold uppercase text-ink">{firstName.slice(0, 1)}</span>
        <span className="max-w-[110px] truncate max-sm:hidden">{firstName}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-[calc(100%+10px)] z-50 w-[240px] rounded-2xl border border-line bg-cream p-2 text-ink shadow-[0_24px_60px_rgba(0,0,0,.35)]">
          <div className="border-b border-line-2 px-3 pb-2.5 pt-1.5">
            <b className="block text-[14.5px] font-semibold">{firstName}</b>
            <span className="block truncate text-[12.5px] text-muted">{email}</span>
          </div>
          <div className="py-1.5">
            <Link role="menuitem" href="/account" onClick={() => setOpen(false)} className={item}>My bookings</Link>
            <Link role="menuitem" href="/account#orders" onClick={() => setOpen(false)} className={item}>My orders</Link>
            <Link role="menuitem" href="/account#details" onClick={() => setOpen(false)} className={item}>Details and password</Link>
          </div>
          <form action={signOut} className="border-t border-line-2 pt-1.5">
            <button role="menuitem" className={`${item} w-full text-left text-wine`}>Sign out</button>
          </form>
        </div>
      )}
    </div>
  );
}
