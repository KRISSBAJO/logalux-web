"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { money } from "@/lib/api";
import { MAX_QTY, cart, useCart } from "@/lib/cart";
import { deliveryDays, perUnit, pickupTodayText, visitDay, type ProductExtras, type Size } from "@/lib/shop";
import { SaveProduct } from "./save-product";

export type BuyProduct = {
  slug: string; name: string; seller_name: string; tone: string; description: string; price_cents: number; compare_cents: number | null; stock: number;
  sizes: Size[]; pickup: boolean; shipping: boolean; shipping_cents: number; business: string | null; business_city: string | null;
};

/** One way to get the product. The three pick-up ways are the same order to the shop; they differ in what the customer is told. */
type Way = "visit" | "today" | "pickup" | "ship";

// A gift card's sizes are amounts ("$25"), so the price beside them would only repeat the label.
const isPrice = (label: string, cents: number) => label.replace(/s/g, "") === money(cents);

/** Price, size, how to get it, quantity and the add-to-cart button. The children of the design's `.info` column, in its order. */
export function ProductBuyBox({ product: p, extras, signedIn }: { product: BuyProduct; extras: Pick<ProductExtras, "delivery" | "pickup_today" | "next_visit" | "saved">; signedIn: boolean }) {
  const sizes = p.sizes.length ? p.sizes : [{ label: "", price_cents: p.price_cents }];
  // The size the listed price belongs to is the one shown first.
  const [size, setSize] = useState((sizes.find((s) => s.price_cents === p.price_cents) ?? sizes[0]).label);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(0);
  const { items, how, when } = useCart();
  const studio = p.business ?? p.seller_name;
  const visit = p.pickup ? extras.next_visit : undefined, today = p.pickup ? extras.pickup_today : undefined;
  const visitOn = visit ? visitDay(visit) : "";
  const ways: { id: Way; title: string; sub: string; cost: string }[] = [
    ...(visitOn ? [{ id: "visit" as const, title: "Pick up at your visit", sub: `${visitOn} · ${studio}${p.business_city ? `, ${p.business_city}` : ""}`, cost: "Free" }] : []),
    ...(today ? [{ id: "today" as const, title: "Pick up today", sub: `${pickupTodayText(today).replace(/^r/, "R")} · ${studio}`, cost: "Free" }] : []),
    ...(p.pickup && !visitOn && !today ? [{ id: "pickup" as const, title: `Pick up at ${studio}`, sub: p.business_city ? `Collect it at the studio in ${p.business_city}` : "Collect it at the studio", cost: "Free" }] : []),
    ...(p.shipping ? [{ id: "ship" as const, title: "Ship to me", sub: [extras.delivery ? `Arrives in ${deliveryDays(extras.delivery)}` : "", p.shipping_cents > 0 ? `One shipping charge for everything you order from ${p.seller_name}` : extras.delivery ? "" : "Sent to your address"].filter(Boolean).join(" · "), cost: p.shipping_cents > 0 ? money(p.shipping_cents) : "Free" }] : []),
  ];
  const [way, setWay] = useState<Way | "">(ways[0]?.id ?? "");
  // What the customer already chose for this seller in their cart is kept.
  const savedHow = how[p.seller_name], savedWhen = when[p.seller_name];
  const hasVisit = !!visitOn, hasToday = !!today;
  useEffect(() => {
    if (savedHow === "ship" && p.shipping) setWay("ship");
    else if (savedHow === "pickup" && p.pickup) setWay(savedWhen === "today" && hasToday ? "today" : hasVisit ? "visit" : hasToday ? "today" : "pickup");
  }, [savedHow, savedWhen, p.pickup, p.shipping, hasVisit, hasToday]);

  const unit = sizes.find((s) => s.label === size)?.price_cents ?? p.price_cents;
  const inCart = items.find((i) => i.slug === p.slug && i.size === size)?.qty ?? 0;
  const max = Math.max(0, Math.min(p.stock, MAX_QTY));
  const room = Math.max(0, max - inCart);
  const n = Math.min(qty, Math.max(1, room));
  const per = perUnit(size, unit);
  const was = p.compare_cents && unit === p.price_cents && p.compare_cents > unit ? p.compare_cents : 0;

  function add() {
    if (room < 1) return;
    cart.add({ slug: p.slug, name: p.name, seller: p.seller_name, size, unit_cents: unit, tone: p.tone }, n, max);
    if (way) cart.setFulfilment(p.seller_name, way === "ship" ? "ship" : "pickup", way === "visit" || way === "today" ? way : undefined);
    setAdded(n); setQty(1);
  }

  return (
    <>
      <div className="price">
        {money(unit)}{was > 0 && <s>{money(was)}</s>}
        {((size && !isPrice(size, unit)) || per) && <small>{[isPrice(size, unit) ? "" : size, per ? `${money(per.cents)} per ${per.per === 1 ? "" : `${per.per} `}${per.unit}` : ""].filter(Boolean).join(" · ")}</small>}
      </div>
      {p.description && <p className="muted lead">{p.description}</p>}

      {sizes.length > 1 && (
        <div className="opts">
          <span className="lbl" id="size-lbl">Size</span>
          <div className="chips" role="group" aria-labelledby="size-lbl">
            {sizes.map((s) => (
              <button key={s.label} type="button" className={`chip ${s.label === size ? "on" : ""}`} aria-pressed={s.label === size} onClick={() => { setSize(s.label); setAdded(0); }}>{s.label}{!isPrice(s.label, s.price_cents) && <> <small>{money(s.price_cents)}</small></>}</button>
            ))}
          </div>
        </div>
      )}

      {ways.length > 0 && (
        <div className="opts">
          <span className="lbl" id="way-lbl">Get it</span>
          <div className="deliv" role="group" aria-labelledby="way-lbl">
            {ways.map((w) => (
              <button key={w.id} type="button" className={`opt ${way === w.id ? "on" : ""}`} aria-pressed={way === w.id} onClick={() => setWay(w.id)}>
                <span><b>{w.title}</b><span>{w.sub}</span></span><span className="r">{w.cost}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="cta">
        <div className="qty">
          <button type="button" onClick={() => setQty(Math.max(1, n - 1))} disabled={n <= 1} aria-label="Fewer">−</button>
          <b aria-live="polite" aria-label={`Quantity ${n}`}>{n}</b>
          <button type="button" onClick={() => setQty(Math.min(room, n + 1))} disabled={n >= room} aria-label="More">+</button>
        </div>
        <button type="button" className="btn btn-ink buy" onClick={add} disabled={room < 1}>
          {p.stock < 1 ? "Out of stock" : room < 1 ? "All we have is in your cart" : `Add to cart · ${money(unit * n)}`}
        </button>
        <SaveProduct variant="page" slug={p.slug} name={p.name} saved={extras.saved === true} signedIn={signedIn} next={`/shop/${p.slug}`} />
      </div>
      <p className="muted stock" role="status">
        {added > 0 ? <>Added {added} to your cart. <Link href="/cart">Go to cart</Link></> : inCart > 0 ? <>{inCart} in your cart. <Link href="/cart">Go to cart</Link></> : p.stock < 1 ? "This one is sold out for now." : p.stock <= 5 ? `Only ${p.stock} left.` : p.stock <= 50 ? `${p.stock} in stock.` : "In stock."}
      </p>
    </>
  );
}
