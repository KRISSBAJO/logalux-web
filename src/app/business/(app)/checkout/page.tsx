import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { Sheet, SubmitButton } from "@/components/merchant-client";
import { Avatar, Empty, Flash, Fld, LoadError, Pill, type PillTone } from "@/components/merchant-ui";
import { getMe, mCan, mLoad, qs, type Row } from "@/lib/merchant-api";
import { clock, dateOnly, dur, METHOD_LABEL, money, plural, ymd } from "@/lib/merchant-format";
import { refundSale } from "./actions";
import type { Line } from "./math";
import { Till, type TillVisit } from "./till";
import "../../css/checkout.css";

export const metadata = { title: "Checkout" };

type SP = {
  booking?: string; sale?: string; client?: string; day?: string;
  receipt?: string; sub?: string; disc?: string; tax?: string; tip?: string; dep?: string; total?: string; member?: string; promo?: string; pts?: string; ptsd?: string; earned?: string; lead?: string;
  ok?: string; err?: string;
};

const STATE: Record<string, { text: string; tone: PillTone }> = {
  completed: { text: "Finished", tone: "ok" }, in_progress: { text: "In chair", tone: "gold" }, checked_in: { text: "Arrived", tone: "grey" }, confirmed: { text: "Booked", tone: "grey" },
};
const SALE: Record<string, { text: string; tone: PillTone }> = {
  paid: { text: "Paid", tone: "ok" }, part_refunded: { text: "Part refunded", tone: "gold" }, refunded: { text: "Refunded", tone: "wine" },
};

