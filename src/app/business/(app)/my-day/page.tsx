import Link from "next/link";
import type { ReactNode } from "react";
import { AutoForm, ConfirmButton } from "@/components/merchant-client";
import { Avatar, Empty, Flash, Ic, LoadError, Pill, statusTone, Topbar } from "@/components/merchant-ui";
import { getMe, mCan, mLoad, qs, type Row } from "@/lib/merchant-api";
import { addDays, clock, dateOnly, dur, firstName, minutesOfDay, money, plural, STATUS_LABEL, ymd } from "@/lib/merchant-format";
import { bookingAction } from "../actions";
import { DayRefresher } from "./refresher";
import "../../css/my-day.css";

export const metadata = { title: "My day" };

type SP = { date?: string; staff?: string; at?: string; ok?: string; err?: string };
type Answer = { label: string; kind: string; answer: string };

const DOW = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const dowOf = (day: string) => DOW[new Date(day + "T12:00:00Z").getUTCDay()];
const mins = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const sentence = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) + (/[.!?]$/.test(s) ? "" : ".") : s);
const ordinal = (n: number) => { const t = n % 100, u = n % 10; return n + (t >= 11 && t <= 13 ? "th" : u === 1 ? "st" : u === 2 ? "nd" : u === 3 ? "rd" : "th"); };
/** "25 min", "2 h 05": how far away a moment is, never less than a minute. */
const span = (ms: number) => dur(Math.max(1, Math.round(Math.abs(ms) / 60000)));
/** What the client still has to pay for a visit. */
const dueOf = (b: Row) => (b.status === "paid" ? 0 : Math.max(0, b.total_cents - (b.discount_cents ?? 0) - (b.deposit_paid ? b.deposit_cents : 0)));
const whoOf = (b: Row): string => b.guest_name || b.client_name || "Client";

