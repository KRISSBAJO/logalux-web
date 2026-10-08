"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { USER_COOKIE, cookieOptions, customerApi, customerUpload, safeNext } from "@/lib/customer";

const v = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const enc = encodeURIComponent;

type Session = { token: string; expires_in: number };

/** A friend's invitation code as it arrives in a link: letters and digits only, twelve at most. */
const refCode = (raw: unknown) => (typeof raw === "string" && /^[A-Za-z0-9]{1,12}$/.test(raw.trim()) ? raw.trim() : "");
/** The API's own words, as a sentence. */
const sentence = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) + (/[.!?]$/.test(s) ? "" : ".") : s);

async function startSession(s: Session) {
  (await cookies()).set(USER_COOKIE, s.token, cookieOptions(s.expires_in));
}

export async function signUp(fd: FormData) {
  const next = safeNext(fd.get("next"));
  // The code of the friend who invited them, when they came by an invitation link.
  const ref = refCode(fd.get("ref"));
  let error = "";
  if (String(fd.get("password") ?? "") !== String(fd.get("again") ?? "")) error = "The two passwords do not match.";
  if (!error) {
    try {
      await startSession(await customerApi<Session>("/auth/signup", {
        method: "POST", auth: false,
        body: { first_name: v(fd, "first_name"), last_name: v(fd, "last_name"), email: v(fd, "email"), phone: v(fd, "phone"), password: String(fd.get("password") ?? ""), ...(ref ? { ref } : {}) },
      }));
    } catch (e) {
      error = (e as Error).message;
    }
  }
  // When the form is shown again, the invitation stays with it.
  redirect(error ? `/signup?next=${enc(next)}${ref ? `&ref=${ref}` : ""}&err=${enc(error)}` : next);
}

export async function signIn(fd: FormData) {
  const next = safeNext(fd.get("next"));
  let error = "";
  try {
    await startSession(await customerApi<Session>("/auth/login", { method: "POST", auth: false, body: { email: v(fd, "email"), password: String(fd.get("password") ?? "") } }));
  } catch (e) {
    error = (e as Error).message;
  }
  redirect(error ? `/signin?next=${enc(next)}&err=${enc(error)}` : next);
}

export async function signOut() {
  try {
    await customerApi("/auth/logout", { method: "POST", body: {} });
  } catch {}
  (await cookies()).delete({ name: USER_COOKIE, path: "/" });
  redirect("/");
}

/** Back to one section of the account with a message. Extra values (an open mover, a chosen day) are kept in the address. */
async function back(kind: "ok" | "err", message: string, tab = "bookings", extra: Record<string, string> = {}): Promise<never> {
  const p = new URLSearchParams({ tab, ...extra, [kind]: message });
  redirect(`/account?${p}`);
}

export async function saveDetails(fd: FormData) {
  let error = "";
  try {
    await customerApi("/auth/me", { method: "PUT", body: { first_name: v(fd, "first_name"), last_name: v(fd, "last_name"), phone: v(fd, "phone") } });
  } catch (e) {
    error = (e as Error).message;
  }
  await (error ? back("err", error, "details") : back("ok", "Your details are saved.", "details"));
}

export async function changeMyPassword(fd: FormData) {
  let error = "";
  if (String(fd.get("new") ?? "") !== String(fd.get("again") ?? "")) error = "The two new passwords do not match.";
  if (!error) {
    try {
      await customerApi("/auth/password", { method: "POST", body: { current: String(fd.get("current") ?? ""), new: String(fd.get("new") ?? "") } });
    } catch (e) {
      error = (e as Error).message;
    }
  }
  await (error ? back("err", error, "details") : back("ok", "Password changed. Other devices have been signed out.", "details"));
}

export async function cancelMyBooking(fd: FormData) {
  let error = "", kept = false;
  const paid = v(fd, "deposit_paid") === "1";
  try {
    kept = !!(await customerApi<{ deposit_kept?: boolean }>(`/auth/bookings/${enc(v(fd, "id"))}/cancel`, { method: "POST", body: {} })).deposit_kept;
  } catch (e) {
    error = (e as Error).message;
  }
  const done = kept
    ? "Booking cancelled. It was past the free cancellation time, so the business keeps the deposit."
    : paid ? "Booking cancelled. Your deposit is being returned to the card or account you paid with." : "Booking cancelled. The time has been released and nothing is owed.";
  await (error ? back("err", error) : back("ok", done));
}

export async function askForReset(fd: FormData) {
  let error = "";
  try {
    await customerApi("/auth/forgot", { method: "POST", auth: false, body: { email: v(fd, "email") } });
  } catch (e) {
    error = (e as Error).message;
  }
  redirect(error ? `/forgot?err=${enc(error)}` : "/forgot?sent=1");
}

export async function chooseNewPassword(fd: FormData) {
  const token = v(fd, "token");
  let error = "";
  if (String(fd.get("password") ?? "") !== String(fd.get("again") ?? "")) error = "The two passwords do not match.";
  if (!error) {
    try {
      await customerApi("/auth/reset", { method: "POST", auth: false, body: { token, password: String(fd.get("password") ?? "") } });
    } catch (e) {
      error = (e as Error).message;
    }
  }
  redirect(error ? `/reset?token=${enc(token)}&err=${enc(error)}` : `/signin?ok=${enc("Password changed. Sign in with the new one.")}`);
}