export default async function Checkout({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const me = (await getMe())!;
  const { merchant: m } = me;
  const tz = m.timezone, cur = m.currency;
  const manager = mCan(me, "manager");
  const cash = (n: number) => money(n, cur);

  const dayParam = /^\d{4}-\d{2}-\d{2}$/.test(sp.day ?? "") ? sp.day! : "";
  const quick = sp.sale === "new";
  // The queue and the day's figures, plus the visit or the client the address names: none depends on another.
  // A visit is only put on the ticket if it is in the queue, which is checked once the queue is here.
  const [{ data: d, error }, dayRes, namedVisit, namedClient] = await Promise.all([
    mLoad("/checkout"), mLoad("/checkout/day" + qs({ date: dayParam })),
    !quick && sp.booking ? mLoad(`/bookings/${encodeURIComponent(sp.booking)}`) : null,
    sp.client ? mLoad(`/clients/${encodeURIComponent(sp.client)}`) : null,
  ]);
  if (error) return <div className="main pg-checkout"><LoadError title="Checkout" error={error} /></div>;

  const queue = (d.queue ?? []) as Row[], sales = (d.sales ?? []) as Row[];
  // With real payments on, only a pay link goes through LogaLuxe. Everything else is money the business took itself.
  const live = d.payments_mode === "live", simulated = !live;
  const provider = m.market === "NG" ? "Paystack" : "Stripe";
  const LIVE_LABEL: Record<string, string> = { link: "Pay link", card: "Card machine", tap: "Card machine", cash: "Cash", transfer: "Bank transfer", wallet: "Mobile wallet" };
  const paidBy = (method: string) => (live ? LIVE_LABEL[method] : method === "link" ? "Pay link" : METHOD_LABEL[method]) ?? method;
  const own = (method: string) => method === "cash" || (live && method !== "link");
  const owner = mCan(me, "owner");
  const today = ymd(new Date(), tz);

  // What is on the ticket: the visit named in the address, a quick sale, or the first visit waiting.
  const asked = !quick && sp.booking ? queue.find((b) => b.id === sp.booking) : undefined;
  const missing = !quick && !!sp.booking && !asked;
  const picked = quick ? undefined : asked ?? (sp.receipt || missing ? undefined : queue[0]);

  let visit: TillVisit | null = null, visitError = "";
  if (picked) {
    const one = namedVisit && picked.id === sp.booking ? namedVisit : await mLoad(`/bookings/${encodeURIComponent(picked.id)}`);
    if (one.error) visitError = one.error;
    else {
      const lines: Line[] = ((one.data.items ?? []) as Row[]).map((it, i) => ({
        key: `b-${i}`, kind: "service", service_id: it.service_id ?? undefined, name: it.name, sub: `Booked · ${dur(it.duration_min)}`, unit: it.price_cents, qty: 1, fixed: true,
      }));
      visit = {
        id: picked.id, clientId: picked.client_id ?? null, clientName: picked.client_name, staffId: picked.staff_id, staffName: picked.staff, tone: picked.staff_tone ?? "#7A1F2B",
        sub: `${picked.services ?? "Visit"} · ${ymd(picked.starts_at, tz) === today ? "" : dateOnly(ymd(picked.starts_at, tz) + "T00:00:00Z") + " "}${clock(picked.starts_at, tz)}`,
        depositPaid: picked.deposit_paid ? picked.deposit_cents : 0, discount: picked.discount_cents ?? 0, promo: picked.promo_code ?? "", lines,
      };
    }
  }
  let client: { id: string; name: string } | null = null;
  if (!visit && namedClient && !namedClient.error && namedClient.data.client) client = { id: namedClient.data.client.id, name: namedClient.data.client.name };

  const here = "/business/checkout" + qs(visit ? { booking: visit.id } : quick ? { sale: "new", client: client?.id } : {});
  const receipt = sp.receipt ? sales.find((s) => s.id === sp.receipt) : undefined;
  // The breakdown comes from the API's answer to the payment. Use it only when it adds up to the sale on record.
  const n = (v?: string) => Math.max(0, Math.round(Number(v) || 0));
  const parts = receipt && n(sp.total) === receipt.total_cents && n(sp.sub) - n(sp.disc) + n(sp.tax) + n(sp.tip) - n(sp.dep) === receipt.total_cents
    ? { sub: n(sp.sub), disc: n(sp.disc), tax: n(sp.tax), tip: n(sp.tip), dep: n(sp.dep), member: n(sp.member), promo: n(sp.promo), ptsd: n(sp.ptsd), pts: n(sp.pts), earned: n(sp.earned), lead: n(sp.lead) } : null;
  // Whatever is left of the discount after the named parts is the one typed at the desk.
  const typedOff = parts ? Math.max(0, parts.disc - Math.min(parts.disc, parts.member + parts.promo + parts.ptsd)) : 0;

  const day = dayRes.data, dt = (day.totals ?? {}) as Row;
  const byMethod = (day.by_method ?? []) as Row[], byStaff = (day.by_staff ?? []) as Row[];
  const dayLabel = day.date === today ? "Today" : day.date ? dateOnly(day.date + "T00:00:00Z", "med") : "";

  // These cross into a client component, so each is one element, not a fragment.
  const topRight = (
    <div key="top" style={{ display: "contents" }}>
      <Link href="/business/checkout?sale=new" className="btn btn-out">Quick sale</Link>
      <Sheet trigger="End of day" title="End of day" sub={dayLabel ? `${dayLabel} · every sale taken at checkout` : undefined} open={!!dayParam} closeHref={here}>
        {dayRes.error ? <div role="alert" className="flash flash-err">{dayRes.error}</div> : (
          <div style={{ display: "contents" }}>
            <form action="/business/checkout" className="rowx" style={{ flexDirection: "row", alignItems: "flex-end" }}>
              <Fld label="Day" style={{ flex: 1 }}><input type="date" name="day" defaultValue={day.date} max={today} required /></Fld>
              <button className="btn btn-out">Show</button>
            </form>
            <dl className="kv">
              <dt>Sales</dt><dd>{dt.sales ?? 0}</dd>
              <dt>Taken, tips and tax included</dt><dd>{cash(dt.taken_cents)}</dd>
              <dt>Tips</dt><dd>{cash(dt.tips_cents)}</dd>
              <dt>Sales tax</dt><dd>{cash(dt.tax_cents)}</dd>
              <dt>Discounts given</dt><dd>{cash(dt.discounts_cents)}</dd>
              <dt>Refunded</dt><dd>{cash(dt.refunded_cents)}</dd>
              <dt>Left after refunds</dt><dd>{cash((dt.taken_cents ?? 0) - (dt.refunded_cents ?? 0))}</dd>
            </dl>
            {byMethod.length ? (
              <DataTable id="day-method" search="Search ways of paying" pageSize={10} noun="way of paying" sort={{ col: "After refunds", dir: "desc" }}>
                <table className="tbl">
                  <thead><tr><th>Paid by</th><th className="num">Sales</th><th className="num">After refunds</th></tr></thead>
                  <tbody>{byMethod.map((r) => <tr key={r.method}><td>{paidBy(r.method)}</td><td className="num" data-sort={r.n}>{r.n}</td><td className="num" data-sort={r.cents}>{cash(r.cents)}</td></tr>)}</tbody>
                </table>
              </DataTable>
            ) : <Empty title="No sales on this day">Sales taken at checkout are counted here.</Empty>}
            {byStaff.length ? (
              <DataTable id="day-staff" search="Search the team" pageSize={10} noun="person" sort={{ col: "Revenue", dir: "desc" }}>
                <table className="tbl">
                  <thead><tr><th>Sold by</th><th className="num">Sales</th><th className="num">Revenue</th><th className="num">Tips</th></tr></thead>
                  <tbody>{byStaff.map((r) => <tr key={r.staff}><td>{r.staff}</td><td className="num" data-sort={r.sales}>{r.sales}</td><td className="num" data-sort={r.revenue_cents}>{cash(r.revenue_cents)}</td><td className="num" data-sort={r.tips_cents}>{cash(r.tips_cents)}</td></tr>)}</tbody>
                </table>
              </DataTable>
            ) : null}
            <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
              {(day.unpaid?.n ?? 0) > 0 ? `${plural(day.unpaid.n, "visit")} from this day ${day.unpaid.n === 1 ? "has" : "have"} not been paid for yet. ` : "Every visit that arrived on this day has been paid for. "}
              Revenue is before tips and tax, after discounts.
              {simulated ? " Payments are simulated on this install, so count only the cash in the drawer as real money." : " Only Pay link sales are paid out by LogaLuxe. The rest is money you took yourself: count the drawer against the Cash line and your card machine against its own report."}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );

  const above = (
    <div key="above" style={{ display: "contents" }}>
      <Flash sp={sp} />
      {missing && <div role="status" className="flash flash-err">That visit is not waiting to be paid. It may already be paid or cancelled. Pick one below, or start a quick sale.</div>}
      {visitError && <div role="alert" className="flash flash-err">{visitError}</div>}

      {receipt && (
        <div className="receipt" role="status">
          <div style={{ flex: "2 1 260px", minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <div><Pill tone="ok">{receipt.method === "link" ? "Paid online" : receipt.method === "cash" ? "Cash recorded" : live ? "Recorded" : "Sale recorded"}</Pill></div>
            <h2 className="serif">{receipt.client_name} · {cash(receipt.total_cents)}</h2>
            <div className="muted" style={{ fontSize: 13.5, lineHeight: 1.5 }}>
              {receipt.items ?? "Sale"} · {paidBy(receipt.method)}{receipt.staff ? ` · with ${receipt.staff}` : ""} · {clock(receipt.created_at, tz)}
              <br />
              {receipt.method === "link" ? `The client paid on ${provider}'s page. The money is on its way to your payout balance.`
                : receipt.method === "cash" ? "Cash is recorded here and kept out of your payout balance."
                : live ? "You took this money yourself. It is recorded here, with no LogaLuxe fee, and is not part of your payouts."
                : "The payment was simulated. No card was charged and no money moved."}
              {parts && (parts.earned > 0 || parts.pts > 0) ? <span><br />{[parts.pts > 0 ? `${parts.pts.toLocaleString("en-US")} loyalty points spent` : "", parts.earned > 0 ? `${parts.earned.toLocaleString("en-US")} ${parts.earned === 1 ? "point" : "points"} earned` : ""].filter(Boolean).join(" · ")}.</span> : null}
              {parts && parts.lead > 0 && owner ? <span><br />New-client fee to LogaLuxe: {cash(parts.lead)}. This client found you through LogaLuxe. <Link href="/business/marketing?tab=leads">See new clients</Link></span> : null}
            </div>
            <div className="rowx">
              <Link href="/business/checkout" className="btn btn-ink btn-sm">Next in line</Link>
              <Link href="/business/checkout?sale=new" className="btn btn-out btn-sm">Quick sale</Link>
              <Link href="/business/calendar" className="btn btn-out btn-sm">Back to the calendar</Link>
            </div>
          </div>
          <dl className="kv">
            {(parts
              ? [["Subtotal", cash(parts.sub)], typedOff > 0 ? ["Discount", "−" + cash(typedOff)] : null, parts.promo > 0 ? ["Promo code", "−" + cash(parts.promo)] : null, parts.member > 0 ? ["Member discount", "−" + cash(parts.member)] : null, parts.ptsd > 0 ? [`${parts.pts.toLocaleString("en-US")} loyalty points`, "−" + cash(parts.ptsd)] : null, parts.tax > 0 ? ["Sales tax", cash(parts.tax)] : null, parts.dep > 0 ? ["Deposit paid before", "−" + cash(parts.dep)] : null, ["Tip", cash(parts.tip)]]
              : [["Tip", cash(receipt.tip_cents)]]
            ).filter((x): x is string[] => !!x).map(([k, v]) => <div key={k} style={{ display: "contents" }}><dt>{k}</dt><dd>{v}</dd></div>)}
            <div style={{ display: "contents" }}><dt className="tot">{receipt.method === "cash" ? "Cash taken" : receipt.method === "link" ? "Paid online" : live ? "Taken" : "Charged"}</dt><dd className="tot">{cash(receipt.total_cents)}</dd></div>
          </dl>
        </div>
      )}

      <div className="lbl" style={{ padding: "0 0 6px" }}>Ready to check out</div>
      <div className="queue">
        {queue.map((b) => {
          const st = STATE[b.status] ?? { text: b.status, tone: "grey" as PillTone };
          return (
            <Link key={b.id} href={`/business/checkout?booking=${b.id}`} className={"q" + (visit?.id === b.id ? " on" : "")} aria-current={visit?.id === b.id ? "true" : undefined}>
              <Avatar name={b.client_name} tone={b.staff_tone} />
              <span style={{ flex: 1 }}><b>{b.client_name}</b><span>{b.services ?? "Visit"} · {clock(b.starts_at, tz)}</span></span>
              <Pill tone={st.tone}>{st.text}</Pill>
            </Link>
          );
        })}
        <Link href="/business/checkout?sale=new" className={"q" + (!visit ? " on" : "")} aria-current={!visit ? "true" : undefined}>
          <Avatar text="+" tone="#9A8E85" />
          <span style={{ flex: 1 }}><b>Walk-in</b><span>No booking</span></span>
          <Pill>New sale</Pill>
        </Link>
      </div>
      {!queue.length && <div className="muted" style={{ fontSize: 13 }}>Nobody is waiting to pay. Visits show here once they are booked for today or checked in.</div>}
    </div>
  );

  const below = (
    <div key="below" className="box" id="sales">
      <div className="hdr">
        <h3>Sales today</h3>
        <span className="muted" style={{ fontSize: 12.5 }}>{sales.length ? `${plural(sales.length, "sale")} · ${cash(sales.reduce((a, s) => a + s.total_cents - s.refunded_cents, 0))} after refunds` : ""}</span>
      </div>
      {sales.length ? (
        <DataTable id="sales" search="Search sales" filters={["Paid by", "Status"]} pageSize={10} noun="sale" sort={{ col: "Time", dir: "desc" }}>
          <table className="tbl">
            <thead><tr><th>Time</th><th>Client</th><th>For</th><th>Paid by</th><th className="num">Tip</th><th className="num">Total</th><th>Status</th>{manager && <th data-nosort><span className="sr">Refund</span></th>}</tr></thead>
            <tbody>
              {sales.map((s) => {
                const left = s.total_cents - s.refunded_cents, st = SALE[s.status] ?? { text: s.status, tone: "grey" as PillTone };
                return (
                  <tr key={s.id} style={s.id === receipt?.id ? { background: "#F1E8DD" } : undefined}>
                    <td style={{ whiteSpace: "nowrap" }} data-sort={s.created_at}>{clock(s.created_at, tz)}</td>
                    <td><b style={{ fontWeight: 600 }}>{s.client_name}</b>{s.staff ? <div className="muted" style={{ fontSize: 12 }}>with {s.staff}</div> : null}</td>
                    <td>{s.items ?? <span className="muted">None</span>}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{paidBy(s.method)}</td>
                    <td className="num" data-sort={s.tip_cents}>{s.tip_cents ? cash(s.tip_cents) : <span className="muted">None</span>}</td>
                    <td className="num" data-sort={s.total_cents}><b>{cash(s.total_cents)}</b>{s.refunded_cents > 0 ? <div className="muted" style={{ fontSize: 12 }}>−{cash(s.refunded_cents)} refunded</div> : null}</td>
                    <td data-filter={st.text}><Pill tone={st.tone}>{st.text}</Pill></td>
                    {manager && (
                      <td style={{ textAlign: "right" }}>
                        {left > 0 ? (
                          <Sheet trigger="Refund" triggerClass="btn btn-out btn-sm" title="Refund a sale" sub={`${s.client_name} · ${cash(s.total_cents)} by ${(paidBy(s.method)).toLowerCase()}${s.refunded_cents > 0 ? ` · ${cash(s.refunded_cents)} already refunded` : ""}`}>
                            <form action={refundSale}>
                              <input type="hidden" name="back" value={here} />
                              <input type="hidden" name="id" value={s.id} />
                              <input type="hidden" name="simulated" value={simulated && s.method !== "cash" ? "1" : "0"} />
                              <Fld label={`Amount (${cur})`} hint={`Up to ${cash(left)}. Leave it as it is to refund everything that is left.`}>
                                <input name="amount" inputMode="decimal" defaultValue={(left / 100).toString()} required />
                              </Fld>
                              <Fld label="Reason"><input name="reason" required maxLength={200} placeholder="Why the money is going back" /></Fld>
                              <label className="chk"><input type="checkbox" name="restock" />Put the products from this sale back in stock</label>
                              <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                                {s.method === "link" ? `This sale was paid online, so the refund is sent back to the client's card through ${provider}.`
                                  : s.method === "cash" ? "Hand the cash back yourself. This records it."
                                  : live ? "You took this money yourself, so give it back yourself (on your card machine or by transfer). This records it."
                                  : "Payments are simulated on this install. The refund is recorded, but no money moves."}
                              </div>
                              <div className="sheet-ft"><SubmitButton className="btn btn-danger">Refund</SubmitButton></div>
                            </form>
                          </Sheet>
                        ) : null}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataTable>
      ) : <Empty title="No sales yet today">{`Each payment you take shows here${manager ? ", with a way to refund it" : ""}.`}</Empty>}
    </div>
  );

  return (
    <div className="main pg-checkout">
      <Till
        key={(visit ? `b:${visit.id}` : `s:${client?.id ?? "walk-in"}`) + `:${sp.receipt ?? ""}`}
        currency={cur} taxBp={Number(d.tax_bp ?? 0)} simulated={simulated} live={live} market={m.market}
        loyalty={(d.loyalty ?? null) as never} locations={((d.locations ?? []) as Row[]).map((l) => ({ id: l.id, name: l.name, is_primary: !!l.is_primary }))}
        services={(d.services ?? []) as never[]} products={(d.products ?? []) as never[]} packages={(d.packages ?? []) as never[]} memberships={(d.memberships ?? []) as never[]} staff={((d.staff ?? []) as Row[]).map((p) => ({ id: p.id, name: p.name }))}
        visit={visit} client={client} myStaffId={m.staff_id ?? ""} back={here} canManage={manager} canPay={d.can_take_payments !== false}
        topRight={topRight} above={above} below={below}
      />
    </div>
  );
}
