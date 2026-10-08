"use server";

import { redirect } from "next/navigation";
import { fid, mBackTo, mDel, mPost, mRun, str } from "@/lib/merchant-actions";
import type { BankState } from "./bank-form";

// Nigeria. Step one: ask the bank whose account this is. Nothing is saved yet.
// The account number travels in the form only; it is never put in the address.
export async function resolveBank(_prev: BankState, fd: FormData): Promise<BankState> {
  if (str(fd, "intent") === "reset") return { step: "enter" };
  const [bank_code = "", bank_name = ""] = str(fd, "bank").split("|");
  const account_number = str(fd, "account_number").replace(/\s/g, "");
  const typed = str(fd, "account_name");
  try {
    const out = await mPost("/payout-account/bank", { bank_code, bank_name, account_number, account_name: typed, confirm: false });
    return { step: "resolved", bank_code, bank_name, account_number, account_name: String(out.account_name ?? typed), checked: out.checked_with_bank === true };
  } catch (e) {
    const message = (e as Error).message || "Something went wrong.";
    return { step: "enter", error: message[0].toUpperCase() + message.slice(1) + ".", bank_code, bank_name, account_number, account_name: typed };
  }
}

// Nigeria. Step two: save the account whose name was just confirmed.
export async function saveBank(fd: FormData) {
  await mRun(
    fd,
    (out) => (out.mode === "live" ? "Payout account saved. It is now your default." : "Payout account saved as your default. It is simulated: the bank was not contacted."),
    () => mPost("/payout-account/bank", { bank_code: str(fd, "bank_code"), bank_name: str(fd, "bank_name"), account_number: str(fd, "account_number"), account_name: str(fd, "account_name"), confirm: true }),
  );
}

// United States. With a Stripe key the API answers with a link to Stripe's own
// pages. Without one it records a simulated account from the three fields.
export async function connectStripe(fd: FormData) {
  let out: Record<string, unknown> = {}, error = "";
  try {
    out = await mPost("/payout-account/stripe", { bank_name: str(fd, "bank_name"), last4: str(fd, "last4"), account_name: str(fd, "account_name") });
  } catch (e) {
    error = (e as Error).message || "Something went wrong.";
  }
  if (error) mBackTo(fd, "err", error);
  const url = typeof out.url === "string" ? out.url : "";
  if (url) {
    let host = "";
    try { host = new URL(url).hostname; } catch {}
    if (host === "stripe.com" || host.endsWith(".stripe.com")) redirect(url);
    mBackTo(fd, "err", "Stripe returned a link this page does not trust. Try again.");
  }
  mBackTo(fd, "ok", "Payout account added as your default. It is simulated: no bank was contacted.");
}

export async function makeDefault(fd: FormData) {
  await mRun(fd, "Default payout account changed.", () => mPost(`/payout-account/${fid(fd)}/default`));
}

export async function removeAccount(fd: FormData) {
  await mRun(fd, "Payout account removed.", () => mDel(`/payout-account/${fid(fd)}`));
}
