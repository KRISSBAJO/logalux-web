// Thin client for the public Go API. The admin console has its own
// server-only client in admin-api.ts.

const BASE = process.env.LOGALUXE_API_URL ?? "http://127.0.0.1:18080";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(init.headers as Record<string, string>) };
  const res = await fetch(`${BASE}${path}`, { ...init, headers, cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? res.statusText);
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(data) }),
};

// ---- Types that mirror the API's JSON ----

export type Business = {
  id: string; slug: string; name: string; tagline: string; about?: string; category: string; market: "US" | "NG";
  currency: string; timezone?: string; rating: string | number; review_count: number; verification_status: string;
  tone: string; highlights: string[]; area?: string; city?: string; from_cents?: number | null; owner_name?: string;
  status?: string; plan?: string; phone?: string; instagram?: string;
};
export type Location = { id: string; name: string; address: string; city: string; region: string; country: string; timezone: string; is_primary: boolean; hours: Record<string, [string, string] | null>; arrival_notes: string };
export type Staff = { id: string; name: string; initials: string; role: string; level: string; tone: string; rating: string | number };
export type Service = { id: string; name: string; category: string; description: string; duration_min: number; processing_min: number; buffer_min: number; price_cents: number; deposit_cents: number };
export type Review = { id: string; author_name: string; service_name: string; rating: number; body: string; reply: string; created_at: string };
export type Product = {
  id: string; slug: string; name: string; seller_name: string; category: string; description?: string; how_to_use?: string;
  price_cents: number; compare_cents: number | null; stock: number; tone: string; tags: string[]; rating: string | number;
  review_count: number; sold: number; pickup: boolean; shipping: boolean; shipping_cents?: number; business_slug?: string | null;
  sizes: { label: string; price_cents: number }[];
};

export const money = (cents: number, currency = "USD") => {
  const amount = cents / 100;
  if (currency === "NGN") return `₦${amount.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
  return amount.toLocaleString("en-US", { style: "currency", currency, maximumFractionDigits: amount % 1 === 0 ? 0 : 2 });
};

export const duration = (min: number) => {
  const h = Math.floor(min / 60), m = min % 60;
  return [h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
};
