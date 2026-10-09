import Link from "next/link";
import type { ReactNode } from "react";
import { DataTable } from "@/components/data-table";
import { ConfirmButton, Sheet } from "@/components/merchant-client";
import { Avatar, Empty, Flash, Ic, LoadError, Pill, statusTone, TopSearch } from "@/components/merchant-ui";
import { getMe, mLoad, qs, type Row } from "@/lib/merchant-api";
import { addDays, clock, dateMed, dateOnly, dayLong, dayShort, dur, firstName, minutesOfDay, money, pct, plural, shortName, STATUS_LABEL, ymd } from "@/lib/merchant-format";
import { bookingAction, waitlistUpdate } from "../actions";
import { createBlock, createBooking, deleteBlock } from "./actions";
import { NewBookingForm, SlotPicker } from "./booking-forms";
import "../../css/calendar.css";

export const metadata = { title: "Calendar" };

type SP = { date?: string; view?: string; hide?: string; booking?: string; block?: string; panel?: string; q?: string; new?: string; client?: string; name?: string; phone?: string; ok?: string; err?: string };

const HOUR = 64; // pixels per hour, as in the design
const DOW = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const SOURCE: Record<string, string> = { web: "Booking page", search: "Search", rebook: "Rebook", phone: "Phone", walk_in: "Walk-in", whatsapp: "WhatsApp", instagram: "Instagram link", link: "Booking link", app: "App" };
const VIEWS = [["day", "Day"], ["staff", "Staff"], ["week", "Week"], ["month", "Month"]] as const;
const mins = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const dowOf = (day: string) => DOW[new Date(day + "T12:00:00Z").getUTCDay()];
const lengthOf = (b: Row) => (Date.parse(b.ends_at) - Date.parse(b.starts_at)) / 60000;
/** Who is coming, when it is not the person who booked. */
const guestOf = (b: Row) => String(b.guest_name ?? "").trim();
/** "Tola (booked by Dami Parent)", or just the client when they booked for themselves. */
const whoOf = (b: Row) => (guestOf(b) ? `${guestOf(b)} (booked by ${b.client_name})` : String(b.client_name ?? ""));
/** The name for a small tile: the guest as typed, with a "for" marker, or the client's short name. */
const tileName = (b: Row) => (guestOf(b) ? <><i className="for">for</i>{guestOf(b)}</> : shortName(b.client_name));
const answerText = (a: Row) => {
  const v = String(a.answer ?? "").trim();
  if (a.kind === "consent") return v.toLowerCase() === "yes" ? "Agreed" : v || "Not ticked";
  if (a.kind === "yesno") return v.toLowerCase() === "yes" ? "Yes" : v.toLowerCase() === "no" ? "No" : v;
  return v || "No answer";
};
const dueOf = (b: Row) => (b.status === "paid" ? 0 : Math.max(0, b.total_cents - b.discount_cents - (b.deposit_paid ? b.deposit_cents : 0)));

