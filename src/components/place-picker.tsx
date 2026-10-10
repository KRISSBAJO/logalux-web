"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { findMe } from "@/lib/near-me";
import { forgetChosen, inCountry, keepChosen, moneyName, people, refusedBefore, toChosen, type Place } from "@/lib/place";
import { Icon } from "./icons";

type Found = { places: Place[]; looked_up?: boolean; complete?: boolean };

/** What the trigger looks like: a link in the dark header, the "Where" field of the search bar, a pill among filters, or the word "Change" in a sentence. */
type Look = "header" | "field" | "pill" | "change";

/** What the server worked out about where the visitor is looking. See lib/places.ts. */
export type PickerWhere = {
  /** The place now shown, or "" when none is known. */
  label: string;
  /** `chosen` they picked it · `device` from "Near me" · `ip` a guess from their internet address · `default` we could not tell · `none`. */
  source: "chosen" | "device" | "ip" | "default" | "none";
  /** The country whose professionals and prices are shown. */
  scope: string;
  /** The country we think they are really in, when it is one we serve. */
  home: string;
  /** Places with professionals in the country being browsed, offered before anything is typed. */
  suggested: Place[];
  /** The countries that have professionals, so another can be browsed on purpose. */
  countries: { code: string; name: string }[];
};

const placeOf = (code: string, name: string): Place => ({
  slug: name.toLowerCase().replace(/[^a-z]+/g, "-"), kind: "country", city: "", region: "", region_name: "", country: code, country_name: name, label: name,
  lat: code === "NG" ? 9.08 : 39.83, lng: code === "NG" ? 8.68 : -98.58, businesses: 0, currency: code === "NG" ? "NGN" : "USD", unit: code === "US" ? "mi" : "km", timezone: "",
});

/** The last few places chosen, kept in this browser only, so they can be picked again in one press. */
const RECENT = "lx_recent_places";
function readRecent(): Place[] {
  try { const list = JSON.parse(window.localStorage.getItem(RECENT) ?? "[]"); return Array.isArray(list) ? list.filter((p) => p && typeof p.label === "string" && typeof p.slug === "string").slice(0, 4) : []; } catch { return []; }
}
function keepRecent(p: Place) {
  try { window.localStorage.setItem(RECENT, JSON.stringify([p, ...readRecent().filter((r) => !(r.slug === p.slug && r.kind === p.kind))].slice(0, 4))); } catch {}
}

/** What names a place in an address. It goes when another place is chosen, so the new one is not overridden by it. */
const PLACE_PARAMS = ["place", "bbox", "page", "market", "where", "country"];

/**
 * The place a visitor is looking in, and the way to change it.
 *
 * Typing offers places we already know, with no outside call. Pressing Enter
 * or "Search" asks the lookup service for any city or town in the United
 * States or Nigeria. "Use my exact location" is the only thing that asks the
 * device where it is, only when pressed, and a refusal is remembered. Another
 * country can be browsed on purpose. The choice is kept in a cookie, so the
 * next page already shows it, and "Forget my location" removes it.
 */
