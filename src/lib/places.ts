// Server only. Reads places from the API and works out where a visitor is
// looking, and which country's businesses and prices they should be shown.
//
// In order: the place they last chose or confirmed (kept in a cookie); else a
// first guess from their internet address, made by the API (GET /v1/locate)
// and shown as a guess; else the place with the most businesses. The device's
// own position is never asked for here: that happens only when the visitor
// presses "Near me".
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { PLACE_COOKIE, readChosen, type Chosen, type Place } from "./place";

const BASE = process.env.LOGALUXE_API_URL ?? "http://127.0.0.1:18080";

export type Country = { code: string; name: string; currency: string; unit: "mi" | "km"; places: number; businesses: number };
export type PlaceList = { places: Place[]; countries: Country[]; default: Place | null };
export type State = { value: string; code: string; name: string };

async function getJson<T>(path: string, revalidate?: number): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, revalidate === undefined ? { cache: "no-store" } : { next: { revalidate } });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Every place that has live businesses, busiest first. Empty when the API cannot be reached. Kept for a minute. */
export const livePlaces = cache(async (): Promise<PlaceList> => {
  const d = await getJson<PlaceList>("/v1/places", 60);
  return { places: d?.places ?? [], countries: d?.countries ?? [], default: d?.default ?? null };
});

/** One place by its slug, with the nearest places that have businesses. `canonical` is set when the slug is an old form. Null when unknown. */
export const getPlace = cache(async (slug: string): Promise<{ place: Place; canonical: string; nearest: Place[] } | null> => {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  return getJson(`/v1/places/${slug}`, 60);
});

/** The states of both countries, for a form. Kept for a day: they do not change. */
export const allStates = cache(async (): Promise<Record<string, State[]>> => {
  return (await getJson<{ states: Record<string, State[]> }>("/v1/places/states", 86400))?.states ?? {};
});

/** What GET /v1/locate answers. */
type Located = { source: "edge" | "ip" | "default"; approximate: boolean; country: string; country_name: string; served: boolean; place: Place | null; default: Place | null };

// What a network in front of the web app says about the visitor. The API believes these only from us.
const EDGE = ["cf-ipcountry", "cf-ipcity", "cf-region-code", "cf-region", "cf-iplatitude", "cf-iplongitude", "x-vercel-ip-country", "x-vercel-ip-country-region", "x-vercel-ip-city", "x-vercel-ip-latitude", "x-vercel-ip-longitude",
  "cloudfront-viewer-country", "cloudfront-viewer-country-region", "cloudfront-viewer-city", "cloudfront-viewer-latitude", "cloudfront-viewer-longitude"];

/** The first guess from the visitor's internet address. Never throws and never waits long: with no answer the caller falls back to the busiest place. */
const locate = cache(async (): Promise<Located | null> => {
  try {
    const h = await headers();
    const send: Record<string, string> = {};
    const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || (h.get("x-real-ip") ?? "").trim();
    if (ip) send["X-Visitor-IP"] = ip;
    if (process.env.WEB_API_KEY) send["X-Web-Key"] = process.env.WEB_API_KEY;
    for (const name of EDGE) { const v = h.get(name); if (v) send[name] = v; }
    // Development only: a cookie names an address to try the flow with (document.cookie = "lx_dev_ip=8.8.8.8; path=/").
    // The API honours it only when it is itself in development.
    if (process.env.NODE_ENV !== "production") {
      const dev = (await cookies()).get("lx_dev_ip")?.value ?? "";
      if (/^[0-9a-fA-F.:]{3,45}$/.test(dev)) send["X-Geo-IP"] = dev;
    }
    const res = await fetch(`${BASE}/v1/locate`, { headers: send, cache: "no-store", signal: AbortSignal.timeout(2500) });
    return res.ok ? ((await res.json()) as Located) : null;
  } catch {
    return null;
  }
});

/**
 * Where the visitor is looking.
 *
 * `source`: `chosen` they picked the place · `device` they pressed "Near me" · `ip` a guess from their internet address
 * (approximate: say "we think") · `default` we could not tell, so this is the busiest place · `none` the API has no places.
 *
 * `scope` is the country whose professionals, products and prices they are shown ("US" or "NG"; "" when unknown).
 * `home` is the country we think they are really in, when it is one we serve. When the two differ they are
 * browsing another country on purpose (a gift for someone in Nigeria, say), and the site says so.
 */
export type Where = { place: Place | null; chosen: Chosen | null; source: "chosen" | "device" | "ip" | "default" | "none"; scope: string; home: string; abroad: boolean; elsewhere: string };

const served = (c: string | undefined) => c === "US" || c === "NG";

/** Where this visitor is looking. Read once per request. */
export const whereAmI = cache(async (): Promise<Where> => {
  let chosen: Chosen | null = null;
  try {
    chosen = readChosen((await cookies()).get(PLACE_COOKIE)?.value);
  } catch {}
  const { places, default: busiest } = await livePlaces();
  if (chosen) {
    const live = places.find((p) => p.slug && p.slug === chosen!.slug);
    const place: Place = live && chosen.src === "picked" ? live : {
      slug: chosen.slug, kind: chosen.kind, city: chosen.city, region: chosen.region, region_name: live?.region_name ?? chosen.region, country: chosen.country, country_name: live?.country_name ?? chosen.country,
      label: chosen.label, lat: chosen.lat, lng: chosen.lng, businesses: live?.businesses ?? 0, categories: live?.categories, currency: chosen.country === "NG" ? "NGN" : "USD", unit: chosen.country === "US" ? "mi" : "km", timezone: live?.timezone ?? "",
    };
    // Somewhere we do not trade (a point abroad): they are shown the country with the most businesses.
    const scope = served(place.country) ? place.country : busiest?.country ?? "";
    const home = served(chosen.home) ? chosen.home : "";
    return { place, chosen, source: chosen.src === "device" ? "device" : "chosen", scope, home, abroad: !!home && !!scope && home !== scope, elsewhere: served(place.country) ? "" : place.country };
  }
  const guess = await locate();
  if (guess?.place && guess.source !== "default" && guess.served) {
    return { place: guess.place, chosen: null, source: "ip", scope: guess.place.country, home: guess.place.country, abroad: false, elsewhere: "" };
  }
  const place = guess?.default ?? busiest;
  // `elsewhere`: we could tell the country, and it is not one we trade in.
  const elsewhere = guess && guess.source !== "default" && !guess.served ? guess.country_name || guess.country : "";
  return place ? { place, chosen: null, source: "default", scope: place.country, home: "", abroad: false, elsewhere } : { place: null, chosen: null, source: "none", scope: "", home: "", abroad: false, elsewhere };
});

/** What the place picker is told, the same on every page: the place, how we came by it, and what to offer. */
export const pickerWhere = cache(async () => {
  const [where, { places, countries }] = await Promise.all([whereAmI(), livePlaces()]);
  return {
    label: where.place?.label ?? "", source: where.source, scope: where.scope,
    // With no guess at all, the country we started them in stands for theirs, so a switch to the other country is still announced.
    home: where.home || (where.source === "default" ? where.scope : ""),
    // Only the country being browsed: someone in the United States is not offered Lagos unless they ask for Nigeria.
    suggested: places.filter((p) => !where.scope || p.country === where.scope).slice(0, 8),
    countries: countries.filter((c) => c.businesses > 0).map((c) => ({ code: c.code, name: c.name })),
  };
});
