import Link from "next/link";
import type { ReactNode } from "react";
import { DataTable } from "@/components/data-table";
import { Empty, Flash, Ic, LoadError, NoAccess, Topbar } from "@/components/merchant-ui";
import { getMe, mLoad, qs, type Row } from "@/lib/merchant-api";
import { dateOnly, firstName, money, pct, plural } from "@/lib/merchant-format";
import "../../css/reports.css";

export const metadata = { title: "Reports" };

const RANGES = [["7d", "7 days"], ["30d", "30 days"], ["90d", "90 days"], ["month", "This month"]] as const;
const SOURCE: Record<string, string> = {
  web: "Your booking page", link: "Your booking link", rebook: "Rebook and reminders", search: "LogaLuxe search",
  walk_in: "Walk-in", phone: "Phone", whatsapp: "WhatsApp", instagram: "Instagram", staff: "Added by the team",
};
const TONES = ["#7A1F2B", "#D4AF5A", "#1A1513", "#C9BCB4", "#8C6A3F", "#4A5A52", "#B98A92", "#E6DCD2"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1).replace(/_/g, " ") : s);
/** A rate in percent with one decimal, or null when there is nothing to divide by. */
const rate = (some: number, whole: number) => (whole > 0 ? Math.round((some / whole) * 1000) / 10 : null);
const dayMonth = (v: string) => dateOnly(v).split(" ").slice(1).join(" ");

type Delta = { text: string; cls: "up" | "down" | "flat" };
/** The line under a figure: how it moved, coloured by whether the move is good news. */
function delta(diff: number | null, text: (abs: string, sign: string) => string, fmt: (n: number) => string, goodWhenUp = true): Delta {
  if (diff === null) return { text: "Nothing to compare with yet", cls: "flat" };
  if (diff === 0) return { text: "Same as the period before", cls: "flat" };
  const up = diff > 0;
  return { text: text(fmt(Math.abs(diff)), up ? "+" : "−"), cls: up === goodWhenUp ? "up" : "down" };
}

