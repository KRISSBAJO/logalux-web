"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Avatar, Empty, Topbar } from "@/components/merchant-ui";
import { dateOnly, dur, firstName, money } from "@/lib/merchant-format";
import { makeLink, pay, quote, type PayLink, type Quote } from "./actions";
import { lineTotal, pointsProblem, ticketTotals, toCents, type Line, type MemberRates, type Points } from "./math";

type Service = { id: string; name: string; category: string; price_cents: number; duration_min: number };
type Product = { id: string; name: string; price_cents: number; stock: number; sku: string };
type Person = { id: string; name: string };
type PlanItem = { service_id: string; name: string; qty: number };
type Package = { id: string; name: string; description: string; price_cents: number; valid_days: number; items: PlanItem[] };
type Membership = { id: string; name: string; description: string; price_cents: number; service_discount_pct: number; retail_discount_pct: number; items: PlanItem[] };
type Credit = { id: string; service_id: string; service: string; total: number; used: number; left: number; expires_at: string | null; usable: boolean };
type Plan = {
  id: string; kind: "package" | "membership"; name: string; status: string; membership_id: string | null; package_id: string | null;
  expires_at: string | null; renews_on: string | null; service_discount_pct: number | null; retail_discount_pct: number | null; credits: Credit[];
  card_on_file?: boolean; charge_problem?: string | null;
};
type Found = { id: string; name: string; phone: string; email: string };
type Price = { price_cents: number; menu_cents: number; rules: string[] } | "failed";
type Tab = "services" | "products" | "packages" | "memberships" | "custom";

export type TillVisit = {
  id: string; clientId: string | null; clientName: string; sub: string; staffId: string; staffName: string; tone: string;
  /** The deposit already paid, which comes off what is due. */
  depositPaid: number;
  /** A discount promised when the visit was booked. */
  discount: number; promo: string;
  lines: Line[];
};

// In simulation every method is pretend. With real payments on, only a pay link goes through LogaLuxe:
// the rest is money the business took itself, which is written down and nothing more.
const SIM_METHODS: { id: string; name: string }[] = [
  { id: "tap", name: "Tap to pay" }, { id: "card", name: "Card" }, { id: "cash", name: "Cash" }, { id: "transfer", name: "Bank transfer" }, { id: "wallet", name: "Wallet" },
];
const LIVE_METHODS: { id: string; name: string }[] = [
  { id: "link", name: "Pay by link" }, { id: "card", name: "Card machine" }, { id: "cash", name: "Cash" }, { id: "transfer", name: "Bank transfer" }, { id: "wallet", name: "Mobile wallet" },
];
export type LoyaltyRules = { enabled: boolean; earn_points: number; per_cents: number; point_value_cents: number; min_redeem: number };
type OpenLink = Extract<PayLink, { ok: true }> & { status: string; problem: string; saleId: string };
const TONES = ["#3B1D22", "#4A3426", "#2E2538", "#1F2A33", "#3A3A2E", "#5A4A3A"];
const DATA = "/business/checkout/data";

