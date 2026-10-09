import { AdminPagination } from "@/components/admin-pagination";
import Link from "next/link";
import { ExportLink } from "@/components/export-link";
import { Btn, Content, Empty, Flash, Hidden, Panel, Pill, ReadOnly, Tabs, Topbar, ago, fmtDate, fmtMoney, inputCls, statusPill, inputSm } from "@/components/admin-ui";
import { can, getAdmin, load, qs, type Row } from "@/lib/admin-api";
import { payoutAction } from "../actions";

export default async function Payouts({ searchParams }: { searchParams: Promise<{ status?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const pageParams = sp as Record<string,string|undefined>;
  const paging = {page:pageParams.page,per_page:pageParams.per_page,sort:pageParams.sort,direction:pageParams.direction};
  const status = sp.status ?? "";
  const [admin, res] = await Promise.all([getAdmin(), load(`/payouts${qs({ ...paging, status })}`)]);
  const list: Row[] = res.data.payouts ?? [];
  const totals: Row[] = res.data.totals ?? [];
  const payments: Row[] = res.data.payments ?? [];
  const back = `/admin/payouts${qs({ status })}`;
  const ops = can(admin, "ops");

  return (
    <>
      <Topbar title="Payouts" sub="Money owed to businesses, and the payments that fund it">
        <Tabs items={[["", "All"], ["failed", "Failed"], ["held", "Held"], ["scheduled", "Scheduled"], ["paid", "Paid"]]} current={status} href={(s) => `/admin/payouts${qs({ status: s })}`} />
        <ExportLink kind="payouts" filters={{ status }} />
      </Topbar>
      <Content>
        <Flash sp={sp} error={res.error} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {totals.map((t) => (
            <Link key={`${t.currency}${t.status}`} href={`/admin/payouts${qs({ status: t.status })}`} className="card block p-4 transition hover:border-ink">
              <div className="flex items-center gap-2"><small className="text-[11px] font-semibold uppercase tracking-[.08em] text-muted">{t.currency}</small>{statusPill(t.status)}</div>
              <b className="mt-1.5 block text-[24px] font-semibold leading-none tracking-tight">{fmtMoney(t.cents, t.currency)}</b>
              <span className="mt-1.5 block text-[12px] text-muted">{t.n} payout{t.n === 1 ? "" : "s"}</span>
            </Link>
          ))}
        </div>
        {!ops && <ReadOnly need="ops" />}

        <Panel title="Payouts" flush>
          <table className="data min-w-[920px]">
            <thead><tr><th>Business</th><th>Amount</th><th>Scheduled</th><th>Provider</th><th>Status</th><th>Detail</th>{ops && <th>Action</th>}</tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="hover:bg-cream">
                  <td><Link href={`/admin/businesses/${p.business_id}`} className="font-semibold hover:text-wine">{p.business}</Link><span className="block text-[12px] text-muted">{p.market}{p.payout_hold ? " · business on hold" : ""}</span></td>
                  <td className="font-semibold">{fmtMoney(p.amount_cents, p.currency)}</td>
                  <td>{fmtDate(p.scheduled_for)}{p.paid_at && <span className="block text-[12px] text-muted">paid {fmtDate(p.paid_at)}</span>}</td>
                  <td className="capitalize">{p.provider}</td>
                  <td>{statusPill(p.status)}</td>
                  <td className="max-w-[220px] text-[13px] text-muted">{p.failure_reason || p.reference || "—"}</td>
                  {ops && (
                    <td>
                      {p.status === "paid" ? <span className="text-[12.5px] text-muted">Done</span> : (
                        <form action={payoutAction} className="flex flex-wrap items-center gap-1.5">
                          <Hidden values={{ id: p.id, back }} />
                          {(p.status === "failed" || p.status === "scheduled") && <input name="note" placeholder="Reason" aria-label="Reason" className={`${inputSm} w-[120px]`} />}
                          {p.status === "failed" && <Btn small kind="ink" name="decision" value="retry">Retry</Btn>}
                          {(p.status === "failed" || p.status === "scheduled") && <Btn small kind="danger" name="decision" value="hold" title="Needs a reason">Hold</Btn>}
                          {p.status === "held" && <Btn small kind="ok" name="decision" value="release">Release</Btn>}
                          {p.status !== "held" && <Btn small name="decision" value="mark_paid" title="Use when the money was sent outside the platform">Mark paid</Btn>}
                        </form>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <Empty>No payouts with this status.</Empty>}
        </Panel>

        <Panel title="Payments ledger" sub="The latest 50 charges, deposits and refunds" flush>
          <table className="data min-w-[720px]">
            <thead><tr><th>When</th><th>Kind</th><th>Amount</th><th>Provider</th><th>Reference</th><th>For</th><th>Status</th></tr></thead>
            <tbody>
              {payments.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap">{ago(e.created_at)}</td>
                  <td className="capitalize">{String(e.kind).replace(/_/g, " ")}</td>
                  <td className="font-semibold">{fmtMoney(e.amount_cents, e.currency)}</td>
                  <td className="capitalize">{e.provider}</td>
                  <td className="font-mono text-[12.5px] text-muted">{e.reference}</td>
                  <td>{e.booking_id ? <Link href={`/admin/bookings?q=${String(e.booking_id).slice(0, 8)}`} className="font-medium text-wine">Booking</Link> : e.order_id ? <Link href={`/admin/orders?q=${String(e.order_id).slice(0, 8)}`} className="font-medium text-wine">Order</Link> : "—"}</td>
                  <td>{e.status === "simulated" ? <Pill kind="grey">simulated</Pill> : statusPill(e.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {payments.length === 0 && <Empty>No payments yet.</Empty>}
        </Panel>
      <AdminPagination pagination={res.data.pagination} columns={["scheduled_for","business","amount_cents","status"]} />
      </Content>
    </>
  );
}
