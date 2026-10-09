import { AdminPagination } from "@/components/admin-pagination";
import Link from "next/link";
import { ExportLink } from "@/components/export-link";
import { Btn, Content, Empty, Field, FilterSearch, Flash, Hidden, Panel, Pill, ReadOnly, Tabs, Topbar, ago, fmtDate, fmtMoney, inputCls } from "@/components/admin-ui";
import { can, getAdmin, load, qs, type Row } from "@/lib/admin-api";
import { blockClient } from "../actions";

export default async function Clients({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const pageParams = sp as Record<string,string|undefined>;
  const paging = {page:pageParams.page,per_page:pageParams.per_page,sort:pageParams.sort,direction:pageParams.direction};
  const { q = "", filter = "" } = sp;
  const [admin, res] = await Promise.all([getAdmin(), load(`/clients${qs({ ...paging, q, filter })}`)]);
  const list: Row[] = res.data.clients ?? [];
  const blocked: Row[] = res.data.blocked ?? [];
  const back = `/admin/clients${qs({ q, filter })}`;
  const ops = can(admin, "ops");

  return (
    <>
      <Topbar title="Clients" sub="A blocked phone number cannot book with any business">
        <Tabs items={[["", "All"], ["no_show", "Has no-shows"], ["blocked", "Blocked"]]} current={filter} href={(f) => `/admin/clients${qs({ q, filter: f })}`} />
        <ExportLink kind="clients" filters={{ q }} />
      </Topbar>
      <Content>
        <Flash sp={sp} error={res.error} />
        <FilterSearch action="/admin/clients" q={q} placeholder="Name, phone or business" keep={{ filter }} />
        <div className="grid items-start gap-5 xl:grid-cols-[1fr_360px]">
          <Panel flush>
            <table className="data min-w-[760px]">
              <thead><tr><th>Client</th><th>Business</th><th>Bookings</th><th>Spent</th><th>No-shows</th><th>Last booking</th><th /></tr></thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id} className="hover:bg-cream">
                    <td><b className="block font-semibold">{c.name}</b><span className="text-[12px] text-muted">{c.phone || "no phone"}</span></td>
                    <td><Link href={`/admin/businesses/${c.business_id}`} className="font-medium hover:text-wine">{c.business}</Link></td>
                    <td>{c.bookings}</td>
                    <td className="font-semibold">{fmtMoney(c.spent_cents, c.currency)}</td>
                    <td>{c.no_show_count > 0 ? <Pill kind="wine">{c.no_show_count}</Pill> : <span className="text-muted-2">0</span>}</td>
                    <td>{fmtDate(c.last_booking)}</td>
                    <td>
                      {c.blocked && !ops && <Pill kind="wine">blocked</Pill>}
                      {ops && c.phone && (
                        <form action={blockClient}>
                          <Hidden values={{ phone: c.phone, blocked: c.blocked ? "0" : "1", note: c.blocked ? "" : "Blocked from the client list", back }} />
                          {c.blocked ? <Btn small kind="ok">Unblock</Btn> : <Btn small kind="danger">Block</Btn>}
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.length === 0 && <Empty>No clients match.</Empty>}
          </Panel>

          <div className="flex flex-col gap-5">
            <Panel title="Block a number">
              {ops ? (
                <form action={blockClient} className="flex flex-col gap-2.5">
                  <Hidden values={{ blocked: "1", back }} />
                  <Field label="Phone, with country code"><input name="phone" required placeholder="+16155550100" className={inputCls} /></Field>
                  <Field label="Reason"><input name="note" required className={inputCls} /></Field>
                  <div><Btn kind="danger" small>Block number</Btn></div>
                </form>
              ) : <ReadOnly need="ops" />}
            </Panel>
            <Panel title={`Blocked numbers · ${blocked.length}`}>
              <div className="divide-y divide-line-2 text-[13.5px]">
                {blocked.map((b) => (
                  <div key={b.phone} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="min-w-0 flex-1"><b className="block font-semibold">{b.phone}</b><span className="block text-[12px] text-muted">{b.reason || "no reason"} · {b.blocked_by} · {ago(b.created_at)}</span></span>
                    {ops && <form action={blockClient}><Hidden values={{ phone: b.phone, blocked: "0", back }} /><Btn small>Unblock</Btn></form>}
                  </div>
                ))}
                {blocked.length === 0 && <p className="text-muted">No numbers are blocked.</p>}
              </div>
            </Panel>
          </div>
        </div>
      <AdminPagination pagination={res.data.pagination} columns={["name","business","spent_cents","bookings","created_at"]} />
      </Content>
    </>
  );
}
