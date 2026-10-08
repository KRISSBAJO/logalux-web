import Link from "next/link";
import type { ReactNode } from "react";
import { DataTable } from "@/components/data-table";
import { ConfirmButton, CopyButton, Sheet } from "@/components/merchant-client";
import { Empty, Flash, Ic, LoadError, NoAccess, Topbar } from "@/components/merchant-ui";
import { getMe, mLoad, qs, type Row } from "@/lib/merchant-api";
import { METHOD_LABEL as BASE_METHOD, addDays, clock, dateOnly, dayShort, firstName, money, pct, plural, ymd } from "@/lib/merchant-format";
import { payOut, setSchedule } from "./actions";
import "../../css/money.css";

export const metadata = { title: "Money" };

type SP = { tab?: string; from?: string; to?: string; kind?: string; staff?: string; ok?: string; err?: string };

const TABS = [["overview", "Overview"], ["tx", "Transactions"], ["payouts", "Payouts"], ["deposits", "Deposits & holds"], ["online", "Online payments"], ["statements", "Statements"]] as const;
const KIND_LABEL: Record<string, string> = { charge: "Sale", deposit: "Deposit", tip: "Tip", fee: "LogaLuxe fee", lead_fee: "Lead fee", plan_fee: "Plan fee", refund: "Refund", payout: "Payout", payout_fee: "Instant payout fee", adjustment: "Adjustment" };
const METHOD_LABEL: Record<string, string> = { ...BASE_METHOD, link: "Pay link", logaluxe: "LogaLuxe" };
const PURPOSE: Record<string, string> = { deposit: "Deposit", sale: "Pay link", order: "Shop order" };
const PAY_STATE: Record<string, [string, string]> = { pending: ["Waiting for payment", "pill-gold"], paid: ["Paid", "pill-ok"], failed: ["Failed", "pill-wine"], expired: ["Expired", "pill-grey"], refunded: ["Refunded", "pill-wine"] };
const monthName = (ym: string) => new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(ym + "-15T12:00:00Z"));
const SCHEDULE_LABEL: Record<string, string> = { daily: "daily", weekly: "weekly", manual: "on request" };
const SCHEDULES = [["daily", "Daily", "Sent every day"], ["weekly", "Weekly", "Sent every Monday"], ["manual", "When I ask", "Nothing is sent until you pay out by hand"]] as const;
const PROVIDER: Record<string, string> = { stripe: "Stripe", paystack: "Paystack", flutterwave: "Flutterwave" };
const isDay = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const share = (some: number, whole: number) => (whole > 0 ? Math.round((some / whole) * 1000) / 10 : 0);
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1).replace(/_/g, " ") : s);

/** How a ledger line stands: in the bank balance, on its way, held, or only recorded. */
function lineState(t: Row, tz: string): { label: string; tone: string } {
  if (t.status === "held") return { label: "Held until visit", tone: "pill-gold" };
  // Cash, a transfer or the business's own card machine: written down, never held by LogaLuxe.
  if (!t.in_balance) return { label: t.kind === "refund" ? "Refunded outside LogaLuxe" : "Taken outside LogaLuxe", tone: "pill-grey" };
  if (t.kind === "refund") return { label: "Refunded", tone: "pill-wine" };
  if (t.status === "settled") return { label: "Settled", tone: "pill-ok" };
  if (t.status === "pending") return { label: t.settles_at ? `Settles ${dayShort(t.settles_at, tz)}` : "Settling", tone: "pill-grey" };
  return { label: cap(String(t.status ?? "")), tone: "pill-grey" };
}

function payoutState(p: Row): { word: string; tone: string; icon: "check" | "clock"; bg: string; fg?: string } {
  if (p.status === "paid") return { word: String(p.reference ?? "").startsWith("sim_") ? "recorded as paid, simulated" : "paid", tone: "pill-ok", icon: "check", bg: "#1F6B3A" };
  if (p.status === "failed") return { word: "failed, money returned to your balance", tone: "pill-wine", icon: "clock", bg: "#9B2335" };
  if (p.status === "sending") return { word: "being sent to your bank", tone: "pill-gold", icon: "clock", bg: "#D4AF5A", fg: "#1A1513" };
  if (p.status === "scheduled") return { word: "scheduled, not sent yet", tone: "pill-grey", icon: "clock", bg: "#EFE5DA", fg: "#1A1513" };
  return { word: cap(String(p.status ?? "")).toLowerCase(), tone: "pill-grey", icon: "clock", bg: "#EFE5DA", fg: "#1A1513" };
}
const payoutKind = (k: string) => (k === "instant" ? "Instant" : k === "manual" ? "On request" : "Automatic");
const bankOf = (p: Row) => (p.bank_name ? `${p.bank_name}${p.account_last4 ? ` ···· ${p.account_last4}` : ""}` : PROVIDER[p.provider] ?? cap(String(p.provider ?? "")));
// The day a payout was due is a plain date; one made by hand only has the moment it was paid.
const payoutDay = (p: Row, tz: string) => (p.scheduled_for ? dateOnly(p.scheduled_for) : p.paid_at ? dayShort(p.paid_at, tz) : "No date");