export default async function Reports({ searchParams }: { searchParams: Promise<{ range?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const me = (await getMe())!;
  const { merchant: m } = me;
  const cur = m.currency;
  const range = RANGES.some(([id]) => id === sp.range) ? sp.range! : "30d";

  const { data: d, error, status } = await mLoad("/reports" + qs({ range }));
  if (status === 403) return <div className="main pg-reports"><NoAccess title="Reports" need="manager" /></div>;
  if (error) return <div className="main pg-reports"><LoadError title="Reports" error={error} /></div>;
  const pay = await mLoad("/payroll" + qs({ from: d.from, to: d.to }));
  const payroll = (pay.data.payroll ?? []) as Row[];

  const now = d.now as Row, was = d.before as Row, mix = d.mix as Row;
  const byDay = (d.by_day ?? []) as Row[], sources = (d.sources ?? []) as Row[], staff = (d.staff ?? []) as Row[], heat = (d.heat ?? []) as Row[], top = (d.top_services ?? []) as Row[];
  const openMin = Number(d.open_min ?? 0);

  // The six figures, each against the period before.
  const avgNow = now.sales > 0 ? Math.round(now.revenue_cents / now.sales) : null, avgWas = was.sales > 0 ? Math.round(was.revenue_cents / was.sales) : null;
  const rbNow = rate(now.rebooked, now.visitors), rbWas = rate(was.rebooked, was.visitors);
  const nsNow = rate(now.no_shows, now.bookings), nsWas = rate(was.no_shows, was.bookings);
  const pts = (n: number) => `${Math.round(n * 10) / 10} pts`;
  const kpis: { name: string; value: string; d: Delta }[] = [
    { name: "Revenue", value: money(now.revenue_cents, cur), d: was.revenue_cents > 0 ? delta(Math.round(((now.revenue_cents - was.revenue_cents) / was.revenue_cents) * 100), (a, s) => `${s}${a} vs the period before`, (n) => `${n}%`) : delta(null, () => "", String) },
    { name: "Bookings", value: String(now.bookings), d: was.bookings > 0 || now.bookings > 0 ? delta(now.bookings - was.bookings, (a, s) => `${s}${a} vs the period before`, String) : delta(null, () => "", String) },
    { name: "Average ticket", value: avgNow === null ? "—" : money(avgNow, cur), d: delta(avgNow !== null && avgWas !== null ? avgNow - avgWas : null, (a, s) => `${s}${a} per sale`, (n) => money(n, cur)) },
    { name: "Rebook rate", value: rbNow === null ? "—" : `${Math.round(rbNow)}%`, d: delta(rbNow !== null && rbWas !== null ? Math.round((rbNow - rbWas) * 10) / 10 : null, (a, s) => `${s}${a}`, pts) },
    { name: "No-show rate", value: nsNow === null ? "—" : `${nsNow}%`, d: delta(nsNow !== null && nsWas !== null ? Math.round((nsNow - nsWas) * 10) / 10 : null, (a, s) => `${s}${a}`, pts, false) },
    { name: "New clients", value: String(now.new_clients), d: was.new_clients > 0 || now.new_clients > 0 ? delta(now.new_clients - was.new_clients, (a, s) => `${s}${a} vs the period before`, String) : delta(null, () => "", String) },
  ];

  // Revenue bars. Up to a month is drawn day by day; 90 days is added up by week.
  type Bar = { key: string; label: string; title: string; rev: number; tips: number; prev: number };
  const weekly = byDay.length > 45;
  const bars: Bar[] = [];
  if (weekly) {
    const lead = byDay.length % 7; // a short first group, so the last one ends today
    for (let i = 0; i < byDay.length; i += i === 0 && lead ? lead : 7) {
      const chunk = byDay.slice(i, i + (i === 0 && lead ? lead : 7));
      const sum = (k: string) => chunk.reduce((a, x) => a + Number(x[k] ?? 0), 0);
      const first = String(chunk[0].day), last = String(chunk[chunk.length - 1].day);
      bars.push({ key: first, label: dayMonth(first), title: `${dateOnly(first)} to ${dateOnly(last)}`, rev: sum("revenue_cents"), tips: sum("tips_cents"), prev: sum("previous_cents") });
    }
  } else {
    byDay.forEach((x, i) => {
      const day = String(x.day), every = byDay.length <= 10 ? 1 : 5;
      const label = byDay.length <= 10 ? dateOnly(day).split(" ")[0] : (byDay.length - 1 - i) % every === 0 ? dayMonth(day) : "";
      bars.push({ key: day, label, title: dateOnly(day), rev: x.revenue_cents, tips: x.tips_cents, prev: x.previous_cents });
    });
  }
  const peak = Math.max(1, ...bars.map((b) => Math.max(b.rev + b.tips, b.prev)));
  const h = (n: number) => `${Math.max(0, Math.min(100, (n / peak) * 100))}%`;
  const anyRevenue = bars.some((b) => b.rev + b.tips + b.prev > 0);

  // Where bookings come from, as one ring.
  const srcTotal = sources.reduce((a, s) => a + Number(s.n), 0);
  let at = 0;
  const ring = srcTotal > 0
    ? `conic-gradient(${sources.map((s, i) => { const from = at; at += (Number(s.n) / srcTotal) * 100; return `${TONES[i % TONES.length]} ${from.toFixed(2)}% ${at.toFixed(2)}%`; }).join(",")})`
    : "#EFE5DA";

  // Busy hours: bookings that start in each two-hour band of each weekday.
  const hours = heat.map((x) => Number(x.hour));
  const bands: number[] = [];
  if (hours.length) for (let hr = Math.min(...hours); hr <= Math.max(...hours); hr += 2) bands.push(hr);
  const heatMax = Math.max(1, ...heat.map((x) => Number(x.n)));
  const cell = (dow: number, hour: number) => Number(heat.find((x) => x.dow === dow && x.hour === hour)?.n ?? 0);
  const perDay = DAYS.map((_, i) => heat.filter((x) => x.dow === i + 1).reduce((a, x) => a + Number(x.n), 0));
  const heatTotal = perDay.reduce((a, n) => a + n, 0);

  const topPeak = Math.max(1, ...top.map((s) => Number(s.revenue_cents)));

  // A few plain sentences, each worked out from the numbers on this page.
  const notes: ReactNode[] = [];
  if (heatTotal > 0) {
    const busiest = perDay.indexOf(Math.max(...perDay));
    notes.push(`${DAYS[busiest]} is your busiest day: ${perDay[busiest]} of ${plural(heatTotal, "booking")}, ${pct(perDay[busiest], heatTotal)}% of the total.`);
    const worked = perDay.map((n, i) => ({ n, i })).filter((x) => x.n > 0);
    const quiet = worked.reduce((a, x) => (x.n < a.n ? x : a), worked[0]);
    if (heatTotal >= 10 && quiet.i !== busiest && quiet.n * 2 <= perDay[busiest]) notes.push(<>{DAYS[quiet.i]} is the quietest day you work, with {plural(quiet.n, "booking")}. <Link href="/business/marketing">An offer in Marketing</Link> could fill it.</>);
  }
  if (nsNow !== null && nsWas !== null && nsNow !== nsWas) notes.push(`No-shows ${nsNow < nsWas ? "fell" : "rose"} to ${nsNow}% of bookings, from ${nsWas}% in the period before.`);
  else if (nsNow !== null && now.no_shows === 0 && now.bookings > 0) notes.push("No one missed a booking in this period.");
  const rated = staff.filter((p) => p.visitors >= 5).map((p) => ({ name: firstName(p.name), r: Math.round((p.rebooked / p.visitors) * 100) })).sort((a, b) => b.r - a.r);
  if (rated.length >= 2 && rated[0].r - rated[rated.length - 1].r >= 10) {
    const low = rated[rated.length - 1];
    notes.push(`${low.name} has a rebook rate of ${low.r}%, ${rated[0].r - low.r} points below ${rated[0].name} at ${rated[0].r}%. A rebook prompt at checkout helps.`);
  }
  if (top[0]) notes.push(`${top[0].name} is your top earner: ${money(top[0].revenue_cents, cur)} from ${top[0].sold} sold.`);
  if (openMin > 0 && staff.length && now.bookings > 0) {
    const booked = staff.reduce((a, p) => a + Number(p.booked_min), 0);
    notes.push(`Your team was booked for ${pct(booked, openMin * staff.length)}% of the hours you were open.`);
  }

  const owed = (p: Row) => Number(p.service_commission_cents) + Number(p.retail_commission_cents) + Number(p.tips_cents);
  const total = (k: string) => payroll.reduce((a, p) => a + Number(p[k] ?? 0), 0);

  return (
    <div className="main pg-reports">
      <Topbar title="Reports">
        <nav className="seg" aria-label="Period">
          {RANGES.map(([id, name]) => <Link key={id} href={"/business/reports" + qs({ range: id === "30d" ? undefined : id })} className={range === id ? "on" : ""} aria-current={range === id ? "page" : undefined}>{name}</Link>)}
        </nav>
        <span className="muted" style={{ fontSize: 13 }}>{d.range} · {dateOnly(d.from)} to {dateOnly(d.to)} · compared with the period before</span>
        <span style={{ flex: 1 }} />
        <a href={"/business/reports/export" + qs({ range })} className="btn btn-out" download title="One row per sale in this period"><Ic name="download" size={16} />Export CSV</a>
      </Topbar>

      <div className="content">
        <Flash sp={sp} />
        <div className="kpis">
          {kpis.map((k) => <div key={k.name} className="kpi"><small>{k.name}</small><b>{k.value}</b><span className={k.d.cls}>{k.d.text}</span></div>)}
        </div>

        <div className="grid2">
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
              <div><h3>Revenue by {weekly ? "week" : "day"}</h3><div className="sub">Sales in ink, tips in gold, the period before in grey</div></div>
              <div className="legend"><span><i style={{ background: "#1A1513" }} />Sales</span><span><i style={{ background: "#D4AF5A" }} />Tips</span><span><i style={{ background: "#E6DCD2" }} />Previous</span></div>
            </div>
            {anyRevenue ? (
              <div className="bars" style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))`, gap: bars.length > 16 ? 3 : 6 }} role="img" aria-label={`Revenue by ${weekly ? "week" : "day"}: ${money(now.revenue_cents, cur)} in sales and ${money(now.tips_cents, cur)} in tips, against ${money(was.revenue_cents, cur)} in the period before.`}>
                {bars.map((b, i) => (
                  <div key={b.key} className={"bar" + (i === bars.length - 1 ? " cur" : "")} title={`${b.title} · ${money(b.rev, cur)} sales · ${money(b.tips, cur)} tips · ${money(b.prev, cur)} before`}>
                    <div className="pair">
                      <div className="now">{b.tips > 0 ? <i className="tip" style={{ height: h(b.tips) }} /> : null}<i style={{ height: h(b.rev) }} /></div>
                      <i className="prev" style={{ height: h(b.prev) }} />
                    </div>
                    <span>{b.label || " "}</span>
                  </div>
                ))}
              </div>
            ) : <Empty title="No sales in this period or the one before">Bars appear here once a sale is checked out.</Empty>}
            {anyRevenue ? <div className="sub">{money(now.revenue_cents, cur)} in sales and {money(now.tips_cents, cur)} in tips. The period before: {money(was.revenue_cents, cur)} and {money(was.tips_cents, cur)}.</div> : null}
          </div>

          <div className="card">
            <h3>Where bookings come from</h3>
            {srcTotal > 0 ? (
              <div className="donut">
                <div className="ring" style={{ background: ring }}><i><b>{srcTotal}</b><small>{srcTotal === 1 ? "booking" : "bookings"}</small></i></div>
                <div className="src">
                  {sources.map((s, i) => <div key={s.source} title={plural(s.n, "booking")}><span><em style={{ background: TONES[i % TONES.length] }} />{SOURCE[s.source] ?? cap(String(s.source || "Other"))}</span><b>{pct(s.n, srcTotal)}%</b></div>)}
                </div>
              </div>
            ) : <Empty title="No bookings in this period">Each booking is counted by how it was made.</Empty>}
            <div className="sub">Counted from every booking in the period that was not cancelled or moved.</div>
          </div>
        </div>

        <div className="grid3">
          <div className="card" style={{ gridColumn: "span 2" }}>
            <h3>Staff performance</h3>
            {staff.length ? (
              <DataTable id="staff" search="Search the team" pageSize={10} noun="team member" sort={{ col: "Revenue", dir: "desc" }}>
                <table>
                  <thead><tr><th>Staff</th><th>Revenue</th><th>Bookings</th><th>Booked</th><th>Per booking</th><th>Tips</th><th>Rebook</th><th>Rating</th></tr></thead>
                  <tbody>
                    {staff.map((p) => (
                      <tr key={p.id}>
                        <td><b>{p.name}</b></td>
                        <td data-sort={p.revenue_cents}><b>{money(p.revenue_cents, cur)}</b></td>
                        <td data-sort={p.bookings}>{p.bookings}</td>
                        <td data-sort={p.booked_min}>{openMin > 0 ? `${pct(p.booked_min, openMin)}%` : "—"}</td>
                        <td data-sort={p.bookings > 0 ? Math.round(p.revenue_cents / p.bookings) : 0}>{p.bookings > 0 ? money(Math.round(p.revenue_cents / p.bookings), cur) : "—"}</td>
                        <td data-sort={p.tips_cents}>{money(p.tips_cents, cur)}</td>
                        <td data-sort={p.visitors > 0 ? pct(p.rebooked, p.visitors) : -1}>{p.visitors > 0 ? `${pct(p.rebooked, p.visitors)}%` : "—"}</td>
                        <td data-sort={Number(p.rating ?? 0)}>{p.rating > 0 ? Number(p.rating).toFixed(1) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTable>
            ) : <Empty title="No team members yet">Add your team in Staff to compare them here.</Empty>}
            <div className="sub">Booked is time in the chair against the hours the business was open. Rebook is the share of clients seen who have a later booking.</div>
          </div>

          <div className="card">
            <h3>Busy hours</h3>
            <div className="sub">Bookings by the time they start. Darker is busier.</div>
            {bands.length ? (
              <div className="heat">
                <div />{DAYS.map((day) => <div key={day} className="h" title={day}>{day[0]}</div>)}
                {bands.map((hr) => [
                  <div key={`r${hr}`} className="r">{hr} to {hr + 2}</div>,
                  ...DAYS.map((day, i) => { const n = cell(i + 1, hr); return <div key={`${hr}-${i}`} className="c" style={{ opacity: n ? Math.max(0.15, n / heatMax) : 0.05 }} title={`${day}, ${hr}:00 to ${hr + 2}:00 · ${plural(n, "booking")}`} />; }),
                ])}
              </div>
            ) : <Empty title="No bookings in this period" />}
          </div>
        </div>

        <div className="grid3">
          <div className="card">
            <h3>Top services</h3>
            {top.length ? (
              <div className="hbar">
                {top.map((s) => <div key={s.name} className="hrow money" title={`${s.name} · ${s.sold} sold`}><span>{s.name}</span><div className="t"><i style={{ width: `${pct(s.revenue_cents, topPeak)}%` }} /></div><b>{money(s.revenue_cents, cur)}</b></div>)}
              </div>
            ) : <Empty title="No services sold in this period" />}
          </div>

          <div className="card">
            <h3>Clients</h3>
            {mix.visits > 0 ? (
              <div className="hbar">
                <div className="hrow"><span>Returning</span><div className="t"><i style={{ width: `${pct(mix.returning_visits, mix.visits)}%`, background: "#1A1513" }} /></div><b>{pct(mix.returning_visits, mix.visits)}%</b></div>
                <div className="hrow"><span>New</span><div className="t"><i style={{ width: `${pct(mix.new_visits, mix.visits)}%`, background: "#D4AF5A" }} /></div><b>{pct(mix.new_visits, mix.visits)}%</b></div>
                <div className="hrow"><span>Paid deposit</span><div className="t"><i style={{ width: `${pct(mix.with_deposit, mix.visits)}%` }} /></div><b>{pct(mix.with_deposit, mix.visits)}%</b></div>
                <div className="hrow"><span>Left a review</span><div className="t"><i style={{ width: `${Math.min(100, pct(mix.reviews, mix.visits))}%` }} /></div><b>{Math.min(100, pct(mix.reviews, mix.visits))}%</b></div>
              </div>
            ) : <Empty title="No finished visits in this period" />}
            <div className="sub">
              {mix.visits > 0 ? `Out of ${plural(mix.visits, "finished visit")}. ` : ""}
              {mix.sales > 0 ? `Retail in ${pct(mix.sales_with_retail, mix.sales)}% of sales · average tip ${mix.sold_cents > 0 ? `${pct(mix.tips_cents, mix.sold_cents)}%` : "—"}` : ""}
            </div>
          </div>

          <div className="ai">
            <Ic name="spark" size={22} color="#D4AF5A" />
            <div style={{ flex: 1 }}><b style={{ fontSize: 14 }}>{d.range} in plain words</b>
              <ul>
                {notes.length ? notes.map((n, i) => <li key={i}>{n}</li>) : <li>Nothing to report yet. This fills in with your first bookings and sales.</li>}
              </ul>
            </div>
          </div>
        </div>

        {!pay.error ? (
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
              <div><h3>Payroll and commission</h3><div className="sub">What each person earned from {dateOnly(pay.data.from ?? d.from)} to {dateOnly(d.to)}. Refunded sales are left out.</div></div>
              <a href={"/business/reports/payroll" + qs({ from: d.from, to: d.to })} className="btn btn-out btn-sm" download><Ic name="download" size={15} />Payroll CSV</a>
            </div>
            {payroll.length ? (
              <DataTable id="payroll" search="Search payroll" pageSize={10} noun="team member" sort={{ col: "Staff", dir: "asc" }}>
                <table>
                  <thead><tr><th>Staff</th><th className="r">Sales</th><th className="r">Services</th><th className="r">Commission</th><th className="r">Retail</th><th className="r">Retail commission</th><th className="r">Tips</th><th className="r">Owed</th></tr></thead>
                  <tbody>
                    {payroll.map((p) => (
                      <tr key={p.id}>
                        <td><b>{p.name}</b></td>
                        <td data-sort={p.sales} className="r">{p.sales}</td>
                        <td data-sort={p.service_cents} className="r">{money(p.service_cents, cur)}</td>
                        <td data-sort={p.service_commission_cents} className="r">{money(p.service_commission_cents, cur)} <span className="muted">· {p.commission_pct}%</span></td>
                        <td data-sort={p.retail_cents} className="r">{money(p.retail_cents, cur)}</td>
                        <td data-sort={p.retail_commission_cents} className="r">{money(p.retail_commission_cents, cur)} <span className="muted">· {p.retail_commission_pct}%</span></td>
                        <td data-sort={p.tips_cents} className="r">{money(p.tips_cents, cur)}</td>
                        <td data-sort={owed(p)} className="r"><b>{money(owed(p), cur)}</b></td>
                      </tr>
                    ))}
                  </tbody>
                  {payroll.length > 1 ? (
                    <tfoot>
                      <tr>
                        <td>Total</td>
                        <td className="r">{total("sales")}</td>
                        <td className="r">{money(total("service_cents"), cur)}</td>
                        <td className="r">{money(total("service_commission_cents"), cur)}</td>
                        <td className="r">{money(total("retail_cents"), cur)}</td>
                        <td className="r">{money(total("retail_commission_cents"), cur)}</td>
                        <td className="r">{money(total("tips_cents"), cur)}</td>
                        <td className="r">{money(payroll.reduce((a, p) => a + owed(p), 0), cur)}</td>
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
              </DataTable>
            ) : <Empty title="No team members yet" />}
            <div className="sub">Owed is commission on services and retail plus tips. Rates are set for each person in <Link href="/business/staff">Staff</Link>.</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
