import Link from "next/link";
import type { ReactNode } from "react";
import { Content, Empty, Flash, Panel, Topbar, fmtDate, fmtMoney, statusPill } from "@/components/admin-ui";
import { load, type Row } from "@/lib/admin-api";

function Group({ title, rows, render }: { title: string; rows: Row[]; render: (r: Row) => { href: string; main: ReactNode; sub: ReactNode; status?: string } }) {
  if (rows.length === 0) return null;
  return (
    <Panel title={`${title} · ${rows.length}`} flush>
      {rows.map((r) => {
        const v = render(r);
        return (
          <Link key={r.id} href={v.href} className="flex items-center gap-3 border-b border-line-2 px-5 py-3 last:border-0 hover:bg-cream">
            <span className="min-w-0 flex-1"><b className="block truncate text-[14px] font-semibold">{v.main}</b><span className="block truncate text-[12.5px] text-muted">{v.sub}</span></span>
            {v.status && statusPill(v.status)}
          </Link>
        );
      })}
    </Panel>
  );
}

const groups = ["businesses", "bookings", "clients", "disputes", "orders", "payments", "tickets", "gift_cards"];
const short = (id: string) => String(id).slice(0, 8);

export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim();
  const res = q.length >= 2 ? await load(`/search?q=${encodeURIComponent(q)}`) : { data: {} as Row, error: "" };
  const d = res.data;
  const total = groups.reduce((n, k) => n + (d[k]?.length ?? 0), 0);

  return (
    <>
      <Topbar title="Search" sub={q ? `Results for “${q}”` : "Businesses, bookings, clients, disputes, orders, payments, support tickets and gift cards"} />
      <Content>
        <Flash sp={{}} error={res.error} />
        {q.length < 2 && <Panel><Empty>Type at least two characters: a name, an email address, a phone number, a payment or dispute reference, a support ticket number, a gift card code, or the start of a booking or order ID.</Empty></Panel>}
        {q.length >= 2 && total === 0 && !res.error && <Panel><Empty>Nothing matches “{q}”.</Empty></Panel>}
        <Group title="Businesses" rows={d.businesses ?? []} render={(r) => ({ href: `/admin/businesses/${r.id}`, main: r.name, sub: `${r.owner_name} · ${r.market} · @${r.slug}${r.email ? ` · ${r.email}` : ""}`, status: r.status })} />
        <Group title="Bookings" rows={d.bookings ?? []} render={(r) => ({ href: `/admin/bookings?q=${encodeURIComponent(short(r.id))}`, main: r.client_name, sub: `${r.business} · ${fmtDate(r.starts_at)}`, status: r.status })} />
        <Group title="Clients" rows={d.clients ?? []} render={(r) => ({ href: `/admin/clients?q=${encodeURIComponent(r.phone || r.email || r.name)}`, main: r.name, sub: [r.phone, r.email, r.business].filter(Boolean).join(" · ") })} />
        <Group title="Disputes" rows={d.disputes ?? []} render={(r) => ({ href: `/admin/disputes?id=${r.id}`, main: `${r.ref} · ${r.client_name}`, sub: r.business, status: r.status })} />
        <Group title="Orders" rows={d.orders ?? []} render={(r) => ({ href: `/admin/orders?q=${encodeURIComponent(short(r.id))}`, main: r.customer_name, sub: `${fmtMoney(r.total_cents, r.currency)} · ${fmtDate(r.created_at)}${r.customer_email ? ` · ${r.customer_email}` : ""}`, status: r.status })} />
        <Group title="Payments" rows={d.payments ?? []} render={(r) => ({ href: r.booking_id ? `/admin/bookings?q=${encodeURIComponent(short(r.booking_id))}` : r.order_id ? `/admin/orders?q=${encodeURIComponent(short(r.order_id))}` : "/admin/payouts", main: r.reference, sub: `${r.provider} · ${r.kind} · ${fmtMoney(r.amount_cents, r.currency)} · ${fmtDate(r.created_at)}`, status: r.status })} />
        <Group title="Support tickets" rows={d.tickets ?? []} render={(r) => ({ href: `/admin/support/${r.id}`, main: `${r.ref} · ${r.subject}`, sub: [r.name, r.email].filter(Boolean).join(" · "), status: r.status })} />
        <Group title="Gift cards" rows={d.gift_cards ?? []} render={(r) => ({ href: `/admin/gift-cards?q=${encodeURIComponent(r.recipient_email || String(r.code).replace(/^ending /, ""))}`, main: r.code, sub: `${fmtMoney(r.balance_cents, r.currency)} left${r.recipient_name ? ` · ${r.recipient_name}` : ""}${r.recipient_email ? ` · ${r.recipient_email}` : ""}`, status: r.status })} />
      </Content>
    </>
  );
}
