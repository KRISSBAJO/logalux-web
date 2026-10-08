"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "./icons";
import { LogoMark } from "./logo-mark";
import type { Pin } from "./results-map";

// The map only exists in the browser.
const ResultsMap = dynamic(() => import("./results-map").then((m) => m.ResultsMap), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center bg-[#EDE6DC] text-[13.5px] text-muted">Loading the map…</div>,
});

export type ResultCard = {
  slug: string; name: string; tagline: string; tone: string; rating: number; reviews: number; verified: boolean; promoted?: boolean;
  area: string; open: boolean | null; openText: string; from: string; team: string; coverId?: string; coverAlt?: string;
  services: { name: string; length: string; price: string }[];
  timezone?: string;
};

type Opening = { service: string; service_id: string; slots: { time: string; starts_at: string; staff_id: string; staff: string }[] };

/** The calendar day of a moment in a time zone, as YYYY-MM-DD. */
function dayIn(at: Date, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

/** "Today", "Tomorrow", "Sat", or "Sat 17 Oct" when it is a week or more away: all in the time zone of the business. */
function dayLabel(date: string, today: string): string {
  const noon = (d: string) => Date.parse(d + "T12:00:00Z");
  const away = Math.round((noon(date) - noon(today)) / 864e5);
  if (away === 0) return "Today";
  if (away === 1) return "Tomorrow";
  return new Date(noon(date)).toLocaleDateString("en-GB", away < 7 ? { timeZone: "UTC", weekday: "short" } : { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
}

export function SearchResults({ cards, pins, q = "" }: { cards: ResultCard[]; pins: Pin[]; q?: string }) {
  const [active, setActive] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false); // phones show the list or the map, not both

  // The next free times of everyone on this page, asked for once after the list is on screen.
  const [openings, setOpenings] = useState<Record<string, Opening>>({});
  const slugs = cards.map((c) => c.slug).join(",");
  useEffect(() => {
    if (!slugs) return;
    let live = true;
    setOpenings({});
    fetch(`/api/openings?${new URLSearchParams({ slugs, q })}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live && d?.openings) setOpenings(d.openings); })
      .catch(() => {});
    return () => { live = false; };
  }, [slugs, q]);

  const pick = useCallback((slug: string) => {
    setActive(slug);
    const el = document.getElementById(`result-${slug}`);
    if (el) {
      setShowMap(false);
      requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "center" }));
    } else {
      window.location.href = `/b/${slug}`; // the pin is for a business on another page of results
    }
  }, []);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className={`flex min-w-0 flex-col gap-3.5 ${showMap ? "max-lg:hidden" : ""}`}>
        {cards.map((c) => (
          <article
            key={c.slug}
            id={`result-${c.slug}`}
            onMouseEnter={() => setActive(c.slug)}
            onMouseLeave={() => setActive(null)}
            className={`group relative flex overflow-hidden rounded-[20px] border bg-white transition duration-300 ${active === c.slug ? "border-ink shadow-[0_16px_40px_rgba(26,21,19,.12)]" : "border-line hover:border-ink"}`}
          >
            <div className="relative w-[112px] flex-none self-stretch overflow-hidden sm:w-[172px]" style={{ background: `linear-gradient(150deg, ${c.tone}, #120e0d 140%)` }}>
              {c.coverId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/media/${c.coverId}`} alt={c.coverAlt ?? ""} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
              ) : (
                <div aria-hidden className="absolute inset-0 flex items-center justify-center">
                  <LogoMark className="absolute h-[135%] w-auto text-white/[.07]" />
                  <span className="serif text-[52px] leading-none text-white/85">{c.name.slice(0, 1)}</span>
                </div>
              )}
              <span className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-cream/95 px-2 py-1 text-[12px] font-bold text-ink"><Icon.Star width={11} height={11} className="text-gold" />{c.rating.toFixed(1)}<small className="font-medium text-muted">({c.reviews})</small></span>
            </div>

            <div className="flex min-w-0 flex-1 flex-col px-4 py-3.5 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="serif min-w-0 truncate text-[23px] leading-tight">
                  <Link href={`/b/${c.slug}?src=search`} className="after:absolute after:inset-0 after:content-['']">{c.name}</Link>
                </h2>
                {c.promoted && <span className="mt-1 flex-none rounded-full border border-line px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[.06em] text-muted" title="This business pays LogaLuxe to be listed higher">Promoted</span>}
                {c.verified && <span className="mt-1 flex flex-none items-center gap-1 text-[11.5px] font-semibold text-ok"><Icon.Shield width={12} height={12} />Verified</span>}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12.5px] text-muted">
                <span className="flex items-center gap-1"><Icon.Pin width={12} height={12} />{c.area}</span>
                {c.open !== null && <span className="flex items-center gap-1.5"><i className={`block h-1.5 w-1.5 rounded-full ${c.open ? "bg-ok" : "bg-muted-2"}`} />{c.openText}</span>}
              </div>

              {c.services.length > 0 && (
                <ul className="mt-2.5 border-t border-line-2 text-[13.5px]">
                  {c.services.map((s) => (
                    <li key={s.name} className="flex items-baseline justify-between gap-3 border-b border-line-2 py-1.5 last:border-0">
                      <span className="min-w-0 truncate">{s.name}<span className="ml-2 text-[12px] text-muted">{s.length}</span></span>
                      <b className="flex-none font-semibold">{s.price}</b>
                    </li>
                  ))}
                </ul>
              )}

              {(() => {
                const o = openings[c.slug];
                if (!o?.slots?.length) return null;
                const today = dayIn(new Date(), c.timezone);
                return (
                  <div className="relative z-10 mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[12px] font-semibold text-muted">Next:</span>
                    {o.slots.slice(0, 3).map((s) => {
                      const date = dayIn(new Date(s.starts_at), c.timezone);
                      const label = `${dayLabel(date, today)} ${s.time}`;
                      return (
                        <Link
                          key={s.starts_at + s.staff_id}
                          href={`/b/${c.slug}/book?${new URLSearchParams({ services: o.service_id, staff: s.staff_id, date, time: s.time, src: "search" })}`}
                          aria-label={`Book ${o.service} at ${c.name}, ${label}, with ${s.staff}`}
                          className="rounded-full border border-line bg-white px-2.5 py-1 text-[12.5px] font-semibold text-ink transition hover:border-ink hover:bg-cream-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                        >{label}</Link>
                      );
                    })}
                    {o.service && <span className="min-w-0 basis-full truncate text-[11.5px] text-muted">for {o.service}</span>}
                  </div>
                );
              })()}

              <div className="mt-auto flex items-center justify-between gap-3 pt-2.5">
                <span className="min-w-0 truncate text-[12.5px] text-muted">{c.team}{c.from && <> · from <b className="text-ink">{c.from}</b></>}</span>
                <span className="flex flex-none items-center gap-1 text-[13px] font-semibold text-wine transition group-hover:gap-2">See times<Icon.Arrow width={13} height={13} /></span>
              </div>
            </div>
          </article>
        ))}
      </div>

      <aside className={`overflow-hidden rounded-[22px] border border-line lg:sticky lg:top-[76px] lg:block lg:h-[calc(100vh-100px)] ${showMap ? "h-[70vh]" : "max-lg:hidden"}`}>
        <ResultsMap pins={pins} active={active} onHover={setActive} onPick={pick} />
      </aside>

      {pins.length > 0 && (
        <button type="button" onClick={() => setShowMap((v) => !v)} className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-5 py-3 text-[14px] font-semibold text-cream shadow-[0_12px_30px_rgba(0,0,0,.35)] lg:hidden">
          {showMap ? <><Icon.List width={16} height={16} />Show list</> : <><Icon.Pin width={16} height={16} />Show map</>}
        </button>
      )}
    </div>
  );
}
