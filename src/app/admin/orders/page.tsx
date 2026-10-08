import { Btn, Content, Empty, FilterSearch, Flash, Hidden, Panel, ReadOnly, Tabs, Topbar, ago, fmtMoney, inputCls, statusPill, inputSm } from "@/components/admin-ui";
import Link from "next/link";
import { ExportLink } from "@/components/export-link";
import { can, getAdmin, load, qs, type Row } from "@/lib/admin-api";
import { setOrderStatus } from "../actions";

const statuses = ["paid", "ready", "shipped", "delivered", "cancelled", "refunded"];

export default async function Orders({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const { q = "", status = "" } = sp;
  const [admin, res] = await Promise.all([getAdmin(), load(`/orders${qs({ q, status })}`)]);
  const list: Row[] = res.data.orders ?? [];
  const back = `/admin/orders${qs({ q, status })}`;
  const ops = can(admin, "ops");

  return (
    <>
      <Topbar title="Orders" sub="Cancelling or refunding an order puts its items back in stock">
        <Tabs items={[["", "All"], ...statuses.map((s) => [s, s[0].toUpperCase() + s.slice(1)] as [string, string])]} current={status} href={(s) => `/admin/orders${qs({ q, status: s })}`} />
        <Link href="/admin/returns" className="inline-flex h-10 items-center whitespace-nowrap rounded-full border border-line bg-white px-4 text-[13.5px] font-semibold text-ink hover:border-ink">Returns of brand products</Link>
        <ExportLink kind="orders" filters={{ q, status }} />
      </Topbar>
      <Content>
        <Flash sp={sp} error={res.error} />
        <FilterSearch action="/admin/orders" q={q} placeholder="Customer, phone or order ID" keep={{ status }} />
        {!ops && <ReadOnly need="ops" />}
        <Panel flush>
          <table className="data min-w-[900px]">
            <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Delivery</th><th>Total</th><th>Status</th>{ops && <th>Change status</th>}</tr></thead>
            <tbody>
              {list.map((o) => {
                const closed = o.status === "cancelled" || o.status === "refunded";
                return (
                  <tr key={o.id} className="hover:bg-cream">
                    <td><b className="block font-semibold uppercase">{String(o.id).slice(0, 8)}</b><span className="text-[12px] text-muted">{ago(o.created_at)}</span></td>
                    <td><b className="block font-semibold">{o.customer_name}</b><span className="text-[12px] text-muted">{o.customer_phone}</span></td>
                    <td className="max-w-[300px]">{o.items}<span className="block text-[12px] text-muted">Sold by {o.sellers}</span></td>
                    <td className="capitalize">{o.fulfilment}</td>
                    <td><b className="font-semibold">{fmtMoney(o.total_cents)}</b>{o.discount_cents > 0 && <span className="block text-[12px] text-muted">{fmtMoney(o.discount_cents)} off · {o.promo_code}</span>}{o.gift_cents > 0 && <span className="block text-[12px] text-muted">{fmtMoney(o.gift_cents)} by gift card {o.gift_code}</span>}</td>
                    <td>{statusPill(o.status)}</td>
                    {ops && (
                      <td>
                        {closed ? <span className="text-[12.5px] text-muted">Closed</span> : (
                          <form action={setOrderStatus} className="flex items-center gap-2">
                            <Hidden values={{ id: o.id, back }} />
                            <select name="status" defaultValue={o.status} aria-label="New status" className={`${inputSm} w-[124px] capitalize`}>{statuses.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                            <Btn small>Save</Btn>
                          </form>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {list.length === 0 && <Empty>No orders match.</Empty>}
        </Panel>
      </Content>
    </>
  );
}
