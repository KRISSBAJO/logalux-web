// Shared by the admin server actions. This file is not marked "use server",
// so nothing in it can be called from the browser.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminFetch } from "./admin-api";

export const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
export const num = (fd: FormData, k: string) => parseFloat(str(fd, k)) || 0;
export const int = (fd: FormData, k: string) => Math.round(num(fd, k));
/** A money field typed in major units, as minor units. */
export const cents = (fd: FormData, k: string) => Math.round(num(fd, k) * 100);
export const on = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "1";
/** One entry per line or comma. */
export const list = (fd: FormData, k: string) => str(fd, k).split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
export const id = (fd: FormData) => encodeURIComponent(str(fd, "id"));

/** Only ever send the admin back to a page inside the console. */
export function backTo(fd: FormData, kind: "ok" | "err", message: string): never {
  const raw = str(fd, "back");
  const url = new URL(raw.startsWith("/admin") ? raw : "/admin", "http://console");
  const path = url.pathname.startsWith("/admin") ? url.pathname : "/admin";
  url.searchParams.delete("ok");
  url.searchParams.delete("err");
  url.searchParams.set(kind, message);
  redirect(path + url.search + url.hash);
}

/** Runs one API call, then returns to the page with a success or an error message. */
export async function run(fd: FormData, done: string, call: () => Promise<unknown>): Promise<never> {
  let error = "";
  try {
    await call();
  } catch (e) {
    error = (e as Error).message || "Something went wrong.";
  }
  return error ? backTo(fd, "err", error) : backTo(fd, "ok", done);
}

export const post = (path: string, body: unknown) => adminFetch(path, { method: "POST", body });
export const put = (path: string, body: unknown) => adminFetch(path, { method: "PUT", body });
export const del = (path: string) => adminFetch(path, { method: "DELETE" });

const FLASH = "lx_flash";

/** Hands a secret (a setup key, recovery codes) to the next page without putting it in the URL. */
export async function setFlash(value: Record<string, unknown>, seconds: number) {
  (await cookies()).set(FLASH, JSON.stringify(value), { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/admin/account", maxAge: seconds });
}
export async function clearFlash() {
  (await cookies()).delete({ name: FLASH, path: "/admin/account" });
}
export async function readFlash<T = Record<string, unknown>>(): Promise<T | null> {
  try {
    const raw = (await cookies()).get(FLASH)?.value;
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
