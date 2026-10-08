// Formatting shared by the merchant screens. Safe to use on the server and in the browser.

const SYMBOL: Record<string, string> = { USD: "$", NGN: "₦" };

/** Minor units as money: 14000 → $140, 14050 → $140.50, NGN 4500000 → ₦45,000. */
export function money(cents: number | null | undefined, currency = "USD", opts: { sign?: boolean; exact?: boolean } = {}): string {
  const n = Number(cents ?? 0);
  const abs = Math.abs(n) / 100;
  const whole = !opts.exact && Math.round(abs * 100) % 100 === 0;
  const text = abs.toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
  const sym = SYMBOL[currency] ?? currency + " ";
  return (n < 0 ? "−" : opts.sign && n > 0 ? "+" : "") + sym + text;
}

/** "3 h 30", "45 min". */
export function dur(min: number | null | undefined): string {
  const m = Math.max(0, Math.round(Number(min ?? 0)));
  if (m < 60) return `${m} min`;
  return m % 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m / 60} h`;
}

const fmt = (tz: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: tz, ...o });
const d = (v: string | Date) => (v instanceof Date ? v : new Date(v));
const part = (v: string | Date, tz: string, o: Intl.DateTimeFormatOptions) => {
  const parts = fmt(tz, o).formatToParts(d(v));
  return (type: string) => parts.find((x) => x.type === type)?.value ?? "";
};

/** A clock time in the timezone of the business: "14:30". */
export const clock = (v: string | Date, tz: string) => { const g = part(v, tz, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }); return `${g("hour")}:${g("minute")}`; };
/** "Sat 10 Oct". */
export const dayShort = (v: string | Date, tz: string) => { const g = part(v, tz, { weekday: "short", day: "numeric", month: "short" }); return `${g("weekday")} ${g("day")} ${g("month")}`; };
/** "Saturday, October 10". */
export const dayLong = (v: string | Date, tz: string) => fmt(tz, { weekday: "long", month: "long", day: "numeric" }).format(d(v));
/** "10 Oct 2026". */
export const dateMed = (v: string | Date, tz: string) => { const g = part(v, tz, { day: "numeric", month: "short", year: "numeric" }); return `${g("day")} ${g("month")} ${g("year")}`; };
/** The calendar date in the timezone of the business, as YYYY-MM-DD. */
export const ymd = (v: string | Date, tz: string) => { const g = part(v, tz, { year: "numeric", month: "2-digit", day: "2-digit" }); return `${g("year")}-${g("month")}-${g("day")}`; };
/** A date-only value from the API ("2026-10-16T00:00:00Z") shown without shifting the day. */
export const dateOnly = (v: string | null | undefined, style: "short" | "med" = "short") => {
  if (!v) return "";
  const noon = v.slice(0, 10) + "T12:00:00Z";
  return style === "short" ? dayShort(noon, "UTC") : dateMed(noon, "UTC");
};
/** "09:21" today, "yesterday", or "3 Oct". */
export function when(v: string | Date, tz: string): string {
  const today = ymd(new Date(), tz), that = ymd(v, tz);
  if (today === that) return clock(v, tz);
  if (ymd(new Date(Date.now() - 864e5), tz) === that) return "yesterday";
  const g = part(v, tz, { day: "numeric", month: "short" });
  return `${g("day")} ${g("month")}`;
}
/** Minutes since midnight in the timezone of the business. */
export const minutesOfDay = (v: string | Date, tz: string) => { const [h, m] = clock(v, tz).split(":").map(Number); return h * 60 + m; };
/** Moves a YYYY-MM-DD date by a number of days. */
export const addDays = (day: string, n: number) => new Date(Date.parse(day + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
/** "Kemi Adeyemi" → "Kemi A." */
export const shortName = (name: string) => { const [a, ...rest] = name.trim().split(/\s+/); return rest.length ? `${a} ${rest[rest.length - 1][0]}.` : a; };
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";
export const pct = (some: number, whole: number) => (whole > 0 ? Math.round((some / whole) * 100) : 0);
export const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

export const STATUS_LABEL: Record<string, string> = {
  requested: "Requested", confirmed: "Confirmed", checked_in: "Arrived", in_progress: "In progress", completed: "Finished", paid: "Paid",
  cancelled_client: "Cancelled by client", cancelled_business: "Cancelled", no_show: "No-show", rescheduled: "Moved",
};
export const CHANNEL_LABEL: Record<string, string> = { whatsapp: "WhatsApp", sms: "SMS", email: "Email", in_app: "in-app", instagram: "Instagram" };
export const METHOD_LABEL: Record<string, string> = { card: "Card", tap: "Tap to pay", cash: "Cash", transfer: "Bank transfer", wallet: "Wallet", stripe: "Stripe", paystack: "Paystack" };
