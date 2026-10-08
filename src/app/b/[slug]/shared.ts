// Types and small date helpers shared by the business page and the booking
// flow. Every time is shown in the business's own timezone, and the same
// code runs on the server and in the browser so both draw the same text.
import type { Business, Location, Product, Review, Service, Staff } from "@/lib/api";

export type Display = { notice?: string; open_badge?: boolean; show_address?: boolean; show_durations?: boolean; show_from?: boolean; show_phone?: boolean; show_reviews?: boolean; show_staff?: boolean };
export type Policy = { instant?: boolean; waitlist?: boolean; cancel_hours?: number; late_cancel_fee?: string; max_days?: number; anyone?: boolean; multi_service?: boolean; payments_live?: boolean; new_client_deposit_pct?: number; prepay_after_no_show?: boolean };
export type Biz = Business & { tiktok?: string; website?: string; logo_id?: string | null; review_summary?: string };
export type Loc = Location & { lat?: number | null; lng?: number | null };
export type StoreProduct = Pick<Product, "id" | "slug" | "name" | "price_cents" | "tone" | "rating" | "review_count">;
export type StoreReview = Review & { pinned?: boolean };
export type Payload = { business: Biz; locations: Loc[]; staff: Staff[]; services: Service[]; reviews: StoreReview[]; products: StoreProduct[]; display?: Display; policy?: Policy; saved?: boolean; photo_count?: number };
export type Slot = { time: string; starts_at: string; staff_id: string; staff: string; price_cents: number };
export type DayCell = { date: string; open: number; from_cents: number; past: boolean; too_far: boolean };
export type Breakdown = { all?: number; average?: number; s1?: number; s2?: number; s3?: number; s4?: number; s5?: number };

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "09:00" → "9:00". */
export const clock = (t: string) => t.replace(/^0/, "");

/** A moment as the business's clock shows it. */
export function inZone(at: string | Date, tz: string) {
  const d = typeof at === "string" ? new Date(at) : at;
  let p: Intl.DateTimeFormatPart[];
  try {
    p = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  } catch {
    p = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  }
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  const date = `${g("year")}-${g("month")}-${g("day")}`;
  return { date, time: `${g("hour") === "24" ? "00" : g("hour")}:${g("minute")}`, weekday: g("weekday").toLowerCase() };
}

/** "2026-10-10" → "Sat 10 Oct". A calendar date has no timezone, so this is plain arithmetic. */
export function dayLabel(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MON[m - 1]}`;
}

/** A moment → "Sat 10 Oct, 10:00" on the business's clock. */
export function whenLabel(at: string | Date, tz: string, sep = ", ") {
  const z = inZone(at, tz);
  return `${dayLabel(z.date)}${sep}${clock(z.time)}`;
}

export const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
export const firstName = (name?: string | null) => (name ?? "").trim().split(/\s+/)[0] ?? "";

/** The address of the booking flow, carrying what has been chosen so far and where the visitor came from. */
export function bookHref(slug: string, o: { services: string[]; staff?: string; date?: string; time?: string; step?: number; src?: string }) {
  const q = new URLSearchParams();
  if (o.services.length) q.set("services", o.services.join(","));
  if (o.staff) q.set("staff", o.staff);
  if (o.date) q.set("date", o.date);
  if (o.time) q.set("time", o.time);
  if (o.step && o.step > 1) q.set("step", String(o.step));
  if (o.src) q.set("src", o.src);
  // Commas are safe in a query string and keep the address readable.
  return `/b/${slug}/book?${q.toString().replace(/%2C/g, ",").replace(/%3A/g, ":")}`;
}

/** What the business keeps when a client cancels late, in plain words. */
export function lateRule(fee: string | undefined, hasDeposit: boolean) {
  if (fee === "50") return "half the price is charged";
  if (fee === "100") return "the full price is charged";
  if (fee === "deposit") return hasDeposit ? "the deposit is kept" : "";
  return "";
}