export default async function MyDay({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const me = (await getMe())!;
  const { merchant: m } = me;
  const manager = mCan(me, "manager");
  const asked = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : undefined;
  // Only managers and the owner may look at someone else's day; the API checks this too.
  const staffId = manager && sp.staff ? sp.staff : undefined;

  const [day, cal] = await Promise.all([
    mLoad("/my-day" + qs({ date: asked, staff_id: staffId })),
    mLoad("/calendar" + qs({ date: asked })),
  ]);
  const people = ((cal.data.staff ?? []) as Row[]).map((s) => ({ id: s.id as string, name: s.name as string }));

  // A sign-in that is not a person on the calendar has no day of its own.
  if (day.status === 409) {
    return (
      <div className="main pg-my-day">
        <Topbar title="My day" />
        <div className="content">
          <div className="card">
            <h3>{manager ? "Choose whose day to see" : "There is no day to show yet"}</h3>
            <div className="sub">{manager ? "Your sign-in is not linked to a person on the calendar, so there is no day of your own. Pick someone on the team." : sentence(day.error)}</div>
            {manager ? (
              people.length ? (
                <div className="people">
                  {people.map((p) => <Link key={p.id} href={"/business/my-day" + qs({ date: asked, staff: p.id })} className="person"><Avatar name={p.name} size={32} /><b>{p.name}</b><Ic name="chevR" size={16} /></Link>)}
                </div>
              ) : <div className="sub">Nobody is on the team yet. Add people in Staff &amp; rosters.</div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }
  if (day.error) return <div className="main pg-my-day"><LoadError title="My day" error={sentence(day.error)} /></div>;

  const d = day.data;
  const tz = (d.timezone as string) || m.timezone, cur = (d.currency as string) || m.currency;
  const date = d.date as string, today = d.today as string, isToday = date === today;
  const who = d.staff as Row, own = who.id === m.staff_id;
  const bookings = (d.bookings ?? []) as Row[], blocks = (d.blocks ?? []) as Row[];
  const canPay = d.can_take_payments === true;
  const now = Date.now();

  const base = { date: isToday ? undefined : date, staff: own ? undefined : (who.id as string) };
  const href = (over: Record<string, string | undefined> = {}) => "/business/my-day" + qs({ ...base, ...over });
  const dayHref = (to: string) => href({ date: to === today ? undefined : to });

  // ----- the hours this person works that day -----
  const dow = dowOf(date);
  const locHours = cal.error ? null : ((cal.data.location_hours ?? {}) as Record<string, string[] | null>);
  // A person without hours of their own works the opening hours of the business.
  const hoursKnown = !!who.hours || !!locHours;
  const hours: string[] | null = (who.hours ? who.hours[dow] : locHours?.[dow]) ?? null;
  const off = ((cal.data.time_off ?? []) as Row[]).some((o) => o.staff_id === who.id && String(o.starts_on).slice(0, 10) <= date && String(o.ends_on).slice(0, 10) >= date);
  const breaks = hours && !off ? (((who.breaks ?? {})[dow] ?? []) as string[][]) : [];

  // ----- the day in order: visits, with blocks and breaks in their place -----
  type Item = { at: number; key: string; visit?: Row; label?: string; time?: string };
  const items: Item[] = bookings.map((b) => ({ at: minutesOfDay(b.starts_at, tz), key: b.id, visit: b }));
  for (const k of blocks) {
    const early = ymd(k.starts_at, tz) < date, late = ymd(k.ends_at, tz) > date || (ymd(k.ends_at, tz) === addDays(date, 1) && clock(k.ends_at, tz) === "00:00");
    const time = early && late ? "all day" : early ? `until ${clock(k.ends_at, tz)}` : late ? `from ${clock(k.starts_at, tz)}` : `${clock(k.starts_at, tz)} to ${clock(k.ends_at, tz)}`;
    items.push({ at: early ? 0 : minutesOfDay(k.starts_at, tz), key: k.id, label: k.reason || "Blocked", time });
  }
  for (const [from, to] of breaks) items.push({ at: mins(from), key: `break-${from}`, label: "Break", time: `${from} to ${to}` });
  items.sort((a, b) => a.at - b.at);

  // ----- the one-line summary -----
  const kept = bookings.filter((b) => b.status !== "no_show"), missed = bookings.length - kept.length;
  const expected = kept.reduce((a, b) => a + b.total_cents - (b.discount_cents ?? 0), 0);
  const lastEnd = kept.reduce((a, b) => (Date.parse(b.ends_at) > Date.parse(a) ? b.ends_at : a), kept[0]?.ends_at ?? "");
  const summary = kept.length
    ? [plural(kept.length, "visit"), `${clock(kept[0].starts_at, tz)} to ${clock(lastEnd, tz)}`, `${money(expected, cur)} expected`, missed ? plural(missed, "no-show") : ""].filter(Boolean).join(" · ")
    : missed ? plural(missed, "no-show") : "";

  // ----- now and next, for today only -----
  const current = isToday ? bookings.find((b) => b.status === "in_progress") ?? bookings.find((b) => b.status === "checked_in") : undefined;
  const next = isToday ? bookings.find((b) => (b.status === "confirmed" || b.status === "requested") && Date.parse(b.ends_at) > now) : undefined;
  const untilNext = next ? Date.parse(next.starts_at) - now : 0;

  const label = dateOnly(date);
  const title = isToday ? `Today, ${label}` : date === addDays(today, 1) ? `Tomorrow, ${label}` : date === addDays(today, -1) ? `Yesterday, ${label}` : label;
  const workLine = off ? "On approved time off" : hours ? `Working hours ${hours[0]} to ${hours[1]}` : hoursKnown ? "Not working" : "";

  const act = (b: Row, action: string, text: ReactNode, cls: string, confirm?: string) => (
    <form action={bookingAction}>
      <input type="hidden" name="id" value={b.id} /><input type="hidden" name="action" value={action} />
      <input type="hidden" name="back" value={href({ at: b.id }) + `#v-${b.id}`} />
      {confirm ? <ConfirmButton message={confirm} className={cls}>{text}</ConfirmButton> : <button className={cls}>{text}</button>}
    </form>
  );

  return (
    <div className="main pg-my-day">
      <Topbar eyebrow={own ? "My day" : who.name} title={title}>
        <div className="daynav">
          <Link href={dayHref(addDays(date, -1))} className="btn btn-out ico" aria-label="Previous day"><Ic name="chevL" /></Link>
          <Link href={dayHref(addDays(date, 1))} className="btn btn-out ico" aria-label="Next day"><Ic name="chevR" /></Link>
          {isToday ? null : <Link href={dayHref(today)} className="btn btn-ink">Today</Link>}
        </div>
        {manager && people.length > 1 ? (
          <AutoForm action="/business/my-day" className="who">
            {isToday ? null : <input type="hidden" name="date" value={date} />}
            <label className="sr" htmlFor="md-who">Whose day</label>
            <select id="md-who" name="staff" defaultValue={who.id}>
              {people.map((p) => <option key={p.id} value={p.id}>{p.id === m.staff_id ? `${p.name} (me)` : p.name}</option>)}
            </select>
            <noscript><button className="btn btn-out btn-sm">Show</button></noscript>
          </AutoForm>
        ) : null}
      </Topbar>

      <div className="content">
        {isToday ? <DayRefresher /> : null}
        {sp.at && bookings.some((b) => b.id === sp.at) ? null : <Flash sp={sp} />}

        {summary ? <p className="sum">{summary}{workLine && !kept.length ? ` · ${workLine}` : ""}</p> : null}

        {current || next ? (
          <div className="nownext">
            {current ? (
              <a href={`#v-${current.id}`} className="nn now">
                <small>Now</small>
                <b>{whoOf(current)}</b>
                <span>{current.services ?? "Visit"}</span>
                <span>{current.status === "in_progress" ? `In progress, due to finish at ${clock(current.ends_at, tz)}` : `Arrived${current.checked_in_at ? ` at ${clock(current.checked_in_at, tz)}` : ""}, waiting to start`}</span>
              </a>
            ) : null}
            {next ? (
              <a href={`#v-${next.id}`} className="nn">
                <small>Next</small>
                <b>{clock(next.starts_at, tz)} · {whoOf(next)}</b>
                <span>{next.services ?? "Visit"}</span>
                <span>{untilNext > 30000 ? `Starts in ${span(untilNext)}` : untilNext > -60000 ? "Starts now" : `Was due ${span(untilNext)} ago`}</span>
              </a>
            ) : null}
          </div>
        ) : null}

        {bookings.length === 0 ? (
          <Empty title={date < today ? "Nothing was booked" : isToday ? "Nothing booked today" : "Nothing booked yet"}>
            {workLine ? `${workLine}${breaks.length ? `, with a break ${breaks.map(([f, t]) => `${f} to ${t}`).join(" and ")}` : ""}.` : null}
          </Empty>
        ) : null}

        {items.length ? (
          <div className="day">
            {items.map((it) => {
              const b = it.visit;
              if (!b) return <div key={it.key} className="quiet"><b>{it.label}</b><span>{it.time}</span></div>;
              const answers = (b.answers ?? []) as Answer[];
              const due = dueOf(b), total = b.total_cents - (b.discount_cents ?? 0);
              const visits = Number(b.past_visits ?? 0);
              const live = b.status === "in_progress" || b.status === "checked_in";
              return (
                <article key={b.id} id={`v-${b.id}`} className={"visit" + (live ? " live" : "") + (b.status === "no_show" ? " miss" : "") + (b.status === "paid" ? " done" : "")}>
                  {sp.at === b.id ? <Flash sp={sp} /> : null}
                  <div className="v-top">
                    <div className="v-time"><b>{clock(b.starts_at, tz)}</b><span>to {clock(b.ends_at, tz)} · {dur((Date.parse(b.ends_at) - Date.parse(b.starts_at)) / 60000)}</span></div>
                    <Pill tone={statusTone(b.status)}>{STATUS_LABEL[b.status] ?? b.status}</Pill>
                  </div>
                  <h2 className="v-who">{whoOf(b)}{b.guest_name ? <small> (booked by {b.client_name})</small> : null}</h2>
                  <div className="v-svc">{b.services ?? "Visit"}</div>
                  <div className="v-tags">
                    <span className="pill pill-grey">{visits === 0 ? "First visit" : `${ordinal(visits + 1)} visit`}</span>
                    {b.series_id ? <span className="pill pill-grey">Repeats</span> : null}
                  </div>
                  <div className="v-money">
                    <b>{money(total, cur)}</b>
                    <span>
                      {b.status === "paid" ? `Paid${b.tip_cents ? `, with a ${money(b.tip_cents, cur)} tip` : ""}`
                        : b.deposit_cents > 0 ? (b.deposit_paid ? `${money(b.deposit_cents, cur)} deposit paid, ${money(due, cur)} to pay` : `${money(b.deposit_cents, cur)} deposit not paid yet`)
                        : b.status === "no_show" ? "No deposit was taken" : "Nothing paid yet"}
                    </span>
                  </div>
                  {b.client_phone ? <a className="v-call" href={`tel:${String(b.client_phone).replace(/[^\d+]/g, "")}`}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 3h4l2 5-2.500 1.500a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z" /></svg>{b.guest_name ? `Call ${firstName(b.client_name)} · ${b.client_phone}` : `Call ${b.client_phone}`}</a> : null}
                  {b.notes ? <div className="v-note"><small>Note from the client</small>{b.notes}</div> : null}
                  {b.client_notes ? <div className="v-note ours"><small>Your notes about {firstName(b.client_name)}</small>{b.client_notes}</div> : null}
                  {answers.length ? (
                    <details className="v-ans">
                      <summary>Answers ({answers.length})</summary>
                      <ul>
                        {answers.map((a, i) => (
                          <li key={i}>
                            {a.kind === "consent" ? <b>{a.answer === "yes" ? "Agreed" : "Not agreed"}: {a.label}</b>
                              : <><span>{a.label}</span><b>{a.kind === "yesno" ? (a.answer === "yes" ? "Yes" : a.answer === "no" ? "No" : a.answer) : a.answer || "No answer"}</b></>}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                  {["requested", "confirmed", "checked_in", "in_progress", "completed"].includes(b.status) ? (
                    <div className="v-acts">
                      {b.status === "requested" && act(b, "confirm", "Confirm", "btn btn-ink big")}
                      {b.status === "confirmed" && act(b, "check_in", "Check in", "btn btn-ink big")}
                      {b.status === "checked_in" && act(b, "start", "Start service", "btn btn-ink big")}
                      {b.status === "in_progress" && act(b, "complete", "Finish", "btn btn-ink big")}
                      {b.status === "confirmed" && Date.parse(b.starts_at) < now && act(b, "no_show", "No-show", "btn btn-out big", `Mark ${whoOf(b)} as a no-show? This cannot be undone here.`)}
                      {b.status === "completed" && (canPay
                        ? <Link href={`/business/checkout?booking=${b.id}`} className="btn btn-gold big">Take payment · {money(due, cur)}</Link>
                        : <p className="v-desk">Finished. The desk takes payment for this visit: {money(due, cur)} to pay.</p>)}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : null}

        {bookings.length && workLine ? <p className="foot muted">{workLine}.</p> : null}
      </div>
    </div>
  );
}
