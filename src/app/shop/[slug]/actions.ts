"use server";

import { redirect } from "next/navigation";
import { customerApi } from "@/lib/customer";
import { messageCode } from "@/lib/flash";

const enc = encodeURIComponent;

/** A review from someone who bought the product: one to five stars and a few words. */
export async function reviewProduct(fd: FormData) {
  const slug = String(fd.get("slug") ?? "").trim();
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(slug)) redirect("/shop");
  let error = "";
  try {
    await customerApi(`/auth/products/${enc(slug)}/review`, { method: "POST", body: { rating: Number(fd.get("rating")) || 0, body: String(fd.get("body") ?? "").trim() } });
  } catch (e) {
    const message = (e as Error).message;
    error = message ? message[0].toUpperCase() + message.slice(1) + (/[.!?]$/.test(message) ? "" : ".") : "Your review could not be saved.";
  }
  // The address carries a code for the message, never the words.
  redirect(`/shop/${enc(slug)}?tab=reviews&${error ? `err=${await messageCode(error)}` : `ok=${await messageCode("Thank you. Your review is published.")}`}#tabs`);
}
