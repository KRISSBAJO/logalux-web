"use client";

import { useEffect, useState } from "react";

/** `currency` is what the product is priced in. A line saved before the shop sold in naira has none, and is in dollars. */
export type CartItem = { slug: string; name: string; seller: string; size: string; unit_cents: number; qty: number; tone: string; currency?: string };
/** How one seller's items reach the customer. */
export type Fulfilment = "pickup" | "ship";

// The lines keep their first key and shape, so a cart saved before the
// per-seller choice existed still opens. The choice lives beside it.
const KEY = "logaluxe.cart.v1";
const HOW_KEY = "logaluxe.cart.how.v1";
// Which pick-up promise the customer chose to go by, per seller: at their booked visit, or today. Only wording; the order is plain pick-up either way.
const WHEN_KEY = "logaluxe.cart.when.v1";
export type PickupWhen = "visit" | "today";
export const MAX_QTY = 9;
const listeners = new Set<() => void>();

function read(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x) => x && typeof x.slug === "string" && Number(x.qty) > 0) : [];
  } catch { return []; }
}
function readHow(): Record<string, Fulfilment> {
  if (typeof window === "undefined") return {};
  try {
    const raw = JSON.parse(localStorage.getItem(HOW_KEY) ?? "{}");
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  } catch { return {}; }
}
function readWhen(): Record<string, PickupWhen> {
  if (typeof window === "undefined") return {};
  try {
    const raw = JSON.parse(localStorage.getItem(WHEN_KEY) ?? "{}");
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  } catch { return {}; }
}
function write(items: CartItem[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
  listeners.forEach((l) => l());
}
function writeHow(how: Record<string, Fulfilment>) {
  try { localStorage.setItem(HOW_KEY, JSON.stringify(how)); } catch {}
  listeners.forEach((l) => l());
}
const cap = (qty: number, max = MAX_QTY) => Math.max(1, Math.min(MAX_QTY, max, qty));

export const cart = {
  /** `max` is the stock on hand, when the caller knows it. */
  add(item: Omit<CartItem, "qty">, qty = 1, max = MAX_QTY) {
    const items = read();
    const i = items.findIndex((x) => x.slug === item.slug && x.size === item.size);
    if (i >= 0) items[i] = { ...items[i], ...item, qty: cap(items[i].qty + qty, max) }; else items.push({ ...item, qty: cap(qty, max) });
    write(items);
  },
  setQty(slug: string, size: string, qty: number, max = MAX_QTY) {
    write(read().map((x) => (x.slug === slug && x.size === size ? { ...x, qty: cap(qty, max) } : x)));
  },
  remove(slug: string, size: string) { write(read().filter((x) => !(x.slug === slug && x.size === size))); },
  /** The customer's choice for one seller: collect at the studio, or have it shipped. */
  setFulfilment(seller: string, how: Fulfilment, when?: PickupWhen) {
    if (when) { try { localStorage.setItem(WHEN_KEY, JSON.stringify({ ...readWhen(), [seller]: when })); } catch {} }
    writeHow({ ...readHow(), [seller]: how });
  },
  /** Takes out the lines of an order that was just placed. Everything else in the cart stays, with its sellers' choices. */
  removeLines(lines: { slug: string; size: string }[]) {
    const gone = new Set(lines.map((l) => `${l.slug}|${l.size}`));
    const items = read().filter((x) => !gone.has(`${x.slug}|${x.size}`));
    const sellers = new Set(items.map((x) => x.seller));
    const keep = <T,>(m: Record<string, T>) => Object.fromEntries(Object.entries(m).filter(([s]) => sellers.has(s)));
    try { localStorage.setItem(HOW_KEY, JSON.stringify(keep(readHow()))); localStorage.setItem(WHEN_KEY, JSON.stringify(keep(readWhen()))); } catch {}
    write(items);
  },
  clear() {
    try { localStorage.removeItem(HOW_KEY); localStorage.removeItem(WHEN_KEY); } catch {}
    write([]);
  },
};

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [how, setHow] = useState<Record<string, Fulfilment>>({});
  const [when, setWhen] = useState<Record<string, PickupWhen>>({});
  // False until the saved cart has been read, so a page can tell "empty" from "not loaded yet".
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => { setItems(read()); setHow(readHow()); setWhen(readWhen()); setReady(true); };
    sync();
    listeners.add(sync);
    window.addEventListener("storage", sync);
    return () => { listeners.delete(sync); window.removeEventListener("storage", sync); };
  }, []);
  const count = items.reduce((a, i) => a + i.qty, 0);
  const subtotal = items.reduce((a, i) => a + i.qty * i.unit_cents, 0);
  return { items, count, subtotal, how, when, ready };
}