export function PlacePicker({ where, look, align = "left", after = "auto" }: {
  where: PickerWhere; look: Look; align?: "left" | "right";
  /** What happens once a place is chosen. `place`: this is a place's own page, so go to the new place's page. `auto`: search, the shop and the home page show the new place; other pages only update the header. */
  after?: "auto" | "place";
}) {
  const { label, source, scope, home, suggested, countries } = where;
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [busy, setBusy] = useState<"" | "typing" | "search" | "near">("");
  const [note, setNote] = useState("");
  const [refused, setRefused] = useState(false);
  const [recent, setRecent] = useState<Place[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const asked = useRef(0);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    setRefused(refusedBefore());
    setRecent(readRecent().filter((r) => r.label !== label));
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    input.current?.focus();
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  /** Ask for places. `lookup` also asks the outside service; it is sent only when the person asks for a search. */
  const ask = useCallback(async (q: string, lookup: boolean) => {
    const n = ++asked.current;
    setBusy(lookup ? "search" : "typing");
    setNote("");
    try {
      const res = await fetch(`/api/places/search?${new URLSearchParams({ q, ...(lookup ? { lookup: "1" } : {}) })}`);
      const data = (await res.json()) as Found & { error?: string };
      if (n !== asked.current) return; // an older answer arriving late
      if (!res.ok) { setNote(data.error ?? "We could not search places just now. Try again in a moment."); setFound(null); return; }
      setFound(data);
      if (lookup && data.complete === false) setNote("The place search is not answering just now. These are the places we already know.");
    } catch {
      if (n === asked.current) setNote("We could not search places just now. Check your connection and try again.");
    } finally {
      if (n === asked.current) setBusy("");
    }
  }, []);

  // As the person types: places we already know. A short pause first, so every key is not a request.
  useEffect(() => {
    if (!open) return;
    const q = text.trim();
    if (!q) { asked.current++; setFound(null); setBusy(""); setNote(""); return; }
    const t = setTimeout(() => ask(q, false), 180);
    return () => clearTimeout(t);
  }, [text, open, ask]);

  /** Go on with the place just chosen: stay where the place matters, else only refresh what the page shows. */
  const go = useCallback((place: Place | null) => {
    setOpen(false);
    setText("");
    setFound(null);
    const url = new URL(window.location.href);
    for (const k of PLACE_PARAMS) url.searchParams.delete(k);
    const q = url.searchParams.toString();
    if (after === "place") router.push(place?.slug && (place.kind === "city" || place.kind === "state") && place.businesses > 0 ? `/${place.slug}` : "/search");
    else if (path === "/" || path === "/search" || path === "/shop" || path === "/gift-cards") router.push(`${path}${q ? `?${q}` : ""}`);
    router.refresh();
  }, [after, path, router]);

  const choose = (p: Place) => { keepChosen(toChosen(p, "picked", home)); keepRecent(p); go(p); };

  const nearMe = async () => {
    setBusy("near");
    setNote("");
    const me = await findMe(home);
    setBusy("");
    if (me.ok) go(me.place);
    else { setNote(me.why); setRefused(refusedBefore()); }
  };

  const forget = () => { forgetChosen(); setRefused(false); go(null); };

  const q = text.trim();
  const search = () => { if (q.length >= 3) ask(q, true); else if (q) setNote("Type at least three letters to search."); };
  const list = q ? found?.places ?? [] : suggested;
  const shown = label || "Your area";
  const guessed = source === "ip";
  const own = countries.find((c) => c.code === scope);
  // What the trigger says. A guess is never stated as a fact.
  const words = source === "device" ? `Near you · ${shown}` : shown;
  const row = "flex w-full items-baseline justify-between gap-3 rounded-xl px-3 py-2 text-left text-[14.5px] transition hover:bg-cream-2 focus-visible:bg-cream-2 focus-visible:outline-none";
  const trigger =
    look === "header" ? "group inline-flex max-w-[240px] items-center gap-2 py-2 text-[14px] font-medium text-[#E9DED3] transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
    : look === "pill" ? "inline-flex max-w-[230px] items-center gap-1.5 rounded-full bg-[#EFE5DA] px-3.5 py-2 text-[12.5px] font-semibold text-ink transition hover:bg-[#E6DCD2]"
    : look === "change" ? "font-semibold text-wine underline underline-offset-2 hover:text-wine-2"
    : "flex w-full min-w-0 flex-col items-start px-3.5 py-1.5 text-left";

  return (
    <div ref={box} className={`relative ${look === "field" ? "min-w-0 border-line md:border-r" : look === "change" ? "inline-block" : "flex-none"}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="dialog" aria-label={`${guessed ? "We think you are near" : "Place:"} ${shown}. Change`} className={trigger}>
        {look === "change" ? "Change" : look === "field" ? (
          <>
            <span className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted">Where</span>
            <span className={`w-full truncate text-[15px] leading-tight ${label ? "text-ink" : "text-muted-2"}`}>{words}</span>
          </>
        ) : (
          <>
            <Icon.Pin width={look === "header" ? 16 : 13} height={look === "header" ? 16 : 13} className={`flex-none ${look === "header" ? "text-gold" : ""}`} />
            <span className={`truncate ${look === "header" ? "border-b border-transparent group-hover:border-gold/60" : ""}`}>{words}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`flex-none opacity-70 transition-transform ${open ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
          </>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Where to look" className={`place-dialog absolute top-[calc(100%+12px)] z-50 w-[min(380px,calc(100vw-32px))] rounded-[20px] border border-line bg-cream p-4 text-left text-[14px] font-normal normal-case tracking-normal text-ink shadow-[0_30px_70px_rgba(18,14,13,.38)] ${align === "right" ? "right-0" : "left-0"}`}>
          <h2 className="serif px-1 text-[26px] font-medium leading-none">Where to look</h2>
          {/* How we came by the place, said plainly. A guess is called a guess. */}
          <p className="px-1 pb-3 pt-2 text-[13px] leading-snug text-muted">
            {source === "ip" ? <>We think you are near <b className="font-semibold text-ink">{shown}</b>, going by your internet connection. It is a rough guess: choose your own place below.</>
              : source === "device" ? <>You are seeing what is near <b className="font-semibold text-ink">{shown}</b>, from your device&apos;s location.</>
              : source === "chosen" ? <>You chose <b className="font-semibold text-ink">{shown}</b>.</>
              : source === "default" ? <>We could not tell where you are, so we started you in <b className="font-semibold text-ink">{shown}</b>. Choose your own place below.</>
              : "Choose where to look."}
          </p>

          {/* Not a form: this panel can sit inside the search bar's own form. */}
          <div className="flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-3.5 pr-1 focus-within:border-ink">
            <input
              ref={input} value={text} onChange={(e) => setText(e.target.value)} maxLength={80} autoComplete="off" spellCheck={false}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(); } }}
              role="combobox" aria-expanded={list.length > 0} aria-controls={listId} aria-label="City, state or country"
              placeholder="City, state or country" className="w-full min-w-0 bg-transparent py-1.5 text-[14.5px] outline-none focus:outline-none focus-visible:outline-none placeholder:text-muted-2"
            />
            <button type="button" onClick={search} disabled={busy === "search" || !q} className="btn btn-ink btn-sm flex-none disabled:opacity-50">{busy === "search" ? "Searching…" : "Search"}</button>
          </div>

          <button type="button" onClick={nearMe} disabled={busy === "near"} className="mt-3 flex w-full items-center gap-2.5 rounded-xl border border-line bg-white px-3 py-2.5 text-left text-[14px] font-semibold text-ink transition hover:border-ink disabled:opacity-60">
            <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-cream-2 text-wine"><Icon.Pin width={14} height={14} /></span>{busy === "near" ? "Finding you…" : "Use my exact location"}
          </button>
          <p className="px-1 pt-1.5 text-[12.5px] leading-snug text-muted">
            {refused ? "You did not allow this last time, so we are using the approximate place. Press the button to be asked again." : "Your browser will ask first. It is used only to put what is nearest to you first."}
          </p>

          {note && <p role="status" className="px-3 pt-2 text-[13px] leading-snug text-ink">{note}</p>}

          {!q && recent.length > 0 && (
            <div className="mt-3 border-t border-line-2 pt-2">
              <p className="px-3 pb-1 text-[10.5px] font-semibold uppercase tracking-[.1em] text-muted">Recent</p>
              <ul aria-label="Recent places">
                {recent.map((p) => (
                  <li key={`r-${p.kind}-${p.slug}`}><button type="button" onClick={() => choose(p)} className={row}><span className="min-w-0 truncate font-medium">{p.kind === "country" ? `All of ${inCountry(p.country)}` : p.label}</span><small className="flex-none text-[12px] text-muted">{p.country_name}</small></button></li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-3 border-t border-line-2 pt-2">
            <p className="px-3 pb-1 text-[10.5px] font-semibold uppercase tracking-[.1em] text-muted">{q ? (found?.looked_up ? "Places found" : "Places we know") : scope ? `Places with professionals in ${inCountry(scope)}` : "Places with professionals"}</p>
            <ul id={listId} role="listbox" aria-label="Places" className="max-h-[232px] overflow-y-auto">
              {list.map((p) => (
                <li key={`${p.kind}-${p.slug}`} role="option" aria-selected={false}>
                  <button type="button" onClick={() => choose(p)} className={row}>
                    <span className="min-w-0 truncate font-medium">
                      {p.kind === "country" ? `All of ${inCountry(p.country)}` : p.label}
                      {p.kind === "state" && <small className="ml-1.5 text-[12px] font-normal text-muted">whole state</small>}
                      {q && p.kind === "city" && p.country !== scope && <small className="ml-1.5 text-[12px] font-normal text-muted">{p.country_name}</small>}
                    </span>
                    <small className="flex-none text-[12px] text-muted">{p.businesses > 0 ? people(p.businesses) : "None yet"}</small>
                  </button>
                </li>
              ))}
              {!q && own && (
                <li role="option" aria-selected={false}>
                  <button type="button" onClick={() => choose(placeOf(own.code, own.name))} className={row}><span className="font-medium">All of {inCountry(own.code)}</span></button>
                </li>
              )}
            </ul>
            {busy === "typing" && list.length === 0 && <p className="px-3 py-2 text-[13.5px] text-muted">Looking…</p>}
            {q && busy === "" && found && list.length === 0 && !note && (
              <p className="px-3 py-2 text-[13.5px] leading-snug text-muted">
                {found.looked_up ? "We could not find that in the United States or Nigeria. Check the spelling, or add the state." : "Press Search to look for any city or town in the United States or Nigeria."}
              </p>
            )}
            {q && busy === "" && found && list.length > 0 && !found.looked_up && q.length >= 3 && (
              <p className="px-3 pb-1 pt-2 text-[12.5px] text-muted">Not here? Press Search to look for it.</p>
            )}
            {!q && suggested.length === 0 && !own && <p className="px-3 py-2 text-[13.5px] text-muted">Type a city, a state or a country.</p>}
          </div>

          {(source === "chosen" || source === "device" || refused) && !q && (
            <div className="mt-1 border-t border-line-2 pt-1.5">
              <button type="button" onClick={forget} className="w-full rounded-xl px-3 py-2 text-left text-[13.5px] font-semibold text-muted transition hover:bg-cream-2 hover:text-ink">Forget my location</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Shown under the header while someone is browsing a country other than their own, so they are never
 * surprised by a currency: "You are browsing Nigeria. Prices are in naira." One press goes back.
 */
export function BrowsingBanner({ scope, home }: { scope: string; home: string }) {
  const router = useRouter();
  const back = () => {
    forgetChosen();
    const u = new URL(window.location.href);
    for (const k of PLACE_PARAMS) u.searchParams.delete(k);
    router.push(u.pathname + (u.searchParams.toString() ? `?${u.searchParams}` : ""));
    router.refresh();
  };
  return (
    <div role="status" className="border-b border-gold/30 bg-warn-bg text-ink">
      <div className="container-x flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-2.5 text-[13.5px]">
        <span>You are browsing <b className="font-semibold">{inCountry(scope)}</b>. Local listings are priced in {moneyName(scope)}. Existing bookings, orders and credit keep their own currency.</span>
        <button type="button" onClick={back} className="font-semibold text-wine underline underline-offset-2">Back to {inCountry(home)}</button>
      </div>
    </div>
  );
}
