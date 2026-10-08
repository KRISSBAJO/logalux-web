"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { money } from "@/lib/api";
import { cardFields } from "@/lib/cards";
import { USER_COOKIE, CustomerApiError, cookieOptions, customerApi, customerUpload, safeNext } from "@/lib/customer";

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

/**
 * Cancels every upcoming visit of a repeating booking. There is no single call for this, so each visit is
 * cancelled on its own and the answer for each is reported: some may be past their free cancellation time.
 */
export async function cancelMySeries(fd: FormData) {
  const series = v(fd, "series");
  type B = { id: string; status: string; starts_at: string; ends_at: string; timezone: string; series_id?: string | null; deposit_paid?: boolean };
  let list: B[] = [];
  try {
    list = (await customerApi<{ bookings: B[] }>("/auth/me")).bookings ?? [];
  } catch (e) {
    await back("err", (e as Error).message);
  }
  const now = Date.now();
  const visits = list
    .filter((b) => !!series && b.series_id === series && ["requested", "confirmed"].includes(b.status) && new Date(b.starts_at).getTime() > now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  if (visits.length === 0) await back("err", "There are no upcoming visits in this series to cancel.");
  const lines: string[] = [];
  let done = 0;
  for (const b of visits) {
    const at = new Date(b.starts_at).toLocaleString("en-US", { timeZone: b.timezone || "UTC", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
    try {
      const kept = !!(await customerApi<{ deposit_kept?: boolean }>(`/auth/bookings/${enc(b.id)}/cancel`, { method: "POST", body: {} })).deposit_kept;
      done++;
      lines.push(`${at}: cancelled. ${kept ? "It was past the free cancellation time, so the business keeps the deposit." : b.deposit_paid ? "Your deposit is being returned to the card or account you paid with." : "The time has been released and nothing is owed."}`);
    } catch (e) {
      lines.push(`${at}: not cancelled. ${sentence((e as Error).message)}`);
    }
  }
  revalidatePath("/account");
  const head = done === visits.length ? `${done === 1 ? "The 1 upcoming visit" : `All ${done} upcoming visits`} in this series ${done === 1 ? "was" : "were"} cancelled.` : `${done} of ${visits.length} upcoming visits in this series were cancelled.`;
  await back(done === visits.length ? "ok" : "err", [head, ...lines].join("\n"));
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

// ---------- after the sale: a return, a tip, a problem with a visit ----------

/** What a form in the account is told after it is sent. `url` is a payment page to go to. */
export type CareState = { error: string; url?: string };
const UUID = /^[0-9a-f-]{36}$/i;

/** Asks the seller to take back their part of an order. The seller answers by email. */
export async function askReturn(_prev: CareState, fd: FormData): Promise<CareState> {
  const id = v(fd, "order"), seller = v(fd, "seller"), reason = v(fd, "reason"), note = v(fd, "note");
  if (!UUID.test(id) || !seller) return { error: "We could not find that order." };
  if (!reason) return { error: "Choose why you are returning it." };
  if ((reason === "other" || reason === "not_as_described") && note.length < 10) return { error: "Tell the seller what is wrong, in a sentence or two." };
  try {
    await customerApi(`/auth/orders/${enc(id)}/returns`, { method: "POST", body: { seller, reason, note } });
  } catch (e) {
    return { error: sentence((e as Error).message) };
  }
  redirect(`/account?tab=orders&ok=${enc(`Return requested. ${seller} will answer by email.`)}#o-${id}`);
}

/** Adds a tip to a finished visit. With payments live the answer is a payment page, unless a kept card paid it at once; otherwise the tip is already recorded. */
export async function addTip(_prev: CareState, fd: FormData): Promise<CareState> {
  const id = v(fd, "id"), cents = Math.round(Number(v(fd, "amount_cents")));
  if (!UUID.test(id)) return { error: "We could not find that visit." };
  if (!Number.isFinite(cents) || cents <= 0) return { error: "Choose an amount for the tip." };
  let out: { amount_cents?: number; currency?: string; payment?: { url?: string } };
  try {
    // A kept card pays at once; a new card is kept only when the box was ticked. Both are dropped unless saved cards are switched on.
    out = await customerApi(`/auth/bookings/${enc(id)}/tip`, { method: "POST", body: await cardFields({ amount_cents: cents, card_id: v(fd, "card_id"), save_card: v(fd, "save_card") === "1" }) });
  } catch (e) {
    return { error: sentence((e as Error).message) };
  }
  if (out.payment?.url) return { error: "", url: out.payment.url };
  redirect(`/account?tab=bookings&ok=${enc(`Thank you. Your ${money(Number(out.amount_cents) || cents, out.currency || "USD")} tip is on its way to ${v(fd, "business") || "the business"}.`)}#b-${id}`);
}

/** Reports a problem with a visit. The business has 48 hours to give its side, then LogaLuxe decides. */
export async function reportProblem(_prev: CareState, fd: FormData): Promise<CareState> {
  const id = v(fd, "id"), reason = v(fd, "reason"), statement = v(fd, "statement");
  if (!UUID.test(id)) return { error: "We could not find that visit." };
  if (!reason) return { error: "Choose what went wrong." };
  if (statement.length < 20) return { error: "Describe what happened in a few sentences, 20 characters or more." };
  if (statement.length > 2000) return { error: "Keep it under 2,000 characters." };
  let ref = "";
  try {
    ref = (await customerApi<{ ref?: string }>(`/auth/bookings/${enc(id)}/problem`, { method: "POST", body: { reason, statement } })).ref ?? "";
  } catch (e) {
    return { error: sentence((e as Error).message) };
  }
  redirect(`/account?tab=bookings&ok=${enc(`Your report is in${ref ? `, reference ${ref}` : ""}. ${v(fd, "business") || "The business"} has 48 hours to give its side. Then LogaLuxe decides and emails you.`)}#b-${id}`);
}

// ---------- signing in with a texted code, and confirming a number ----------

/** Where the "Text me a code" form stands. The server moves it on; the browser only shows it. */
export type CodeState = {
  stage: "phone" | "code" | "name" | "password";
  phone: string; channel: "sms" | "whatsapp"; code: string;
  /** "delivered", or "logged" when the number is one that cannot be texted. */
  sent: string; error: string;
  /** Goes up each time a code is sent, so the wait before "Send a new code" starts again. */
  sends: number;
};

const digits = (s: string) => s.replace(/\D/g, "").slice(0, 6);

/** One step of signing in or signing up with a code: send it, check it, or finish with a name. */
export async function codeStep(prev: CodeState, fd: FormData): Promise<CodeState> {
  const intent = v(fd, "intent");
  const next = safeNext(fd.get("next"));
  if (intent === "restart") return { stage: "phone", phone: prev.phone, channel: prev.channel, code: "", sent: "", error: "", sends: prev.sends };

  if (intent === "send") {
    const phone = v(fd, "phone") || prev.phone;
    const channel = v(fd, "channel") === "whatsapp" ? "whatsapp" : "sms";
    if (!phone) return { ...prev, error: "Enter your mobile number with the country code, like +1 615 555 0100." };
    try {
      const out = await customerApi<{ sent?: string }>("/auth/code/send", { method: "POST", auth: false, body: { phone, channel } });
      return { stage: "code", phone, channel, code: "", sent: out.sent ?? "", error: "", sends: prev.sends + 1 };
    } catch (e) {
      // A refusal to send again leaves the person where they are: the code they have may still work.
      return { ...prev, phone, channel, error: sentence((e as Error).message) };
    }
  }

  const phone = prev.phone, code = digits(v(fd, "code") || prev.code);
  if (!phone) return { ...prev, stage: "phone", error: "Enter your mobile number first." };
  if (code.length !== 6) return { ...prev, error: "Enter the 6 digits of the code." };
  const first = v(fd, "first_name"), ref = refCode(fd.get("ref"));
  if (intent === "finish" && !first) return { ...prev, code, error: "Enter your first name." };
  let session: Session | null = null, state: CodeState = { ...prev, code, error: "" };
  try {
    session = await customerApi<Session>("/auth/code/verify", {
      method: "POST", auth: false,
      body: { phone, code, ...(intent === "finish" ? { first_name: first, last_name: v(fd, "last_name"), email: v(fd, "email"), ...(ref ? { ref } : {}) } : {}) },
    });
  } catch (e) {
    const err = e as CustomerApiError;
    const said = sentence(err.message);
    if (err.status === 409 && err.data?.need === "name") state = { ...state, stage: "name" };
    else if (err.status === 409 && err.data?.need === "password") state = { ...state, stage: "password", error: said };
    // The code ran out or was used up while the name was being typed: back to the code.
    else if (err.status === 401) state = { ...state, stage: "code", code: "", error: said };
    else state = { ...state, error: said };
  }
  if (!session) return state;
  await startSession(session);
  redirect(next);
}

/** What the "confirm your number" form in the account is told. */
export type PhoneState = { stage: "idle" | "code"; sent: string; error: string; sends: number };

/** Sends a code to the number on the account, or checks the code that was typed. */
export async function phoneStep(prev: PhoneState, fd: FormData): Promise<PhoneState> {
  if (v(fd, "intent") === "send") {
    try {
      const out = await customerApi<{ sent?: string }>("/auth/phone/send", { method: "POST", body: { channel: v(fd, "channel") === "whatsapp" ? "whatsapp" : "sms" } });
      return { stage: "code", sent: out.sent ?? "", error: "", sends: prev.sends + 1 };
    } catch (e) {
      return { ...prev, error: sentence((e as Error).message) };
    }
  }
  const code = digits(v(fd, "code"));
  if (code.length !== 6) return { ...prev, error: "Enter the 6 digits of the code." };
  try {
    await customerApi("/auth/phone/verify", { method: "POST", body: { code } });
  } catch (e) {
    return { ...prev, error: sentence((e as Error).message) };
  }
  redirect(`/account?tab=details&ok=${enc("Your number is confirmed. You can sign in with a code sent to it.")}`);
}

/** How the person wants to hear about bookings. Only a channel that is switched on is accepted here; the API checks the word itself. */
export async function saveChannel(fd: FormData) {
  const channel = v(fd, "channel");
  let error = "";
  try {
    await customerApi("/auth/channel", { method: "PUT", body: { channel } });
  } catch (e) {
    error = sentence((e as Error).message);
  }
  const how = channel === "whatsapp" ? "on WhatsApp, and by email" : channel === "sms" ? "by text, and by email" : "by email";
  await (error ? back("err", error, "details") : back("ok", `Saved. You will hear about bookings ${how}.`, "details"));
}

/** Takes a kept card off the account. The provider forgets it too. */
export async function removeCard(fd: FormData) {
  let error = "";
  try {
    await customerApi(`/auth/cards/${enc(v(fd, "card"))}`, { method: "DELETE" });
  } catch (e) {
    error = sentence((e as Error).message);
  }
  await (error ? back("err", error, "details") : back("ok", `${v(fd, "label") || "The card"} is removed.`, "details"));
}
