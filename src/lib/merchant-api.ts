// Server-only client for the merchant API: the people who run a business.
// The session token lives in an httpOnly cookie that only travels to
// /business pages, so scripts in the browser can never read it.
import { cookies } from "next/headers";
import { visitorHeaders } from "./visitor";
import { cache } from "react";

const BASE = process.env.LOGALUXE_API_URL ?? "http://127.0.0.1:18080";
export const MERCHANT_COOKIE = process.env.LOGALUXE_QA === "1" ? "lx_qa_merchant" : "lx_merchant";

export type MRole = "staff" | "manager" | "owner";
export type Merchant = {
  id: string; email: string; name: string; role: MRole; staff_id: string;
  business_id: string; business: string; slug: string; currency: string; timezone: string; market: "US" | "NG"; plan: string; status: string;
  /** What the owner switched on for a team member. Always all true for managers and the owner. */
  permissions: { see_all_calendars: boolean; take_payments: boolean; see_reports: boolean };
};
export type Me = {
  merchant: Merchant;
  businesses: { id: string; name: string; slug: string; role: MRole; area: string }[];
  badges: { area: string; checkout: number; inbox: number; locations: number; time_off: number; verification: string };
  mail_mode?: string;
  modes?: { email: string; sms: string; whatsapp: string };
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export class MerchantApiError extends Error {
  constructor(public status: number, message: string, public body: Row = {}) {
    super(message);
  }
}

async function send<T>(path: string, init: RequestInit): Promise<T> {
  const token = (await cookies()).get(MERCHANT_COOKIE)?.value;
  if (!token) throw new MerchantApiError(401, "You are signed out.");
  let res: Response;
  try {
    res = await fetch(`${BASE}/v1/m${path}`, { ...init, signal: AbortSignal.timeout(25000), headers: { Authorization: `Bearer ${token}`, ...(await visitorHeaders()), ...(init.headers ?? {}) }, cache: "no-store" });
  } catch {
    throw new MerchantApiError(503, "The service is not reachable. Try again in a moment.");
  }
  let body: Row;
  try { body = await res.json(); } catch { throw new MerchantApiError(503, "The service response was interrupted. Try again in a moment."); }
  if (!res.ok) throw new MerchantApiError(res.status, body.error ?? res.statusText);
  return body as T;
}

export function mFetch<T = Row>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  return send<T>(path, { method: init.method ?? "GET", headers: { "Content-Type": "application/json" }, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
}

/** Sends a file. The form data from the browser is passed on as it is. */
export function mUpload<T = Row>(path: string, form: FormData): Promise<T> {
  return send<T>(path, { method: "POST", body: form });
}

/** Who is signed in, the business that is open, and the badges on the menu. Cached for one request. */
export const getMe = cache(async (): Promise<Me | null> => {
  try {
    return await mFetch<Me>("/me");
  } catch (e) {
    if (e instanceof MerchantApiError && e.status === 401) return null;
    throw e;
  }
});

/** Loads the data for a page and turns a failure into a message the page can show. */
export async function mLoad<T = Row>(path: string): Promise<{ data: T; error: string; status: number }> {
  try {
    return { data: await mFetch<T>(path), error: "", status: 200 };
  } catch (e) {
    const err = e as MerchantApiError;
    return { data: {} as T, error: err.message, status: err.status ?? 500 };
  }
}

const rank: Record<MRole, number> = { staff: 1, manager: 2, owner: 3 };
export const mCan = (me: Me | Merchant | null, role: MRole) => {
  const m = me && "merchant" in me ? me.merchant : me;
  return !!m && rank[m.role] >= rank[role];
};

/** Calls an endpoint that needs no session: sign up, sign in, forgot and reset. */
export async function mPublic<T = Row>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/v1/m${path}`, { method: "POST", signal: AbortSignal.timeout(25000), headers: { "Content-Type": "application/json", ...(await visitorHeaders()) }, body: JSON.stringify(body), cache: "no-store" });
  } catch {
    throw new MerchantApiError(503, "The service is not reachable. Try again in a moment.");
  }
  let out: Row;
  try { out = await res.json(); } catch { throw new MerchantApiError(503, "The service response was interrupted. Try again in a moment."); }
  if (!res.ok) throw new MerchantApiError(res.status, out.error ?? "Something went wrong.", out);
  return out as T;
}

export const merchantCookie = (maxAge: number) => ({ httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/business", maxAge });

/** Builds a query string, leaving out empty values. */
export const qs = (params: Record<string, string | number | undefined | null>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};
