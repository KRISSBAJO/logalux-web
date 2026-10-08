// Server-only client for the admin API. The session token lives in an
// httpOnly cookie and is attached here, so the browser never reads it.
import { cookies } from "next/headers";
import { visitorHeaders } from "./visitor";
import { cache } from "react";

const BASE = process.env.LOGALUXE_API_URL ?? "http://127.0.0.1:18080";
export const SESSION_COOKIE = "lx_session";

export type Role = "support" | "ops" | "super_admin";
export type Admin = { id: string; email: string; name: string; role: Role };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export class AdminApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function adminFetch<T = Row>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) throw new AdminApiError(401, "You are signed out.");
  let res: Response;
  try {
    res = await fetch(`${BASE}/v1/admin${path}`, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch {
    throw new AdminApiError(503, "The API is not reachable.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new AdminApiError(res.status, body.error ?? res.statusText);
  return body as T;
}

/** Sends a file to the admin API. The browser's form data is passed on as it is. */
export async function adminUpload<T = Row>(path: string, form: FormData): Promise<T> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) throw new AdminApiError(401, "You are signed out.");
  let res: Response;
  try {
    res = await fetch(`${BASE}/v1/admin${path}`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form, cache: "no-store" });
  } catch {
    throw new AdminApiError(503, "The API is not reachable.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new AdminApiError(res.status, body.error ?? res.statusText);
  return body as T;
}

/** The signed-in admin, or null. Cached for the length of one request. */
export const getAdmin = cache(async (): Promise<Admin | null> => {
  try {
    return (await adminFetch<{ admin: Admin }>("/me")).admin;
  } catch {
    return null;
  }
});

/** Loads a page's data and turns a failure into a message the page can show. */
export async function load(path: string): Promise<{ data: Row; error: string }> {
  try {
    return { data: await adminFetch<Row>(path), error: "" };
  } catch (e) {
    return { data: {}, error: (e as Error).message };
  }
}

const rank: Record<Role, number> = { support: 1, ops: 2, super_admin: 3 };
export const can = (admin: Admin | null, role: Role) => !!admin && rank[admin.role] >= rank[role];

export async function signIn(email: string, password: string, code = ""): Promise<{ token: string; expires_in: number }> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/v1/admin/login`, { method: "POST", headers: { "Content-Type": "application/json", ...(await visitorHeaders()) }, body: JSON.stringify({ email, password, code }), cache: "no-store" });
  } catch {
    throw new AdminApiError(503, "The API is not reachable.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new AdminApiError(res.status, body.error ?? "Sign-in failed.");
  return body;
}

/** Builds a query string, leaving out empty values. */
export const qs = (params: Record<string, string | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
};
