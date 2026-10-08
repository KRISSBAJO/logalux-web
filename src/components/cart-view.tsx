"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { money } from "@/lib/api";
import { MAX_QTY, cart, useCart, type CartItem, type Fulfilment } from "@/lib/cart";
import { TAX_LABEL, deliveryDays, pickupTodayText, possessive, salesTax, visitDay, type CartProduct, type ProductExtras } from "@/lib/shop";

type Check = { discount_cents: number; promo_error: string; gift_balance_cents: number; gift_error: string };
const NONE: Check = { discount_cents: 0, promo_error: "", gift_balance_cents: 0, gift_error: "" };
type Shipment = { seller_name: string; fulfilment: Fulfilment; status: string; items_cents: number; shipping_cents: number };
type Order = { id: string; status?: string; total_cents: number; discount_cents: number; gift_cents: number; credit_cents?: number; promo_code: string; shipments?: Shipment[]; payment?: { url?: string } };
/** One way a seller's items can reach the customer. The three pick-up ways are the same order to the shop; they differ in what the customer is told. */
type Way = "visit" | "today" | "pickup" | "ship";
type WayOption = { id: Way; title: string; sub: string; cost: string };
type Line = CartItem & { key: string; live: CartProduct | null | undefined; unit: number; max: number; problem: string };
type Group = {
  seller: string; lines: Line[]; items: number; count: number; canPickup: boolean; canShip: boolean; how: Fulfilment | ""; shipping: number; live?: CartProduct;
  /** The day of the customer's next visit to this seller, when they have one booked. */
  visitOn: string;
  /** Set only when every one of the seller's items in the cart can be collected today. */
  today?: { ready_at: string; until: string };
  /** Set only when a delivery time is stated for every one of the seller's items. */
  delivery?: { days_min: number; days_max: number };
  ways: WayOption[]; way: Way | "";
};
type Errors = Partial<Record<"name" | "email" | "address" | "promo" | "gift" | "pay", string>> & { items?: Record<string, string> };

const sentence = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) + (/[.!?]$/.test(s) ? "" : ".") : s);
const Shield = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" /></svg>;