export default async function Money({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const me = (await getMe())!;
  const { merchant: m } = me;
  const tz = m.timezone, cur = m.currency;
  const tab = TABS.some(([id]) => id === sp.tab) ? sp.tab! : "overview";
  const today = ymd(new Date(), tz);

  // What the ledger is asked for. The deposits tab looks back as far as the API allows.
  const from = isDay(sp.from), to = isDay(sp.to);
  const filter = tab === "deposits" ? { from: addDays(today, -98), to: today, kind: "deposit" }
    : tab === "payouts" || tab === "online" || tab === "statements" ? {}
    : { from, to: from ? to : undefined, kind: sp.kind, staff: sp.staff };

  const [{ data: d, error, status }, settings, stm, online] = await Promise.all([
    mLoad("/money" + qs(filter)), mLoad("/settings"), mLoad("/statements"),
    tab === "online" ? mLoad("/payments") : Promise.resolve(null),
  ]);
  if (status === 403) return <div className="main pg-money"><NoAccess title="Money" need="owner" /></div>;
  if (error) return <div className="main pg-money"><LoadError title="Money" error={error} /></div>;

  const bal = d.balances as Row, mo = d.month as Row, account = d.account as Row | null;
  const tx = (d.transactions ?? []) as Row[], payouts = (d.payouts ?? []) as Row[], methods = (d.methods ?? []) as Row[], staff = (d.staff ?? []) as Row[];
  // Live: clients really pay through Stripe or Paystack and payouts are really sent. Otherwise everything is simulated.
  const live = d.payments_mode === "live", simulated = !live;
  const prov = PROVIDER[d.provider ?? account?.provider] ?? (m.market === "NG" ? "Paystack" : "Stripe");
  // An account recorded in simulation cannot receive a real payout: the API refuses.
  const blocked = live && !!account && account.mode !== "live";
  const statements = (stm.data.statements ?? []) as Row[];
  const leadFees = Math.abs(Number(statements.find((x) => x.month === today.slice(0, 7))?.lead_fees_cents ?? 0));
  const planFees = Math.abs(Number(statements.find((x) => x.month === today.slice(0, 7))?.plan_fees_cents ?? 0));
  const payments = ((online?.data.payments ?? []) as Row[]);
  const month = String(d.month_label ?? "This month"), mon = month.slice(0, 3);

  const here = (over: Partial<SP> = {}) => "/business/money" + qs({ tab: tab === "overview" ? undefined : tab, from, to: from ? to : undefined, kind: sp.kind, staff: sp.staff, ...over });
  const back = here();

  // The fee for an instant payout comes from the fee table of the plan. Only the rate is published, not the minimum.
  const plan = ((settings.data.plans ?? []) as Row[]).find((p) => p.plan === m.plan);
  const feePct: number | null = plan && typeof plan.instant_payout_pct === "number" ? plan.instant_payout_pct : null;
  const feeGuess = feePct ? Math.round((bal.available_cents * feePct) / 100) : 0;
  const canPay = !!account && account.status === "verified" && bal.available_cents >= 100 && !blocked;
  const whyNot = blocked ? "This payout account was recorded before real payments were switched on, so it cannot receive a payout. Connect your real account first."
    : !account ? "Add a payout account first, so there is somewhere to send the money."
    : account.status !== "verified" ? "Your payout account is not verified yet."
    : "There is nothing to pay out yet. Money becomes available two days after a client pays.";

  const whole = Math.trunc(bal.available_cents / 100) * 100;
  const centsPart = String(Math.abs(bal.available_cents) % 100).padStart(2, "0");

  // Where the money of the month went. What is left after these is the share of the business.
  const sp2 = d.split as Row;
  const left = mo.processed_cents - sp2.commission_cents - mo.tips_cents - mo.fees_cents - leadFees - planFees - sp2.retail_cost_cents - mo.refunds_cents;
  const splitRows: { name: string; cents: number; gold?: boolean }[] = [
    { name: "Staff commission", cents: sp2.commission_cents },
    { name: "Tips to staff", cents: mo.tips_cents },
    { name: "LogaLuxe fees", cents: mo.fees_cents },
    { name: "Lead fees", cents: leadFees },
    ...(planFees > 0 ? [{ name: "Plan fee", cents: planFees }] : []),
    { name: "Retail cost", cents: sp2.retail_cost_cents },
    ...(mo.refunds_cents > 0 ? [{ name: "Refunds", cents: mo.refunds_cents }] : []),
    { name: "To the business", cents: left, gold: true },
  ];
  const methodTotal = methods.reduce((a, x) => a + Number(x.cents), 0);

  const oneDay = d.from === d.to;
  const rangeLabel = oneDay ? (d.from === today ? "today" : dateOnly(d.from)) : `${dateOnly(d.from)} to ${dateOnly(d.to)}`;
  const quick: [string, string | undefined, string | undefined][] = [
    ["Today", undefined, undefined], ["7 days", addDays(today, -6), today], ["30 days", addDays(today, -29), today], [month, today.slice(0, 8) + "01", today],
  ];

  const txTable = (rows: Row[], size: number) => (
    <DataTable id="ledger" search="Search the ledger" filters={["Staff", "Method", "Type", "Status"]} pageSize={size} noun="line" sort={{ col: "Time", dir: "desc" }}>
      <table>
        <thead><tr><th>Time</th><th>Client · item</th><th>Staff</th><th>Method</th><th className="r">Amount</th><th>Type</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map((t) => {
            const [head, ...rest] = String(t.description ?? "").split(" · ");
            const st = lineState(t, tz);
            return (
              <tr key={t.id}>
                <td data-sort={t.created_at}>{oneDay ? clock(t.created_at, tz) : `${dayShort(t.created_at, tz)} · ${clock(t.created_at, tz)}`}</td>
                <td><b>{head || KIND_LABEL[t.kind] || "Ledger line"}</b>{rest.length ? <small>{rest.join(" · ")}</small> : null}{t.kind === "lead_fee" ? <small><Link href="/business/marketing?tab=leads">See this lead</Link></small> : null}{t.kind === "plan_fee" ? <small><Link href="/business/settings?tab=plan">See your plan</Link></small> : null}</td>
                <td data-filter={t.staff ? firstName(t.staff) : "No staff"}>{t.staff ? firstName(t.staff) : <span className="muted">—</span>}</td>
                <td>{METHOD_LABEL[t.method] ?? (t.method ? cap(String(t.method)) : "—")}</td>
                <td data-sort={t.amount_cents} className={"r " + (t.amount_cents < 0 ? "neg" : "pos")}>{money(t.amount_cents, cur, { sign: true, exact: true })}</td>
                <td className="muted" data-filter={KIND_LABEL[t.kind] ?? cap(String(t.kind))}>{t.kind === "plan_fee" ? <Link href="/business/settings?tab=plan">Plan fee</Link> : KIND_LABEL[t.kind] ?? cap(String(t.kind))}</td>
                <td data-filter={st.label.startsWith("Settles ") ? "Settling" : st.label}><span className={"pill " + st.tone}>{st.label}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </DataTable>
  );

  const filters = (
    <form action="/business/money" className="filters">
      {tab !== "overview" ? <input type="hidden" name="tab" value={tab} /> : null}
      {tab === "tx" ? (
        <>
          <input type="date" name="from" defaultValue={d.from} max={today} aria-label="From" />
          <input type="date" name="to" defaultValue={d.to} max={today} aria-label="To" />
        </>
      ) : (
        <>
          {from ? <input type="hidden" name="from" value={from} /> : null}
          {from && to ? <input type="hidden" name="to" value={to} /> : null}
        </>
      )}
      <select name="kind" defaultValue={sp.kind ?? ""} aria-label="Type">
        <option value="">All types</option>
        {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <select name="staff" defaultValue={sp.staff ?? ""} aria-label="Staff">
        <option value="">All staff</option>
        {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <button className="btn btn-out btn-sm">Show</button>
    </form>
  );

  const quickLinks = (
    <div className="quick">
      {quick.map(([name, f, t]) => (
        <Link key={name} href={here({ from: f, to: t })} className={(f ?? today) === d.from && (t ?? today) === d.to ? "on" : ""}>{name}</Link>
      ))}
    </div>
  );

  const payoutRow = (p: Row) => {
    const st = payoutState(p);
    return (
      <div key={p.id} className="payout">
        <span className="avatar" style={{ background: st.bg, color: st.fg ?? "#F4ECE3" }}><Ic name={st.icon} size={16} stroke={2.4} /></span>
        <div><b>{payoutDay(p, tz)}{p.kind === "instant" ? " · instant" : p.kind === "manual" ? " · on request" : ""}</b><span>{bankOf(p)} · {st.word}{p.fee_cents > 0 ? ` · ${money(p.fee_cents, cur, { exact: true })} fee` : ""}{p.status === "failed" && p.failure_reason ? ` · ${p.failure_reason}` : ""}</span></div>
        <span className="amt">{money(p.amount_cents, cur, { exact: true })}</span>
      </div>
    );
  };

  let body: ReactNode;
  if (tab === "tx") {
    body = (
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}><h3>Transactions · {rangeLabel}</h3>{filters}</div>
        {quickLinks}
        {tx.length ? txTable(tx, 25) : <Empty title="No ledger lines for this choice">Try a longer range or clear the filters.</Empty>}
        <div className="sub">
          {tx.length >= 300 ? "Showing the newest 300 lines. Narrow the dates, or export the CSV for everything. " : tx.length ? `${plural(tx.length, "line")}. ` : ""}
          Every sale, tip, refund, fee and payout is a line in the ledger. A range can cover up to 100 days.
        </div>
      </div>
    );
  } else if (tab === "payouts") {
    body = (
      <div className="card">
        <h3>Payouts</h3>
        {payouts.length ? (
          <DataTable id="payouts" search="Search payouts" filters={["Kind", "Sent to", "Status"]} pageSize={10} noun="payout" sort={{ col: "Date", dir: "desc" }}>
            <table className="fit">
              <thead><tr><th>Date</th><th>Kind</th><th>Sent to</th><th>Reference</th><th className="r">Fee</th><th className="r">Amount</th><th>Status</th></tr></thead>
              <tbody>
                {payouts.map((p) => {
                  const st = payoutState(p);
                  return (
                    <tr key={p.id}>
                      <td data-sort={String(p.scheduled_for ?? p.paid_at ?? "")}><b>{payoutDay(p, tz)}</b></td>
                      <td>{payoutKind(p.kind)}</td>
                      <td>{bankOf(p)}</td>
                      <td className="muted">{p.reference || "—"}</td>
                      <td data-sort={p.fee_cents} className="r muted">{p.fee_cents > 0 ? money(p.fee_cents, cur, { exact: true }) : "—"}</td>
                      <td data-sort={p.amount_cents} className="r"><b>{money(p.amount_cents, cur, { exact: true })}</b></td>
                      <td data-filter={cap(String(p.status))}><span className={"pill " + st.tone}>{cap(st.word)}</span>{p.status === "failed" && p.failure_reason ? <small className="why">{cap(String(p.failure_reason))}</small> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DataTable>
        ) : <Empty title="No payouts yet">The first one is made once money has settled and a payout account is set up.</Empty>}
        <div className="sub">
          {payouts.length >= 8 ? "These are the 8 most recent payouts. The CSV export lists every payout line. " : ""}
          {simulated ? "Payments are in simulation on this install: a payout is recorded as paid without a real bank transfer." : `A payout is really sent to your default payout account through ${prov}. Scheduled means it is not sent yet, being sent means the bank has it, paid means it arrived. If one fails, the money is returned to your balance as an adjustment line.`}
        </div>
      </div>
    );
  } else if (tab === "online") {
    body = (
      <div className="card">
        <h3>Online payments</h3>
        {online?.error ? <div role="alert" className="flash flash-err">{online.error}</div> : payments.length ? (
          <DataTable id="online" search="Search online payments" filters={["For", "Status"]} pageSize={25} noun="payment" sort={{ col: "When", dir: "desc" }}>
            <table>
              <thead><tr><th>When</th><th>For</th><th>Description</th><th className="r">Amount</th><th>Status</th><th className="r">Refunded</th><th data-nosort data-col="Link"><span className="sr">Link</span></th></tr></thead>
              <tbody>
                {payments.map((x) => {
                  const [label, tone] = PAY_STATE[x.status] ?? [cap(String(x.status)), "pill-grey"];
                  return (
                    <tr key={x.reference}>
                      <td data-sort={x.created_at}>{dayShort(x.created_at, tz)} · {clock(x.created_at, tz)}</td>
                      <td>{PURPOSE[x.purpose] ?? cap(String(x.purpose))}</td>
                      <td style={{ whiteSpace: "normal", minWidth: 220 }}><b>{x.description || "Payment"}</b>{x.problem ? <span className="warn" role="note">{cap(String(x.problem))}</span> : null}</td>
                      <td data-sort={x.amount_cents} className="r"><b>{money(x.amount_cents, x.currency ?? cur, { exact: true })}</b></td>
                      <td data-filter={label}><span className={"pill " + tone}>{label}</span>{x.status === "paid" && x.paid_at ? <small>{dayShort(x.paid_at, tz)} · {clock(x.paid_at, tz)}</small> : x.status === "pending" && x.expires_at ? <small>Link ends {dayShort(x.expires_at, tz)} · {clock(x.expires_at, tz)}</small> : null}</td>
                      <td data-sort={x.refunded_cents} className="r muted">{x.refunded_cents > 0 ? money(x.refunded_cents, x.currency ?? cur, { exact: true }) : "—"}</td>
                      <td>{x.status === "pending" && x.url ? <CopyButton text={String(x.url)}>Copy link</CopyButton> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DataTable>
        ) : <Empty title="No online payments yet">{live ? `Deposits clients pay when they book, and pay links you send from Checkout, show here. They are taken through ${prov}.` : "Online payments are switched off on this install, so deposits and pay links are simulated."}</Empty>}
        <div className="sub">
          {live ? `The client pays on ${prov}'s own page, so card details never reach LogaLuxe. A paid payment counts toward your payouts two days later.` : "Payments are in simulation on this install."} The newest 300 are listed.
        </div>
      </div>
    );
  } else if (tab === "statements") {
    body = (
      <div className="card">
        <h3>Monthly statements</h3>
        {stm.error ? <div role="alert" className="flash flash-err">{stm.error}</div> : statements.length ? (
          <DataTable id="statements" search="Search months" filters={["Year"]} pageSize={12} pageSizes={[12, 24, 36]} noun="month" sort={{ col: "Month", dir: "desc" }}>
            <table>
              <thead><tr><th>Month</th><th>Year</th><th className="r">Sales</th><th className="r">Charges</th><th className="r">Tips</th><th className="r">Deposits</th><th className="r">Refunds</th><th className="r">LogaLuxe fees</th><th className="r">Lead fees</th><th className="r">Plan fees</th><th className="r">Payout fees</th><th className="r">Adjustments</th><th className="r">Net toward payouts</th><th className="r">Paid out</th><th className="r">Taken outside LogaLuxe</th></tr></thead>
              <tbody>
                {statements.map((x) => {
                  const cell = (k: string, strong = false) => { const v = Number(x[k] ?? 0); return <td data-sort={v} className={"r" + (v < 0 ? " neg" : "")}>{strong ? <b>{money(v, cur, { exact: true })}</b> : money(v, cur, { exact: true })}</td>; };
                  return (
                    <tr key={x.month}>
                      <td data-sort={x.month}><Link href={`/business/money/statement/${x.month}`} style={{ fontWeight: 600 }}>{monthName(String(x.month))}</Link></td>
                      <td>{String(x.month).slice(0, 4)}</td>
                      <td data-sort={x.sales} className="r">{x.sales}</td>
                      {cell("charges_cents")}{cell("tips_cents")}{cell("deposits_cents")}{cell("refunds_cents")}{cell("fees_cents")}{cell("lead_fees_cents")}{cell("plan_fees_cents")}{cell("payout_fees_cents")}{cell("adjustments_cents")}{cell("net_cents", true)}{cell("payouts_cents")}{cell("cash_cents")}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DataTable>
        ) : <Empty title="No statements yet">A month appears here once any money has moved in it.</Empty>}
        <div className="sub">Open a month for a statement you can print or save as a PDF. Plan fees are the monthly price of LogaLuxe Pro: see your plan in Settings. Net toward payouts is what the month added to your payout balance. Money taken outside LogaLuxe (cash, a transfer, your own card machine) is recorded but never part of a payout. Up to 36 months are kept here.</div>
      </div>
    );
  } else if (tab === "deposits") {
    const held = tx.filter((t) => t.status === "held");
    body = (
      <div className="card">
        <h3>Deposits · last 99 days</h3>
        {tx.length ? (
          <DataTable id="deposits" search="Search deposits" filters={["Method", "Status"]} pageSize={25} noun="deposit" sort={{ col: "Taken", dir: "desc" }}>
            <table className="fit">
              <thead><tr><th>Taken</th><th>Client</th><th>Method</th><th className="r">Amount</th><th>Status</th></tr></thead>
              <tbody>
                {tx.map((t) => {
                  const [head, ...rest] = String(t.description ?? "").split(" · ");
                  const st = t.status === "held" ? { label: "Held until visit", tone: "pill-gold" } : t.amount_cents < 0 ? { label: "Returned", tone: "pill-wine" } : { label: "Released", tone: "pill-ok" };
                  return (
                    <tr key={t.id}>
                      <td data-sort={t.created_at}>{dayShort(t.created_at, tz)} · {clock(t.created_at, tz)}</td>
                      <td><b>{rest.join(" · ") || head}</b></td>
                      <td>{METHOD_LABEL[t.method] ?? (t.method ? cap(String(t.method)) : "—")}</td>
                      <td data-sort={t.amount_cents} className={"r " + (t.amount_cents < 0 ? "neg" : "pos")}>{money(t.amount_cents, cur, { sign: true, exact: true })}</td>
                      <td><span className={"pill " + st.tone}>{st.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DataTable>
        ) : <Empty title="No deposits in the last 99 days">When a client pays a deposit to book, it shows here until the visit.</Empty>}
        <div className="sub">
          {held.length ? `${plural(held.length, "deposit")} in this list ${held.length === 1 ? "is" : "are"} still held. ` : ""}
          A deposit is held until the visit and released at checkout. Held deposits are not part of your payout balance: {money(bal.held_cents, cur, { exact: true })} is held in total{mo.deposits_for > 0 ? ` for ${plural(mo.deposits_for, "upcoming booking")}` : ""}.
        </div>
      </div>
    );
  } else {
    body = (
      <div className="grid">
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}><h3>Transactions · {rangeLabel}</h3>{filters}</div>
          {quickLinks}
          {tx.length ? txTable(tx, 10) : <Empty title={oneDay && d.from === today ? "Nothing has gone through today yet" : "No ledger lines for this choice"}>Pick a longer range above to see earlier lines.</Empty>}
          <div className="sub">
            <Link href={here({ tab: "tx" })} style={{ fontWeight: 600 }}>Open the full ledger</Link> ·{" "}
            Every sale, tip, refund, fee and payout is a line in the ledger. Export it for your accountant any time.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <h3>Recent payouts</h3>
            {payouts.length ? <div>{payouts.slice(0, 4).map(payoutRow)}</div> : <Empty title="No payouts yet">The first one is made once money has settled.</Empty>}
            {payouts.length > 4 ? <Link href="/business/money?tab=payouts" style={{ fontSize: 13, fontWeight: 600 }}>All payouts</Link> : null}
          </div>

          <div className="card">
            <h3>Payment methods · {month}</h3>
            {methods.length ? (
              <div className="methods">
                {methods.map((x) => (
                  <div key={x.method} className="pm" title={`${plural(x.n, "sale")} · ${money(x.cents, cur)}`}><span>{METHOD_LABEL[x.method] ?? cap(String(x.method))}</span><b>{pct(x.cents, methodTotal)}%</b></div>
                ))}
              </div>
            ) : <Empty title="No sales this month yet" />}
            {methods.length ? <div className="sub">Share of the {money(methodTotal, cur)} taken in {plural(methods.reduce((a, x) => a + Number(x.n), 0), "sale")} this month.</div> : null}
          </div>

          <div className="card">
            <h3>Where the money goes · {month}</h3>
            {mo.processed_cents > 0 ? (
              <div className="split">
                {splitRows.map((r) => (
                  <div key={r.name} className="srow"><span>{r.name}</span><div className="t"><i style={{ width: `${Math.min(100, Math.max(0, pct(r.cents, mo.processed_cents)))}%`, ...(r.gold ? { background: "#D4AF5A" } : {}) }} /></div><b>{money(r.cents, cur)}</b></div>
                ))}
              </div>
            ) : <Empty title="Nothing processed this month yet">The split appears with your first sale.</Empty>}
            {mo.processed_cents > 0 ? <div className="sub">Out of {money(mo.processed_cents, cur)} processed. Commission follows each person&apos;s rate in Staff. A lead fee is charged once, for the first paid visit of a new client LogaLuxe brought you: <Link href="/business/marketing?tab=leads">see your leads</Link>.{planFees > 0 ? <> The plan fee is the monthly price of LogaLuxe Pro, taken from your payout balance: <Link href="/business/settings?tab=plan">see your plan</Link>.</> : null}</div> : null}
            {d.tax?.tax_cents > 0 ? (
              <div className="tax">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7A5A12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></svg>
                <span>Sales tax collected this month: <b>{money(d.tax.tax_cents, cur, { exact: true })}</b>. It is in the CSV export, one line per sale.</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main pg-money">
      <Topbar title="Money">
        <nav className="seg" aria-label="Money sections">
          {TABS.map(([id, name]) => <Link key={id} href={"/business/money" + qs({ tab: id === "overview" ? undefined : id })} className={tab === id ? "on" : ""} aria-current={tab === id ? "page" : undefined}>{name}</Link>)}
        </nav>
        <span style={{ flex: 1 }} />
        <a href={"/business/money/export" + qs({ from, to: from ? to ?? from : undefined })} className="btn btn-out" download title={from ? `Ledger lines from ${dateOnly(d.from)} to ${dateOnly(d.to)}` : `Ledger lines for ${month} so far`}><Ic name="download" size={16} />Export CSV</a>
        <Link href="/business/money/payout-account" className="btn btn-out">Payout account</Link>
      </Topbar>

      <div className="content">
        <Flash sp={sp} />
        <div className="grid">
          <div className="bal">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div><small>Available for payout</small><div className="big serif" style={{ marginTop: 6 }}>{money(whole, cur)}<span>.{centsPart}</span></div></div>
              {account
                ? <span className="pill" style={{ background: "rgba(255,255,255,.1)", color: "#F4ECE3" }}>{PROVIDER[account.provider] ?? cap(String(account.provider))} · {SCHEDULE_LABEL[d.schedule] ?? d.schedule} · {account.bank_name || "Bank"}{account.account_last4 ? ` ···· ${account.account_last4}` : ""}</span>
                : <Link href="/business/money/payout-account" className="pill" style={{ background: "rgba(255,255,255,.1)" }}>No payout account yet · add one</Link>}
            </div>
            <div className="row">
              <div><small>Settling</small><b>{money(bal.pending_cents, cur, { exact: true })}</b><span style={{ fontSize: 11, color: "#9A8E85" }}>{live ? `paid through ${prov}, available two days after payment` : "paid by clients, available two days after payment"}</span></div>
              <div><small>Next automatic payout</small><b>{d.next_payout ? dateOnly(d.next_payout) : "None"}</b><span style={{ fontSize: 11, color: "#9A8E85" }}>{!d.next_payout ? "you pay out by hand" : !account ? "needs a payout account first" : d.schedule === "weekly" ? "sent every Monday" : "sent every day"}</span></div>
              <div><small>Held deposits</small><b>{money(bal.held_cents, cur, { exact: true })}</b><span style={{ fontSize: 11, color: "#9A8E85" }}>{mo.deposits_for > 0 ? `for ${plural(mo.deposits_for, "upcoming booking")}, released at checkout` : "released at checkout"}</span></div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Sheet trigger="Pay out now" triggerClass="btn btn-gold" title="Pay out now" sub="Sends your whole available balance to your payout account.">
                <dl className="kv">
                  <dt>Available now</dt><dd>{money(bal.available_cents, cur, { exact: true })}</dd>
                  <dt>Sent to</dt><dd>{account ? `${account.bank_name || PROVIDER[account.provider] || "Bank"}${account.account_last4 ? ` ···· ${account.account_last4}` : ""}` : "No account yet"}</dd>
                </dl>
                {simulated ? <p><span className="sim">Simulation</span> Payments are in simulation on this install. A payout is recorded as paid straight away, but no bank transfer is made.</p> : null}
                {canPay ? (
                  <>
                    <div className="opt">
                      <h4>Standard payout · no fee</h4>
                      <p>{simulated ? "Recorded as paid at once." : `Sent to your bank through ${prov}. It shows as scheduled, then being sent, then paid.`} You receive <b>{money(bal.available_cents, cur, { exact: true })}</b>.</p>
                      <form action={payOut}>
                        <input type="hidden" name="back" value={back} />
                        <ConfirmButton className="btn btn-ink" message={`Pay out ${money(bal.available_cents, cur, { exact: true })} now?${simulated ? " This is a simulation: no bank transfer is made." : ""}`}>Pay out {money(bal.available_cents, cur, { exact: true })}</ConfirmButton>
                      </form>
                    </div>
                    {feePct === 0 ? (
                      <p>Instant payouts carry no fee on your plan, so the standard payout above is all you need.</p>
                    ) : (
                      <div className="opt">
                        <h4>Instant payout · {feePct ? `${feePct}% fee` : "a fee applies"}</h4>
                        {feePct ? (
                          <p>The fee is {feePct}% of the amount: about <b>{money(feeGuess, cur, { exact: true })}</b>, so you would receive about <b>{money(bal.available_cents - feeGuess, cur, { exact: true })}</b>. A minimum fee can apply to small amounts. The exact fee is shown as soon as the payout is made.</p>
                        ) : (
                          <p>An instant payout carries a fee set by your plan. The exact fee is shown as soon as the payout is made.</p>
                        )}
                        <form action={payOut}>
                          <input type="hidden" name="back" value={back} />
                          <input type="hidden" name="instant" value="1" />
                          <ConfirmButton className="btn btn-out" message={`Pay out instantly${feePct ? ` for a fee of about ${money(feeGuess, cur, { exact: true })}` : ", with a fee"}?${simulated ? " This is a simulation: no bank transfer is made." : ""}`}>Pay out instantly{feePct ? ` · about ${money(feeGuess, cur, { exact: true })} fee` : ""}</ConfirmButton>
                        </form>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p>{whyNot}</p>
                    {blocked || !account || account.status !== "verified" ? <div><Link href="/business/money/payout-account" className="btn btn-ink">{blocked ? "Connect a real payout account" : "Open payout account"}</Link></div> : null}
                  </>
                )}
              </Sheet>
              <Sheet trigger="Change schedule" triggerClass="btn btn-ghost" title="Payout schedule" sub="How often your available balance is sent to your bank.">
                <form action={setSchedule}>
                  <input type="hidden" name="back" value={back} />
                  {SCHEDULES.map(([id, name, note]) => (
                    <label key={id} className="chk opt" style={{ flexDirection: "row", alignItems: "center" }}>
                      <input type="radio" name="schedule" value={id} defaultChecked={d.schedule === id} />
                      <span><b style={{ display: "block", fontSize: 14 }}>{name}</b><span style={{ fontSize: 12.5, color: "#6B5F57" }}>{note}</span></span>
                    </label>
                  ))}
                  <div className="sheet-ft"><button className="btn btn-ink">Save schedule</button></div>
                </form>
              </Sheet>
            </div>
            {simulated ? <div className="simline"><span className="sim" style={{ marginRight: 8 }}>Simulation</span>Payments are in simulation on this install. A payout is recorded as paid, but no real bank transfer is made.</div> : (
              <>
                {blocked ? (
                  <div className="cta" role="alert">
                    <span><b>Payouts cannot be sent yet.</b> Your payout account was recorded in simulation, before real payments were switched on. Connect a real account and your balance can be paid out.</span>
                    <Link href="/business/money/payout-account" className="btn btn-gold btn-sm">Connect a real account</Link>
                  </div>
                ) : null}
                <div className="simline">Deposits and pay links are taken through {prov} and count toward your payouts two days after the client pays. Money taken at the desk on your own card machine, by transfer or in cash is recorded here, but LogaLuxe never holds it, so it is never part of a payout. Those lines are marked &quot;Taken outside LogaLuxe&quot;.</div>
              </>
            )}
          </div>

          <div className="kpis">
            <div className="kpi"><small>Processed · {mon}</small><b>{money(mo.processed_cents, cur)}</b><span>{mo.processed_prev_cents > 0 ? `${money(mo.processed_prev_cents, cur)} in all of last month` : "Nothing last month"}</span></div>
            <div className="kpi"><small>Tips · {mon}</small><b>{money(mo.tips_cents, cur)}</b><span>{mo.tips_cents > 0 ? "Goes to your team" : "None yet"}</span></div>
            <div className="kpi"><small>LogaLuxe fees · {mon}</small><b>{money(mo.fees_cents, cur)}</b><span>{mo.processed_cents > 0 ? `${share(mo.fees_cents, mo.processed_cents)}% of what was processed` : "No fees yet"}</span></div>
            <div className="kpi"><small>Refunds · {mon}</small><b>{money(mo.refunds_cents, cur)}</b><span>{mo.refunds > 0 ? `${plural(mo.refunds, "refund")} · ${share(mo.refunds_cents, mo.processed_cents)}%` : "No refunds"}</span></div>
            <div className="kpi"><small>Staff commission · {mon}</small><b>{money(sp2.commission_cents, cur)}</b><span>{mo.processed_cents > 0 ? `${share(sp2.commission_cents, mo.processed_cents)}% of what was processed` : "Nothing earned yet"}</span></div>
            <div className="kpi"><small>Deposits held</small><b>{money(bal.held_cents, cur)}</b><span>{mo.deposits_for > 0 ? `for ${plural(mo.deposits_for, "upcoming booking")}` : "No upcoming deposits"}</span></div>
          </div>
        </div>

        {body}
      </div>
    </div>
  );
}
