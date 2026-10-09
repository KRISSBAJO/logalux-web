"use server";

import { redirect } from "next/navigation";
import { toDataURL } from "qrcode";
import { cents, fid, int, mBackTo, mPost, mRun, on, str } from "@/lib/merchant-actions";
import { qs, type Row } from "@/lib/merchant-api";

type Item = { kind: string; service_id?: string; product_id?: string; package_id?: string; membership_id?: string; name?: string; qty: number; unit_cents?: number; redeem?: boolean };

/** Reads the lines the ticket sent, keeping only the fields the API knows. */
function readItems(raw: string): Item[] {
  let parsed: unknown = [];
  try {
    parsed = JSON.parse(raw || "[]");
  } catch {}
  if (!Array.isArray(parsed)) return [];
  return parsed.slice(0, 40).map((x: Row) => {
    const item: Item = { kind: String(x.kind ?? ""), qty: Math.max(1, Math.round(Number(x.qty) || 1)) };
    if (x.service_id) item.service_id = String(x.service_id);
    if (x.product_id) item.product_id = String(x.product_id);
    if (x.package_id) item.package_id = String(x.package_id);
    if (x.membership_id) item.membership_id = String(x.membership_id);
    if (x.redeem === true) item.redeem = true;
    if (x.name) item.name = String(x.name).slice(0, 120);
    if (x.unit_cents !== undefined && x.unit_cents !== null && Number.isFinite(Number(x.unit_cents))) item.unit_cents = Math.max(0, Math.round(Number(x.unit_cents)));
    return item;
  });
}

/** The sale as the API wants it. The same body takes a payment at the desk and makes a pay link. */
const ticket = (fd: FormData) => ({
  booking_id: str(fd, "booking_id"),
  client_id: str(fd, "client_id"),
  client_name: str(fd, "client_name"),
  staff_id: str(fd, "staff_id"),
  items: readItems(str(fd, "items")),
  tip_cents: Math.max(0, int(fd, "tip_cents")),
  discount_cents: Math.max(0, int(fd, "discount_cents")),
  method: str(fd, "method"),
  note: str(fd, "note"),
  promo_code: str(fd, "promo_code"),
  redeem_points: Math.max(0, int(fd, "redeem_points")),
  location_id: str(fd, "location_id"),
});

const sentence = (m: string) => (m ? m[0].toUpperCase() + m.slice(1) + (/[.?!]$/.test(m) ? "" : ".") : "Something went wrong.");

/** Takes payment for a visit, or makes a quick sale. Then shows the receipt with the figures the API returned. */
export async function pay(fd: FormData) {
  const body = ticket(fd);
  if (!body.items.length) mBackTo(fd, "err", "Add at least one service or product.");
  let out: Row = {}, error = "";
  try {
    out = (await mPost("/checkout", body)) as Row;
  } catch (e) {
    error = sentence((e as Error).message);
  }
  if (error) mBackTo(fd, "err", error);
  redirect("/business/checkout" + qs({
    receipt: out.sale_id, sub: out.subtotal_cents, disc: out.discount_cents, tax: out.tax_cents, tip: out.tip_cents, dep: out.deposit_cents, total: out.total_cents,
    member: out.member_discount_cents || undefined, promo: out.promo_discount_cents || undefined, pts: out.points_used || undefined, ptsd: out.points_discount_cents || undefined,
    earned: out.points_earned || undefined, lead: out.lead_fee_cents || undefined,
  }));
}

export type Quote = { ok: true; quote: Record<string, number> } | { ok: false; error: string };

/**
 * Asks the API what the ticket comes to, with the same body a sale sends. Nothing is charged or kept.
 * A refusal (a code that is not valid, a plan without a client) comes back as the API's own sentence.
 */
export async function quote(fd: FormData): Promise<Quote> {
  const body = ticket(fd);
  if (!body.items.length) return { ok: false, error: "Add at least one service or product." };
  try {
    const out = (await mPost("/checkout/quote", body)) as Row;
    const q = (out.quote ?? {}) as Row, quote: Record<string, number> = {};
    for (const k of ["subtotal_cents", "discount_cents", "tax_cents", "tip_cents", "deposit_cents", "total_cents", "member_discount_cents", "promo_discount_cents", "points_used", "points_discount_cents", "points_earned"]) quote[k] = Number(q[k] ?? 0);
    return { ok: true, quote };
  } catch (e) {
    return { ok: false, error: sentence((e as Error).message) };
  }
}

export type PayLink =
  | { ok: true; reference: string; url: string; amount_cents: number; expires_in: number; qr: string; totals: Record<string, number> }
  | { ok: false; error: string };

/**
 * Prices the ticket and makes a payment page for the client. Nothing is recorded yet:
 * the API records the sale by itself once the client has paid.
 */
export async function makeLink(fd: FormData): Promise<PayLink> {
  const body = { ...ticket(fd), email: str(fd, "email") };
  if (!body.items.length) return { ok: false, error: "Add at least one service or product." };
  try {
    const out = (await mPost("/checkout/link", body)) as Row;
    const url = String(out.url ?? "");
    // The code is drawn here, on the server, so the client can scan the link off the screen.
    const qr = url ? await toDataURL(url, { margin: 1, width: 440, color: { dark: "#1A1513", light: "#FFFFFF" } }).catch(() => "") : "";
    const t = (out.totals ?? {}) as Row;
    const totals: Record<string, number> = {};
    for (const k of ["subtotal_cents", "discount_cents", "tax_cents", "tip_cents", "deposit_cents", "total_cents", "member_discount_cents"]) totals[k] = Number(t[k] ?? 0);
    return { ok: true, reference: String(out.reference), url, amount_cents: Number(out.amount_cents ?? 0), expires_in: Number(out.expires_in ?? 1800), qr, totals };
  } catch (e) {
    return { ok: false, error: sentence((e as Error).message) };
  }
}

export async function refundSale(fd: FormData) {
  const simulated = str(fd, "simulated") === "1";
  await mRun(
    fd,
    (out) => (out.status === "refunded" ? "Sale refunded in full." : "Part of the sale refunded.")
      + (out.provider_refund ? ` Refund ${out.provider_refund}.` : simulated ? " Payments are simulated, so no money moved." : ""),
    () => mPost(`/sales/${fid(fd)}/refund`, { amount_cents: cents(fd, "amount"), reason: str(fd, "reason"), restock: on(fd, "restock") }),
  );
}