export default async function Calendar({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const me = (await getMe())!;
  const { merchant: m } = me;
  const tz = m.timezone, cur = m.currency;
  const today = ymd(new Date(), tz);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;
  const view = (["day", "staff", "week", "month"].includes(sp.view ?? "") ? sp.view : "staff") as "day" | "staff" | "week" | "month";
  const hide = (sp.hide ?? "").split(",").filter(Boolean);

  const base = { date: date === today ? undefined : date, view: view === "staff" ? undefined : view, hide: hide.join(",") || undefined };
  const href = (over: Record<string, string | undefined> = {}) => "/business/calendar" + qs({ ...base, booking: sp.booking, ...over });
  const here = href({ panel: sp.panel });
  const plain = href({ booking: undefined });

  const [cal, svc, sel, wait, found, pre] = await Promise.all([
    mLoad("/calendar" + qs({ date, days: view === "week" ? "7" : view === "month" ? "month" : undefined })),
    mLoad("/services"),
    sp.booking ? mLoad(`/bookings/${encodeURIComponent(sp.booking)}`) : null,
    sp.panel === "waitlist" ? mLoad("/waitlist") : null,
    sp.q ? mLoad("/bookings" + qs({ q: sp.q })) : null,
    sp.client ? mLoad(`/clients/${encodeURIComponent(sp.client)}`) : null,
  ]);
  if (cal.error) return <div className="main pg-calendar"><LoadError title="Calendar" error={cal.error} /></div>;

  const d = cal.data;
  const staffAll = (d.staff ?? []) as Row[], bookings = (d.bookings ?? []) as Row[], blocks = (d.blocks ?? []) as Row[], timeOff = (d.time_off ?? []) as Row[];
  const locHours = (d.location_hours ?? {}) as Record<string, string[] | null>;
  const services = ((svc.data.services ?? []) as Row[]).filter((s) => !s.archived).map((s) => ({ id: s.id, name: s.name, category: s.category, duration_min: s.duration_min + (s.processing_min ?? 0), price_cents: s.price_cents }));
  const staffPick = staffAll.map((s) => ({ id: s.id, name: s.name, bookable: s.bookable }));

  const hoursFor = (s: Row, day: string): string[] | null => (s.hours ? s.hours[dowOf(day)] : locHours[dowOf(day)]) ?? null;
  const isOff = (s: Row, day: string) => timeOff.some((o) => o.staff_id === s.id && String(o.starts_on).slice(0, 10) <= day && String(o.ends_on).slice(0, 10) >= day);

  // ----- the top bar -----
  const step = view === "week" ? 7 : 1;
  const monthShift = (n: number) => { const t = new Date(date.slice(0, 7) + "-01T12:00:00Z"); t.setUTCMonth(t.getUTCMonth() + n); return t.toISOString().slice(0, 10); };
  const prev = view === "month" ? monthShift(-1) : addDays(date, -step), next = view === "month" ? monthShift(1) : addDays(date, step);
  const first = String(d.date);
  const title = view === "month" ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(date + "T12:00:00Z"))
    : view === "week" ? `${dateOnly(first + "T00:00:00Z").replace(/^\w+ /, "")} to ${dateOnly(addDays(first, 6) + "T00:00:00Z").replace(/^\w+ /, "")}`
    : dayLong(date + "T12:00:00Z", "UTC");
  const unit = view === "month" ? "month" : view === "week" ? "week" : "day";

  // ----- the day grid (Staff view) -----
  const cols = staffAll.filter((s) => s.bookable || bookings.some((b) => b.staff_id === s.id)).filter((s) => !hide.includes(s.id));
  let lo = 9 * 60, hi = 17 * 60, openMin = 0;
  for (const s of staffAll) {
    const h = hoursFor(s, date);
    if (h && !isOff(s, date) && s.bookable) { lo = Math.min(lo, mins(h[0])); hi = Math.max(hi, mins(h[1])); openMin += Math.max(0, mins(h[1]) - mins(h[0])); }
  }
  const dayBookings = view === "staff" || view === "day" ? bookings : bookings.filter((b) => ymd(b.starts_at, tz) === date);
  if (view === "staff") for (const b of [...bookings, ...blocks]) { lo = Math.min(lo, minutesOfDay(b.starts_at, tz)); hi = Math.max(hi, minutesOfDay(b.starts_at, tz) + lengthOf(b)); }
  const startH = Math.floor(lo / 60), endH = Math.min(24, Math.ceil(hi / 60));
  const height = (endH - startH) * HOUR;
  const top = (iso: string) => Math.round(((minutesOfDay(iso, tz) - startH * 60) / 60) * HOUR);
  const nowTop = date === today ? top(new Date().toISOString()) : -1;
  const stats = d.stats as Row;

  const evClass = (b: Row) => [
    "ev",
    b.status === "paid" || b.status === "completed" ? "done" : b.status === "no_show" ? "miss" : b.status === "requested" ? "req" : b.deposit_paid ? "gold" : "",
    b.status === "in_progress" || b.status === "checked_in" ? "live" : "",
    sp.booking === b.id ? "on" : "",
  ].filter(Boolean).join(" ");
  const evSub = (b: Row) => [b.services ?? "Visit", b.status === "paid" ? "paid" : b.status === "completed" ? "to check out" : b.status === "in_progress" ? "in progress" : b.status === "checked_in" ? "arrived" : b.status === "requested" ? "request" : b.status === "no_show" ? "no-show" : b.deposit_paid ? `deposit ${money(b.deposit_cents, cur)}` : ""].filter(Boolean).join(" · ");

  // Two things at the same time for one person (a walk-in squeezed in, a block over a booking) share the column.
  const lanes = (list: Row[]) => {
    const out = new Map<string, { lane: number; of: number }>();
    let cluster: Row[] = [], ends: number[] = [], clusterEnd = 0;
    const close = () => { for (const x of cluster) out.get(x.id)!.of = ends.length; cluster = []; ends = []; };
    for (const x of [...list].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))) {
      const a = Date.parse(x.starts_at), b = Date.parse(x.ends_at);
      if (cluster.length && a >= clusterEnd) close();
      let lane = ends.findIndex((e) => e <= a);
      if (lane < 0) { lane = ends.length; ends.push(b); } else ends[lane] = b;
      out.set(x.id, { lane, of: 1 });
      cluster.push(x); clusterEnd = Math.max(clusterEnd, b);
    }
    close();
    return out;
  };
  const place = (x: Row, at: Map<string, { lane: number; of: number }>) => {
    const p = at.get(x.id) ?? { lane: 0, of: 1 };
    const box = { top: top(x.starts_at) + 1, height: Math.max(22, (lengthOf(x) / 60) * HOUR - 2) };
    return p.of === 1 ? box : { ...box, left: `calc(${(p.lane / p.of) * 100}% + 3px)`, right: "auto", width: `calc(${100 / p.of}% - 6px)` };
  };

  // ----- the side panel -----
  const picked = sel && !sel.error ? (sel.data.booking as Row) : null;
  const items = (sel?.data.items ?? []) as Row[], hist = (sel?.data.client ?? null) as Row | null, answers = (sel?.data.answers ?? []) as Row[];
  const block = sp.block ? blocks.find((b) => b.id === sp.block) : null;
  const waitlist = (wait?.data.waitlist ?? []) as Row[];
  const client0 = pre && !pre.error ? { id: pre.data.client.id, name: pre.data.client.name, phone: pre.data.client.phone } : sp.name ? { name: sp.name, phone: sp.phone } : undefined;

  const act = (action: string, label: ReactNode, cls = "btn btn-out btn-sm", extra?: ReactNode) => (
    <form action={bookingAction} style={{ display: "contents" }}>
      <input type="hidden" name="id" value={picked!.id} /><input type="hidden" name="action" value={action} /><input type="hidden" name="back" value={href()} />
      {extra}<button className={cls}>{label}</button>
    </form>
  );

  return (
    <div className="main pg-calendar">
      <header className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link href={href({ date: prev, booking: undefined })} className="iconb" aria-label={`Previous ${unit}`} style={{ width: 36, height: 36 }}><Ic name="chevL" size={16} /></Link>
          <h1 className="serif">{title}</h1>
          <Link href={href({ date: next, booking: undefined })} className="iconb" aria-label={`Next ${unit}`} style={{ width: 36, height: 36 }}><Ic name="chevR" size={16} /></Link>
          <Link href={href({ date: undefined, booking: undefined })} className="btn btn-out btn-sm">Today</Link>
        </div>
        <div className="seg">
          {VIEWS.map(([id, name]) => <Link key={id} href={href({ view: id === "staff" ? undefined : id, booking: undefined })} className={view === id ? "on" : ""}>{name}</Link>)}
        </div>
        <TopSearch action="/business/calendar" value={sp.q ?? ""} placeholder="Client name or phone" hidden={{ date: base.date, view: base.view }} />
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Sheet trigger="Block time" triggerClass="btn btn-out" title="Block time" sub="For lunch, training or a break. Clients cannot book a blocked time.">
            <form action={createBlock}>
              <input type="hidden" name="back" value={here} />
              <label className="fld"><span>Who</span><select name="staff_id" required defaultValue={m.staff_id || undefined}>{staffAll.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              <label className="fld"><span>Day</span><input type="date" name="date" defaultValue={date} required /></label>
              <div className="f2">
                <label className="fld"><span>From</span><input type="time" name="from" defaultValue="13:00" step={300} required /></label>
                <label className="fld"><span>To</span><input type="time" name="to" defaultValue="14:00" step={300} required /></label>
              </div>
              <label className="fld"><span>Reason</span><input name="reason" maxLength={80} placeholder="Lunch" /></label>
              <div className="sheet-ft"><button className="btn btn-ink">Block it</button></div>
            </form>
          </Sheet>
          <Sheet trigger={<><Ic name="plus" size={16} stroke={2.4} />New booking</>} triggerClass="btn btn-ink" title="New booking" sub="For a call, a message or a walk-in. Only free times are offered." open={sp.new === "1"} closeHref={here} wide>
            <NewBookingForm action={createBooking} back={here} services={services} staff={staffPick} currency={cur} market={m.market} date0={date < today ? today : date} client0={client0} />
          </Sheet>
        </span>
      </header>

      <div className="content">
        <Flash sp={sp} />

        {found ? (
          <div className="card-lite">
            <div className="hd"><b>{found.error ? "Search failed" : `${plural((found.data.bookings ?? []).length, "booking")} for “${sp.q}”`}</b><Link href={href({ q: undefined })}>Clear</Link></div>
            {found.error ? <div role="alert" className="flash flash-err">{found.error}</div> : (found.data.bookings ?? []).length === 0 ? <div className="muted" style={{ fontSize: 13.5 }}>No booking matches that name or phone.</div> : (
              <div className="found">
                {((found.data.bookings ?? []) as Row[]).map((b) => (
                  <Link key={b.id} href={"/business/calendar" + qs({ date: ymd(b.starts_at, tz), booking: b.id })}>
                    <time>{dayShort(b.starts_at, tz)} · {clock(b.starts_at, tz)}</time>
                    <span style={{ flex: 1, minWidth: 0 }}><b>{whoOf(b)}</b> · {b.services ?? "Visit"} with {firstName(b.staff)}</span>
                    <Pill tone={statusTone(b.status)}>{STATUS_LABEL[b.status] ?? b.status}</Pill>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <div className="tools">
          <span className="muted" style={{ fontSize: 13 }}>
            <b style={{ color: "#1A1513" }}>{plural(stats.bookings, "booking")}</b> · {money(stats.expected_cents, cur)} expected
            {view === "staff" || view === "day" ? (openMin > 0 ? ` · ${pct(stats.booked_min, openMin)}% booked` : " · closed") : ` this ${unit}`}
          </span>
          <span style={{ flex: 1 }} />
          {view === "staff" && staffAll.filter((s) => s.bookable || bookings.some((b) => b.staff_id === s.id)).map((s) => {
            const shown = !hide.includes(s.id);
            const nextHide = shown ? [...hide, s.id] : hide.filter((x) => x !== s.id);
            return (
              <Link key={s.id} href={href({ hide: nextHide.join(",") || undefined })} className={"chip" + (shown ? " on" : "")} aria-pressed={shown}>
                <span className="dot" style={{ background: s.tone }}>{s.initials}</span>{firstName(s.name)}
              </Link>
            );
          })}
          <Link href={href({ panel: sp.panel === "waitlist" ? undefined : "waitlist", booking: undefined, block: undefined })} className="pill pill-gold">Waitlist {stats.waitlist}</Link>
        </div>

        <div className="calwrap">
          {view === "staff" && (
            <div className="calbox">
              {cols.length === 0 ? <div style={{ padding: 18 }}><Empty title="Nobody is shown">Turn a team member back on with the chips above, or add your team in Staff &amp; rosters.</Empty></div> : (
                <div className="cal" style={{ ["--n" as string]: cols.length, minWidth: Math.max(520, 56 + cols.length * 176) }}>
                  <div className="chead" style={{ ["--n" as string]: cols.length }}>
                    <div />
                    {cols.map((s) => {
                      const mine = bookings.filter((b) => b.staff_id === s.id && b.status !== "no_show");
                      const h = hoursFor(s, date), off = isOff(s, date);
                      return (
                        <div key={s.id} className="st">
                          <Avatar text={s.initials} tone={s.tone} />
                          <div><b>{firstName(s.name)}</b><span>{off ? "Time off" : !h ? "Not working" : `${mine.length} booked · ${money(mine.reduce((a, b) => a + b.total_cents, 0), cur)}`}</span></div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="cbody" style={{ ["--n" as string]: cols.length }}>
                    {nowTop >= 0 && nowTop <= height ? <div className="now" style={{ top: nowTop }} /> : null}
                    <div className="taxis" style={{ height }}>
                      {Array.from({ length: endH - startH + 1 }, (_, i) => <span key={i} style={{ top: i * HOUR }}>{startH + i}:00</span>)}
                    </div>
                    {cols.map((s) => {
                      const h = hoursFor(s, date), off = isOff(s, date) || !h;
                      const at = lanes([...blocks.filter((b) => b.staff_id === s.id), ...bookings.filter((b) => b.staff_id === s.id)]);
                      return (
                        <div key={s.id} className={"col" + (off ? " off" : "")} style={{ height }}>
                          {/* Shade the hours before opening and after closing. */}
                          {!off && h && mins(h[0]) > startH * 60 ? <div className="shut" style={{ top: 0, height: ((mins(h[0]) - startH * 60) / 60) * HOUR }} /> : null}
                          {!off && h && mins(h[1]) < endH * 60 ? <div className="shut" style={{ top: ((mins(h[1]) - startH * 60) / 60) * HOUR, bottom: 0 }} /> : null}
                          {!off && (((s.breaks ?? {}) as Record<string, string[][]>)[dowOf(date)] ?? []).map((b, i) => (
                            <div key={"brk" + i} className="brk" style={{ top: ((mins(b[0]) - startH * 60) / 60) * HOUR, height: ((mins(b[1]) - mins(b[0])) / 60) * HOUR }} title={`Break ${b[0]} to ${b[1]}`}><span>Break</span></div>
                          ))}
                          {blocks.filter((b) => b.staff_id === s.id).map((b) => (
                            <Link key={b.id} href={href({ block: b.id, booking: undefined, panel: undefined })} scroll={false} className={"ev block" + (sp.block === b.id ? " on" : "")} style={place(b, at)} title={b.external ? "From your calendar" : undefined}>
                              <b>{b.reason || (b.external ? "Busy" : "Blocked")}</b><span>{b.external ? "From your calendar" : "Blocked"}</span>
                            </Link>
                          ))}
                          {bookings.filter((b) => b.staff_id === s.id).map((b) => (
                            <Link key={b.id} href={href({ booking: b.id, block: undefined, panel: undefined })} scroll={false} className={evClass(b)} style={place(b, at)} title={`${clock(b.starts_at, tz)} to ${clock(b.ends_at, tz)} · ${whoOf(b)}`}>
                              <b>{tileName(b)}</b><span>{evSub(b)}</span>
                            </Link>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {view === "day" && (
            <div className="calbox">
              {dayBookings.length === 0 ? <div style={{ padding: 18 }}><Empty title="Nothing booked this day">Use New booking to add one.</Empty></div> : (
                <DataTable id="day" search="Search this day" filters={["With", "Status"]} pageSize={25} noun="booking" sort={{ col: "Time", dir: "asc" }}>
                  <table className="agenda">
                    <thead><tr><th>Time</th><th>Client</th><th>Service</th><th>With</th><th>Length</th><th className="num">Total</th><th>Status</th></tr></thead>
                    <tbody>
                      {dayBookings.map((b) => (
                        <tr key={b.id} className={sp.booking === b.id ? "on" : ""}>
                          <td data-sort={b.starts_at}><Link href={href({ booking: b.id, block: undefined, panel: undefined })} scroll={false} className="agt">{clock(b.starts_at, tz)}</Link></td>
                          <td data-sort={guestOf(b) || b.client_name}><Link href={href({ booking: b.id, block: undefined, panel: undefined })} scroll={false} className="agc"><Avatar name={guestOf(b) || b.client_name} tone={b.staff_tone} size={28} />{guestOf(b) ? <span><b><i className="for">for</i>{guestOf(b)}</b><small>booked by {b.client_name}</small></span> : <b>{b.client_name}</b>}</Link></td>
                          <td>{b.services ?? "Visit"}</td>
                          <td>{firstName(b.staff)}</td>
                          <td data-sort={lengthOf(b)}>{dur(lengthOf(b))}</td>
                          <td className="num" data-sort={b.total_cents}>{money(b.total_cents, cur)}</td>
                          <td data-filter={STATUS_LABEL[b.status] ?? b.status}><Pill tone={statusTone(b.status)}>{STATUS_LABEL[b.status] ?? b.status}</Pill></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DataTable>
              )}
            </div>
          )}

          {view === "week" && (
            <div className="calbox">
              <div className="wk">
                {Array.from({ length: 7 }, (_, i) => addDays(first, i)).map((day) => {
                  const list = bookings.filter((b) => ymd(b.starts_at, tz) === day);
                  const closed = !locHours[dowOf(day)];
                  return (
                    <div key={day} className={"wkd" + (day === today ? " today" : "") + (closed ? " closed" : "")}>
                      <Link href={href({ date: day, view: undefined, booking: undefined })} className="wkh"><b>{dateOnly(day + "T00:00:00Z")}</b><span>{closed && !list.length ? "Closed" : `${list.length} booked · ${money(list.reduce((a, b) => a + b.total_cents, 0), cur)}`}</span></Link>
                      {list.map((b) => (
                        <Link key={b.id} href={href({ booking: b.id, block: undefined, panel: undefined })} scroll={false} className={evClass(b).replace(/^ev/, "we")} style={{ borderLeftColor: b.staff_tone }}>
                          <b>{clock(b.starts_at, tz)} {tileName(b)}</b><span>{b.services ?? "Visit"} · {firstName(b.staff)}</span>
                        </Link>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === "month" && (
            <div className="calbox">
              <div className="mo">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((x) => <div key={x} className="moh">{x}</div>)}
                {Array.from({ length: 42 }, (_, i) => addDays(first, i)).map((day) => {
                  const list = bookings.filter((b) => ymd(b.starts_at, tz) === day && b.status !== "no_show");
                  const other = day.slice(0, 7) !== date.slice(0, 7);
                  return (
                    <Link key={day} href={href({ date: day, view: undefined, booking: undefined })} className={"mod" + (other ? " other" : "") + (day === today ? " today" : "")}>
                      <b>{Number(day.slice(8))}</b>
                      {list.length ? <><span>{plural(list.length, "booking")}</span><small>{money(list.reduce((a, b) => a + b.total_cents, 0), cur)}</small></> : <span className="none">{locHours[dowOf(day)] ? "" : "Closed"}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <aside className="panel">
            {sp.panel === "waitlist" ? (
              <>
                <div className="hd"><b style={{ fontSize: 17 }}>Waitlist</b><Link href={href({ panel: undefined })} style={{ fontSize: 13, fontWeight: 600 }}>Close</Link></div>
                {wait?.error ? <div role="alert" className="flash flash-err">{wait.error}</div> : waitlist.length === 0 ? <Empty title="Nobody is waiting">Clients who ask for a full day show up here.</Empty> : waitlist.map((w) => (
                  <div key={w.id} className="wl">
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <Avatar name={w.client_name} size={32} />
                      <div style={{ flex: 1, minWidth: 0 }}><b>{w.client_name}</b><small>{[w.day ? dateOnly(w.day) : "Any day", w.time_of_day, w.service].filter(Boolean).join(" · ")}</small></div>
                      {w.status === "offered" ? <Pill tone="new">Offered</Pill> : null}
                    </div>
                    <div className="rowx" style={{ gap: 6 }}>
                      <Link href={href({ panel: "waitlist", date: w.day ? String(w.day).slice(0, 10) : undefined, booking: undefined }) + `&new=1&name=${encodeURIComponent(w.client_name)}&phone=${encodeURIComponent(w.client_phone ?? "")}`} className="btn btn-ink btn-sm">Book</Link>
                      {w.status === "waiting" ? <form action={waitlistUpdate}><input type="hidden" name="id" value={w.id} /><input type="hidden" name="status" value="offered" /><input type="hidden" name="back" value={here} /><button className="btn btn-out btn-sm">Mark offered</button></form> : null}
                      <form action={waitlistUpdate}><input type="hidden" name="id" value={w.id} /><input type="hidden" name="status" value="removed" /><input type="hidden" name="back" value={here} /><button className="btn btn-ghost btn-sm">Remove</button></form>
                    </div>
                  </div>
                ))}
              </>
            ) : block ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar text={staffAll.find((s) => s.id === block.staff_id)?.initials} tone={staffAll.find((s) => s.id === block.staff_id)?.tone} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 17, fontWeight: 600 }}>{block.reason || (block.external ? "Busy" : "Blocked time")}</div><div className="muted" style={{ fontSize: 12.5 }}>{staffAll.find((s) => s.id === block.staff_id)?.name}</div></div>
                  <Pill tone={block.external ? "grey" : "wine"}>{block.external ? "From your calendar" : "Block"}</Pill>
                </div>
                <div className="kv"><div><small>Time</small><b>{clock(block.starts_at, tz)} to {clock(block.ends_at, tz)}</b></div><div><small>Day</small><b>{dayShort(block.starts_at, tz)}</b></div></div>
                {block.external ? (
                  <>
                    <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>This time comes from a calendar you connected, so clients cannot book it. Change or remove it in that calendar; it goes from here at the next sync.</div>
                    <Link href="/business/settings?tab=account#calendar-sync" className="btn btn-out btn-sm" style={{ width: "100%" }}>Settings, Calendar sync</Link>
                  </>
                ) : (
                  <form action={deleteBlock}><input type="hidden" name="id" value={block.id} /><input type="hidden" name="back" value={href({ block: undefined })} /><ConfirmButton message="Remove this block? Clients will be able to book the time again." className="btn btn-out btn-sm" style={{ width: "100%" }}>Remove block</ConfirmButton></form>
                )}
              </>
            ) : picked ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar name={guestOf(picked) || picked.client_name} tone={picked.staff_tone} size={44} style={{ fontSize: 14 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 600, overflowWrap: "anywhere" }}>{guestOf(picked) ? <>{guestOf(picked)} <span className="by">(booked by {picked.client_name})</span></> : picked.client_name}</div>
                    <div className="muted" style={{ fontSize: 12.5 }}>{guestOf(picked) && hist ? `${firstName(picked.client_name)}: ` : ""}{hist ? (hist.visits > 0 ? `${plural(hist.visits, "visit")} · ${money(hist.spent_cents, cur)} · ${plural(hist.no_shows, "no-show")}` : "First visit") : picked.client_phone || "Walk-in"}</div>
                  </div>
                  <span className="tags">
                    {picked.series_id ? <span className="pill pill-gold" title="One of a set of repeat appointments the client booked.">Repeats</span> : null}
                    <Pill tone={statusTone(picked.status)}>{STATUS_LABEL[picked.status] ?? picked.status}</Pill>
                  </span>
                </div>
                <div className="kv">
                  <div><small>Service</small><b>{picked.services ?? "Visit"}</b></div>
                  <div><small>With</small><b>{picked.staff}</b></div>
                  <div><small>Time</small><b>{ymd(picked.starts_at, tz) !== date || view !== "staff" ? dayShort(picked.starts_at, tz) + " · " : ""}{clock(picked.starts_at, tz)} to {clock(picked.ends_at, tz)}</b></div>
                  <div><small>Booked via</small><b>{SOURCE[picked.source] ?? picked.source}</b></div>
                </div>
                <div>
                  {items.map((it, i) => <div key={i} className="line"><span>{it.name}</span><span>{money(it.price_cents, cur)}</span></div>)}
                  {picked.discount_cents > 0 ? <div className="line muted"><span>Discount{picked.promo_code ? ` · ${picked.promo_code}` : ""}</span><span>{money(-picked.discount_cents, cur)}</span></div> : null}
                  {picked.deposit_cents > 0 ? <div className="line muted"><span>{picked.deposit_paid ? "Deposit paid" : "Deposit not paid"}</span><span>{picked.deposit_paid ? money(-picked.deposit_cents, cur) : money(picked.deposit_cents, cur)}</span></div> : null}
                  {picked.status === "paid" ? <div className="line muted"><span>Paid{picked.paid_at ? ` ${dateMed(picked.paid_at, tz)}` : ""}{picked.tip_cents ? ` · tip ${money(picked.tip_cents, cur)}` : ""}</span><span>{money(-(picked.total_cents - picked.discount_cents), cur)}</span></div> : null}
                  <div className="line total"><span>Due at checkout</span><span>{money(dueOf(picked), cur)}</span></div>
                </div>
                {answers.length > 0 && (
                  <div className="answers">
                    <b>Answers</b>
                    <dl>
                      {answers.map((a, i) => <div key={i}><dt>{a.label}</dt><dd>{answerText(a)}</dd></div>)}
                    </dl>
                  </div>
                )}
                {picked.notes || hist?.notes ? <div className="note"><b>Notes</b><br />{[picked.notes, hist?.notes].filter(Boolean).join(" · ")}</div> : null}
                {picked.cancel_reason ? <div className="note"><b>Reason</b><br />{picked.cancel_reason}</div> : null}

                <div className="acts">
                  {picked.status === "requested" && act("confirm", "Confirm", "btn btn-ink btn-sm")}
                  {picked.status === "confirmed" && act("check_in", "Check in", "btn btn-ink btn-sm")}
                  {picked.status === "checked_in" && act("start", "Start service", "btn btn-ink btn-sm")}
                  {picked.status === "in_progress" && act("complete", "Finish", "btn btn-ink btn-sm")}
                  {picked.status === "completed" && <Link href={`/business/checkout?booking=${picked.id}`} className="btn btn-ink btn-sm">Checkout</Link>}
                  {["checked_in", "in_progress"].includes(picked.status) && <Link href={`/business/checkout?booking=${picked.id}`} className="btn btn-out btn-sm">Checkout</Link>}
                  {picked.status === "paid" && <Link href={href({ booking: undefined }) + (plain.includes("?") ? "&" : "?") + `new=1&client=${picked.client_id ?? ""}`} className="btn btn-ink btn-sm">Rebook</Link>}
                  {picked.client_id ? <Link href={`/business/inbox?new=1&cq=${encodeURIComponent(picked.client_name)}`} className="btn btn-out btn-sm">Message</Link> : null}
                  {["requested", "confirmed"].includes(picked.status) && (
                    <Sheet trigger="Reschedule" triggerClass="btn btn-out btn-sm" title="Move this booking" sub={`${whoOf(picked)} · ${picked.services ?? "Visit"} · now ${dayShort(picked.starts_at, tz)} at ${clock(picked.starts_at, tz)}`}>
                      <form action={bookingAction}>
                        <input type="hidden" name="id" value={picked.id} /><input type="hidden" name="action" value="reschedule" /><input type="hidden" name="back" value={href()} />
                        <SlotPicker staff={staffPick} currency={cur} serviceIds={items.map((it) => it.service_id).filter(Boolean)} exclude={picked.id} date0={ymd(picked.starts_at, tz) < today ? today : ymd(picked.starts_at, tz)} staff0={picked.staff_id} />
                        <div className="sheet-ft"><button className="btn btn-ink">Move booking</button></div>
                      </form>
                    </Sheet>
                  )}
                  {picked.status === "confirmed" && Date.parse(picked.starts_at) < Date.now() && act("no_show", "No-show", "btn btn-out btn-sm")}
                  {["requested", "confirmed", "checked_in"].includes(picked.status) && (
                    <Sheet trigger={picked.status === "requested" ? "Decline" : "Cancel"} triggerClass="btn btn-out btn-sm" title={picked.status === "requested" ? "Decline this request" : "Cancel this booking"} sub="The time opens up again for other clients.">
                      <form action={bookingAction}>
                        <input type="hidden" name="id" value={picked.id} /><input type="hidden" name="action" value="cancel" /><input type="hidden" name="back" value={href({ booking: undefined })} />
                        <label className="fld"><span>Reason</span><textarea name="reason" maxLength={200} placeholder="Kept on the booking for your records" /></label>
                        {picked.deposit_paid ? <div className="slot-note">The deposit of {money(picked.deposit_cents, cur)} is released, because the business is cancelling.</div> : null}
                        <div className="sheet-ft"><button className="btn btn-wine">{picked.status === "requested" ? "Decline request" : "Cancel booking"}</button></div>
                      </form>
                    </Sheet>
                  )}
                </div>
                {picked.client_id ? <Link href={`/business/clients?client=${picked.client_id}`} style={{ fontSize: 13, fontWeight: 600, textAlign: "center", minHeight: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>Open client profile</Link> : null}
              </>
            ) : sel?.error ? (
              <div role="alert" className="flash flash-err">{sel.error}</div>
            ) : (
              <>
                <b style={{ fontSize: 17 }}>{view === "month" ? "Pick a day" : "Pick a booking"}</b>
                <div className="muted" style={{ fontSize: 13.5, lineHeight: 1.5 }}>{view === "month" ? "Choose a day to open it." : "Choose a booking to check the client in, move it, or take payment."}</div>
                <div className="kv">
                  <div><small>Booked time</small><b>{dur(stats.booked_min)}</b></div>
                  <div><small>Waitlist</small><b>{stats.waitlist}</b></div>
                </div>
                <div className="legend">
                  <span><i className="lg gold" />Deposit paid</span><span><i className="lg live" />In the chair</span><span><i className="lg done" />Finished or paid</span><span><i className="lg req" />Request</span><span><i className="lg block" />Blocked</span><span><i className="lg brk" />Break</span>
                </div>
              </>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
