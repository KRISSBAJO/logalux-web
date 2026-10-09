"use server";

import { backTo, cents, del, id, on, post, put, run, str } from "@/lib/action-helpers";
import { fmtMoney } from "@/components/admin-ui";

// After the sale: the sales tax on brand products, and returns of brand products.

const sentence = (m: string) => { const s = (m || "Something went wrong").trim(); return s[0].toUpperCase() + s.slice(1) + (/[.?]$/.test(s) ? "" : "."); };

/** Adds a state's rate or changes it. The rate is typed as a percentage and sent as hundredths of a percent. */
export async function saveTaxRate(fd: FormData) {
  const region = str(fd, "region").toUpperCase(), name = str(fd, "name"), raw = str(fd, "rate");
  await run(fd, `Rate for ${region} saved. Brand products shipped there are taxed at ${raw}% from now on.`, async () => {
    if (!/^[A-Z]{2}$/.test(region)) throw new Error("Use the two-letter state code, such as TN.");
    if (!name) throw new Error("Add the name of the state.");
    if (!/^\d{1,2}(\.\d{1,2})?$/.test(raw) || parseFloat(raw) > 25) throw new Error("Enter the rate as a percentage from 0 to 25, with up to two decimals.");
    try {
      return await put(`/tax-rates/${encodeURIComponent(region)}`, { name, bp: Math.round(parseFloat(raw) * 100) });
    } catch (e) {
      throw new Error(sentence((e as Error).message));
    }
  });
}

export async function removeTaxRate(fd: FormData) {
  const region = str(fd, "region").toUpperCase();
  await run(fd, `Rate for ${region} removed. Brand products shipped there are not taxed now.`, async () => {
    if (!/^[A-Z]{2}$/.test(region)) throw new Error("Use the two-letter state code, such as TN.");
    return del(`/tax-rates/${encodeURIComponent(region)}`);
  });
}

/** Asks the payment provider again for a refund it has not accepted yet. The worker keeps trying on its own; this is for a human who does not want to wait. */
export async function retryRefund(fd: FormData) {
  let out: Record<string, unknown> = {}, error = "";
  try {
    out = await post(`/attention/refunds/${id(fd)}/retry`, {});
  } catch (e) {
    error = sentence((e as Error).message);
  }
  if (error) backTo(fd, "err", error);
  if (out.ok) backTo(fd, "ok", "The provider accepted the refund. The books are settled.");
  backTo(fd, "err", `The provider still has not accepted it: ${sentence(String(out.problem ?? "no reason given"))} The worker keeps trying.`);
}

/** Approves (and refunds) or refuses a return of a brand product. On a failure the form opens again; nothing has changed then. */
export async function decideBrandReturn(fd: FormData) {
  const refuse = str(fd, "decision") === "refuse", reply = str(fd, "reply");
  const fail = (message: string): never => {
    const url = new URL(str(fd, "back") || "/admin/returns", "http://console");
    url.searchParams.set("answer", str(fd, "id"));
    fd.set("back", url.pathname + url.search);
    return backTo(fd, "err", message);
  };
  if (refuse && reply.length < 10) fail("Tell the customer why, in a sentence. At least 10 characters.");
  let out: Record<string, unknown> = {}, error = "";
  try {
    out = await post(`/returns/${id(fd)}`, refuse ? { action: "refuse", reply } : { action: "approve", reply, refund_cents: cents(fd, "refund"), restock: on(fd, "restock") });
  } catch (e) {
    error = sentence((e as Error).message);
  }
  if (error) fail(error);
  if (refuse) backTo(fd, "ok", "Return refused. The customer is emailed the message. Nothing was refunded.");
  const refund = Number(out.refund_cents ?? 0), card = Number(out.to_card_cents ?? 0), credit = Number(out.credit_cents ?? 0);
  const where = card > 0 && credit > 0 ? `${fmtMoney(card)} to the customer's card and ${fmtMoney(credit)} as LogaLuxe store credit` : card > 0 ? "to the customer's card" : "as LogaLuxe store credit";
  backTo(fd, "ok", `Return approved. ${fmtMoney(refund)} refunded, ${where}. ${on(fd, "restock") ? "The items are back in stock." : "Stock was not changed."}`);
}
