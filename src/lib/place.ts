// Places as the API describes them, and the place a visitor has chosen.
// Nothing here lists a city: the places LogaLuxe serves are wherever live
// businesses are, read from GET /v1/places. This file is safe to import from
// the browser; the server-only helpers are in places.ts.

/** A city, a state or a whole country. `point` is a spot with no page of its own: somewhere we do not serve, or open country. */
export type Place = {
  slug: string; kind: "city" | "state" | "country" | "point";
  city: string; region: string; region_name: string; country: string; country_name: string; label: string;
  lat: number; lng: number; businesses: number; categories?: Record<string, number>;
  currency: string; unit: "mi" | "km"; timezone: string;
  /** Set when the place is listed in relation to a point. */
  distance_km?: number; distance?: number; distance_text?: string;
};

/**
 * Where the visitor is looking, as kept in their browser.
 * `picked`: they chose it. `device`: they pressed "Near me" and this is where their device is.
 */
export type Chosen = {
  slug: string; kind: Place["kind"]; label: string; city: string; region: string; country: string; lat: number; lng: number; src: "picked" | "device";
  /** The country we think the person is really in (from their internet address), noted when they chose. It tells "browsing Nigeria from the United States" apart from being there. */
  home: string;
};

/** The cookie that keeps the chosen place. It is read by the server so the first page already shows the right place. */
export const PLACE_COOKIE = "lx_place";
const SIX_MONTHS = 60 * 60 * 24 * 180;

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** Set when the person refused to share their device's position, so the site does not keep suggesting it. */
export const DENIED_COOKIE = "lx_geo_no";

export function toChosen(p: Pick<Place, "slug" | "kind" | "label" | "city" | "region" | "country" | "lat" | "lng">, src: Chosen["src"], home = ""): Chosen {
  // Three decimals is about a hundred metres: enough for a distance, and no more exact than it needs to be.
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return { slug: p.slug, kind: p.kind, label: p.label, city: p.city, region: p.region, country: p.country, lat: r(p.lat), lng: r(p.lng), src, home: /^[A-Z]{2}$/.test(home) ? home : "" };
}

export function readChosen(raw: string | undefined | null): Chosen | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(decodeURIComponent(raw)) as Partial<Chosen>;
    if (typeof c.label !== "string" || !c.label || c.label.length > 120 || !finite(c.lat) || !finite(c.lng) || Math.abs(c.lat) > 90 || Math.abs(c.lng) > 180) return null;
    return {
      slug: typeof c.slug === "string" && /^[a-z0-9-]{0,80}$/.test(c.slug) ? c.slug : "",
      kind: c.kind === "state" || c.kind === "point" || c.kind === "country" ? c.kind : "city",
      label: c.label, city: String(c.city ?? "").slice(0, 80), region: String(c.region ?? "").slice(0, 80), country: String(c.country ?? "").slice(0, 2).toUpperCase(),
      lat: c.lat, lng: c.lng, src: c.src === "device" ? "device" : "picked",
      home: typeof c.home === "string" && /^[A-Z]{2}$/.test(c.home) ? c.home : "",
    };
  } catch {
    return null;
  }
}

/** Browser only: remember the place. */
export function keepChosen(c: Chosen) {
  document.cookie = `${PLACE_COOKIE}=${encodeURIComponent(JSON.stringify(c))}; path=/; max-age=${SIX_MONTHS}; samesite=lax`;
}

/** Browser only: forget it (and any refusal), so the site goes back to its first guess. */
export function forgetChosen() {
  document.cookie = `${PLACE_COOKIE}=; path=/; max-age=0; samesite=lax`;
  document.cookie = `${DENIED_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

/** Browser only: remember that the person said no to sharing their device's position. */
export function rememberRefusal() {
  document.cookie = `${DENIED_COOKIE}=1; path=/; max-age=${SIX_MONTHS}; samesite=lax`;
}

/** Browser only: whether they said no before. */
export const refusedBefore = () => typeof document !== "undefined" && document.cookie.split("; ").some((c) => c === `${DENIED_COOKIE}=1`);

/** The money of a country, in a sentence: "naira", "US dollars". */
export const moneyName = (country: string) => (country === "NG" ? "naira" : "US dollars");

/** "Nashville" from "Nashville, TN": the short name for a heading. */
export const shortName = (p: { city: string; label: string }) => p.city || p.label;

/** "the United States" inside a sentence. */
export const inCountry = (country: string) => (country === "US" ? "the United States" : country === "NG" ? "Nigeria" : country);

/** "4 professionals", "1 professional". */
export const people = (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? "professional" : "professionals"}`;

/** Zones as people say them. Anything else is shown as its own name. */
export function zoneName(zone: string): string {
  const names: Record<string, string> = {
    "America/New_York": "Eastern time", "America/Detroit": "Eastern time", "America/Indiana/Indianapolis": "Eastern time", "America/Kentucky/Louisville": "Eastern time",
    "America/Chicago": "Central time", "America/Denver": "Mountain time", "America/Boise": "Mountain time", "America/Phoenix": "Arizona time",
    "America/Los_Angeles": "Pacific time", "America/Anchorage": "Alaska time", "America/Adak": "Aleutian time", "Pacific/Honolulu": "Hawaii time",
    "Africa/Lagos": "West Africa time", "America/Puerto_Rico": "Atlantic time", "America/St_Thomas": "Atlantic time", "Pacific/Guam": "Chamorro time", "Pacific/Pago_Pago": "Samoa time",
  };
  return names[zone] ?? zone.replace(/_/g, " ");
}

/** The part of an address a name becomes, as the API makes it: "St. Louis" is "st-louis". */
export const slugify = (s: string) => s.toLowerCase().trim().replace(/['’.]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/**
 * The address of a city's page, as the API makes it (geo.PlaceSlug): "nashville-tn" in the United States,
 * "port-harcourt-rivers" or "abuja-fct" in Nigeria. "" when the state is missing.
 */
export function placeSlug(city: string, region: string, country: string): string {
  if (!city.trim() || !region.trim()) return "";
  if (country === "US") return /^[A-Za-z]{2}$/.test(region.trim()) ? `${slugify(city)}-${region.trim().toLowerCase()}` : "";
  if (country === "NG") return `${slugify(city)}-${region.trim().toUpperCase() === "FCT" ? "fct" : slugify(region)}`;
  return "";
}

/** One calm line about where the visitor is looking, for beside a "Change" link: "Near Nashville, TN", "We think you are near Atlanta, GA". */
export function whereLine(w: { label: string; source: string }, kind?: Place["kind"], country?: string): string {
  if (!w.label) return "";
  if (kind === "country" && country) return w.source === "ip" ? `We think you are in ${inCountry(country)}` : `Across ${inCountry(country)}`;
  if (kind === "state") return `In ${w.label}`;
  if (w.source === "ip") return `We think you are near ${w.label}`;
  if (w.source === "device") return `Nearest to you, around ${w.label}`;
  return `Near ${w.label}`;
}