export function CartView({ me, creditCents = 0 }: { me?: { name: string; phone: string; email: string }; creditCents?: number }) {
  const { items, how, when, ready } = useCart();
  // What each product costs and how it can be delivered today. The saved cart only remembers what was added.
  const [live, setLive] = useState<Record<string, CartProduct | null>>({});
  // What each seller states about delivery and pick-up today, and the customer's next visit there.
  const [extras, setExtras] = useState<Record<string, ProductExtras>>({});
  const [liveError, setLiveError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const slugs = useMemo(() => [...new Set(items.map((i) => i.slug))].sort().join(","), [items]);
  useEffect(() => {
    if (!slugs) return;
    let on = true;
    fetch(`/api/products?slugs=${encodeURIComponent(slugs)}`)
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; })
      .then((j) => { if (on) { setLive(j.products ?? {}); setExtras(j.extras ?? {}); setLiveError(""); } })
      .catch((e: Error) => { if (on) setLiveError(e.message || "We could not check your cart just now. Try again in a moment."); });
    return () => { on = false; };
  }, [slugs, refresh]);
  const loaded = !slugs || slugs.split(",").every((s) => s in live);

  const [name, setName] = useState(me?.name ?? ""), [phone, setPhone] = useState(me?.phone ?? ""), [email, setEmail] = useState(me?.email ?? "");
  const [line1, setLine1] = useState(""), [city, setCity] = useState(""), [zip, setZip] = useState("");
  const [busy, setBusy] = useState(false), [errors, setErrors] = useState<Errors>({}), [order, setOrder] = useState<Order | null>(null);
  const [shippedTo, setShippedTo] = useState("");
  // What each seller's part of the placed order was promised, kept for the confirmation.
  const [told, setTold] = useState<Record<string, string>>({});
  // What the shopper typed, and what they pressed Apply on.
  const [promoInput, setPromoInput] = useState(""), [giftInput, setGiftInput] = useState("");
  const [promo, setPromo] = useState(""), [gift, setGift] = useState("");
  const [check, setCheck] = useState<Check>(NONE);
  const addressRef = useRef<HTMLDivElement>(null), payRef = useRef<HTMLDivElement>(null);

  // Lines as the order endpoint will price them: today's price for the size, and stock shared between sizes of one product.
  const groups = useMemo<Group[]>(() => {
    const left: Record<string, number> = {};
    const out: Group[] = [];
    for (const i of items) {
      const p = live[i.slug];
      const unit = p ? p.sizes.find((s) => s.label === i.size)?.price_cents ?? p.price_cents : i.unit_cents;
      if (p && !(i.slug in left)) left[i.slug] = p.stock;
      const stock = p ? left[i.slug] : MAX_QTY;
      const problem = p === null ? "This is no longer sold. Remove it to carry on." : p && stock < 1 ? "Out of stock. Remove it to carry on." : p && stock < i.qty ? `Only ${stock} left. Lower the number to carry on.` : "";
      if (p) left[i.slug] = Math.max(0, stock - i.qty);
      const seller = p?.seller_name ?? i.seller;
      let g = out.find((x) => x.seller === seller);
      if (!g) out.push((g = { seller, lines: [], items: 0, count: 0, canPickup: true, canShip: true, how: "", shipping: 0, live: p ?? undefined, visitOn: "", ways: [], way: "" }));
      g.lines.push({ ...i, key: `${i.slug}|${i.size}`, live: p, unit, max: Math.min(MAX_QTY, Math.max(1, stock)), problem });
      if (p === null) continue;
      g.items += unit * i.qty; g.count += i.qty;
      if (p) { g.canPickup &&= p.pickup; g.canShip &&= p.shipping; g.live ??= p; }
    }
    for (const g of out) {
      const wanted = how[g.seller];
      g.how = !g.lines.some((l) => l.live) ? "" : wanted === "pickup" && g.canPickup ? "pickup" : wanted === "ship" && g.canShip ? "ship" : g.canPickup ? "pickup" : g.canShip ? "ship" : "";
      // One shipping charge per seller that ships: the first of its products in the order sets it.
      const first = g.lines.find((l) => l.live);
      g.shipping = g.how === "ship" ? first?.live?.shipping_cents ?? 0 : 0;

      // A seller's choice covers all its items, so a promise is made only when it holds for every one of them.
      const facts = g.lines.filter((l) => l.live).map((l) => extras[l.slug]);
      if (!facts.length) continue;
      const visit = g.canPickup ? facts.find((x) => x?.next_visit)?.next_visit : undefined;
      g.visitOn = visit ? visitDay(visit) : "";
      const todays = facts.map((x) => x?.pickup_today);
      if (g.canPickup && todays.every((t) => t)) g.today = { ready_at: todays.map((t) => t!.ready_at).sort().at(-1)!, until: todays.map((t) => t!.until).sort()[0] };
      const times = facts.map((x) => x?.delivery);
      if (g.canShip && times.every((t) => t)) g.delivery = { days_min: Math.max(...times.map((t) => t!.days_min)), days_max: Math.max(...times.map((t) => t!.days_max)) };
      const place = g.live?.business_city ? `At the studio in ${g.live.business_city}` : "At the studio";
      g.ways = [
        ...(g.visitOn ? [{ id: "visit" as const, title: "Pick up at your visit", sub: `${g.visitOn} · ${g.seller}`, cost: "Free" }] : []),
        ...(g.today ? [{ id: "today" as const, title: "Pick up today", sub: pickupTodayText(g.today).replace(/^r/, "R"), cost: "Free" }] : []),
        ...(g.canPickup && !g.visitOn && !g.today ? [{ id: "pickup" as const, title: `Pick up at ${g.seller}`, sub: place, cost: "Free" }] : []),
        ...(g.canShip ? [{ id: "ship" as const, title: "Ship to me", sub: g.delivery ? `Arrives in ${deliveryDays(g.delivery)}` : "To the address you give below", cost: (first?.live?.shipping_cents ?? 0) > 0 ? money(first!.live!.shipping_cents) : "Free" }] : []),
      ];
      g.way = g.how === "ship" ? "ship" : g.how === "pickup" ? (when[g.seller] === "today" && g.today ? "today" : g.visitOn ? "visit" : g.today ? "today" : "pickup") : "";
    }
    return out;
  }, [items, live, how, when, extras]);

  const lines = groups.flatMap((g) => g.lines);
  const count = lines.reduce((a, l) => a + (l.live === null ? 0 : l.qty), 0);
  const subtotal = groups.reduce((a, g) => a + g.items, 0);
  const shipping = groups.reduce((a, g) => a + g.shipping, 0);
  const anyShip = groups.some((g) => g.how === "ship");
  const stuck = groups.filter((g) => g.how === "" && g.lines.some((l) => l.live));
  const blocked = !loaded || lines.some((l) => l.problem) || stuck.length > 0;

  // The server says what a code is worth. It is asked again whenever the cart changes.
  useEffect(() => {
    if (!promo && !gift) { setCheck(NONE); return; }
    let on = true;
    fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: "orders", currency: "USD", subtotal_cents: subtotal, promo_code: promo, gift_code: gift }) })
      .then((r) => r.json()).then((j) => { if (on) setCheck({ ...NONE, ...j }); })
      .catch(() => { if (on) setCheck({ ...NONE, promo_error: promo ? "we could not check that code" : "", gift_error: gift ? "we could not check that card" : "" }); });
    return () => { on = false; };
  }, [promo, gift, subtotal]);

  const discount = promo && !check.promo_error ? Math.min(check.discount_cents, subtotal) : 0;
  const tax = salesTax(subtotal - discount);
  const beforeGift = subtotal - discount + shipping + tax;
  const giftUsed = gift && !check.gift_error ? Math.min(check.gift_balance_cents, beforeGift) : 0;
  const total = beforeGift - giftUsed;
  // Store credit, as the order endpoint spends it: after the promo, shipping, tax and the gift card, up to what is left. A guest has none.
  const credit = me ? Math.max(0, creditCents) : 0;
  const creditUsed = Math.min(credit, total);
  const due = total - creditUsed;
  const covered = [giftUsed > 0 ? "gift card" : "", creditUsed > 0 ? "store credit" : ""].filter(Boolean);

  /** What the customer is told about collecting one seller's items. */
  const collectText = (g: Group) =>
    g.way === "visit" ? `Your items from ${g.seller} will be waiting at your visit on ${g.visitOn}.`
      : g.way === "today" && g.today ? `Your items from ${g.seller} can be collected today: ${pickupTodayText(g.today)}.`
        : `Your items from ${g.seller} are collected at the studio.`;

  async function pay() {
    const next: Errors = {};
    if (!name.trim()) next.name = "Enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = "Enter an email address for your receipt.";
    if (anyShip && (!line1.trim() || !city.trim() || !zip.trim())) next.address = "Enter the address to ship to.";
    setErrors(next);
    if (next.address) { addressRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); return; }
    if (next.name || next.email) { payRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); return; }
    if (blocked) return;
    setBusy(true);
    const sent = lines.filter((l) => l.live !== null);
    let res: Response, j: { order?: Order; error?: string };
    try {
      res = await fetch("/api/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: name.trim(), customer_phone: phone.trim(), customer_email: email.trim(),
          fulfilment: anyShip ? "ship" : "pickup",
          fulfilment_by_seller: Object.fromEntries(groups.filter((g) => g.how).map((g) => [g.seller, g.how])),
          address: anyShip ? { line1: line1.trim(), city: city.trim(), zip: zip.trim() } : null,
          promo_code: discount ? promo : "", gift_code: giftUsed ? gift : "",
          items: sent.map((l) => ({ product_slug: l.slug, size_label: l.size, qty: l.qty })),
        }),
      });
      j = await res.json();
    } catch {
      setBusy(false); setErrors({ pay: "We could not reach the shop. Nothing was charged. Try again in a moment." }); return;
    }
    if (!res.ok || !j.order) {
      setBusy(false);
      const text = sentence(j.error ?? "the order could not be placed");
      // The API answers in plain sentences that begin with the product's name. Put each beside what it is about.
      const about = [...sent].sort((a, b) => (b.live?.name ?? b.name).length - (a.live?.name ?? a.name).length).find((l) => (j.error ?? "").startsWith(`${l.live?.name ?? l.name} `));
      if (about && /out of stock|cannot be (shipped|collected)/.test(text)) { setErrors({ items: { [about.key]: text } }); setRefresh((n) => n + 1); }
      else if (/address/i.test(text)) { setErrors({ address: text }); addressRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); }
      else if (/customer_name/.test(text)) setErrors({ name: "Enter your name." });
      else if (/promo code/i.test(text)) setErrors({ promo: text });
      else if (/gift card/i.test(text)) setErrors({ gift: text });
      else setErrors({ pay: text });
      return;
    }
    // Paid online: hand over to the secure payment page. The order is confirmed when the payment arrives.
    if (j.order.payment?.url) { cart.clear(); window.location.href = j.order.payment.url; return; }
    setShippedTo(anyShip ? [line1.trim(), city.trim()].filter(Boolean).join(", ") : "");
    setTold(Object.fromEntries(groups.filter((g) => g.how).map((g) => [g.seller, g.how === "pickup" ? collectText(g) : g.delivery ? `Arrives in ${deliveryDays(g.delivery)}.` : ""])));
    cart.clear(); setBusy(false); setOrder(j.order);
  }

  if (order) {
    const shipments = order.shipments ?? [];
    return (
      <div className="layout">
        <div className="left done">
          <div className="card" role="status">
            <h2 className="serif">Order placed</h2>
            <p className="muted">Order {String(order.id).slice(0, 8)} · {Number(order.total_cents) > 0 ? `${money(Number(order.total_cents))} ${order.status === "pending" ? "to pay" : "paid"}` : "nothing was charged"}{Number(order.discount_cents) > 0 ? ` · ${money(Number(order.discount_cents))} off with ${order.promo_code}` : ""}{Number(order.gift_cents) > 0 ? ` · ${money(Number(order.gift_cents))} from your gift card` : ""}{Number(order.credit_cents) > 0 ? ` · ${money(Number(order.credit_cents))} from your store credit` : ""}</p>
            {shipments.map((s) => (
              <div key={s.seller_name} className="seller ship">
                <span className="av" />
                <span><b>{s.seller_name}</b><span className="muted">{s.fulfilment === "pickup" ? told[s.seller_name] || `Collect at ${s.seller_name}.` : `Ships to ${shippedTo || "your address"}.${told[s.seller_name] ? ` ${told[s.seller_name]}` : ""}`}</span></span>
                <span className="amt">{money(Number(s.items_cents) + Number(s.shipping_cents))}</span>
              </div>
            ))}
            <div className="row">
              <Link href="/shop" className="btn btn-out">Keep shopping</Link>
              {me ? <Link href="/account#orders" className="btn btn-ink">See your orders</Link> : <Link href="/search" className="btn btn-ink">Book a visit</Link>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!ready || items.length === 0) {
    return (
      <div className="layout">
        <div className="left">
          <div className="card">
            <h2 className="serif">Your cart</h2>
            {ready ? <p className="muted empty">Your cart is empty. <Link href="/shop">Browse the shop</Link>.</p> : <p className="muted empty" aria-live="polite">Loading your cart.</p>}
          </div>
        </div>
      </div>
    );
  }

  const choosers = groups.filter((g) => g.ways.length > 1 && g.lines.some((l) => l.live));
  const fixed = groups.filter((g) => !choosers.includes(g) && g.how);
  const collecting = groups.filter((g) => g.how === "pickup"), sending = groups.filter((g) => g.how === "ship");

  const codeRow = (label: string, value: string, set: (v: string) => void, apply: () => void, applied: string, clear: () => void, placeholder: string, ok: string, bad: string) => (
    <div>
      <div className="promo">
        <label><span className="sr">{label}</span><input type="text" value={value} onChange={(e) => set(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); apply(); } }} placeholder={placeholder} readOnly={!!applied} autoComplete="off" spellCheck={false} /></label>
        {applied ? <button type="button" onClick={clear} className="btn btn-out btn-sm">Remove</button> : <button type="button" onClick={apply} disabled={!value.trim()} className="btn btn-out btn-sm">Apply</button>}
      </div>
      {bad ? <p role="alert" className="msg bad">{sentence(bad)}</p> : applied && ok ? <p className="msg good">{ok}</p> : null}
    </div>
  );

  return (
    <div className="layout">
      <div className="left">
        <div className="card">
          <h2 className="serif">Your cart · {count} {count === 1 ? "item" : "items"}</h2>
          {liveError && <p role="alert" className="msg bad">{liveError} <button type="button" className="link" onClick={() => setRefresh((n) => n + 1)}>Try again</button></p>}
          {groups.map((g) => (
            <section key={g.seller} className="grp" aria-label={g.seller}>
              <div className="seller">
                <span className="av" style={{ background: g.lines[0].live?.tone ?? g.lines[0].tone }} />
                <b>{g.seller}</b>
                {g.live?.business_slug ? (g.live.business_city && <span className="muted">· {g.live.business_city}</span>) : g.live && <span className="muted">· ships to you</span>}
                {g.live?.seller_verified && <span className="pill pill-ok">Verified seller</span>}
                {g.live && <Link href={g.live.business_slug ? `/b/${g.live.business_slug}` : `/shop?seller=${encodeURIComponent(g.seller)}`} className="visit">Visit shop</Link>}
              </div>
              {g.lines.map((l) => {
                const problem = errors.items?.[l.key] ?? l.problem;
                return (
                  <div key={l.key} className="item">
                    <Link href={`/shop/${l.slug}`} className="ph" style={{ background: l.live?.tone ?? l.tone }} aria-label={l.live?.name ?? l.name}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {l.live?.photo_id && <img src={`/media/${l.live.photo_id}`} alt="" loading="lazy" decoding="async" />}
                    </Link>
                    <div>
                      <b>{l.live?.name ?? l.name}{l.size ? ` · ${l.size}` : ""}</b>
                      {l.live !== null && <span>{[g.way === "visit" ? `Pick up at your visit · ${g.visitOn}` : g.way === "today" ? "Pick up today" : g.how === "pickup" ? "Pick up at the studio" : g.how === "ship" ? (g.delivery ? `Ships to you · ${deliveryDays(g.delivery)}` : "Ships to you") : "", l.qty > 1 || !g.how ? `${money(l.unit)} each` : ""].filter(Boolean).join(" · ")}</span>}
                      {problem && <span role="alert" className="bad">{problem}</span>}
                    </div>
                    <div className="r">
                      <span className="amt">{l.live === null ? "" : money(l.unit * l.qty)}</span>
                      {l.live !== null && (
                        <div className="qty">
                          <button type="button" onClick={() => cart.setQty(l.slug, l.size, l.qty - 1, l.max)} disabled={l.qty <= 1} aria-label={`Fewer ${l.name}`}>−</button>
                          <b aria-live="polite">{l.qty}</b>
                          <button type="button" onClick={() => cart.setQty(l.slug, l.size, l.qty + 1, l.max)} disabled={l.qty >= l.max} aria-label={`More ${l.name}`}>+</button>
                        </div>
                      )}
                      <button type="button" className="rm" onClick={() => cart.remove(l.slug, l.size)} aria-label={`Remove ${l.name}`}>Remove</button>
                    </div>
                  </div>
                );
              })}
              {stuck.includes(g) && <p role="alert" className="msg bad">Some of these can only be collected and some can only be shipped. Order them separately.</p>}
            </section>
          ))}
        </div>

        <div className="card">
          <h2 className="serif">{choosers.length === 1 ? `How you'll get ${possessive(choosers[0].seller)} items` : "How you'll get your order"}</h2>
          {choosers.map((g) => (
            <div key={g.seller} className="choose" role="radiogroup" aria-label={`How you get the items from ${g.seller}`}>
              {choosers.length > 1 && <span className="lbl">{g.seller}</span>}
              {g.ways.map((w) => (
                <button key={w.id} type="button" role="radio" aria-checked={g.way === w.id} className={`opt ${g.way === w.id ? "on" : ""}`} onClick={() => { cart.setFulfilment(g.seller, w.id === "ship" ? "ship" : "pickup", w.id === "visit" || w.id === "today" ? w.id : undefined); setErrors((e) => ({ ...e, items: undefined })); }}>
                  <span className="radio">{g.way === w.id && <i />}</span><span><b>{w.title}</b><span>{w.sub}</span></span><span className="r">{w.cost}</span>
                </button>
              ))}
            </div>
          ))}
          {anyShip && (
            <div className="two" ref={addressRef}>
              <div className="field wide"><label htmlFor="a1">Address</label><input id="a1" type="text" value={line1} onChange={(e) => setLine1(e.target.value)} autoComplete="address-line1" aria-invalid={!!errors.address && !line1.trim()} aria-describedby={errors.address ? "addr-err" : undefined} /></div>
              <div className="field"><label htmlFor="ct">City</label><input id="ct" type="text" value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" aria-invalid={!!errors.address && !city.trim()} /></div>
              <div className="field"><label htmlFor="zp">ZIP</label><input id="zp" type="text" value={zip} onChange={(e) => setZip(e.target.value)} autoComplete="postal-code" inputMode="numeric" aria-invalid={!!errors.address && !zip.trim()} /></div>
              {errors.address && <p id="addr-err" role="alert" className="msg bad wide">{errors.address}</p>}
            </div>
          )}
          {fixed.map((g) => (
            <div key={g.seller} className="muted fixed">
              {g.how === "ship"
                ? `${g.seller} ships to you${choosers.length ? " either way" : ""}, ${g.shipping > 0 ? money(g.shipping) : "free"}, included below.${g.delivery ? ` Arrives in ${deliveryDays(g.delivery)}.` : ""}`
                : `${possessive(g.seller)} items are collected at the studio, free. ${g.lines.length > 1 ? "Not all of them can be shipped." : "It cannot be shipped."}${g.way === "visit" ? ` They will be waiting at your visit on ${g.visitOn}.` : g.way === "today" && g.today ? ` Pick up today: ${pickupTodayText(g.today)}.` : ""}`}
            </div>
          ))}
        </div>

        <div className="card" ref={payRef}>
          <h2 className="serif">Pay</h2>
          <div className="two">
            <div className="field"><label htmlFor="nm">Name</label><input id="nm" type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-invalid={!!errors.name} />{errors.name && <p role="alert" className="msg bad">{errors.name}</p>}</div>
            <div className="field"><label htmlFor="ph">Mobile · so the seller can reach you</label><input id="ph" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" /></div>
            <div className="field wide"><label htmlFor="em">Email · for your receipt</label><input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-invalid={!!errors.email} />{errors.email && <p role="alert" className="msg bad">{errors.email}</p>}</div>
          </div>
          <div className="tip"><Shield /><span>{due === 0 && loaded ? `Your ${covered.join(" and ") || "discount"} ${covered.length > 1 ? "cover" : "covers"} this order, so nothing will be charged and there is no payment page.` : <>You will pay on Stripe&apos;s secure page. LogaLuxe never sees your card. It is one payment for the whole order, and each seller is paid their share.</>}</span></div>
          {!me && <div className="muted fixed"><Link href="/signin?next=%2Fcart">Sign in</Link> before you pay to keep this order in your account.</div>}
        </div>
      </div>

      <aside className="side" aria-label="Order summary">
        <div className="sum">
          {groups.filter((g) => g.count > 0).map((g) => <div key={g.seller} className="line"><span>{g.seller} · {g.count} {g.count === 1 ? "item" : "items"}</span><span>{money(g.items)}</span></div>)}
          {discount > 0 && <div className="line good"><span>Promo · {promo}</span><span>−{money(discount)}</span></div>}
          {groups.filter((g) => g.how).map((g) => <div key={g.seller} className="line"><span className="muted">{g.how === "ship" ? "Shipping" : "Pickup"} · {g.seller}</span><span className="muted">{g.shipping > 0 ? money(g.shipping) : "Free"}</span></div>)}
          <div className="line"><span className="muted">{TAX_LABEL}</span><span className="muted">{money(tax)}</span></div>
          {giftUsed > 0 && <div className="line good"><span>Gift card</span><span>−{money(giftUsed)}</span></div>}
          {creditUsed > 0 && <div className="line good"><span>Store credit</span><span>−{money(creditUsed)}</span></div>}
          <div className="line total"><span>Total</span><span>{money(due)}</span></div>
          {codeRow("Promo code", promoInput, setPromoInput, () => { setPromo(promoInput.trim()); setErrors((e) => ({ ...e, promo: undefined })); }, promo, () => { setPromo(""); setPromoInput(""); setErrors((e) => ({ ...e, promo: undefined })); }, "Promo code", discount ? `${money(discount)} off` : "", errors.promo ?? (promo ? check.promo_error : ""))}
          {codeRow("Gift card code", giftInput, setGiftInput, () => { setGift(giftInput.trim()); setErrors((e) => ({ ...e, gift: undefined })); }, gift, () => { setGift(""); setGiftInput(""); setErrors((e) => ({ ...e, gift: undefined })); }, "Gift card code", check.gift_balance_cents ? `${money(check.gift_balance_cents)} on this card${giftUsed < check.gift_balance_cents ? `, ${money(giftUsed)} used here` : ""}` : "", errors.gift ?? (gift ? check.gift_error : ""))}
          {errors.pay && <p role="alert" className="msg bad">{errors.pay}</p>}
          <button type="button" className="btn btn-ink pay" disabled={busy || blocked} onClick={pay}>{busy ? (due === 0 ? "Placing your order…" : "Opening the payment page…") : due === 0 ? "Place order" : `Pay ${money(due)}`}</button>
          {due === 0 && loaded && !blocked && <p className="msg">Nothing will be charged.{covered.length ? ` Your ${covered.join(" and ")} ${covered.length > 1 ? "cover" : "covers"} this order.` : ""}</p>}
          {blocked && loaded && <p className="msg bad">Sort out the items marked in your cart first.</p>}
          {(collecting.length > 0 || sending.length > 0) && (
            <div className="ok">
              {[...collecting.map(collectText), ...sending.map((g) => `${g.seller} ships to you${g.delivery ? `, arriving in ${deliveryDays(g.delivery)}` : ""}.`)].join(" ")}
            </div>
          )}
        </div>
        <div className="muted small">
          Prices and stock are checked again when you pay. {me ? "You can follow the order in your account." : ""}
          {credit > 0 && ` You have ${money(credit)} in store credit. It is used on this order automatically${creditUsed < credit && loaded ? `, and ${money(credit - creditUsed)} stays for your next one` : ""}.`}
        </div>
      </aside>
    </div>
  );
}
