import Link from "next/link";
import { ExportLink } from "@/components/export-link";
import { Content, Empty, FilterSearch, Flash, Panel, Pill, Tabs, Topbar, fmtMoney, initials, statusPill } from "@/components/admin-ui";
import { Avatar } from "@/components/icons";
import { load, qs, type Row } from "@/lib/admin-api";

export default async function Businesses({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; market?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const { q = "", status = "", market = "" } = sp;
  const res = await load(`/businesses${qs({ q, status, market })}`);
  const list: Row[] = res.data.businesses ?? [];

  return (
    <>
      <Topbar title="Businesses" sub={`${list.length} shown, ordered by money processed in the last 30 days`}>
        <Tabs items={[["", "All"], ["live", "Live"], ["pending", "Pending"], ["paused", "Paused"], ["suspended", "Suspended"]]} current={status} href={(s) => `/admin/businesses${qs({ q, market, status: s })}`} />
        <ExportLink kind="businesses" filters={{ q, status, market }} />
        <Link href="/admin/businesses/new" className="inline-flex h-10 items-center rounded-full bg-ink px-4 text-[13.5px] font-semibold text-cream hover:bg-ink-3">Add a business</Link>
      </Topbar>
      <Content>
        <Flash sp={sp} error={res.error} />
        <div className="flex flex-wrap items-center gap-3">
          <FilterSearch action="/admin/businesses" q={q} placeholder="Name, owner or link" keep={{ status, market }} />
          <Tabs items={[["", "All markets"], ["US", "US"], ["NG", "Nigeria"]]} current={market} href={(m) => `/admin/businesses${qs({ q, status, market: m })}`} />
        </div>
        <Panel flush>
          <table className="data min-w-[900px]">
            <thead><tr><th>Business</th><th>Status</th><th>Plan</th><th>Team</th><th>Bookings 30 d</th><th>Processed 30 d</th><th>Rating</th><th>Attention</th></tr></thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.id} className="hover:bg-cream">
                  <td>
                    <Link href={`/admin/businesses/${b.id}`} className="flex items-center gap-3">
                      <Avatar initials={initials(b.name)} tone={b.tone} />
                      <span className="min-w-0"><b className="block font-semibold">{b.name}</b><span className="text-[12px] capitalize text-muted">{b.owner_name} · {b.category} · {b.market}</span></span>
                    </Link>
                  </td>
                  <td><div className="flex flex-col items-start gap-1">{statusPill(b.status)}{b.verification_status !== "verified" && statusPill(b.verification_status)}</div></td>
                  <td className="capitalize">{b.plan}</td>
                  <td>{b.staff_count}</td>
                  <td>{b.bookings_30d}</td>
                  <td className="font-semibold">{fmtMoney(b.processed_30d_cents, b.currency)}</td>
                  <td>{Number(b.rating).toFixed(1)} <span className="text-muted">({b.review_count})</span></td>
                  <td><div className="flex flex-wrap gap-1">{b.open_disputes > 0 && <Pill kind="wine">{b.open_disputes} dispute{b.open_disputes > 1 ? "s" : ""}</Pill>}{b.flagged_reviews > 0 && <Pill kind="gold">{b.flagged_reviews} flagged</Pill>}{!b.open_disputes && !b.flagged_reviews && <span className="text-muted-2">—</span>}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <Empty>No businesses match.</Empty>}
        </Panel>
      </Content>
    </>
  );
}
