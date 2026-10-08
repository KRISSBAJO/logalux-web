// Server-only helpers for the signed-in customer. The session token lives in
// an httpOnly cookie, so scripts in the browser can never read it.
import { cookies } from "next/headers";
import { cache } from "react";
import { visitorHeaders } from "./visitor";

const BASE = process.env.LOGALUXE_API_URL ?? "http://127.0.0.1:18080";
export const USER_COOKIE = "lx_user";

export type Customer = { id: string; email: string; first_name: string; last_name: string; phone: string; email_verified?: boolean };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export class CustomerApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function userToken(): Promise<string | undefined> {
  return (await cookies()).get(USER_COOKIE)?.value;
}

/** Calls the API. With `auth`, the customer's token is attached when there is one. */
export async function customerApi<T = Row>(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(await visitorHeaders()) };
  if (init.auth !== false) {
    const token = await userToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}/v1${path}`, { method: init.method ?? "GET", headers, body: init.body === undefined ? undefined : JSON.stringify(init.body), cache: "no-store" });
  } catch {
    throw new CustomerApiError(503, "We could not reach the service. Try again in a moment.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new CustomerApiError(res.status, body.error ?? "Something went wrong.");
  return body as T;
}

/** The signed-in customer, or null for a guest. Cached for the length of one request. */
export const getCustomer = cache(async (): Promise<Customer | null> => {
  if (!(await userToken())) return null;
  try {
    return (await customerApi<{ user: Customer }>("/auth/me?brief=1")).user;
  } catch {
    return null;
  }
});

/** Only ever send someone to a page on this site after signing in. */
export function safeNext(raw: unknown, fallback = "/account"): string {
  const s = typeof raw === "string" ? raw : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") && !s.startsWith("/admin") ? s : fallback;
}

export const cookieOptions = (maxAge: number) => ({ httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge });

/** Sends a file as the signed-in customer. The form data from the browser is passed on as it is. */
export async function customerUpload<T = Row>(path: string, form: FormData): Promise<T> {
  const token = await userToken();
  if (!token) throw new CustomerApiError(401, "You are signed out. Sign in and try again.");
  let res: Response;
  try {
    // No Content-Type here: fetch writes the multipart boundary itself.
    res = await fetch(`${BASE}/v1${path}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, ...(await visitorHeaders()) }, body: form, cache: "no-store" });
  } catch {
    throw new CustomerApiError(503, "We could not reach the service. Try again in a moment.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new CustomerApiError(res.status, body.error ?? "Something went wrong.");
  return body as T;
}
