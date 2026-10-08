// Shared by the merchant server actions. This file is not marked "use server",
// so nothing in it can be called from the browser.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { str } from "./action-helpers";
import { mFetch } from "./merchant-api";

export { str, num, int, cents, on, list } from "./action-helpers";

export const fid = (fd: FormData, k = "id") => encodeURIComponent(str(fd, k));

/** Only ever send someone back to a page inside the merchant web. */
export function mBackTo(fd: FormData, kind: "ok" | "err", message: string): never {
  const raw = str(fd, "back");
  const url = new URL(raw.startsWith("/business") ? raw : "/business", "http://merchant");
  const path = url.pathname.startsWith("/business") ? url.pathname : "/business";
  url.searchParams.delete("ok");
  url.searchParams.delete("err");
  url.searchParams.set(kind, message);
  redirect(path + url.search + url.hash);
}

/** Runs one API call, then returns to the page with a success or an error message. */
export async function mRun(fd: FormData, done: string | ((out: Record<string, unknown>) => string), call: () => Promise<unknown>): Promise<never> {
  let error = "", out: Record<string, unknown> = {};
  try {
    out = ((await call()) ?? {}) as Record<string, unknown>;
  } catch (e) {
    error = (e as Error).message || "Something went wrong.";
  }
  return error ? mBackTo(fd, "err", error) : mBackTo(fd, "ok", typeof done === "function" ? done(out) : done);
}

export const mPost = (path: string, body: unknown = {}) => mFetch(path, { method: "POST", body });
export const mPut = (path: string, body: unknown = {}) => mFetch(path, { method: "PUT", body });
export const mDel = (path: string) => mFetch(path, { method: "DELETE" });

const M_FLASH = "lx_mflash";
type FlashValue = { setup?: { secret: string; uri: string }; recovery?: string[] };

/** Hands a secret (a setup key, recovery codes) to the next page without putting it in the URL. */
export async function mSetFlash(value: FlashValue, seconds: number) {
  (await cookies()).set(M_FLASH, JSON.stringify(value), { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/business/settings", maxAge: seconds });
}
export async function mClearFlash() {
  (await cookies()).delete({ name: M_FLASH, path: "/business/settings" });
}
export async function mReadFlash(): Promise<FlashValue | null> {
  try {
    const raw = (await cookies()).get(M_FLASH)?.value;
    return raw ? (JSON.parse(raw) as FlashValue) : null;
  } catch {
    return null;
  }
}
