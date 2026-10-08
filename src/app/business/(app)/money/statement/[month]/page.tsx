import Link from "next/link";
import type { ReactNode } from "react";
import { DataTable } from "@/components/data-table";
import { Ic, LoadError, NoAccess } from "@/components/merchant-ui";
import { getMe, mLoad, type Row } from "@/lib/merchant-api";
import { METHOD_LABEL as BASE_METHOD, clock, dateOnly, dayShort, firstName, money, plural, ymd } from "@/lib/merchant-format";
import { PrintButton } from "./print-button";
import "../../../../css/money.css";

export const metadata = { title: "Statement" };

const KIND_LABEL: Record<string, string> = { charge: "Sale", deposit: "Deposit", tip: "Tip", fee: "LogaLuxe fee", lead_fee: "Lead fee", plan_fee: "Plan fee", refund: "Refund", payout: "Payout", payout_fee: "Instant payout fee", adjustment: "Adjustment" };
const METHOD_LABEL: Record<string, string> = { ...BASE_METHOD, link: "Pay link", logaluxe: "LogaLuxe" };
const PAYOUT_STATE: Record<string, [string, string]> = { scheduled: ["Scheduled, not sent yet", "pill-grey"], sending: ["Being sent", "pill-gold"], paid: ["Paid", "pill-ok"], failed: ["Failed, money returned", "pill-wine"] };
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1).replace(/_/g, " ") : s);
/** Moves a YYYY-MM month by a number of months. */
const shift = (ym: string, n: number) => { const [y, mth] = ym.split("-").map(Number); const d = new Date(Date.UTC(y, mth - 1 + n, 15)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };

export default async function Statement({ params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  const me = (await getMe())!;
  const { merchant: m } = me;
  const tz = m.timezone;
  const back = "/business/money?tab=statements";

  const { data: d, error, status } = /^\d{4}-\d{2}$/.test(month) ? await mLoad(`/statements/${month}`) : { data: {} as Row, error: "That is not a month. A statement address ends like 2026-10.", status: 400 };
  if (status === 403) return <div className="main pg-money pg-statement"><NoAccess title="Statement" need="owner" /></div>;
  if (error) return <div className="main pg-money pg-statement"><LoadError title="Statement" error={error[0].toUpperCase() + error.slice(1)} /><div className="content" style={{ paddingTop: 0 }}><div><Link href={back} className="btn btn-out btn-sm">Back to statements</Link></div></div></div>;

  const cur = String(d.currency ?? m.currency), s = d.sums as Row, biz = (d.business ?? {}) as Row;
  const lines = (d.lines ?? []) as Row[], payouts = (d.payouts ?? []) as Row[];
  const $ = (cents: number) => money(cents, cur, { exact: true });
  const live = d.payments_mode === "live";
  const thisMonth = ymd(new Date(), tz).slice(0, 7);
  const open = month === thisMonth, future = month > thisMonth;

  // The totals by type count every line. What is left after taking them from the net is money LogaLuxe never held.
  const planFees = Number(s.plan_fees_cents ?? 0);
  const byType = planFees + s.charges_cents + s.deposits_cents + s.tips_cents + s.refunds_cents + s.fees_cents + s.lead_fees_cents + s.payout_fees_cents + s.adjustments_cents;
  const outside = s.net_cents - byType;
  const outsideLines = lines.filter((l) => !l.in_balance && l.kind !== "payout").reduce((a, l) => a + Number(l.amount_cents), 0);
  const outsideKnown = lines.length < 5000 && -outsideLines === outside;
  // The check a statement has to pass: what you started with, plus the month, less what was paid out.
  const expected = d.opening_cents + s.net_cents + s.payouts_cents;
  const adds = expected === d.closing_cents;

  const rows: [ReactNode, string, number][] = [
    [`Sales`, plural(s.sales, "sale"), s.charges_cents],
    ["Deposits released", "deposits that turned into a visit or were kept", s.deposits_cents],
    ["Tips", "", s.tips_cents],
    ["Refunds", "", s.refunds_cents],
    ["LogaLuxe fees", "the fee on each payment", s.fees_cents],
    ["Lead fees", "new clients LogaLuxe brought you, charged once each", s.lead_fees_cents],
    [<Link key="plan" href="/business/settings?tab=plan">Plan fee</Link>, "the monthly price of LogaLuxe Pro, taken from your payout balance", planFees],
    ["Payout fees", "instant payouts", s.payout_fees_cents],
    ["Adjustments", "corrections, and payouts that failed and were returned", s.adjustments_cents],
  ];

  return (
    <div className="main pg-money pg-statement">
      <header className="topbar">
        <Link href={back} className="btn btn-out btn-sm" style={{ minHeight: 40 }}><Ic name="chevL" size={16} />Statements</Link>
        <h1 className="serif">{d.label}</h1>
        <span style={{ flex: 1 }} />
        <Link href={`/business/money/statement/${shift(month, -1)}`} className="btn btn-out btn-sm" aria-label="The month before"><Ic name="chevL" size={16} /></Link>
        {month < thisMonth ? <Link href={`/business/money/statement/${shift(month, 1)}`} className="btn btn-out btn-sm" aria-label="The month after"><Ic name="chevR" size={16} /></Link> : null}
        <a href={`/business/money/statement/${month}/csv`} className="btn btn-out" download><Ic name="download" size={16} />Download CSV</a>
        <PrintButton />
      </header>

      <div className="content">
        <div className="sheetdoc">
          <div className="head">
            <div>
              <h2 className="serif">Statement</h2>
              <p>{d.label} · {dateOnly(d.from, "med")} to {dateOnly(d.to, "med")}<br />All amounts in {cur}{open ? " · this month is not over, so these figures will change" : future ? " · this month has not started" : ""}</p>
            </div>
            <div className="who">
              <p><b>{biz.name ?? m.business}</b>{[biz.address, [biz.city, biz.region].filter(Boolean).join(", ")].filter(Boolean).map((x, i) => <span key={i}>{x}<br /></span>)}Prepared by LogaLuxe for business</p>
            </div>
          </div>

          <section>
            <h3>Payout balance</h3>
            <div className="sums">
              <div className="sub2"><span>Opening balance<small>what LogaLuxe owed you at the start of {dateOnly(d.from)}</small></span><b>{$(d.opening_cents)}</b></div>
              {rows.map(([name, note, cents], i) => (
                <div key={i} className="in"><span>{name}{note ? <small>{note}</small> : null}</span><b>{$(cents)}</b></div>
              ))}
              {outside !== 0 ? (
                <div className="in"><span>{outsideKnown ? "Less money taken outside LogaLuxe" : "Less money taken outside LogaLuxe, and other lines"}<small>cash, a bank transfer or your own card machine: recorded above, but never held by LogaLuxe, so not part of a payout</small></span><b>{$(outside)}</b></div>
              ) : null}
              <div className="sub2"><span>Net toward payouts<small>what this month added to your payout balance</small></span><b>{$(s.net_cents)}</b></div>
              <div className="in"><span>Paid out to your bank<small>{payouts.length ? `${plural(payouts.length, "payout")} created this month, listed below` : "no payouts were created this month"}</small></span><b>{$(s.payouts_cents)}</b></div>
              <div className="total"><span>Closing balance<small>at the end of {dateOnly(d.to)}, including money still settling</small></span><b>{$(d.closing_cents)}</b></div>
            </div>
            <p className={"checkline" + (adds ? "" : " bad")} style={{ marginTop: 8 }}>
              {adds
                ? `Checked: ${$(d.opening_cents)} opening, plus ${$(s.net_cents)} net, less ${$(Math.abs(s.payouts_cents))} paid out, comes to the closing balance of ${$(d.closing_cents)}.`
                : `These figures do not add up: opening + net + paid out comes to ${$(expected)}, but the closing balance is ${$(d.closing_cents)}. Contact LogaLuxe support before relying on this statement.`}
            </p>
            {s.cash_cents !== 0 ? <p className="sub" style={{ fontSize: 12.5, color: "#6B5F57", marginTop: 4 }}>Sales and tips taken outside LogaLuxe this month: {$(s.cash_cents)}. {live ? "With real payments on, only deposits and pay links are held by LogaLuxe." : ""}</p> : null}
          </section>

          <section>
            <h3>Payouts created this month</h3>
            {payouts.length ? (
              <DataTable id="st-payouts" search="Search payouts" filters={["Status"]} pageSize={10} noun="payout" sort={{ col: "Date", dir: "asc" }}>
                <table className="fit">
                  <thead><tr><th>Date</th><th>Kind</th><th>Sent to</th><th>Reference</th><th className="r">Fee</th><th className="r">Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    {payouts.map((p, i) => {
                      const [label, tone] = PAYOUT_STATE[p.status] ?? [cap(String(p.status)), "pill-grey"];
                      const simulated = String(p.reference ?? "").startsWith("sim_");
                      return (
                        <tr key={i}>
                          <td data-sort={p.created_at}>{dayShort(p.paid_at ?? p.created_at, tz)}</td>
                          <td>{p.kind === "instant" ? "Instant" : p.kind === "manual" ? "On request" : "Automatic"}</td>
                          <td>{p.bank_name ? `${p.bank_name}${p.account_last4 ? ` ···· ${p.account_last4}` : ""}` : "—"}</td>
                          <td className="muted">{p.reference || "—"}</td>
                          <td data-sort={p.fee_cents} className="r muted">{p.fee_cents > 0 ? $(p.fee_cents) : "—"}</td>
                          <td data-sort={p.amount_cents} className="r"><b>{$(p.amount_cents)}</b></td>
                          <td data-filter={label}><span className={"pill " + tone}>{simulated && p.status === "paid" ? "Recorded as paid, simulated" : label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </DataTable>
            ) : <div className="empty"><b>No payouts this month</b></div>}
          </section>

          <section className="lines">
            <h3>Every line · {lines.length >= 5000 ? "the first 5,000" : lines.length}</h3>
            {lines.length ? (
              <DataTable id="st-lines" search="Search this statement" filters={["Type", "Method", "Toward payouts"]} pageSize={25} noun="line" sort={{ col: "Date", dir: "asc" }}>
                <table>
                  <thead><tr><th>Date</th><th>Description</th><th>Staff</th><th>Method</th><th>Type</th><th className="r">Amount</th><th>Toward payouts</th></tr></thead>
                  <tbody>
                    {lines.map((l, i) => (
                      <tr key={i}>
                        <td data-sort={l.created_at}>{dayShort(l.created_at, tz)} · {clock(l.created_at, tz)}</td>
                        <td><b>{l.description || KIND_LABEL[l.kind] || "Ledger line"}</b></td>
                        <td data-filter={l.staff ? firstName(l.staff) : "No staff"}>{l.staff ? firstName(l.staff) : <span className="muted">—</span>}</td>
                        <td>{METHOD_LABEL[l.method] ?? (l.method ? cap(String(l.method)) : "—")}</td>
                        <td data-filter={KIND_LABEL[l.kind] ?? cap(String(l.kind))}>{l.kind === "plan_fee" ? <Link href="/business/settings?tab=plan">Plan fee</Link> : KIND_LABEL[l.kind] ?? cap(String(l.kind))}</td>
                        <td data-sort={l.amount_cents} className={"r " + (l.amount_cents < 0 ? "neg" : "pos")}>{money(l.amount_cents, cur, { sign: true, exact: true })}</td>
                        <td data-filter={l.in_balance ? "Yes" : "Taken outside LogaLuxe"}>{l.in_balance ? (l.status === "pending" ? "Yes · settling" : "Yes") : <span className="pill pill-grey">Taken outside LogaLuxe</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTable>
            ) : <div className="empty"><b>Nothing moved in {d.label}</b><span>A sale, tip, refund, fee or payout in this month would be listed here.</span></div>}
            <p className="noprint" style={{ fontSize: 12.5, color: "#6B5F57", marginTop: 8 }}>Printing lists every line, whatever page or filter is showing. Deposits still held for a visit that has not happened are not on a statement until they are released.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
