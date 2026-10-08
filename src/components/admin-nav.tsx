"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

export type NavItem = { href: string; label: string; icon: ReactNode; count?: number };
/** A collapsible group folds away on desktop. It opens by itself when you are on one of its pages. */
export type NavGroup = { title: string; items: NavItem[]; collapsible?: boolean };

const STORE = "lx_nav_open";

export function AdminNav({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();
  const isActive = (href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`));
  // What the person chose by clicking. Loaded after the first paint so the server and browser agree.
  const [chosen, setChosen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      setChosen(JSON.parse(localStorage.getItem(STORE) ?? "{}"));
    } catch {}
  }, []);

  const toggle = (title: string, open: boolean) => {
    const next = { ...chosen, [title]: open };
    setChosen(next);
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
    } catch {}
  };

  return (
    <nav aria-label="Console" className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {groups.map((g) => {
        const hasActive = g.items.some((i) => isActive(i.href));
        const open = !g.collapsible || hasActive || !!chosen[g.title];
        const total = g.items.reduce((n, i) => n + (i.count ?? 0), 0);
        const listId = `nav-${g.title.toLowerCase()}`;
        return (
          <div key={g.title} className="flex gap-1 md:mb-2 md:flex-col">
            {g.collapsible ? (
              <button
                type="button"
                onClick={() => toggle(g.title, !open)}
                aria-expanded={open}
                aria-controls={listId}
                disabled={hasActive}
                title={hasActive ? "Open because you are on one of these pages" : undefined}
                className="hidden w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-[.14em] text-[#8C7F75] transition enabled:hover:bg-white/5 enabled:hover:text-[#C9BCB0] md:flex"
              >
                {g.title}
                {!open && total > 0 && <span className="rounded-full bg-rose px-1.5 py-0.5 text-[10px] font-bold leading-none tracking-normal text-white">{total}</span>}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`ml-auto transition-transform duration-200 ${open ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
              </button>
            ) : (
              <div className="hidden px-3 pb-1 text-[10px] font-bold uppercase tracking-[.14em] text-[#8C7F75] md:block">{g.title}</div>
            )}
            {/* On a phone the menu is one scrolling row, so nothing is folded away there. */}
            <div id={listId} className={`flex gap-1 md:flex-col ${open ? "" : "md:hidden"}`}>
              {g.items.map((i) => {
                const on = isActive(i.href);
                return (
                  <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined} className={`flex min-h-[40px] flex-none items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2 text-[14px] font-medium transition ${on ? "bg-white/10 text-white" : "text-[#C9BCB0] hover:bg-white/5 hover:text-[#F4ECE3]"}`}>
                    <span className={`flex-none ${on ? "text-rose" : ""}`}>{i.icon}</span>
                    {i.label}
                    {i.count ? <span className="ml-auto rounded-full bg-rose px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">{i.count}</span> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

/** Shows why the last sign-in attempt failed. */
export function SignInError() {
  const sp = useSearchParams();
  const err = sp.get("err"), ok = sp.get("ok");
  if (err) return <div role="alert" className="mb-5 rounded-xl border border-bad/25 bg-bad-bg px-3.5 py-2.5 text-[13.5px] font-medium text-bad">{err}</div>;
  return ok ? <div role="status" className="mb-5 rounded-xl border border-ok/25 bg-ok-bg px-3.5 py-2.5 text-[13.5px] font-medium text-ok">{ok}</div> : null;
}
