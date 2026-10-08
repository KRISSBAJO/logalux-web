"use client";

import dynamic from "next/dynamic";
import { useId, useState } from "react";
import type { FieldLook } from "@/lib/location-form";
import { zoneName } from "@/lib/place";

// The map only exists in the browser.
const PinMap = dynamic(() => import("./pin-map").then((m) => m.PinMap), { ssr: false, loading: () => <div className="flex h-[220px] items-center justify-center rounded-xl border border-line bg-[#EDE6DC] text-[13px] text-muted">Loading the map…</div> });

type State = { value: string; code: string; name: string };
type Located = { location: { address: string; city: string; region: string; country: string; lat: number | null; lng: number | null; timezone: string; position_source: string; matched: string }; position: string; timezone_name: string };


/**
 * Where a business is: its country, street, city and state, and whether it
 * travels to clients. "Check on the map" shows where the address lands and
 * which time zone that is; the pin can be dragged when it is wrong, and then
 * its position is sent with the form. The country sets the money and cannot
 * be changed once the business exists (`fixedCountry`).
 */
export function LocationFields({ states, look, country: start = "US", fixedCountry = false, value = {}, idp = "loc", requireCity = true }: {
  /** The states of each country, from GET /v1/places/states. */
  states: Record<string, State[]>;
  look: FieldLook;
  country?: string;
  fixedCountry?: boolean;
  value?: { address?: string; city?: string; region?: string; lat?: number | null; lng?: number | null; travels?: boolean; travel_radius_km?: number | null; timezone?: string };
  idp?: string;
  requireCity?: boolean;
}) {
  const id = useId() + idp;
  const [country, setCountry] = useState(start === "NG" ? "NG" : "US");
  const [address, setAddress] = useState(value.address ?? "");
  const [city, setCity] = useState(value.city ?? "");
  const [region, setRegion] = useState(value.region ?? "");
  const [travels, setTravels] = useState(!!value.travels);
  const miles = country === "US";
  const [far, setFar] = useState(value.travel_radius_km ? String(Math.round(miles ? value.travel_radius_km / 1.609344 : value.travel_radius_km)) : "");
  const [found, setFound] = useState<Located | null>(null);
  const [hand, setHand] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const list = states[country] ?? [];
  // A stored state that is not in the list (typed before states were checked) is still offered, so nothing is lost.
  const known = !region || list.some((s) => s.value === region);
  const km = far.trim() && Number(far) > 0 ? Math.round(miles ? Number(far) * 1.609344 : Number(far)) : 0;

  const check = async (pinned?: { lat: number; lng: number }) => {
    setBusy(true);
    setProblem("");
    try {
      const res = await fetch("/api/places/locate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address, city, region, country, ...(pinned ? pinned : {}) }) });
      const data = await res.json();
      if (!res.ok) { setProblem(data.error ? data.error.charAt(0).toUpperCase() + data.error.slice(1) + "." : "We could not check that address just now."); setFound(null); return; }
      setFound(data as Located);
      if (data.location?.region) setRegion(data.location.region);
    } catch {
      setProblem("We could not check that address just now. You can still save; we look it up again then.");
    } finally {
      setBusy(false);
    }
  };
  // Anything typed after a check makes the check stale.
  const edit = (set: (v: string) => void) => (e: { target: { value: string } }) => { set(e.target.value); setFound(null); setHand(null); };
  const where = hand ?? (found?.location.lat != null ? { lat: found.location.lat, lng: found.location.lng as number } : null);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={look.field}>
          <label htmlFor={`${id}-country`} className={look.label}>Country</label>
          {fixedCountry ? (
            <><input id={`${id}-country`} readOnly value={country === "NG" ? "Nigeria · paid in naira" : "United States · paid in US dollars"} className={look.input} /><input type="hidden" name="country" value={country} /></>
          ) : (
            <select id={`${id}-country`} name="country" value={country} onChange={(e) => { setCountry(e.target.value); setRegion(""); setFound(null); setHand(null); }} className={look.input}>
              <option value="US">United States · paid in US dollars</option>
              <option value="NG">Nigeria · paid in naira</option>
            </select>
          )}
        </div>
        <div className={look.field}>
          <label htmlFor={`${id}-addr`} className={look.label}>Street address</label>
          <input id={`${id}-addr`} name="address" value={address} onChange={edit(setAddress)} maxLength={200} autoComplete="street-address" placeholder={travels ? "Leave empty if you have no shop front" : country === "NG" ? "12 Admiralty Way, Lekki Phase 1" : "1402 Gallatin Ave"} className={look.input} />
        </div>
        <div className={look.field}>
          <label htmlFor={`${id}-city`} className={look.label}>City or town</label>
          <input id={`${id}-city`} name="city" value={city} onChange={edit(setCity)} required={requireCity} maxLength={80} autoComplete="address-level2" className={look.input} />
        </div>
        <div className={look.field}>
          <label htmlFor={`${id}-reg`} className={look.label}>State</label>
          <select id={`${id}-reg`} name="region" value={region} onChange={edit(setRegion)} required={requireCity} className={look.input}>
            <option value="">Choose</option>
            {!known && <option value={region}>{region}</option>}
            {list.map((s) => <option key={s.value} value={s.value}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 text-[14px]">
        <input type="checkbox" checked={travels} onChange={(e) => setTravels(e.target.checked)} className="mt-0.5 h-4 w-4 flex-none accent-[#1A1513]" />
        <span>I travel to clients<span className={`block ${look.hint}`}>Clients see &ldquo;Comes to you&rdquo; and your pin marks the area you work from, not a door.</span></span>
      </label>
      <input type="hidden" name="travels" value={travels ? "1" : "0"} />
      {travels && (
        <div className={`${look.field} max-w-[260px]`}>
          <label htmlFor={`${id}-far`} className={look.label}>How far you go, in {miles ? "miles" : "kilometres"}</label>
          <input id={`${id}-far`} type="number" min={1} max={miles ? 310 : 500} step={1} value={far} onChange={(e) => setFar(e.target.value)} placeholder="Leave empty for no limit" className={look.input} />
        </div>
      )}
      <input type="hidden" name="travel_radius_km" value={travels && km ? String(km) : travels ? "0" : ""} />

      {/* Only a pin the person placed is sent. Otherwise the address is looked up when the form is saved. */}
      {hand && <><input type="hidden" name="lat" value={hand.lat} /><input type="hidden" name="lng" value={hand.lng} /></>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => check()} disabled={busy || !city.trim() || !region} className={look.button}>{busy ? "Checking…" : "Check on the map"}</button>
        {!found && !problem && <span className={look.hint}>See where the address lands and which time zone it is in.</span>}
        {problem && <span role="alert" className="text-[13px] font-medium text-bad">{problem}</span>}
      </div>

      {found && (
        <div className="flex flex-col gap-2" aria-live="polite">
          <p className="text-[13.5px] leading-snug">
            {hand ? <b className="font-semibold">Pin placed by hand. It is saved where you put it.</b>
              : found.position === "found" ? <><b className="font-semibold">Found on the map.</b> {found.location.matched && <span className="text-muted [overflow-wrap:anywhere]">{found.location.matched}</span>}</>
              : found.position === "approximate" ? <><b className="font-semibold">Only the city was found,</b> so the pin is its centre. Drag it to where you are, or check the street.</>
              : <b className="font-semibold">That address is not on the map. Check the street and city, or drag the pin once it shows.</b>}
            {" "}Time zone: <b className="font-semibold">{found.timezone_name || zoneName(found.location.timezone)}</b>.
          </p>
          {where && <PinMap lat={where.lat} lng={where.lng} approximate={!hand && found.position === "approximate"} onMove={(lat, lng) => { setHand({ lat, lng }); check({ lat, lng }).catch(() => {}); }} />}
          {where && <p className={look.hint}>Wrong spot? Drag the pin. {hand && <button type="button" onClick={() => { setHand(null); check(); }} className="font-semibold text-wine underline underline-offset-2">Go back to the address</button>}</p>}
        </div>
      )}
      {!found && value.timezone && <p className={look.hint}>Now on {zoneName(value.timezone)}{value.lat != null ? ", with a pin on the map" : ", not on the map yet"}. Saving a new address finds both again.</p>}
    </div>
  );
}
