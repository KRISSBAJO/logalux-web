import Link from "next/link";
import { Btn, Content, Empty, Facts, Field, Flash, Hidden, Kpi, Panel, Pill, ReadOnly, Topbar, ago, fmtDate, fmtMoney, fmtWhen, initials, inputCls, statusPill } from "@/components/admin-ui";
import { Avatar, Stars } from "@/components/icons";
import { MediaManager } from "@/components/media-manager";
import { can, getAdmin, load, type Row } from "@/lib/admin-api";
import { addNote, issueCredit, setBusinessPlan, setBusinessStatus, setPayoutHold } from "../../actions";

const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export default async function BusinessDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [admin, res] = await Promise.all([getAdmin(), load(`/businesses/${encodeURIComponent(id)}`)]);
  const b: Row | undefined = res.data.business;
  const back = `/admin/businesses/${id}`;
  const ops = can(admin, "ops");

  if (!b) {
    return (
      <>
        <Topbar title="Business" />
        <Content><Flash sp={sp} error={res.error || "Business not found."} /><Link href="/admin/businesses" className="text-[14px] font-semibold text-wine">Back to businesses</Link></Content>
      </>
    );
  }
  const d = res.data;
  const photos: Row[] = (await load(`/media?slot=business&ref=${encodeURIComponent(b.slug)}`)).data.media ?? [];
  const cur = b.currency;
  const tz = b.timezone;
  const list = (k: string): Row[] => d[k] ?? [];

  return (
    <>
      <Topbar title={b.name} sub={b.tagline}>
        <Link href="/admin/businesses" className="text-[13px] font-semibold text-muted hover:text-ink">All businesses</Link>
        {ops && <Link href={`/admin/businesses/${id}/edit`} className="inline-flex h-10 items-center rounded-full bg-ink px-4 text-[13.5px] font-semibold text-cream hover:bg-ink-3">Edit profile, hours, services and team</Link>}
        <Link href={`/b/${b.slug}`} className="inline-flex h-10 items-center rounded-full border border-line bg-white px-4 text-[13.5px] font-semibold hover:border-ink">View public page</Link>
      </Topbar>
      <Content>
        <Flash sp={sp} />
        <Panel>
          <div className="mb-4 flex flex-wrap items-center gap-3.5">
            <Avatar initials={initials(b.name)} tone={b.tone} size={52} />
            <div className="mr-auto min-w-0">
              <div className="text-[16px] font-semibold">{b.owner_name}</div>
              <div className="text-[13px] capitalize text-muted">{b.category} · {b.market} · joined {fmtDate(b.created_at)}</div>
            </div>
            {statusPill(b.status)}
            {statusPill(b.verification_status)}
            <Pill kind={b.plan === "pro" ? "info" : "grey"}>{b.plan} plan</Pill>
            {b.payout_hold && <Pill kind="wine">Payouts on hold</Pill>}
          </div>
          <Facts items={[["Phone", b.phone], ["Email", b.email], ["Instagram", b.instagram], ["Booking link", `logaluxe.com/@${b.slug}`], ["Time zone", tz], ["Rating", `${Number(b.rating).toFixed(1)} from ${b.review_count} reviews`]]} />
        </Panel>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Bookings, 30 days" value={d.stats?.bookings_30d ?? 0} />
          <Kpi label="Processed, 30 days" value={fmtMoney(d.stats?.processed_30d_cents, cur)} />
          <Kpi label="Clients" value={d.stats?.clients ?? 0} />
          <Kpi label="No-shows" value={d.stats?.no_shows ?? 0} tone={d.stats?.no_shows ? "bad" : "ok"} />
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[1fr_380px]">
          <div className="flex min-w-0 flex-col gap-5">
            <Panel title={`Photos · ${photos.length}`} sub="Up to 8 show. The first is the cover on search and at the top of the storefront; the next four fill the gallery.">
              <MediaManager slot="business" refKey={b.slug} items={photos} back={back} canEdit={ops} max={8} aspect="aspect-[4/3]" hint="Landscape photos work best for the cover, at least 1,200 pixels wide." />
            </Panel>

            <Panel title="Recent bookings" flush action={<Link href={`/admin/bookings?business=${b.slug}`} className="text-[13px] font-semibold text-wine">See all</Link>}>
              <table className="data min-w-[560px]">
                <thead><tr><th>When</th><th>Client</th><th>With</th><th>Total</th><th>Status</th></tr></thead>
                <tbody>{list("bookings").map((k) => <tr key={k.id}><td>{fmtWhen(k.starts_at, tz)}</td><td className="font-semibold">{k.client_name}</td><td>{k.staff}</td><td>{fmtMoney(k.total_cents, cur)}</td><td>{statusPill(k.status)}</td></tr>)}</tbody>
              </table>
              {list("bookings").length === 0 && <Empty>No bookings yet.</Empty>}
            </Panel>

            <div className="grid gap-5 md:grid-cols-2">
              <Panel title={`Team · ${list("staff").length}`}>
                <div className="flex flex-col gap-3">
                  {list("staff").map((s) => (
                    <div key={s.id} className="flex items-center gap-3">
                      <Avatar initials={s.initials} tone={s.tone} size={32} />
                      <span className="min-w-0 flex-1"><b className="block text-[14px] font-semibold">{s.name}</b><span className="text-[12px] capitalize text-muted">{s.role} · {s.level}</span></span>
                      {!s.bookable && <Pill kind="grey">not bookable</Pill>}
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel title={`Locations · ${list("locations").length}`}>
                {list("locations").map((l, i) => (
                  <div key={i} className="mb-4 last:mb-0">
                    <b className="text-[14px] font-semibold">{l.name}</b>{l.is_primary && <span className="ml-2 text-[12px] text-muted">primary</span>}
                    <div className="text-[13px] text-muted">{l.address}, {l.city}{l.region ? `, ${l.region}` : ""}</div>
                    <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[11px]">
                      {days.map((day) => <div key={day} className={`rounded-md px-0.5 py-1 ${l.hours?.[day] ? "bg-cream-2" : "bg-transparent text-muted-2"}`}><b className="block uppercase">{day.slice(0, 2)}</b>{l.hours?.[day] ? <span className="block leading-tight">{l.hours[day][0]}<br />{l.hours[day][1]}</span> : <span>shut</span>}</div>)}
                    </div>
                  </div>
                ))}
              </Panel>
            </div>

            <Panel title={`Services · ${list("services").length}`} flush>
              <table className="data min-w-[560px]">
                <thead><tr><th>Service</th><th>Category</th><th>Length</th><th>Price</th><th>Deposit</th><th>Online</th></tr></thead>
                <tbody>{list("services").map((s, i) => <tr key={i}><td className="font-semibold">{s.name}</td><td>{s.category}</td><td>{s.duration_min} min</td><td>{fmtMoney(s.price_cents, cur)}</td><td>{s.deposit_cents ? fmtMoney(s.deposit_cents, cur) : "—"}</td><td>{s.online ? "Yes" : "No"}</td></tr>)}</tbody>
              </table>
            </Panel>

            <Panel title="Payouts" flush action={<Link href="/admin/payouts" className="text-[13px] font-semibold text-wine">All payouts</Link>}>
              <table className="data min-w-[520px]">
                <thead><tr><th>Scheduled</th><th>Amount</th><th>Provider</th><th>Status</th><th>Detail</th></tr></thead>
                <tbody>{list("payouts").map((p) => <tr key={p.id}><td>{fmtDate(p.scheduled_for)}</td><td className="font-semibold">{fmtMoney(p.amount_cents, p.currency)}</td><td className="capitalize">{p.provider}</td><td>{statusPill(p.status)}</td><td className="text-muted">{p.failure_reason || p.reference || "—"}</td></tr>)}</tbody>
              </table>
              {list("payouts").length === 0 && <Empty>No payouts yet.</Empty>}
            </Panel>

            <Panel title="Latest reviews">
              <div className="flex flex-col gap-4">
                {list("reviews").map((r) => (
                  <div key={r.id}>
                    <div className="flex flex-wrap items-center gap-2"><Stars rating={r.rating} /><b className="text-[13.5px] font-semibold">{r.author_name}</b><span className="text-[12.5px] text-muted">{ago(r.created_at)}</span>{r.status !== "published" && statusPill(r.status)}</div>
                    <p className="mt-1 text-[14px] leading-relaxed">{r.body}</p>
                  </div>
                ))}
                {list("reviews").length === 0 && <p className="text-[14px] text-muted">No reviews yet.</p>}
              </div>
            </Panel>
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <Panel title="Controls">
              {ops ? (
                <div className="flex flex-col gap-5">
                  <form action={setBusinessStatus} className="flex flex-col gap-2.5">
                    <Hidden values={{ id: b.id, back }} />
                    <Field label="Listing status"><input name="note" placeholder="Reason, sent to the owner" className={inputCls} /></Field>
                    <div className="flex flex-wrap gap-2">
                      {b.status !== "live" && <Btn kind="ok" small name="decision" value="live">Set live</Btn>}
                      {b.status !== "paused" && <Btn small name="decision" value="paused">Pause</Btn>}
                      {b.status !== "suspended" && <Btn kind="danger" small name="decision" value="suspended">Suspend</Btn>}
                    </div>
                  </form>
                  <form action={setBusinessPlan} className="flex items-end gap-2 border-t border-line-2 pt-4">
                    <Hidden values={{ id: b.id, back }} />
                    <Field label="Plan" className="flex-1"><select name="plan" defaultValue={b.plan} className={inputCls}><option value="free">Free</option><option value="pro">Pro</option></select></Field>
                    <Btn>Save plan</Btn>
                  </form>
                  <form action={setPayoutHold} className="flex flex-col gap-2.5 border-t border-line-2 pt-4">
                    <Hidden values={{ id: b.id, back, hold: b.payout_hold ? "0" : "1" }} />
                    <Field label="Payouts">
                      {b.payout_hold
                        ? <p className="rounded-xl bg-bad-bg px-3.5 py-2.5 text-[13px] text-bad">On hold: {b.payout_hold_reason || "no reason given"}</p>
                        : <input name="note" required placeholder="Reason for the hold" className={inputCls} />}
                    </Field>
                    <div>{b.payout_hold ? <Btn kind="ok" small>Release payouts</Btn> : <Btn kind="danger" small>Hold payouts</Btn>}</div>
                  </form>
                </div>
              ) : <ReadOnly need="ops" />}
            </Panel>

            <Panel title="Goodwill credit" sub="Paid by LogaLuxe, not the business">
              {ops && (
                <form action={issueCredit} className="mb-4 flex flex-col gap-2.5">
                  <Hidden values={{ id: b.id, back }} />
                  <div className="grid grid-cols-2 gap-2.5">
                    <Field label={`Amount (${cur})`}><input name="amount" type="number" min="0.01" step="0.01" required className={inputCls} /></Field>
                    <Field label="Client phone"><input name="client_phone" placeholder="+1…" className={inputCls} /></Field>
                  </div>
                  <Field label="Reason"><input name="note" required className={inputCls} /></Field>
                  <div><Btn kind="ink" small>Issue credit</Btn></div>
                </form>
              )}
              <div className="divide-y divide-line-2 text-[13.5px]">
                {list("credits").map((c) => <div key={c.id} className="py-2.5 first:pt-0 last:pb-0"><b className="font-semibold">{fmtMoney(c.amount_cents, c.currency)}</b> · {c.reason}<div className="text-[12px] text-muted">{c.client_phone || "no client"} · {c.issued_by} · {ago(c.created_at)}</div></div>)}
                {list("credits").length === 0 && <p className="text-muted">No credits issued.</p>}
              </div>
            </Panel>

            <Panel title="Internal notes" sub="Staff only. The business never sees these.">
              <form action={addNote} className="mb-4 flex flex-col gap-2.5">
                <Hidden values={{ id: b.id, back }} />
                <textarea name="body" required rows={2} placeholder="Add a note for the team" className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[14px] outline-none focus:border-ink" />
                <div><Btn small>Add note</Btn></div>
              </form>
              <div className="divide-y divide-line-2 text-[13.5px]">
                {list("notes").map((n) => <div key={n.id} className="py-2.5 first:pt-0 last:pb-0">{n.body}<div className="text-[12px] text-muted">{n.author} · {ago(n.created_at)}</div></div>)}
                {list("notes").length === 0 && <p className="text-muted">No notes yet.</p>}
              </div>
            </Panel>

            {list("disputes").length > 0 && (
              <Panel title="Disputes">
                <div className="flex flex-col gap-2.5">
                  {list("disputes").map((x) => <Link key={x.id} href={`/admin/disputes?id=${x.id}`} className="flex items-center gap-2 rounded-xl border border-line px-3.5 py-2.5 text-[13.5px] hover:border-ink"><b className="font-semibold">{x.ref}</b><span className="min-w-0 flex-1 truncate text-muted">{x.client_name} · {x.reason}</span>{statusPill(x.status)}</Link>)}
                </div>
              </Panel>
            )}

            <Panel title="Admin history">
              <div className="divide-y divide-line-2 text-[13.5px]">
                {list("events").map((e, i) => <div key={i} className="py-2.5 first:pt-0 last:pb-0"><b className="font-semibold">{e.action}</b><div className="text-[12px] text-muted">{e.actor} · {ago(e.created_at)}</div></div>)}
                {list("events").length === 0 && <p className="text-muted">No admin actions yet.</p>}
              </div>
            </Panel>
          </div>
        </div>
      </Content>
    </>
  );
}
