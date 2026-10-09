"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { money } from "@/lib/api";
import { MAX_QTY, cart, useCart, type CartItem, type Fulfilment, type PickupWhen } from "@/lib/cart";
import { checkoutRequest, completeCheckout, type CheckoutRequest } from "@/lib/checkout-request";
import { CardChoice, NO_PAY, WalletNote, cardLabel, cardsFor, walletsFor, type PayFeatures } from "@/components/pay-bits";
import { US_STATES, currencyOf, deliveryDays, payProvider, pickupTodayText, possessive, shopHref, visitDay, type CartProduct, type Currency, type OrderQuote, type ProductExtras } from "@/lib/shop";

/** What the server said two codes are worth, and which codes and subtotal it was asked about. */
type Check = { discount_cents: number; promo_error: string; gift_balance_cents: number; gift_error: string; asked: string };
const NONE: Check = { discount_cents: 0, promo_error: "", gift_balance_cents: 0, gift_error: "", asked: "" };
type Shipment = { seller_name: string; fulfilment: Fulfilment; status: string; items_cents: number; shipping_cents: number };
type Order = { id: string; status?: string; currency?: string; total_cents: number; discount_cents: number; gift_cents: number; credit_cents?: number; promo_code: string; shipments?: Shipment[]; payment?: { url?: string } };
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
type Me = { name: string; phone: string; email: string };

const sentence = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) + (/[.!?]$/.test(s) ? "" : ".") : s);
const Shield = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" /></svg>;
const ORDER: Currency[] = ["USD", "NGN"];
const PAYING: Record<Currency, string> = { USD: "Paying in dollars", NGN: "Paying in naira" };
const WORD: Record<Currency, string> = { USD: "dollars", NGN: "naira" };

/**
 * The cart page. The cart can hold products priced in dollars and in naira, but an order is in one
 * currency, so the page shows one cart for each: its own items, delivery choices, total and Pay button.
 * Placing one order leaves the other cart's items where they are.
 */