/** A signed-in client writes to a business. The reply arrives in the same thread. */
export async function sendMessage(fd: FormData) {
  let id = v(fd, "thread"), error = "";
  try {
    id = (await customerApi<{ id: string }>("/auth/threads", { method: "POST", body: { business_slug: v(fd, "slug"), body: v(fd, "body") } })).id;
  } catch (e) {
    error = (e as Error).message;
  }
  const where = id ? `thread=${enc(id)}&` : v(fd, "slug") ? `to=${enc(v(fd, "slug"))}&` : "";
  redirect(`/account?tab=messages&${where}${error ? "err=" + enc(error) : "ok=" + enc("Message sent.")}#messages`);
}

/** A review of a finished visit: one to five stars and a few words. */
export async function leaveReview(fd: FormData) {
  let error = "";
  try {
    await customerApi(`/auth/bookings/${enc(v(fd, "id"))}/review`, { method: "POST", body: { rating: Number(v(fd, "rating")) || 0, body: v(fd, "body") } });
  } catch (e) {
    error = (e as Error).message;
  }
  if (error) await back("err", error, "bookings");
  // Straight to the visit they reviewed, where photos can be added.
  redirect(`/account?tab=bookings&reviewed=${enc(v(fd, "id"))}#b-${enc(v(fd, "id"))}`);
}

export type PhotoState = { error: string; done: number };

/** Adds one photo to a review the client wrote. The API allows three, and asks for a confirmed email. */
export async function addReviewPhoto(prev: PhotoState, fd: FormData): Promise<PhotoState> {
  const id = v(fd, "review_id"), file = fd.get("file");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "We could not find that review.", done: prev.done };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo to upload.", done: prev.done };
  if (file.size > 8 * 1024 * 1024) return { error: "The photo is too large. The limit is 8 MB.", done: prev.done };
  try {
    const out = new FormData();
    out.set("file", file, file.name);
    await customerUpload(`/auth/reviews/${enc(id)}/photos`, out);
  } catch (e) {
    return { error: sentence((e as Error).message), done: prev.done };
  }
  revalidatePath("/account");
  return { error: "", done: prev.done + 1 };
}

/** Takes one of the client's own photos off their review. */
export async function removeReviewPhoto(prev: PhotoState, fd: FormData): Promise<PhotoState> {
  const id = v(fd, "photo_id");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "We could not find that photo.", done: prev.done };
  try {
    await customerApi(`/auth/review-photos/${enc(id)}`, { method: "DELETE" });
  } catch (e) {
    return { error: sentence((e as Error).message), done: prev.done };
  }
  revalidatePath("/account");
  return { error: "", done: prev.done + 1 };
}

/** Takes a product off the saved list. */
export async function removeSavedProduct(fd: FormData) {
  let error = "";
  try {
    await customerApi(`/auth/favourite-products/${enc(v(fd, "slug"))}`, { method: "DELETE" });
  } catch (e) {
    error = sentence((e as Error).message);
  }
  await (error ? back("err", error, "saved") : back("ok", "Removed from your saved products.", "saved"));
}

/** Moves one of the client's own bookings to a new free time. The price agreed when booking is kept. */
export async function moveMyBooking(fd: FormData) {
  const id = v(fd, "id");
  let error = "", out: { starts_at?: string; staff?: string } = {};
  if (!v(fd, "starts_at")) error = "Choose a new time.";
  if (!error) {
    try {
      out = await customerApi(`/auth/bookings/${enc(id)}/reschedule`, { method: "POST", body: { starts_at: v(fd, "starts_at"), staff_id: v(fd, "staff_id") } });
    } catch (e) {
      error = (e as Error).message;
    }
  }
  if (error) await back("err", error.charAt(0).toUpperCase() + error.slice(1) + (/[.!?]$/.test(error) ? "" : "."), "bookings", { move: id, ...(v(fd, "day") ? { day: v(fd, "day") } : {}) });
  let when = "";
  try {
    when = new Date(out.starts_at ?? v(fd, "starts_at")).toLocaleString("en-US", { timeZone: v(fd, "timezone") || undefined, weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
  } catch {}
  await back("ok", `Booking moved${when ? " to " + when : ""}${out.staff ? " with " + out.staff : ""}. The price stays the same.`);
}

/** Takes a business off the saved list. */
export async function removeSaved(fd: FormData) {
  let error = "";
  try {
    await customerApi(`/auth/favourites/${enc(v(fd, "slug"))}`, { method: "DELETE" });
  } catch (e) {
    error = (e as Error).message;
  }
  await (error ? back("err", error, "saved") : back("ok", "Removed from your saved businesses.", "saved"));
}

export async function cancelMyOrder(fd: FormData) {
  let error = "";
  try {
    await customerApi(`/auth/orders/${enc(v(fd, "id"))}/cancel`, { method: "POST" });
  } catch (e) {
    error = (e as Error).message;
  }
  await (error ? back("err", error, "orders") : back("ok", "Order cancelled. Nothing was charged.", "orders"));
}

/** The button on /verify: confirms the address the link was sent to. */
export async function confirmEmail(fd: FormData) {
  const token = v(fd, "token");
  let error = "", email = "";
  try {
    email = (await customerApi<{ email: string }>("/auth/verify", { method: "POST", auth: false, body: { token } })).email;
  } catch (e) {
    error = (e as Error).message;
  }
  redirect(error ? `/verify?err=${enc(error)}` : `/verify?ok=${enc(`${email} is confirmed. Thank you.`)}`);
}

export async function resendConfirmation(fd: FormData) {
  const tab = v(fd, "tab") || "bookings";
  let error = "", email = "";
  try {
    email = (await customerApi<{ email?: string }>("/auth/verify/send", { method: "POST" })).email ?? "";
  } catch (e) {
    error = (e as Error).message;
  }
  await (error ? back("err", error, tab) : back("ok", email ? `We sent a new link to ${email}. It works for 48 hours.` : "Your email is already confirmed.", tab));
}