async function ask<T>(query: string): Promise<T> {
  const res = await fetch(`${DATA}?${query}`, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
  return body as T;
}

const includes = (items: PlanItem[]) => items.map((i) => `${i.qty} × ${i.name}`).join(", ");
const rates = (service: number, retail: number) => [service > 0 ? `${service}% off services` : "", retail > 0 ? `${retail}% off retail` : ""].filter(Boolean).join(", ");

function PayButton({ label, disabled }: { label: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return <button className="btn btn-ink" style={{ width: "100%", minHeight: 50 }} disabled={disabled || pending}>{pending ? "Working…" : label}</button>;
}

/**
 * The ticket being built: what is on it, the tip, the discount and how the client pays.
 * It lives in the browser until Charge is pressed; then one server action sends it.
 */
export function Till({ currency, taxBp, simulated, live, market, loyalty, locations, services, products, packages, memberships, staff, visit, client, myStaffId, back, canManage, canPay, topRight, above, below }: {
  currency: string; taxBp: number; simulated: boolean; market: string;
  /** Real online payments are on: a pay link can be sent, and every other method is only written down. */
  live: boolean;
  loyalty: LoyaltyRules | null;
  locations: { id: string; name: string; is_primary: boolean }[];
  services: Service[]; products: Product[]; packages: Package[]; memberships: Membership[]; staff: Person[];
  /** The visit being paid for, or null for a quick sale. */
  visit: TillVisit | null;
  /** The client of a quick sale, when one was chosen on the Clients screen. */
  client: { id: string; name: string } | null;
  myStaffId: string; back: string; canManage: boolean;
  /** False when this sign-in may look at the till but not charge. */
  canPay: boolean;
  topRight: ReactNode; above: ReactNode; below: ReactNode;
}) {
  const [lines, setLines] = useState<Line[]>(visit?.lines ?? []);
  const [tab, setTab] = useState<Tab>(services.length || !products.length ? "services" : "products");
  const [find, setFind] = useState("");
  const [tipPct, setTipPct] = useState<number | null>(null);
  const [tipText, setTipText] = useState("");
  const [discountText, setDiscountText] = useState(visit && visit.discount > 0 ? (visit.discount / 100).toString() : "");
  const [showDiscount, setShowDiscount] = useState(!!visit && visit.discount > 0);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [method, setMethod] = useState(live ? (market === "NG" ? "transfer" : "card") : market === "NG" ? "transfer" : "tap");
  const [promoText, setPromoText] = useState("");
  const [showPromo, setShowPromo] = useState(false);
  const [pointsText, setPointsText] = useState("");
  // A visit is sold where it was booked unless the desk says otherwise; a quick sale at the main location.
  const [locationId, setLocationId] = useState(visit ? "" : locations.find((l) => l.is_primary)?.id ?? locations[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<OpenLink | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const METHODS = live ? LIVE_METHODS : SIM_METHODS;
  const provider = market === "NG" ? "Paystack" : "Stripe";
  const [clientName, setClientName] = useState("");
  const [staffId, setStaffId] = useState(staff.some((p) => p.id === myStaffId) ? myStaffId : "");
  const [customName, setCustomName] = useState("");
  const [customAmount, setCustomAmount] = useState("");

  // The client of a quick sale can be chosen here; a visit already has its client.
  const [chosen, setChosen] = useState<{ id: string; name: string } | null>(client);
  const [lookup, setLookup] = useState("");
  const [found, setFound] = useState<Found[] | null>(null);
  const [lookupError, setLookupError] = useState("");
  const clientId = visit ? visit.clientId : chosen?.id ?? null;
  const sellerId = visit ? visit.staffId : staffId;

  useEffect(() => {
    const q = lookup.trim();
    if (q.length < 2) { setFound(null); setLookupError(""); return; }
    let open = true;
    const timer = setTimeout(() => {
      ask<{ clients: Found[] }>(`kind=clients&q=${encodeURIComponent(q)}`)
        .then((out) => { if (open) { setFound(out.clients); setLookupError(""); } })
        .catch((e: Error) => { if (open) { setFound([]); setLookupError(e.message); } });
    }, 250);
    return () => { open = false; clearTimeout(timer); };
  }, [lookup]);

  // What the client holds: packages with visits left, and a membership with its discounts.
  const [plans, setPlans] = useState<{ forClient: string; plans: Plan[]; points: number; error: string } | null>(null);
  useEffect(() => {
    if (!clientId) { setPlans(null); return; }
    let open = true;
    ask<{ plans: Plan[]; points?: number }>(`kind=plans&client=${encodeURIComponent(clientId)}`)
      .then((out) => { if (open) setPlans({ forClient: clientId, plans: out.plans ?? [], points: Number(out.points ?? 0), error: "" }); })
      .catch((e: Error) => { if (open) setPlans({ forClient: clientId, plans: [], points: 0, error: e.message }); });
    return () => { open = false; };
  }, [clientId]);
  const held = plans && plans.forClient === clientId ? plans.plans : [];
  const plansLoading = !!clientId && (!plans || plans.forClient !== clientId);
  const activeHeld = held.filter((p) => p.status === "active" || p.status === "past_due");
  // The API takes the best rate of each kind across the memberships that are active.
  const memberships_ = held.filter((p) => p.kind === "membership" && p.status === "active");
  const member: (MemberRates & { name: string }) | null = memberships_.length
    ? { name: memberships_.map((p) => p.name).join(", "), service: Math.max(...memberships_.map((p) => p.service_discount_pct ?? 0)), retail: Math.max(...memberships_.map((p) => p.retail_discount_pct ?? 0)) }
    : null;
  const credits = held.flatMap((p) => p.credits.filter((c) => c.usable).map((c) => ({ ...c, plan: p.name })));
  const creditsLeft = (serviceId: string) => credits.filter((c) => c.service_id === serviceId).reduce((a, c) => a + c.left, 0) - lines.filter((l) => l.redeem && l.service_id === serviceId).length;
  const creditPlan = (serviceId: string) => credits.find((c) => c.service_id === serviceId)?.plan ?? "a credit";

  // A service added at the desk costs what the pricing rules say for this person, now. Ask for each one.
  const [prices, setPrices] = useState<Record<string, Price>>({});
  const priceKey = (serviceId: string) => `${serviceId}|${sellerId}`;
  const wanted = [...new Set(lines.filter((l) => l.kind === "service" && l.service_id && !l.fixed).map((l) => priceKey(l.service_id!)))].filter((k) => !(k in prices)).join(",");
  useEffect(() => {
    if (!wanted) return;
    // Answers are kept by service and person, so a late one is still right and is never thrown away.
    for (const key of wanted.split(",")) {
      const [service, who] = key.split("|");
      ask<{ price_cents: number; menu_cents: number; rules: string[] }>(`kind=price&service=${encodeURIComponent(service)}&staff=${encodeURIComponent(who)}`)
        .then((out) => setPrices((p) => ({ ...p, [key]: out })))
        .catch(() => setPrices((p) => ({ ...p, [key]: "failed" })));
    }
  }, [wanted]);

  // The lines as they will be charged.
  const priced = lines.map((l) => {
    if (l.kind !== "service" || !l.service_id || l.fixed) return { ...l, why: "", checking: false };
    const p = prices[priceKey(l.service_id)];
    if (!p) return { ...l, why: "", checking: true };
    if (p === "failed") return { ...l, why: "Price could not be checked. The menu price is shown.", checking: false };
    return { ...l, unit: p.price_cents, why: p.price_cents !== p.menu_cents ? `${p.rules.length ? p.rules.join(", ") : "Their own price"} · menu price ${money(p.menu_cents, currency)}` : "", checking: false };
  });
  const checking = priced.some((l) => l.checking);

  const cash = (n: number) => money(n, currency);
  const base = ticketTotals(priced, { discount: 0, tip: 0, taxBp, depositPaid: 0 });
  // Tips are worked out on services, or on the whole ticket when it has none.
  const tipBase = base.serviceTotal > 0 ? base.serviceTotal : base.subtotal;
  const tip = tipPct !== null ? Math.round((tipBase * tipPct) / 100) : toCents(tipText);
  const typed = showDiscount ? toCents(discountText) : 0;
  // Loyalty: what the client has, and what the desk wants to spend of it.
  const balance = plans && plans.forClient === clientId ? plans.points : 0;
  const points: Points | null = loyalty?.enabled && clientId
    ? { enabled: true, earnPoints: loyalty.earn_points, perCents: loyalty.per_cents, pointValue: loyalty.point_value_cents, minRedeem: loyalty.min_redeem, balance, redeem: Math.max(0, Math.round(Number(pointsText) || 0)) }
    : null;
  const pointsWhy = pointsProblem(points);
  const promo = showPromo ? promoText.trim().toUpperCase() : "";
  const t = ticketTotals(priced, { discount: typed, tip, taxBp, depositPaid: visit?.depositPaid ?? 0, member, points });
  // Shown in the order they are taken: typed, member, points. All of it is capped at the subtotal.
  const typedShown = Math.min(typed, t.discount), memberShown = Math.min(t.memberDiscount, t.discount - typedShown), pointsShown = Math.min(t.pointsDiscount, t.discount - typedShown - memberShown);

  // The API prices the ticket: the sums above are only the instant estimate while its answer is on the way.
  // Everything that changes the total is in this key; a change waits 400 ms, then the same body a sale sends is quoted.
  const pointsSent = points && !pointsWhy ? points.redeem : 0;
  const quoteKey = lines.length ? JSON.stringify([lines.map((l) => [l.kind, l.service_id, l.product_id, l.package_id, l.membership_id, l.qty, !!l.redeem, l.fixed ? l.unit : null]), t.tip, Math.min(typed, t.subtotal), promo, pointsSent, visit?.id ?? "", clientId ?? "", locationId]) : "";
  const [quoted, setQuoted] = useState<{ forKey: string; out: Quote } | null>(null);
  useEffect(() => {
    if (!quoteKey) return;
    let open = true;
    const timer = setTimeout(() => {
      if (!form.current) return;
      quote(new FormData(form.current))
        .then((out) => { if (open) setQuoted({ forKey: quoteKey, out }); })
        .catch(() => { if (open) setQuoted({ forKey: quoteKey, out: { ok: false, error: "The total could not be checked. Try again." } }); });
    }, 400);
    return () => { open = false; clearTimeout(timer); };
  }, [quoteKey]);
  const answer = quoted && quoted.forKey === quoteKey ? quoted.out : null;
  const fig = answer?.ok ? answer.quote : null;
  const quoteError = answer && !answer.ok ? answer.error : "";
  const quoting = !!quoteKey && !answer;
  // The figures shown: the API's when it has answered, the estimate until then.
  const due = fig ? fig.total_cents : t.due;
  const promoOff = fig ? fig.promo_discount_cents : 0, memberOff = fig ? fig.member_discount_cents : memberShown, pointsOff = fig ? fig.points_discount_cents : pointsShown;
  const typedOff = fig ? Math.max(0, fig.discount_cents - promoOff - memberOff - pointsOff) : typedShown;
  const pointsUsed = fig ? fig.points_used : t.pointsUsed, pointsEarned = fig ? fig.points_earned : t.pointsEarned;

  // A pay link: the API prices the sale and opens a payment page. Then ask every few seconds whether it was paid.
  const sendLink = async () => {
    if (!form.current) return;
    setLinkBusy(true);
    setLinkError("");
    const fd = new FormData(form.current);
    fd.set("email", email.trim());
    const out = await makeLink(fd).catch(() => ({ ok: false as const, error: "The pay link could not be made. Try again." }));
    setLinkBusy(false);
    if (!out.ok) { setLinkError(out.error); return; }
    setLink({ ...out, status: "pending", problem: "", saleId: "" });
  };
  const linkRef = link?.reference ?? "", linkStatus = link?.status ?? "";
  useEffect(() => {
    if (!linkRef || linkStatus !== "pending") return;
    let open = true;
    const check = () => ask<{ payment: { status: string; problem?: string; sale_id?: string | null } | null }>(`kind=payment&ref=${encodeURIComponent(linkRef)}`)
      .then((out) => { if (open && out.payment) setLink((l) => (l && l.reference === linkRef ? { ...l, status: out.payment!.status, problem: out.payment!.problem ?? "", saleId: out.payment!.sale_id ?? "" } : l)); })
      .catch(() => {});
    const timer = setInterval(check, 4000);
    return () => { open = false; clearInterval(timer); };
  }, [linkRef, linkStatus]);
  // Paid: the API has recorded the sale. Show its receipt, which also reloads the queue.
  const paidSale = link?.status === "paid" ? link.saleId : "";
  useEffect(() => {
    if (!paidSale || !link) return;
    const x = link.totals;
    const query = new URLSearchParams({ receipt: paidSale, sub: String(x.subtotal_cents), disc: String(x.discount_cents), tax: String(x.tax_cents), tip: String(x.tip_cents), dep: String(x.deposit_cents), total: String(x.total_cents) });
    if (x.member_discount_cents) query.set("member", String(x.member_discount_cents));
    router.push(`/business/checkout?${query}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paidSale]);

  const sellerName = visit ? visit.staffName : staff.find((p) => p.id === staffId)?.name ?? "";
  const inCart = (productId: string) => lines.find((l) => l.product_id === productId)?.qty ?? 0;
  const has = (key: "package_id" | "membership_id", id: string) => lines.some((l) => l[key] === id);
  const alreadyMember = (id: string) => held.some((p) => p.membership_id === id && p.status === "active");

  const addService = (s: Service) => setLines((ls) => {
    // A service that is part of the booked visit keeps the price agreed at booking.
    const booked = visit?.lines.find((l) => l.service_id === s.id && l.fixed);
    const at = ls.findIndex((l) => l.kind === "service" && l.service_id === s.id && !l.redeem && !!l.fixed === !!booked);
    if (at >= 0) return ls.map((l, i) => (i === at ? { ...l, qty: l.qty + 1 } : l));
    return [...ls, { key: `s-${s.id}-${Date.now()}`, kind: "service", service_id: s.id, name: s.name, sub: `Service · ${dur(s.duration_min)}`, unit: booked ? booked.unit : s.price_cents, qty: 1, fixed: booked ? true : undefined }];
  });
  const addProduct = (p: Product) => setLines((ls) => {
    const at = ls.findIndex((l) => l.product_id === p.id);
    if (at >= 0) return ls.map((l, i) => (i === at ? { ...l, qty: Math.min(p.stock, l.qty + 1) } : l));
    return [...ls, { key: `p-${p.id}`, kind: "product", product_id: p.id, name: p.name, sub: "Retail", unit: p.price_cents, qty: 1, stock: p.stock }];
  });
  const addPackage = (p: Package) => setLines((ls) => (ls.some((l) => l.package_id === p.id) ? ls : [...ls, { key: `k-${p.id}`, kind: "package", package_id: p.id, name: p.name, sub: `Package · ${includes(p.items)}`, unit: p.price_cents, qty: 1 }]));
  const addMembership = (m: Membership) => setLines((ls) => (ls.some((l) => l.membership_id === m.id) ? ls : [...ls, { key: `m-${m.id}`, kind: "membership", membership_id: m.id, name: `${m.name} · first month`, sub: "Membership · renews each month", unit: m.price_cents, qty: 1 }]));
  const addCustom = () => {
    const name = customName.trim(), unit = toCents(customAmount);
    if (!name) return;
    setLines((ls) => [...ls, { key: `c-${Date.now()}`, kind: "custom", name, sub: "Custom amount", unit, qty: 1, fixed: true }]);
    setCustomName("");
    setCustomAmount("");
  };
  const setQty = (key: string, by: number) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, qty: Math.max(1, Math.min(l.stock ?? 99, l.qty + by)) } : l)));
  const remove = (key: string) => setLines((ls) => ls.filter((l) => l.key !== key));
  // One credit pays for one visit, so a line with several is split: one is paid by the credit, the rest stay.
  const redeem = (key: string, on: boolean) => setLines((ls) => ls.flatMap((l) => {
    if (l.key !== key) return [l];
    if (!on) return [{ ...l, redeem: false }];
    return l.qty > 1 ? [{ ...l, key: `${l.key}-r${Date.now()}`, qty: 1, redeem: true }, { ...l, qty: l.qty - 1 }] : [{ ...l, redeem: true }];
  }));
  const pick = (c: { id: string; name: string } | null) => {
    setChosen(c);
    setLookup("");
    setFound(null);
    // Credits belong to one client, so none carry over to the next.
    setLines((ls) => ls.map((l) => (l.redeem ? { ...l, redeem: false } : l)));
  };

  const q = find.trim().toLowerCase();
  const match = (...texts: string[]) => texts.some((x) => x.toLowerCase().includes(q));
  const shownServices = q ? services.filter((s) => match(s.name, s.category)) : tab === "services" ? services : [];
  const shownProducts = q ? products.filter((p) => match(p.name, p.sku)) : tab === "products" ? products : [];
  const shownPackages = q ? packages.filter((p) => match(p.name)) : tab === "packages" ? packages : [];
  const shownMemberships = q ? memberships.filter((m) => match(m.name)) : tab === "memberships" ? memberships : [];
  const shown = shownServices.length + shownProducts.length + shownPackages.length + shownMemberships.length;
  const plansNeedClient = !clientId && (shownPackages.length > 0 || shownMemberships.length > 0);
  const orphanPlans = !clientId && lines.some((l) => l.kind === "package" || l.kind === "membership");

  const items = JSON.stringify(priced.map((l) => ({
    kind: l.kind, service_id: l.service_id, product_id: l.product_id, package_id: l.package_id, membership_id: l.membership_id,
    qty: l.kind === "package" || l.kind === "membership" || l.redeem ? 1 : l.qty,
    ...(l.redeem ? { redeem: true } : (l.kind === "service" || l.kind === "custom") && (l.fixed || !l.service_id) ? { name: l.name, unit_cents: l.unit } : {}),
  })));
  const cta = !lines.length ? "Add something to charge" : checking || quoting ? "Checking the total…" : quoteError ? "Cannot charge yet" : due === 0 ? "Complete sale"
    : method === "cash" ? `Record cash ${cash(due)}` : live ? `Record ${cash(due)} taken` : `Charge ${cash(due)}`;
  const blocked = !lines.length || checking || quoting || !!quoteError || plansLoading || !!pointsWhy || !canPay;
  const who = visit ? visit.clientName : chosen ? chosen.name : clientName.trim() || "Walk-in";
  const TABS: [Tab, string][] = [["services", "Services"], ["products", "Products"], ["packages", "Packages"], ["memberships", "Memberships"], ["custom", "Custom amount"]];

  return (
    <>
      <Topbar title="Checkout">
        {simulated
          ? <span className="sim">Payments are simulated. No money moves.</span>
          : <span className="muted" style={{ fontSize: 13 }}>Pay links go through {provider}</span>}
        <span style={{ flex: 1 }} />
        <label className="search">
          <span className="sr">Find a service, product or package</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input type="search" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a service, product or package" />
        </label>
        {topRight}
      </Topbar>

      <div className="content">
        {above}
        {!canPay && <div role="status" className="flash flash-err">Your sign-in can look at the till but cannot take payments. Ask the owner to switch that on for you.</div>}

        <div className="wrap">
          <div className="left">
            <div className="tabs" role="tablist">
              {TABS.map(([id, name]) => (
                <button key={id} type="button" role="tab" aria-selected={!q && tab === id} className={!q && tab === id ? "on" : ""} onClick={() => { setTab(id); setFind(""); }}>{name}</button>
              ))}
            </div>

            {plansNeedClient && (
              <div role="status" className="needs">
                <b>Choose the client first</b>
                <span>{visit ? "This visit is not linked to a client record, so a package or membership cannot be sold on it. Start a quick sale and choose the client there." : "A package or a membership belongs to a client, so it cannot be sold to a walk-in. Find the client in the ticket on the right, then add it."}</span>
              </div>
            )}

            {q || tab !== "custom" ? (
              shown ? (
                <div className="grid">
                  {shownServices.map((s) => (
                    <button key={s.id} type="button" className="item" onClick={() => addService(s)}>
                      <b>{s.name}</b><span>{[s.category, dur(s.duration_min)].filter(Boolean).join(" · ")}</span><span className="p">{cash(s.price_cents)}</span>
                    </button>
                  ))}
                  {shownProducts.map((p, i) => {
                    const left = p.stock - inCart(p.id);
                    return (
                      <button key={p.id} type="button" className="item" onClick={() => addProduct(p)} disabled={left <= 0}>
                        <span className="ph" style={{ background: TONES[i % TONES.length] }} />
                        <b>{p.name}</b><span>Retail · {left <= 0 ? "all in the ticket" : `${left} in stock`}</span><span className="p">{cash(p.price_cents)}</span>
                      </button>
                    );
                  })}
                  {shownPackages.map((p) => (
                    <button key={p.id} type="button" className="item" onClick={() => addPackage(p)} disabled={!clientId || has("package_id", p.id)}>
                      <b>{p.name}</b>
                      <span>Package · {includes(p.items) || "no services set"} · use within {p.valid_days} days</span>
                      <span className="p">{cash(p.price_cents)}{has("package_id", p.id) ? " · in the ticket" : ""}</span>
                    </button>
                  ))}
                  {shownMemberships.map((m) => (
                    <button key={m.id} type="button" className="item" onClick={() => addMembership(m)} disabled={!clientId || has("membership_id", m.id) || alreadyMember(m.id)}>
                      <b>{m.name}</b>
                      <span>Membership · {[rates(m.service_discount_pct, m.retail_discount_pct), m.items.length ? `${includes(m.items)} each month` : ""].filter(Boolean).join(" · ") || "no benefits set"}</span>
                      <span className="p">{cash(m.price_cents)} a month{alreadyMember(m.id) ? " · already a member" : has("membership_id", m.id) ? " · in the ticket" : ""}</span>
                    </button>
                  ))}
                </div>
              ) : q ? (
                <Empty title="Nothing matches">Try another word, or add it as a custom amount.</Empty>
              ) : tab === "services" ? (
                <Empty title="No services on your menu yet">{canManage ? <span>Add them on the <Link href="/business/services">Services</Link> screen. Until then, use a custom amount.</span> : "Ask a manager to add them. Until then, use a custom amount."}</Empty>
              ) : tab === "products" ? (
                <Empty title="No retail products in stock">{canManage ? <span>Add stock on the <Link href="/business/inventory">Inventory</Link> screen.</span> : "Ask a manager to add stock."}</Empty>
              ) : tab === "packages" ? (
                <Empty title="No packages on sale">{canManage ? <span>Set them up on the <Link href="/business/services">Services</Link> screen.</span> : "A manager can set them up."}</Empty>
              ) : (
                <Empty title="No memberships on sale">{canManage ? <span>Set them up on the <Link href="/business/services">Services</Link> screen.</span> : "A manager can set them up."}</Empty>
              )
            ) : (
              <div className="custom">
                <label className="fld" style={{ flex: "2 1 200px" }}><span>What is it for</span><input value={customName} maxLength={120} onChange={(e) => setCustomName(e.target.value)} placeholder="Colour correction" /></label>
                <label className="fld" style={{ flex: "1 1 120px" }}><span>Amount ({currency})</span><input value={customAmount} inputMode="decimal" onChange={(e) => setCustomAmount(e.target.value)} placeholder="0" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} /></label>
                <button type="button" className="btn btn-ink" onClick={addCustom} disabled={!customName.trim()}>Add to ticket</button>
                <div className="muted" style={{ flexBasis: "100%", fontSize: 12.5 }}>A custom amount is charged as typed. It is not taxed as retail, gets no member discount and does not change stock.</div>
              </div>
            )}

            {below}
          </div>

          <form ref={form} className={"cart" + (link ? " linked" : "")} action={pay} aria-label="Ticket" onKeyDown={(e) => { if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") e.preventDefault(); }}>
            <input type="hidden" name="back" value={back} />
            <input type="hidden" name="booking_id" value={visit?.id ?? ""} />
            <input type="hidden" name="client_id" value={visit ? "" : chosen?.id ?? ""} />
            <input type="hidden" name="items" value={items} />
            <input type="hidden" name="tip_cents" value={t.tip} />
            <input type="hidden" name="discount_cents" value={Math.min(typed, t.subtotal)} />
            <input type="hidden" name="method" value={method} />
            <input type="hidden" name="promo_code" value={promo} />
            <input type="hidden" name="redeem_points" value={points && !pointsWhy ? points.redeem : 0} />
            {locations.length > 1 ? null : <input type="hidden" name="location_id" value="" />}

            <div className="hd">
              {visit ? <Avatar name={visit.clientName} tone={visit.tone} size={44} style={{ fontSize: 14 }} /> : <Avatar text={chosen ? undefined : "+"} name={chosen?.name} tone="#9A8E85" size={44} style={{ fontSize: 14 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{who}</b>
                <span>{visit ? `${visit.sub} · with ${firstName(visit.staffName)}` : "Quick sale · no booking"}</span>
              </div>
              {clientId ? <Link href={`/business/clients?client=${clientId}`} className="btn btn-out btn-sm">Profile</Link> : null}
            </div>

            {link && (
              <div className="linkbox" role="status" aria-live="polite">
                <div className="lbl" style={{ padding: 0 }}>Pay by link · {who}</div>
                <div className="amount">{cash(link.amount_cents)}</div>
                {link.status === "pending" ? (
                  <>
                    <div className="state"><i aria-hidden="true" />Waiting for the client to pay. This checks by itself every few seconds.</div>
                    {link.qr ? <img src={link.qr} alt="QR code of the payment link" width={220} height={220} /> : null}
                    <div className="muted" style={{ fontSize: 12.5 }}>{link.qr ? "The client can scan this with their phone camera, or you can send them the link." : "Send the client this link."} It works for about {Math.round(link.expires_in / 60)} minutes. They pay on {provider}&rsquo;s page, so card details never touch this screen.</div>
                    <input className="inp" readOnly value={link.url} aria-label="Payment link" onFocus={(e) => e.currentTarget.select()} />
                    <div className="rowx">
                      <button type="button" className="btn btn-ink btn-sm" onClick={(e) => { const b = e.currentTarget; navigator.clipboard?.writeText(link.url).then(() => { b.textContent = "Copied"; setTimeout(() => { b.textContent = "Copy link"; }, 1400); }); }}>Copy link</button>
                      <a href={link.url} target="_blank" rel="noreferrer" className="btn btn-out btn-sm">Open on this device</a>
                      <button type="button" className="btn btn-out btn-sm" onClick={() => setLink(null)}>Change the ticket</button>
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>Nothing is recorded until they pay. If you change the ticket, make a new link and do not use this one.</div>
                  </>
                ) : link.status === "paid" ? (
                  <div className="state ok">{link.saleId ? "Paid. Opening the receipt…" : "Paid. The sale is being recorded…"}</div>
                ) : (
                  <>
                    <div className="state bad">{link.status === "expired" ? "The link ran out before the client paid. Nothing was charged." : link.status === "failed" ? "The payment did not go through. Nothing was recorded." : `The payment is ${link.status}.`}</div>
                    <div className="rowx"><button type="button" className="btn btn-ink btn-sm" onClick={() => { setLink(null); }}>Back to the ticket</button></div>
                  </>
                )}
                {link.problem ? <div role="alert" style={{ fontSize: 13, color: "#9B2C2C" }}>{link.problem}</div> : null}
              </div>
            )}

            {locations.length > 1 && (
              <div className="who">
                <label className="fld"><span>Selling at</span>
                  <select name="location_id" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                    {visit ? <option value="">Where the visit was booked</option> : null}
                    {locations.map((l) => <option key={l.id} value={l.id}>{l.name}{l.is_primary ? " (main)" : ""}</option>)}
                  </select>
                  <small>Products come off this location&rsquo;s shelf. The stock numbers on the left are for the whole business, so one may be out here.</small>
                </label>
              </div>
            )}

            {!visit && (
              <div className="who">
                {chosen ? (
                  <div className="rowx" style={{ justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13.5 }}>On <b>{chosen.name}</b>&rsquo;s record</span>
                    <button type="button" className="btn btn-out btn-sm" onClick={() => pick(null)}>Change client</button>
                  </div>
                ) : (
                  <>
                    <label className="fld"><span>Find a client</span>
                      <input type="search" value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="Name, phone, or email" autoComplete="off" />
                      <small>Needed for packages, memberships and credits. Leave it empty for a walk-in.</small>
                    </label>
                    {lookupError ? <div role="alert" className="muted" style={{ fontSize: 12.5, color: "#9B2C2C" }}>{lookupError}</div> : null}
                    {found ? (
                      found.length ? (
                        <div className="found" role="listbox" aria-label="Clients found">
                          {found.map((c) => <button key={c.id} type="button" role="option" aria-selected="false" onClick={() => pick({ id: c.id, name: c.name })}><b>{c.name}</b><span>{[c.phone, c.email].filter(Boolean).join(" · ") || "No contact details"}</span></button>)}
                        </div>
                      ) : !lookupError ? <div className="muted" style={{ fontSize: 12.5 }}>Nobody matches. <Link href="/business/clients?new=1">Add a client</Link>, or carry on as a walk-in.</div> : null
                    ) : null}
                    <label className="fld"><span>Walk-in name</span><input name="client_name" value={clientName} maxLength={80} onChange={(e) => setClientName(e.target.value)} placeholder="Walk-in" /></label>
                  </>
                )}
                <label className="fld"><span>Sold by</span>
                  <select name="staff_id" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                    <option value="">Nobody in particular</option>
                    {staff.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
              </div>
            )}

            {clientId && (
              <div className="holds" aria-live="polite">
                <div className="lbl" style={{ padding: 0 }}>Packages and memberships</div>
                {plansLoading ? <span className="muted">Looking up what they hold…</span>
                  : plans?.error ? <span style={{ color: "#9B2C2C" }}>{plans.error}</span>
                  : activeHeld.length ? activeHeld.map((p) => (
                    <div key={p.id} className="hold">
                      <b>{p.name}{p.status === "past_due" ? " · payment owing" : ""}</b>
                      <span>
                        {[
                          p.kind === "membership" ? `Member${rates(p.service_discount_pct ?? 0, p.retail_discount_pct ?? 0) ? ` · ${rates(p.service_discount_pct ?? 0, p.retail_discount_pct ?? 0)}` : ""}` : "Package",
                          ...p.credits.map((c) => `${c.service}: ${c.left} of ${c.total} left${c.left > 0 && !c.usable ? " (cannot be used now)" : ""}`),
                          p.kind === "membership" ? (p.renews_on ? `renews ${dateOnly(p.renews_on, "med")}` : "") : p.expires_at ? `use by ${dateOnly(p.expires_at, "med")}` : "",
                        ].filter(Boolean).join(" · ")}
                      </span>
                      {p.kind === "membership" ? <span>{p.card_on_file ? "Card on file · renews automatically" : "No card on file · collect at the desk"}</span> : null}
                      {p.status === "past_due" ? <span style={{ color: "#9B2C2C" }}>{p.charge_problem ? `The last renewal was declined: ${p.charge_problem}` : "The renewal is owed. Collect it here."}</span> : null}
                    </div>
                  )) : <span className="muted">Nothing yet. Sell one from the Packages or Memberships tab.</span>}
              </div>
            )}

            <div className="lines">
              {priced.length ? priced.map((l) => {
                const plan = l.kind === "package" || l.kind === "membership";
                const canRedeem = l.kind === "service" && !!l.service_id && !l.redeem && creditsLeft(l.service_id) > 0;
                return (
                  <div key={l.key} className="line">
                    <div style={{ minWidth: 0 }}>
                      <b>{l.name}</b>
                      <small>
                        {l.redeem ? `Paid by ${creditPlan(l.service_id!)} · one credit used` : l.sub}{!l.redeem && l.qty > 1 ? ` · ${cash(l.unit)} each` : ""}
                        {l.checking ? " · checking the price…" : ""}
                      </small>
                      {l.why && !l.redeem ? <small>{l.why}</small> : null}
                      {canRedeem ? <button type="button" className="credit" onClick={() => redeem(l.key, true)}>Use credit · {creditsLeft(l.service_id!)} left on {creditPlan(l.service_id!)}</button> : null}
                      {l.redeem ? <button type="button" className="credit" onClick={() => redeem(l.key, false)}>Charge it instead</button> : null}
                    </div>
                    {plan || l.redeem ? <span className="muted" style={{ fontSize: 12.5, flex: "none" }}>1</span> : (
                      <span className="qty">
                        <button type="button" onClick={() => setQty(l.key, -1)} disabled={l.qty <= 1} aria-label={`One less ${l.name}`}>−</button>
                        <span aria-label="Quantity">{l.qty}</span>
                        <button type="button" onClick={() => setQty(l.key, 1)} disabled={l.qty >= (l.stock ?? 99)} aria-label={`One more ${l.name}`}>+</button>
                      </span>
                    )}
                    <span className="amt">{l.redeem ? <><s className="muted" style={{ fontWeight: 400 }}>{cash(l.unit)}</s> {cash(0)}</> : cash(lineTotal(l))}</span>
                    <button type="button" className="x" onClick={() => remove(l.key)} aria-label={`Remove ${l.name}`}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    </button>
                  </div>
                );
              }) : <div className="muted" style={{ padding: "14px 0", fontSize: 13.5 }}>The ticket is empty. Pick a service or a product on the left.</div>}
            </div>

            <div className="lbl">{sellerName ? `Tip for ${firstName(sellerName)}` : "Tip"}</div>
            <div className="tipgrid">
              {[15, 20, 25].map((p) => (
                <button key={p} type="button" className={"tip" + (tipPct === p ? " on" : "")} aria-pressed={tipPct === p} onClick={() => { setTipPct(p); setTipText(""); }}>
                  <b>{p}%</b><span>{cash(Math.round((tipBase * p) / 100))}</span>
                </button>
              ))}
              <button type="button" className={"tip" + (tipPct === null && !toCents(tipText) ? " on" : "")} aria-pressed={tipPct === null && !toCents(tipText)} onClick={() => { setTipPct(null); setTipText(""); }}><b>None</b><span /></button>
            </div>
            <div className="extra">
              <label className="fld"><span>Other tip ({currency})</span><input inputMode="decimal" value={tipText} onChange={(e) => { setTipText(e.target.value); setTipPct(null); }} placeholder="0" /></label>
              {showDiscount && (
                <label className="fld"><span>Discount ({currency}){visit?.promo ? ` · code ${visit.promo}` : ""}</span><input inputMode="decimal" value={discountText} onChange={(e) => setDiscountText(e.target.value)} placeholder="0" />
                  {typed + t.memberDiscount > t.subtotal && t.subtotal > 0 ? <small>Discounts cannot be more than the ticket, so {cash(t.subtotal)} is taken off in all.</small> : null}
                </label>
              )}
              {showPromo && (
                <label className="fld"><span>Promo code</span><input value={promoText} maxLength={20} autoCapitalize="characters" autoComplete="off" onChange={(e) => setPromoText(e.target.value)} placeholder="CODE" />
                  <small style={promo && quoteError ? { color: "#9B2C2C" } : undefined}>
                    {!promo ? "Checked as you type. If it is not valid, you are told here." : quoting ? "Checking the code…" : quoteError ? quoteError : fig ? `Applied: ${cash(promoOff)} off.` : "Checked as you type."}
                  </small>
                </label>
              )}
              {points && (
                <label className="fld"><span>Loyalty · {plansLoading ? "…" : `${balance.toLocaleString("en-US")} points`}</span>
                  <input inputMode="numeric" value={pointsText} onChange={(e) => setPointsText(e.target.value.replace(/[^0-9]/g, ""))} placeholder={balance >= points.minRedeem ? `Points to spend, ${points.minRedeem} or more` : `Needs ${points.minRedeem} points to spend`} disabled={plansLoading || balance < points.minRedeem} />
                  <small style={pointsWhy ? { color: "#9B2C2C" } : undefined}>
                    {pointsWhy || [
                      `Each point is worth ${cash(points.pointValue)}.`,
                      pointsUsed > 0 ? `${pointsUsed.toLocaleString("en-US")} points take ${cash(pointsOff)} off${pointsUsed < points.redeem ? ": that is all this bill can use" : ""}.` : "",
                      `This sale earns ${fig ? "" : "about "}${pointsEarned.toLocaleString("en-US")} ${pointsEarned === 1 ? "point" : "points"}.`,
                    ].filter(Boolean).join(" ")}
                  </small>
                </label>
              )}
              {showNote && <label className="fld"><span>Note on the sale</span><input name="note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Shown on the sale record" /></label>}
            </div>

            <div className="lbl">Pay with</div>
            {live && lines.some((l) => l.kind === "membership") ? (
              <div className="muted" style={{ padding: "0 18px 8px", fontSize: 12.5, lineHeight: 1.45 }}>Use Pay by link to renew this membership automatically each month. Paid any other way, you collect each renewal yourself.</div>
            ) : null}
            <div className="pays">
              {METHODS.map((p) => (
                <button key={p.id} type="button" className={"pm" + (method === p.id ? " on" : "")} aria-pressed={method === p.id} onClick={() => setMethod(p.id)}>
                  <span><b>{p.name}</b><span>{p.id === "link" ? `Client pays on ${provider}. Paid out by LogaLuxe` : live ? "Recorded. Not paid out by LogaLuxe" : p.id === "cash" ? "Recorded. Kept out of payouts" : "Simulated"}</span></span>
                </button>
              ))}
            </div>

            <div className="tots" aria-live="polite">
              <div><span>Subtotal</span><span>{cash(fig ? fig.subtotal_cents : t.subtotal)}</span></div>
              {typedOff > 0 && <div><span className="muted">Discount</span><span className="muted">−{cash(typedOff)}</span></div>}
              {promo && <div><span className="muted">Promo code {promo}</span><span className="muted">{fig ? `−${cash(promoOff)}` : quoteError ? "not applied" : "checking"}</span></div>}
              {member && memberOff > 0 && <div><span className="muted">{member.name} member · {rates(member.service, member.retail)}</span><span className="muted">−{cash(memberOff)}</span></div>}
              {pointsOff > 0 && <div><span className="muted">{pointsUsed.toLocaleString("en-US")} loyalty points</span><span className="muted">−{cash(pointsOff)}</span></div>}
              {taxBp > 0 && <div><span className="muted">Sales tax {taxBp / 100}% · retail only</span><span className="muted">{cash(fig ? fig.tax_cents : t.tax)}</span></div>}
              {(visit?.depositPaid ?? 0) > 0 && <div><span className="muted">Deposit paid</span><span className="muted">−{cash(fig ? fig.deposit_cents : t.deposit)}</span></div>}
              <div><span className="muted">Tip</span><span className="muted">{cash(fig ? fig.tip_cents : t.tip)}</span></div>
              <div className="big"><span>Due now</span><span>{quoting ? <span className="muted" style={{ fontSize: 13.5, fontWeight: 500 }}>checking · about {cash(t.due)}</span> : cash(due)}</span></div>
              {quoteError ? <div role="alert" style={{ fontSize: 12.5, color: "#9B2C2C", whiteSpace: "normal" }}><span>{quoteError}</span></div> : null}
            </div>

            <div className="foot">
              {orphanPlans && <div role="alert" style={{ fontSize: 12.5, color: "#9B2C2C" }}>Choose the client before charging: a package or membership has to belong to someone.</div>}
              {method === "link" ? (
                <>
                  <label className="fld"><span>Client&rsquo;s email (optional)</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Filled in for them on the payment page" autoComplete="off" /></label>
                  {linkError ? <div role="alert" style={{ fontSize: 13, color: "#9B2C2C" }}>{linkError}</div> : null}
                  <button type="button" className="btn btn-ink" style={{ width: "100%", minHeight: 50 }} disabled={blocked || orphanPlans || linkBusy || due <= 0} onClick={sendLink}>
                    {!canPay ? "Your sign-in cannot take payments" : linkBusy ? "Making the link…" : !lines.length ? "Add something to charge" : checking || quoting ? "Checking the total…" : quoteError ? "Cannot make a link yet" : due <= 0 ? "Nothing left to pay by link" : `Make a pay link for ${cash(due)}`}
                  </button>
                </>
              ) : (
                <PayButton label={canPay ? cta : "Your sign-in cannot take payments"} disabled={blocked || orphanPlans} />
              )}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="btn btn-out btn-sm" style={{ flex: 1 }} aria-expanded={showDiscount} onClick={() => { if (showDiscount) setDiscountText(""); setShowDiscount(!showDiscount); }}>{showDiscount ? "Remove discount" : "Discount"}</button>
                <button type="button" className="btn btn-out btn-sm" style={{ flex: 1 }} aria-expanded={showPromo} onClick={() => { if (showPromo) setPromoText(""); setShowPromo(!showPromo); }}>{showPromo ? "Remove code" : "Promo code"}</button>
                <button type="button" className="btn btn-out btn-sm" style={{ flex: 1 }} aria-expanded={showNote} onClick={() => { if (showNote) setNote(""); setShowNote(!showNote); }}>{showNote ? "Remove note" : "Add a note"}</button>
              </div>
              <div className="muted" style={{ fontSize: 11.5, textAlign: "center" }}>
                {simulated
                  ? "Payments are simulated on this install. The sale is recorded, but no card is charged and no money moves."
                  : method === "link" ? `The client pays on ${provider}'s page. The sale is recorded when they have paid, and the money goes to your payout balance.`
                  : "You take this money yourself. It is recorded here, with no LogaLuxe fee, and is not part of your payouts."}
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
