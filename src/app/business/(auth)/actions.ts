"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MERCHANT_COOKIE, mPublic, merchantCookie } from "@/lib/merchant-api";

const v = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const enc = encodeURIComponent;
type Session = { token: string; expires_in: number };

async function start(s: Session) {
  (await cookies()).set(MERCHANT_COOKIE, s.token, merchantCookie(s.expires_in));
}

export async function merchantSignIn(fd: FormData) {
  let error = "";
  try {
    await start(await mPublic<Session>("/login", { email: v(fd, "email"), password: String(fd.get("password") ?? "") }));
  } catch (e) {
    error = (e as Error).message;
  }
  redirect(error ? `/business/signin?err=${enc(error)}` : "/business");
}

export async function merchantSignUp(fd: FormData) {
  let error = "";
  if (String(fd.get("password") ?? "") !== String(fd.get("again") ?? "")) error = "The two passwords do not match.";
  if (!error) {
    try {
      await start(await mPublic<Session>("/signup", {
        name: v(fd, "name"), email: v(fd, "email"), phone: v(fd, "phone"), password: String(fd.get("password") ?? ""),
        business: v(fd, "business"), category: v(fd, "category"), market: v(fd, "market"), city: v(fd, "city"), region: v(fd, "region"), address: v(fd, "address"),
      }));
    } catch (e) {
      error = (e as Error).message;
    }
  }
  if (error) {
    // Send back what was typed, apart from the passwords, so nothing has to be entered twice.
    const keep = new URLSearchParams({ err: error });
    for (const k of ["name", "email", "phone", "business", "category", "market", "city", "region", "address"]) if (v(fd, k)) keep.set(k, v(fd, k));
    redirect(`/business/signup?${keep}`);
  }
  redirect(`/business?ok=${enc("Welcome to LogaLuxe. Add your services and your hours, and you are ready to take bookings.")}`);
}

export async function merchantForgot(fd: FormData) {
  try {
    await mPublic("/forgot", { email: v(fd, "email") });
  } catch {}
  redirect(`/business/forgot?ok=${enc("If that email has a business account, a link to choose a new password is on its way.")}`);
}

export async function merchantReset(fd: FormData) {
  const token = v(fd, "token");
  let error = "";
  if (String(fd.get("password") ?? "") !== String(fd.get("again") ?? "")) error = "The two passwords do not match.";
  if (!error) {
    try {
      await mPublic("/reset", { token, password: String(fd.get("password") ?? "") });
    } catch (e) {
      error = (e as Error).message;
    }
  }
  redirect(error ? `/business/reset?token=${enc(token)}&err=${enc(error)}` : `/business/signin?ok=${enc("Password saved. Sign in with it now.")}`);
}
