import Link from "next/link";
import { Btn, Content, Empty, Field, FilterSearch, Flash, Hidden, Kpi, Panel, Pill, ReadOnly, Tabs, Topbar, ago, fmtDate, fmtMoney, inputCls, inputSm } from "@/components/admin-ui";
import { can, getAdmin, load, qs, type Row } from "@/lib/admin-api";
import { resolveLead, setLeadRate } from "../actions-leads";

export const metadata = { title: "Leads" };

const STATUS: Record<string, [string, "ok" | "gold" | "wine" | "info" | "grey"]> = {
  pending: ["Visit to come", "info"], charged: ["Charged", "ok"], void: ["Void", "grey"], disputed: ["Disputed", "gold"], refunded: ["Refunded", "wine"],
};
const pct = (n: number) => `${Number(n).toFixed(n % 1 ? 1 : 0)}%`;

// New clients LogaLuxe brought to businesses, what each one earned, and the
// disputes businesses have raised about them.
export default async function Leads({ searchParams }: { searchParams: Promise<{ status?: string; market?: string; q?: string; id?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const status = sp.status ?? "", market = sp.market ?? "";
  const [admin, res] = await Promise.all([getAdmin(), load(`/leads${qs({ status, market, q: sp.q })}`)]);
  const leads: Row[] = res.data.leads ?? [], totals: Row[] = res.data.totals ?? [], rates: Row[] = res.data.category_rates ?? [], base: Row[] = res.data.base_rates ?? [];
  const categories: string[] = res.data.categories ?? [];
  const sel = sp.id ? leads.find((l) => l.id === sp.id) : leads.find((l) => l.status === "disputed");
  const back = `/admin/leads${qs({ status, market, q: sp.q, id: sel?.id })}`;
  const here = (over: Record<string, string | undefined>) => `/admin/leads${qs({ status, market, q: sp.q, ...over })}`;

  return (
    <>
      <Topbar title="Leads" sub="A business pays once for a new client LogaLuxe brought, when that first visit is paid for">
        <Tabs items={[["", "All"], ["disputed", "Disputed"], ["charged", "Charged"], ["pending", "Visit to come"], ["void", "Void"], ["refunded", "Refunded"]]} current={status} href={(s) => here({ status: s, id: undefined })} />
      </Topbar>
      <Content>
        <Flash sp={sp} error={res.error} />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {totals.map((t) => (
            <div key={t.market} className="contents">
              <Kpi label={`${t.market} · lead revenue, 30 days`} value={fmtMoney(t.fee_cents_30d, t.currency)} sub={`${t.charged_30d} charged of ${t.leads_30d} leads · ${fmtMoney(t.boost_cents_30d, t.currency)} from promotion`} />
              <Kpi label={`${t.market} · all time`} value={fmtMoney(t.fee_cents_all, t.currency)} sub={`${t.promoting} ${t.promoting === 1 ? "business is" : "businesses are"} promoting · ${t.disputed} disputed`} tone={t.disputed > 0 ? "bad" : undefined} href={t.disputed > 0 ? here({ status: "disputed", id: undefined }) : undefined} />
            </div>
          ))}
          {totals.length === 0 && <Kpi label="Lead revenue" value="None yet" sub="Leads open when a first-time client books from search" />}
        </div>

        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1fr_380px]">
          <Panel flush title="Leads" action={<div className="flex items-center gap-2">
            <Tabs items={[["", "Both"], ["US", "US"], ["NG", "NG"]]} current={market} href={(m) => here({ market: m, id: undefined })} />
            <FilterSearch action="/admin/leads" q={sp.q} placeholder="Business or client" keep={{ status, market }} />
          </div>}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-[13.5px]">
                <thead><tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-[.06em] text-muted">
                  <th className="px-4 py-2.5">Opened</th><th className="px-3 py-2.5">Business</th><th className="px-3 py-2.5">Client</th><th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">First visit</th><th className="px-3 py-2.5 text-right">Rate</th><th className="px-4 py-2.5 text-right">Fee</th>
                </tr></thead>
                <tbody>
                  {leads.map((l) => {
                    const [label, kind] = STATUS[l.status] ?? [l.status, "grey"];
                    return (
                      <tr key={l.id} className={`border-b border-line-2 last:border-0 ${sel?.id === l.id ? "bg-cream-3" : "hover:bg-cream"}`}>
                        <td className="whitespace-nowrap px-4 py-2.5 text-muted"><Link href={here({ id: l.id })} className="text-ink underline decoration-line underline-offset-2">{fmtDate(l.created_at)}</Link></td>
                        <td className="px-3 py-2.5"><Link href={`/admin/businesses/${l.business_id}`} className="font-medium">{l.business}</Link><span className="ml-1.5 text-[11.5px] uppercase text-muted">{l.market} · {l.plan}</span></td>
                        <td className="px-3 py-2.5">{l.client_name}{l.earlier_bookings > 0 && <span className="ml-1.5 text-[11.5px] font-semibold text-bad" title="This client had bookings with the business before the lead opened">{l.earlier_bookings} earlier</span>}</td>
                        <td className="px-3 py-2.5"><Pill kind={kind}>{label}</Pill>{l.boosted && <span className="ml-1.5 text-[11px] font-semibold uppercase tracking-[.05em] text-muted">Promoted</span>}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(l.value_cents, l.currency)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{pct(l.base_pct)}{l.boost_pct > 0 ? ` + ${pct(l.boost_pct)}` : ""}</td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{l.status === "pending" || l.status === "void" ? "None" : fmtMoney(l.fee_cents, l.currency)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {leads.length === 0 && <Empty>No leads here.</Empty>}
          </Panel>

          <div className="flex min-w-0 flex-col gap-5">
            {sel && (
              <Panel title={`${sel.client_name} · ${sel.business}`} sub={`Opened ${ago(sel.created_at)} from ${sel.source}`}>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13.5px]">
                  <dt className="text-muted">Status</dt><dd className="text-right font-semibold">{(STATUS[sel.status] ?? [sel.status])[0]}</dd>
                  <dt className="text-muted">First visit</dt><dd className="text-right">{fmtMoney(sel.value_cents, sel.currency)}</dd>
                  <dt className="text-muted">Fee</dt><dd className="text-right">{fmtMoney(sel.fee_cents, sel.currency)} at {pct(sel.base_pct + sel.boost_pct)}</dd>
                  <dt className="text-muted">Bookings before the lead</dt><dd className={`text-right ${sel.earlier_bookings > 0 ? "font-semibold text-bad" : ""}`}>{sel.earlier_bookings}</dd>
                  {sel.charged_at && <><dt className="text-muted">Charged</dt><dd className="text-right">{ago(sel.charged_at)}</dd></>}
                </dl>
                {sel.void_reason && <p className="mt-3 text-[13.5px] text-muted">{sel.void_reason}.</p>}
                {sel.dispute_reason && <div className="mt-3 rounded-xl bg-cream-2 px-3 py-2.5 text-[13.5px] leading-relaxed"><b>The business says:</b> {sel.dispute_reason}</div>}
                {sel.resolution_note && <p className="mt-3 text-[13.5px]"><b className="font-semibold">Decision by {sel.resolved_by || "the team"}:</b> {sel.resolution_note}</p>}
                {(sel.status === "disputed" || sel.status === "charged") && (can(admin, "ops") ? (
                  <form action={resolveLead} className="mt-4 flex flex-col gap-3 border-t border-line-2 pt-4">
                    <Hidden values={{ id: sel.id, back }} />
                    <Field label="Reason, kept on the lead and shown to the business"><input name="note" required minLength={5} className={inputCls} /></Field>
                    <p className="text-[12.5px] text-muted">A refund returns {fmtMoney(sel.fee_cents, sel.currency)} to the business&apos;s payout balance. Upholding keeps the fee.</p>
                    <div className="flex flex-wrap gap-2">
                      <Btn kind="ok" name="outcome" value="refund">Refund the fee</Btn>
                      {sel.status === "disputed" && <Btn kind="ink" name="outcome" value="uphold">Uphold the charge</Btn>}
                    </div>
                  </form>
                ) : <div className="mt-4"><ReadOnly need="ops" /></div>)}
              </Panel>
            )}

            <Panel title="What a lead costs" sub="The share of a first visit, by market and plan. Change these under Fees and plans.">
              <div className="divide-y divide-line-2 text-[13.5px]">
                {base.map((b) => <div key={b.market + b.plan} className="flex justify-between py-1.5"><span className="uppercase">{b.market} · {b.plan}</span><b>{pct(b.new_client_pct)}{b.new_client_cap_cents ? ` · up to ${fmtMoney(b.new_client_cap_cents, b.market === "NG" ? "NGN" : "USD")}` : ""}</b></div>)}
              </div>
              <p className="mt-3 text-[12.5px] leading-relaxed text-muted">A business can add up to {res.data.max_boost_pct ?? 20} points of its own to be listed first in search. That part is the promotion revenue above.</p>
            </Panel>

            <Panel title="By kind of business" sub="Points added to, or taken off, the rate above for one category in one market.">
              <div className="divide-y divide-line-2 text-[13.5px]">
                {rates.map((r) => <div key={r.market + r.category} className="flex items-center justify-between py-1.5"><span><span className="uppercase">{r.market}</span> · <span className="capitalize">{r.category}</span></span><b className={r.delta_pct < 0 ? "text-ok" : ""}>{r.delta_pct > 0 ? "+" : ""}{pct(r.delta_pct)}</b></div>)}
                {rates.length === 0 && <p className="py-2 text-muted">No adjustments. Every category pays the plan&apos;s rate.</p>}
              </div>
              {can(admin, "super_admin") ? (
                <form action={setLeadRate} className="mt-3 flex flex-wrap items-end gap-2 border-t border-line-2 pt-3">
                  <Hidden values={{ back }} />
                  <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[.06em] text-muted">Market<select name="market" className={inputSm}><option>US</option><option>NG</option></select></label>
                  <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[.06em] text-muted">Category<select name="category" className={`${inputSm} capitalize`}>{categories.map((c) => <option key={c}>{c}</option>)}</select></label>
                  <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[.06em] text-muted">Points<input name="delta" type="number" step="0.5" min="-20" max="30" defaultValue="0" className={`${inputSm} w-20`} /></label>
                  <Btn kind="ink" small>Save</Btn>
                  <p className="w-full text-[12px] text-muted">0 removes the adjustment. It applies to leads opened from now on.</p>
                </form>
              ) : <div className="mt-3"><ReadOnly need="super admin" /></div>}
            </Panel>
          </div>
        </div>
      </Content>
    </>
  );
}
