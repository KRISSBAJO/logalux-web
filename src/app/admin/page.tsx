import Link from "next/link";
import { Content, Flash, Kpi, Panel, Tabs, Topbar, ago, fmtMoney, statusPill } from "@/components/admin-ui";
import { load, type Row } from "@/lib/admin-api";

export default async function Overview({ searchParams }: { searchParams: Promise<{ market?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const market = sp.market ?? "";
  const [o, h] = await Promise.all([load(`/overview?market=${market}`), load("/health")]);
  const k: Row = o.data.kpis ?? {};
  const days: Row[] = o.data.days ?? [];
  const checks: Row[] = h.data.checks ?? [];
  const max = Math.max(1, ...days.map((d) => d.completed + d.bad));
  const worst = checks.some((c) => c.state === "down") ? "down" : checks.some((c) => c.state === "warn") ? "warn" : "ok";
  const currency = market === "NG" ? "NGN" : "USD";

  const queue: [string, number, string, string][] = [
    ["/admin/verification", k.verification_queue, "Verification requests", `${k.verification_at_risk ?? 0} close to the 24 h target`],
    ["/admin/moderation", k.moderation_queue, "Reviews flagged", "Caught by rules or the model"],
    ["/admin/disputes", k.open_disputes, "Open disputes", `${k.overdue_disputes ?? 0} past the business window`],
    ["/admin/support", k.open_tickets, "Support messages", "From the help page, waiting for a reply"],
    ["/admin/payouts?status=failed", k.payout_failures, "Payout failures", "Bank rejected the transfer"],
  ];

  return (
    <>
      <Topbar title="Overview" sub={`Payments run in ${o.data.payments_mode ?? "unknown"} mode · ${h.data.env ?? ""}`}>
        <Tabs items={[["", "All markets"], ["US", "United States"], ["NG", "Nigeria"]]} current={market} href={(m) => `/admin${m ? `?market=${m}` : ""}`} />
      </Topbar>
      <Content>
        <Flash sp={sp} error={o.error} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Kpi label="Bookings today" value={k.bookings_today ?? 0} href="/admin/bookings" />
          <Kpi label="Processed today" value={fmtMoney(k.processed_today_cents, currency)} sub={market ? undefined : "all currencies, face value"} href="/admin/payouts" />
          <Kpi label="Payment success" value={`${k.payment_success_pct ?? 0}%`} sub="target 97%" tone={(k.payment_success_pct ?? 0) >= 97 ? "ok" : "bad"} />
          <Kpi label="Live businesses" value={k.live_businesses ?? 0} sub={`+${k.new_businesses_week ?? 0} this week`} tone="ok" href="/admin/businesses" />
          <Kpi label="Verification queue" value={k.verification_queue ?? 0} sub={`${k.verification_at_risk ?? 0} at risk`} tone={k.verification_at_risk ? "bad" : "ok"} href="/admin/verification" />
          <Kpi label="Open disputes" value={k.open_disputes ?? 0} sub={`${k.overdue_disputes ?? 0} overdue`} tone={k.overdue_disputes ? "bad" : "ok"} href="/admin/disputes" />
        </div>

        <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
          <Panel title="Bookings, last 14 days" sub="Completed against no-shows" action={<div className="flex gap-3.5 text-[12px] text-muted"><span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-ink align-middle" />Completed</span><span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-rose align-middle" />No-show</span></div>}>
            <div className="grid h-[180px] items-end gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(1, days.length)}, minmax(0,1fr))` }}>
              {days.map((d) => (
                <div key={d.day} className="flex h-full flex-col items-center justify-end gap-1" title={`${d.completed} completed, ${d.bad} no-show`}>
                  {d.bad > 0 && <i className="block w-full rounded-sm bg-rose" style={{ height: `${(d.bad / max) * 140}px` }} />}
                  <i className="block w-full rounded-t-md bg-ink" style={{ height: `${Math.max(2, (d.completed / max) * 140)}px` }} />
                  <span className="text-[10px] font-semibold text-muted">{new Date(d.day).toLocaleDateString("en-US", { weekday: "narrow", timeZone: "UTC" })}</span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Needs a human">
            <div className="flex flex-col gap-2">
              {queue.map(([href, n, title, sub]) => (
                <Link key={href} href={href} className="flex items-center gap-3 rounded-[14px] border border-line bg-white px-3.5 py-3 transition hover:border-ink">
                  <span className={`min-w-[36px] text-right text-[22px] font-semibold ${n ? "text-ink" : "text-muted-2"}`}>{n ?? 0}</span>
                  <span className="flex-1"><b className="block text-[14px] font-semibold">{title}</b><span className="text-[12.5px] text-muted">{sub}</span></span>
                </Link>
              ))}
            </div>
          </Panel>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="System health" action={statusPill(h.error ? "down" : worst)}>
            {h.error ? <p className="text-[14px] text-bad">{h.error}</p> : (
              <div className="divide-y divide-line-2">
                {checks.map((c) => (
                  <div key={c.name} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <i className={`block h-2 w-2 flex-none rounded-full ${c.state === "ok" ? "bg-ok" : c.state === "warn" ? "bg-gold" : "bg-bad"}`} />
                    <span className="flex-1"><b className="block text-[14px] font-semibold">{c.name}</b><span className="text-[12.5px] text-muted">{c.detail}</span></span>
                    <span className="text-[13px] font-medium text-muted">{c.value}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Recent activity" action={<Link href="/admin/audit" className="text-[13px] font-semibold text-wine">Open the audit log</Link>}>
            <div className="divide-y divide-line-2 text-[13.5px]">
              {(o.data.activity ?? []).map((a: Row, i: number) => (
                <div key={i} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
                  <time className="w-[76px] flex-none text-[12px] text-muted-2">{ago(a.created_at)}</time>
                  <span className="min-w-0 break-words"><b className="font-semibold">{a.action}</b> <span className="text-muted">by {a.actor}</span></span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </Content>
    </>
  );
}