export function CartView({ me, creditBalances = {}, pay = NO_PAY }: { me?: Me; creditBalances?: Partial<Record<Currency,number>>; /** Kept cards and wallets, each only while LogaLuxe staff have it switched on. */ pay?: PayFeatures }) {
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

  // A cart whose order was placed stays on the page to say so, after its lines have left the cart.
  const [placed, setPlaced] = useState<Currency[]>([]);
  // The product itself says what it is priced in. Until it has answered, the line goes by what was saved with it.
  const byCurrency = useMemo(() => {
    const out: Record<Currency, CartItem[]> = { USD: [], NGN: [] };
    for (const i of items) out[currencyOf(live[i.slug]?.currency ?? i.currency)].push(i);
    return out;
  }, [items, live]);
  const shown = ORDER.filter((c) => byCurrency[c].length > 0 || placed.includes(c));

  if (!ready || shown.length === 0) {
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

  const split = shown.length > 1;
  return (
    <>
      {split && byCurrency.USD.length > 0 && byCurrency.NGN.length > 0 && (
        <p className="twocur" role="note">Your cart holds items priced in dollars and items priced in naira. An order is in one currency, so there is a cart for each below. Pay for one, then the other. Paying for one leaves the other as it is.</p>
      )}
      {shown.map((c) => (
        <section key={c} className={split ? "cur" : undefined} aria-label={split ? PAYING[c] : undefined}>
          {split && <h2 className="serif curh">{PAYING[c]}</h2>}
          <CurrencyCart
            currency={c} items={byCurrency[c]} live={live} extras={extras} loaded={loaded} liveError={liveError} onRefresh={() => setRefresh((n) => n + 1)}
            how={how} when={when} me={me} creditCents={Number(creditBalances[c] || 0)} pay={pay}
            otherLeft={ORDER.filter((o) => o !== c).reduce((a, o) => a + byCurrency[o].reduce((n, i) => n + i.qty, 0), 0)}
            onPlaced={() => setPlaced((p) => (p.includes(c) ? p : [...p, c]))}
          />
        </section>
      ))}
    </>
  );
}

/** One currency's cart: its lines, how each seller's items are delivered, the server's total, and its own Pay button. */
function CurrencyCart({ currency, items, live, extras, loaded, liveError, onRefresh, how, when, me, creditCents, otherLeft, onPlaced, pay: payf }: {
  pay: PayFeatures;
  currency: Currency; items: CartItem[]; live: Record<string, CartProduct | null>; extras: Record<string, ProductExtras>; loaded: boolean; liveError: string; onRefresh: () => void;
  how: Record<string, Fulfilment>; when: Record<string, PickupWhen>; me?: Me; creditCents: number;
  /** How many items are in the cart for the other currency. */
  otherLeft: number; onPlaced: () => void;
}) {
  const naira = currency === "NGN";
  const cash = (cents: number) => money(cents, currency);
  const provider = payProvider(currency);
  // Two carts can be on the page at once, so each field's id carries its currency.
  const id = (s: string) => `${s}-${currency.toLowerCase()}`;

  const [name, setName] = useState(me?.name ?? ""), [phone, setPhone] = useState(me?.phone ?? ""), [email, setEmail] = useState(me?.email ?? "");
  const [line1, setLine1] = useState(""), [city, setCity] = useState(""), [zip, setZip] = useState("");
  // Where an order ships to. In the US it is the state's two-letter code, and tax on brand products depends on it.
  // In Nigeria it is the state as the customer writes it, and changes no amount.
  const [region, setRegion] = useState("");
  // The last answer to "what does this order come to", the order it was for, and the last failure.
  const [quoted, setQuoted] = useState<{ body: string; quote: OrderQuote } | null>(null);
  const [quoteFail, setQuoteFail] = useState<{ body: string; text: string } | null>(null);
  const [quoteRetry, setQuoteRetry] = useState(0);
  const quoteSeq = useRef(0);
  const [busy, setBusy] = useState(false), [errors, setErrors] = useState<Errors>({}), [order, setOrder] = useState<Order | null>(null);
  const [shippedTo, setShippedTo] = useState("");
  // What each seller's part of the placed order was promised, kept for the confirmation.
  const [told, setTold] = useState<Record<string, string>>({});
  // What the shopper typed, and what they pressed Apply on.
  const [promoInput, setPromoInput] = useState(""), [giftInput, setGiftInput] = useState("");
  const [promo, setPromo] = useState(""), [gift, setGift] = useState("");
  const [check, setCheck] = useState<Check>(NONE);
  const addressRef = useRef<HTMLDivElement>(null), payRef = useRef<HTMLDivElement>(null);
  // A card the customer kept in this cart's currency, or a different one. Offered only to a signed-in customer while saved cards are switched on.
  const kept = useMemo(() => cardsFor(payf.cards, currency), [payf.cards, currency]);
  const [cardId, setCardId] = useState(kept[0]?.id ?? "");
  const [keepCard, setKeepCard] = useState(false);
  const wallets = walletsFor(payf, provider);

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
        ...(g.canShip ? [{ id: "ship" as const, title: "Ship to me", sub: g.delivery ? `Arrives in ${deliveryDays(g.delivery)}` : "To the address you give below", cost: (first?.live?.shipping_cents ?? 0) > 0 ? money(first!.live!.shipping_cents, currency) : "Free" }] : []),
      ];
      g.way = g.how === "ship" ? "ship" : g.how === "pickup" ? (when[g.seller] === "today" && g.today ? "today" : g.visitOn ? "visit" : g.today ? "today" : "pickup") : "";
    }
    return out;
  }, [items, live, how, when, extras, currency]);

  const lines = groups.flatMap((g) => g.lines);
  const count = lines.reduce((a, l) => a + (l.live === null ? 0 : l.qty), 0);
  const subtotal = groups.reduce((a, g) => a + g.items, 0);
  const anyShip = groups.some((g) => g.how === "ship");
  const stuck = groups.filter((g) => g.how === "" && g.lines.some((l) => l.live));
  const blocked = !loaded || lines.some((l) => l.problem) || stuck.length > 0;

  // The server says what a code is worth in this cart's currency. It is asked again whenever the cart changes.
  useEffect(() => {
    if (!promo && !gift) { setCheck(NONE); return; }
    let on = true;
    const asked = `${promo}|${gift}|${subtotal}`;
    fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: "orders", currency, subtotal_cents: subtotal, promo_code: promo, gift_code: gift }) })
       .then(async (r) => { const data = await r.json(); if (!r.ok) throw new Error(data.error || "Could not check this code"); return data; }).then((j) => { if (on) setCheck({ ...NONE, ...j, asked }); })
      .catch(() => { if (on) setCheck({ ...NONE, promo_error: promo ? "we could not check that code" : "", gift_error: gift ? "we could not check that card" : "", asked }); });
    return () => { on = false; };
  }, [promo, gift, subtotal, currency]);

  // A code goes into the order only once the server has said it is good for this cart.
  const checked = check.asked === `${promo}|${gift}|${subtotal}`;
  const promoOk = !!promo && checked && !check.promo_error && check.discount_cents > 0;
  // A gift card is valid only for the currency checked by the server.
  const giftOk = !!gift && checked && !check.gift_error && check.gift_balance_cents > 0;

  // The order as it would be placed. The quote is asked for this, and for nothing the shopper has not chosen yet.
  const orderBody = {
    fulfilment: anyShip ? "ship" : "pickup",
    fulfilment_by_seller: Object.fromEntries(groups.filter((g) => g.how).map((g) => [g.seller, g.how])),
    promo_code: promoOk ? promo : "", gift_code: giftOk ? gift : "",
    items: lines.filter((l) => l.live).map((l) => ({ product_slug: l.slug, size_label: l.size, qty: l.qty })),
  };
  // Only a US state changes an amount, so typing the street does not ask again. Nothing in a Nigerian address changes one.
  const quoteBody = blocked || orderBody.items.length === 0 || ((!!promo || !!gift) && !checked) ? "" : JSON.stringify({ ...orderBody, address: anyShip ? { region: naira ? "" : region } : null });

  // The server works out the total: each seller's own tax, tax by state on brand products, the codes and store credit.
  // It is asked again a moment after anything changes, and only the answer to the latest question is kept.
  useEffect(() => {
    if (!quoteBody) return;
    const mine = ++quoteSeq.current;
    const timer = window.setTimeout(async () => {
      let ok = false, j: { quote?: OrderQuote; error?: string } = {};
      try {
        const res = await fetch("/api/orders/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: quoteBody });
        j = await res.json(); ok = res.ok;
      } catch {
        if (mine === quoteSeq.current) setQuoteFail({ body: quoteBody, text: "We could not work out the total just now. Check your connection." });
        return;
      }
      if (mine !== quoteSeq.current) return;
      if (ok && j.quote) { setQuoted({ body: quoteBody, quote: j.quote }); setQuoteFail(null); }
      else setQuoteFail({ body: quoteBody, text: sentence(j.error ?? "the total could not be worked out") });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [quoteBody, quoteRetry]);

  const quote = quoted?.quote;
  const current = !!quoted && quoted.body === quoteBody;
  const failed = !!quoteFail && quoteFail.body === quoteBody;
  // The numbers on show are the last ones the server gave. Until it answers for the cart as it is now, they are marked as updating.
  const updating = !current && !failed;
  const discount = quote?.discount_cents ?? 0, giftUsed = quote?.gift_cents ?? 0, creditUsed = quote?.credit_cents ?? 0;
  const due = quote?.total_cents ?? 0;
  const free = current && due === 0;
  // Only this order currency is supplied here. The server quote is authoritative.
  const credit = me ? Math.max(0, creditCents) : 0;
  const covered = [giftUsed > 0 ? "gift card" : "", creditUsed > 0 ? "store credit" : ""].filter(Boolean);
  // Nothing to pay means no card is asked for, kept or new.
  const offerCards = payf.saved && !!me && !free;
  const useCard = offerCards ? kept.find((c) => c.id === cardId) : undefined;
  // Brand products are taxed by the US state they ship to, so until one is chosen their tax is not in the total.
  const taxWaits = !naira && !region && groups.some((g) => g.how === "ship" && !!g.live && !g.live.business_slug);
  // A quote that fails says why in the API's own sentence, shown where the cart shows order errors.
  const quoteProblem = failed ? quoteFail!.text : "";
  const quoteAbout = !quoteProblem ? "" : /promo code/i.test(quoteProblem) ? "promo" : /gift card/i.test(quoteProblem) ? "gift" : "pay";

  /** What the customer is told about collecting one seller's items. */
  const collectText = (g: Group) =>
    g.way === "visit" ? `Your items from ${g.seller} will be waiting at your visit on ${g.visitOn}.`
      : g.way === "today" && g.today ? `Your items from ${g.seller} can be collected today: ${pickupTodayText(g.today)}.`
        : `Your items from ${g.seller} are collected at the studio.`;

  async function pay() {
    const next: Errors = {};
    if (!name.trim()) next.name = "Enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = "Enter an email address for your receipt.";
    if (anyShip && naira && (!line1.trim() || !city.trim() || !region.trim())) next.address = "Enter the street, the area or city, and the state to deliver to.";
    else if (anyShip && !naira && (!line1.trim() || !city.trim() || !zip.trim())) next.address = "Enter the address to ship to.";
    else if (anyShip && !region) next.address = "Choose the state to ship to.";
    setErrors(next);
    if (next.address) { addressRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); return; }
    if (next.name || next.email) { payRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); return; }
    if (blocked || !current) return;
    setBusy(true);
    const sent = lines.filter((l) => l.live !== null);
    const body = {
      customer_name: name.trim(), customer_phone: phone.trim(), customer_email: email.trim(),
      ...orderBody,
      // A kept card is charged at once; a new card is kept only when the box is ticked.
      ...(useCard ? { card_id: useCard.id } : offerCards && keepCard ? { save_card: true } : {}),
      address: anyShip ? { line1: line1.trim(), city: city.trim(), region: region.trim(), postal: naira ? "" : zip.trim() } : null,
    };
    // The same order sent again (after a lost answer, or two clicks) carries the same request id, so the API
    // answers with the order it already placed rather than placing a second one. Only the id is kept in the browser.
    let request: CheckoutRequest;
    try {
      const fd = new FormData();
      fd.set("order", JSON.stringify(body));
      request = await checkoutRequest(fd, "shop", "cart", me?.email || "guest");
    } catch (e) {
      setBusy(false); setErrors({ pay: (e as Error).message }); return;
    }
    let res: Response, j: { order?: Order; error?: string };
    try {
      res = await fetch("/api/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, request_id: request.id }),
        signal: AbortSignal.timeout(25000),
      });
      j = await res.json();
    } catch {
      setBusy(false); setErrors({ pay: "We could not confirm the result. Nothing more is charged if you try again with the same details: the same request cannot place a second order. You can also check your orders in your account." }); return;
    }
    if (res.ok && j.order) completeCheckout(request);
    if (!res.ok || !j.order) {
      setBusy(false);
      const text = sentence(j.error ?? "the order could not be placed");
      // The API answers in plain sentences that begin with the product's name. Put each beside what it is about.
      const about = [...sent].sort((a, b) => (b.live?.name ?? b.name).length - (a.live?.name ?? a.name).length).find((l) => (j.error ?? "").startsWith(`${l.live?.name ?? l.name} `));
      if (about && /out of stock|cannot be (shipped|collected)/.test(text)) { setErrors({ items: { [about.key]: text } }); onRefresh(); }
      else if (/address/i.test(text)) { setErrors({ address: text }); addressRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); }
      else if (/customer_name/.test(text)) setErrors({ name: "Enter your name." });
      else if (/promo code/i.test(text)) setErrors({ promo: text });
      else if (/gift card/i.test(text)) setErrors({ gift: text });
      else setErrors({ pay: text });
      return;
    }
    // The order holds this cart's lines only. They leave the cart; the other currency's lines stay.
    // Paid online: hand over to the secure payment page. The order is confirmed when the payment arrives.
    // With a kept card the money may already be taken: then there is no payment page and the order comes back paid.
    if (j.order.payment?.url) { cart.removeLines(sent); window.location.href = j.order.payment.url; return; }
    setShippedTo(anyShip ? [line1.trim(), city.trim(), region.trim()].filter(Boolean).join(", ") : "");
    setTold(Object.fromEntries(groups.filter((g) => g.how).map((g) => [g.seller, g.how === "pickup" ? collectText(g) : g.delivery ? `Arrives in ${deliveryDays(g.delivery)}.` : ""])));
    onPlaced(); setOrder(j.order); setBusy(false); cart.removeLines(sent);
  }

  if (order) {
    const shipments = order.shipments ?? [];
    // The order says what it is in. It is this cart's currency.
    const paid = (cents: number) => money(cents, currencyOf(order.currency ?? currency));
    return (
      <div className="layout">
        <div className="left done">
          <div className="card" role="status">
            <h2 className="serif">Order placed</h2>
            <p className="muted">Order {String(order.id).slice(0, 8)} · {Number(order.total_cents) > 0 ? `${paid(Number(order.total_cents))} ${order.status === "pending" ? "to pay" : "paid"}` : "nothing was charged"}{Number(order.discount_cents) > 0 ? ` · ${paid(Number(order.discount_cents))} off with ${order.promo_code}` : ""}{Number(order.gift_cents) > 0 ? ` · ${paid(Number(order.gift_cents))} from your gift card` : ""}{Number(order.credit_cents) > 0 ? ` · ${paid(Number(order.credit_cents))} from your store credit` : ""}</p>
            {shipments.map((s) => (
              <div key={s.seller_name} className="seller ship">
                <span className="av" />
                <span><b>{s.seller_name}</b><span className="muted">{s.fulfilment === "pickup" ? told[s.seller_name] || `Collect at ${s.seller_name}.` : `Ships to ${shippedTo || "your address"}.${told[s.seller_name] ? ` ${told[s.seller_name]}` : ""}`}</span></span>
                <span className="amt">{paid(Number(s.items_cents) + Number(s.shipping_cents))}</span>
              </div>
            ))}
            {otherLeft > 0 && <p className="muted">Your {otherLeft === 1 ? "item" : `${otherLeft} items`} priced in {WORD[naira ? "USD" : "NGN"]} {otherLeft === 1 ? "is" : "are"} still in your cart, ready to pay for.</p>}
            <div className="row">
              <Link href={shopHref(currency)} className="btn btn-out">Keep shopping</Link>
              {me ? <Link href="/account?tab=orders" className="btn btn-ink">See your orders</Link> : <Link href={naira ? "/search?place=nigeria" : "/search"} className="btn btn-ink">Book a visit</Link>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

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
          {liveError && <p role="alert" className="msg bad">{liveError} <button type="button" className="link" onClick={onRefresh}>Try again</button></p>}
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
                      {l.live !== null && <span>{[g.way === "visit" ? `Pick up at your visit · ${g.visitOn}` : g.way === "today" ? "Pick up today" : g.how === "pickup" ? "Pick up at the studio" : g.how === "ship" ? (g.delivery ? `Ships to you · ${deliveryDays(g.delivery)}` : "Ships to you") : "", l.qty > 1 || !g.how ? `${cash(l.unit)} each` : ""].filter(Boolean).join(" · ")}</span>}
                      {problem && <span role="alert" className="bad">{problem}</span>}
                    </div>
                    <div className="r">
                      <span className="amt">{l.live === null ? "" : cash(l.unit * l.qty)}</span>
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
          {anyShip && naira && (
            <div className="two" ref={addressRef}>
              <div className="field wide"><label htmlFor={id("a1")}>Street address</label><input id={id("a1")} type="text" value={line1} onChange={(e) => setLine1(e.target.value)} autoComplete="address-line1" aria-invalid={!!errors.address && !line1.trim()} aria-describedby={errors.address ? id("addr-err") : undefined} /></div>
              <div className="field"><label htmlFor={id("ct")}>Area or city</label><input id={id("ct")} type="text" value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" aria-invalid={!!errors.address && !city.trim()} /></div>
              <div className="field"><label htmlFor={id("st")}>State</label><input id={id("st")} type="text" value={region} onChange={(e) => { setRegion(e.target.value); setErrors((x) => ({ ...x, address: undefined })); }} autoComplete="address-level1" aria-invalid={!!errors.address && !region.trim()} /></div>
              {errors.address && <p id={id("addr-err")} role="alert" className="msg bad wide">{errors.address}</p>}
            </div>
          )}
          {anyShip && !naira && (
            <div className="two" ref={addressRef}>
              <div className="field wide"><label htmlFor={id("a1")}>Address</label><input id={id("a1")} type="text" value={line1} onChange={(e) => setLine1(e.target.value)} autoComplete="address-line1" aria-invalid={!!errors.address && !line1.trim()} aria-describedby={errors.address ? id("addr-err") : undefined} /></div>
              <div className="csz wide">
                <div className="field"><label htmlFor={id("ct")}>City</label><input id={id("ct")} type="text" value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" aria-invalid={!!errors.address && !city.trim()} /></div>
                <div className="field"><label htmlFor={id("st")}>State</label>
                  <select id={id("st")} value={region} onChange={(e) => { setRegion(e.target.value); setErrors((x) => ({ ...x, address: undefined })); }} autoComplete="address-level1" aria-invalid={!!errors.address && !region}>
                    <option value="">Choose a state</option>
                    {US_STATES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                  </select>
                </div>
                <div className="field"><label htmlFor={id("zp")}>ZIP</label><input id={id("zp")} type="text" value={zip} onChange={(e) => setZip(e.target.value)} autoComplete="postal-code" inputMode="numeric" aria-invalid={!!errors.address && !zip.trim()} /></div>
              </div>
              {errors.address && <p id={id("addr-err")} role="alert" className="msg bad wide">{errors.address}</p>}
            </div>
          )}
          {fixed.map((g) => (
            <div key={g.seller} className="muted fixed">
              {g.how === "ship"
                ? `${g.seller} ships to you${choosers.length ? " either way" : ""}, ${g.shipping > 0 ? cash(g.shipping) : "free"}, included below.${g.delivery ? ` Arrives in ${deliveryDays(g.delivery)}.` : ""}`
                : `${possessive(g.seller)} items are collected at the studio, free. ${g.lines.length > 1 ? "Not all of them can be shipped." : "It cannot be shipped."}${g.way === "visit" ? ` They will be waiting at your visit on ${g.visitOn}.` : g.way === "today" && g.today ? ` Pick up today: ${pickupTodayText(g.today)}.` : ""}`}
            </div>
          ))}
        </div>

        <div className="card" ref={payRef}>
          <h2 className="serif">Pay</h2>
          <div className="two">
            <div className="field"><label htmlFor={id("nm")}>Name</label><input id={id("nm")} type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-invalid={!!errors.name} />{errors.name && <p role="alert" className="msg bad">{errors.name}</p>}</div>
            <div className="field"><label htmlFor={id("ph")}>Mobile · so the seller can reach you</label><input id={id("ph")} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder={naira ? "0803 123 4567" : undefined} /></div>
            <div className="field wide"><label htmlFor={id("em")}>Email · for your receipt</label><input id={id("em")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-invalid={!!errors.email} />{errors.email && <p role="alert" className="msg bad">{errors.email}</p>}</div>
          </div>
          {offerCards ? (
            <div className="choose">
              {kept.length > 0 ? <span className="lbl">Pay with</span> : null}
              <CardChoice cards={kept} provider={provider} value={useCard ? useCard.id : ""} onChange={setCardId} keep={keepCard} onKeep={setKeepCard} name={id("pay-card")} wallets={wallets} otherSub={false} charge={due > 0 ? `You will be charged ${cash(due)} ${useCard ? "now, with no payment page" : `on ${provider}'s page`}.` : undefined} />
            </div>
          ) : null}
          <div className="tip"><Shield /><span>{free ? `Your ${covered.join(" and ") || "discount"} ${covered.length > 1 ? "cover" : "covers"} this order, so nothing will be charged and there is no payment page.` : useCard ? <>{cardLabel(useCard)} is charged when you press Pay. LogaLuxe never sees your card. It is one payment for {otherLeft > 0 ? `the items priced in ${WORD[currency]}` : "the whole order"}, and each seller is paid their share.</> : <>You will pay on {provider}&apos;s secure page. LogaLuxe never sees your card.{wallets ? <WalletNote /> : null} It is one payment for {otherLeft > 0 ? `the items priced in ${WORD[currency]}` : "the whole order"}, and each seller is paid their share.</>}</span></div>
          {!me && <div className="muted fixed"><Link href="/signin?next=%2Fcart">Sign in</Link> before you pay to keep this order in your account.</div>}
        </div>
      </div>

      <aside className="side" aria-label={`Order summary, ${WORD[currency]}`}>
        <div className="sum">
          {groups.filter((g) => g.count > 0).map((g) => <div key={g.seller} className="line"><span>{g.seller} · {g.count} {g.count === 1 ? "item" : "items"}</span><span>{cash(g.items)}</span></div>)}
          {/* Every amount from here to the total is the server's own, from the order quote. */}
          <div className={`nums ${updating ? "upd" : ""}`} aria-busy={updating}>
            <div className="line"><span className="muted">Subtotal</span><span className="muted">{quote ? cash(quote.subtotal_cents) : "…"}</span></div>
            {discount > 0 && <div className="line good"><span>Promo · {promo}</span><span>−{cash(discount)}</span></div>}
            {collecting.map((g) => <div key={g.seller} className="line"><span className="muted">Pickup · {g.seller}</span><span className="muted">Free</span></div>)}
            {sending.length > 0 && <div className="line"><span className="muted">Shipping · {sending.map((g) => g.seller).join(", ")}</span><span className="muted">{!quote ? "…" : quote.shipping_cents > 0 ? cash(quote.shipping_cents) : "Free"}</span></div>}
            <div className="line"><span className="muted">Tax</span><span className="muted">{quote ? cash(quote.tax_cents) : "…"}</span></div>
            {taxWaits && <p className="msg">Choose the state you ship to. Tax on shipped items is added then.</p>}
            {giftUsed > 0 && <div className="line good"><span>Gift card</span><span>−{cash(giftUsed)}</span></div>}
            {creditUsed > 0 && <div className="line good"><span>Store credit</span><span>−{cash(creditUsed)}</span></div>}
            <div className="line total"><span>Total</span><span>{quote ? cash(due) : "…"}</span></div>
          </div>
          <p className="msg" role="status">{updating && !blocked ? (quote ? "Updating the total." : "Working out the total.") : ""}</p>
          {codeRow("Promo code", promoInput, setPromoInput, () => { setPromo(promoInput.trim()); setErrors((e) => ({ ...e, promo: undefined })); }, promo, () => { setPromo(""); setPromoInput(""); setErrors((e) => ({ ...e, promo: undefined })); }, "Promo code", promoOk ? `${cash(current && discount ? discount : check.discount_cents)} off` : "", errors.promo ?? (quoteAbout === "promo" ? quoteProblem : promo && checked ? check.promo_error : ""))}
          {/* A gift card pays only for an order in its own money; the API says so when it does not match. */}
          {codeRow("Gift card code", giftInput, setGiftInput, () => { setGift(giftInput.trim()); setErrors((e) => ({ ...e, gift: undefined })); }, gift, () => { setGift(""); setGiftInput(""); setErrors((e) => ({ ...e, gift: undefined })); }, "Gift card code", giftOk ? `${cash(check.gift_balance_cents)} on this card${current && giftUsed < check.gift_balance_cents ? `, ${cash(giftUsed)} used here` : ""}` : "", errors.gift ?? (quoteAbout === "gift" ? quoteProblem : gift && checked ? check.gift_error : ""))}
          {errors.pay && <p role="alert" className="msg bad">{errors.pay}</p>}
          {!errors.pay && quoteAbout === "pay" && <p role="alert" className="msg bad">{quoteProblem} <button type="button" className="link" onClick={() => setQuoteRetry((n) => n + 1)}>Try again</button></p>}
          <button type="button" className="btn btn-ink pay" disabled={busy || blocked || !current} onClick={pay}>{busy ? (due === 0 ? "Placing your order…" : useCard ? "Paying…" : "Opening the payment page…") : !quote ? "Working out the total…" : due === 0 ? "Place order" : `Pay ${cash(due)}`}</button>
          {free && !blocked && <p className="msg">Nothing will be charged.{covered.length ? ` Your ${covered.join(" and ")} ${covered.length > 1 ? "cover" : "covers"} this order.` : ""}</p>}
          {blocked && loaded && <p className="msg bad">Sort out the items marked in your cart first.</p>}
          {(collecting.length > 0 || sending.length > 0) && (
            <div className="ok">
              {[...collecting.map(collectText), ...sending.map((g) => `${g.seller} ships to you${g.delivery ? `, arriving in ${deliveryDays(g.delivery)}` : ""}.`)].join(" ")}
            </div>
          )}
        </div>
        <div className="muted small">
          {naira ? "Tax is each seller's own rate. You pay in naira through Paystack." : "Tax depends on the seller and where an order ships."} Prices and stock are checked again when you pay. {me ? "You can follow the order in your account." : ""}
          {credit > 0 && ` You have ${cash(credit)} in store credit. It is used on this order automatically${current && creditUsed < credit ? `, and ${cash(credit - creditUsed)} stays for your next one` : ""}.`}
        </div>
      </aside>
    </div>
  );
}
