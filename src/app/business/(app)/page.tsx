import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar, Empty, Flash, Ic, LoadError, Pill, Topbar, TopSearch } from "@/components/merchant-ui";
import { getMe, mCan, mLoad, type Row } from "@/lib/merchant-api";
import { CHANNEL_LABEL, clock, dateOnly, dayLong, dur, firstName, money, pct, plural, shortName, when } from "@/lib/merchant-format";
import { papersState, setupOpen, standing, stepsOf } from "./setup/shared";
import "../css/home.css";

export const metadata = { title: "Home" };

const mins = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };

export default async function Home({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const me = (await getMe())!;
  const { merchant: m } = me;
  const owner = mCan(me, "owner"), manager = mCan(me, "manager");
  // The setup list is for managers and the owner, so it is not asked for on behalf of anyone else.
  const [{ data: d, error }, setup] = await Promise.all([mLoad("/home"), manager ? mLoad("/onboarding") : null]);
  if (error) return <div className="main pg-home"><LoadError title="Home" error={error} /></div>;

  const tz = m.timezone, cur = m.currency;
  // If the setup list could not be loaded, Home simply goes without the card.
  const ob = setup && !setup.error ? setup.data : null;
  const showSetup = !!ob && setupOpen(ob);
  const papers = ob ? papersState(ob) : null;
  const askedForMore = papers === "needs_info" || papers === "rejected";
  const nextStep = ob ? stepsOf(ob).find((s) => !s.done) : undefined;
  const t = d.today as Row, c = d.counts as Row;
  const team = (d.team ?? []) as Row[], upNext = (d.up_next ?? []) as Row[], week = (d.week ?? []) as Row[], inbox = (d.inbox ?? []) as Row[];
  const timeOff = (d.time_off ?? []) as Row[], lowStock = (d.low_stock ?? []) as Row[];

  const hour = Number(clock(new Date(), tz).slice(0, 2));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // How full today is: booked minutes against the minutes the people working could take.
  const open = d.open_today as string[] | null;
  const working = team.filter((p) => !p.off).length;
  const openMin = open ? Math.max(0, mins(open[1]) - mins(open[0])) * Math.max(1, working) : 0;
  const full = pct(t.booked_min, openMin);
  const inChair = upNext.filter((b) => b.status === "in_progress");
  const toPay = upNext.filter((b) => b.status === "completed");

  // "Needs you": only real things, most urgent first.
  const todos: { href: string; icon: string; title: ReactNode; sub: ReactNode; pill: ReactNode }[] = [];
  for (const b of toPay.slice(0, 2)) {
    const due = b.total_cents - b.discount_cents - (b.deposit_paid ? b.deposit_cents : 0);
    todos.push({ href: `/business/checkout?booking=${b.id}`, icon: "checkout", title: `${shortName(b.client_name)} has finished · ${money(due, cur)} due`, sub: `${b.services ?? "Visit"} with ${firstName(b.staff)}${b.deposit_paid ? ` · deposit ${money(b.deposit_cents, cur)} paid` : ""}`, pill: <Pill tone="gold">Check out</Pill> });
  }
  if (c.to_confirm > 0) todos.push({ href: "/business/calendar", icon: "calendar", title: `${plural(c.to_confirm, "booking request")} waiting for you`, sub: "Clients are waiting to hear back", pill: <Pill tone="new">Confirm</Pill> });
  if (manager) for (const o of timeOff.slice(0, 2)) todos.push({ href: "/business/staff", icon: "calendar", title: `${firstName(o.staff)} asked for ${dateOnly(o.starts_on)}${o.ends_on !== o.starts_on ? ` to ${dateOnly(o.ends_on)}` : ""} off`, sub: o.bookings_affected > 0 ? `${plural(o.bookings_affected, "booking")} would need moving` : "No bookings are affected", pill: <Pill>Approve</Pill> });
  if (c.unread > 0) todos.push({ href: "/business/inbox?filter=unread", icon: "inbox", title: `${plural(c.unread, "message")} not answered yet`, sub: inbox[0] ? `${inbox[0].client_name}: ${inbox[0].last_preview}` : "Open the inbox to reply", pill: <Pill tone="new">Reply</Pill> });
  if (c.waitlist > 0 && full < 100) todos.push({ href: "/business/calendar?panel=waitlist", icon: "clock", title: `${plural(c.waitlist, "client")} on the waitlist`, sub: full < 80 ? "Today still has room. Offer them a slot." : "Offer a slot when one opens", pill: <Pill>Offer</Pill> });
  if (manager) for (const p of lowStock.slice(0, 2)) todos.push({ href: "/business/inventory?filter=low", icon: "inventory", title: `${p.name} is down to ${p.stock}`, sub: `Reorder level is ${p.reorder_at}`, pill: <Pill tone="wine">Low stock</Pill> });
  if (manager && c.unreplied_reviews > 0) todos.push({ href: "/business/storefront#reviews", icon: "star", title: `${plural(c.unreplied_reviews, "review")} without a reply`, sub: "A short reply shows new clients you care", pill: <Pill>Reply</Pill> });
  if (manager && c.services === 0) todos.push({ href: "/business/services", icon: "services", title: "Add your first service", sub: "Clients cannot book until your menu has something on it", pill: <Pill tone="wine">Set up</Pill> });
  if (owner && c.payout_accounts === 0) todos.push({ href: "/business/money/payout-account", icon: "bank", title: "Add a payout account", sub: "So the money you take can reach your bank", pill: <Pill tone="wine">Set up</Pill> });
  if (manager && c.photos === 0) todos.push({ href: "/business/storefront", icon: "storefront", title: "Add photos to your booking page", sub: "Clients want to see your work before they book", pill: <Pill>Add</Pill> });
  if (c.verification !== "verified" && !showSetup) todos.push({ href: manager ? "/business/setup#verify" : "/business/settings", icon: "shield", title: "Your listing is being checked", sub: "You can set everything up now. It goes live once our team approves it.", pill: <Pill tone="gold">In review</Pill> });

  // The note: plain sentences worked out from the numbers above.
  const weekSoFar = week.reduce((a, w) => a + w.cents, 0), weekBooked = week.reduce((a, w) => a + w.booked_cents, 0);
  const change = d.last_week_cents > 0 ? Math.round(((weekSoFar + weekBooked - d.last_week_cents) / d.last_week_cents) * 100) : null;
  const notes: ReactNode[] = [];
  if (t.bookings === 0) notes.push(open ? "Nothing is booked today yet. Walk-ins and a message to your waitlist can fill it." : "You are closed today. Enjoy the rest.");
  else notes.push(`Today is ${full}% booked: ${plural(t.bookings, "booking")}, ${dur(t.booked_min)} in the chair, ${money(t.expected_cents, cur)} expected.`);
  if (change !== null && manager) notes.push(change >= 0 ? `This week is ${change}% ahead of last week, counting what is already booked.` : `This week is ${Math.abs(change)}% behind last week so far. A quick offer can close the gap.`);
  if (manager && c.lapsed > 0) notes.push(<>{plural(c.lapsed, "client")} have not been back in 60 days. <Link href="/business/marketing">Invite them back</Link>.</>);
  if (c.waitlist > 0 && full < 80) notes.push(`${plural(c.waitlist, "person", "people")} on the waitlist could take today's free time.`);
  if (notes.length < 2) notes.push("Everything is in hand. Nothing else needs you right now.");

  const peak = Math.max(1, ...week.map((w) => w.cents + w.booked_cents));
  const maxBookings = Math.max(1, ...team.map((p) => p.bookings));

  return (
    <div className="main pg-home">
      <Topbar eyebrow={dayLong(new Date(), tz)} title={`${greeting}, ${d.first_name || firstName(m.name)}`}>
        <TopSearch action="/business/clients" placeholder="Search clients by name or phone" />
        <span style={{ flex: 1 }} />
        <Link href="/business/checkout?sale=new" className="btn btn-out">Quick sale</Link>
        <Link href="/business/calendar?new=1" className="btn btn-ink"><Ic name="plus" size={16} stroke={2.4} />New booking</Link>
      </Topbar>

      <div className="content">
        <Flash sp={sp} />
        {showSetup && ob ? (
          <section className="card setup-card" aria-label="Setup">
            <div className="hd"><h3>Get ready to take bookings</h3><Link href="/business/setup">See all steps</Link></div>
            <div className="setup-prog">
              <div className="setup-bar" role="progressbar" aria-valuemin={0} aria-valuemax={Number(ob.total)} aria-valuenow={Number(ob.done)} aria-label={`${ob.done} of ${ob.total} steps done`}><i style={{ width: `${pct(ob.done, ob.total)}%` }} /></div>
              <span>{ob.done} of {ob.total} done</span>
            </div>
            {askedForMore && !ob.live ? (
              <div className="setup-next">
                <span><b>{standing(ob)}</b><span>Upload what is missing, then send your papers again.</span></span>
                <Link href="/business/setup#verify" className="btn btn-ink btn-sm">Go to your papers</Link>
              </div>
            ) : nextStep ? (
              <div className="setup-next">
                <span><b>Next: {nextStep.title}</b><span>{nextStep.hint}</span></span>
                <Link href={nextStep.href} className="btn btn-ink btn-sm">Do this</Link>
              </div>
            ) : (
              <div className="sub">{standing(ob)}</div>
            )}
          </section>
        ) : null}
        <div className="kpis">
          <div className="kpi"><small>Bookings today</small><b>{t.bookings}</b><span>{open ? `${full}% of the day booked` : "Closed today"}</span></div>
          <div className="kpi"><small>Expected today</small><b>{money(t.expected_cents, cur)}</b><span>{money(t.paid_cents, cur)} already paid</span></div>
          <div className="kpi"><small>In the chair now</small><b>{t.in_chair}</b><span>{inChair.length ? [...new Set(inChair.map((b) => firstName(b.staff)))].join(", ") : "Nobody right now"}</span></div>
          <div className="kpi"><small>Waiting to check out</small><b>{t.to_check_out}</b><span>{toPay.length ? toPay.slice(0, 2).map((b) => shortName(b.client_name)).join(" · ") : "All settled"}</span></div>
          <div className="kpi"><small>Unread messages</small><b>{c.unread}</b><span>{c.unread ? "Waiting for a reply" : "Inbox is clear"}</span></div>
          {owner
            ? <div className="kpi"><small>Available for payout</small><b>{money(d.balances.available_cents, cur)}</b><span>{d.balances.pending_cents > 0 ? `${money(d.balances.pending_cents, cur)} more on its way` : "Nothing pending"}</span></div>
            : <div className="kpi"><small>On the waitlist</small><b>{c.waitlist}</b><span>{c.waitlist ? "Hoping for a slot" : "Nobody waiting"}</span></div>}
        </div>

        <div className="grid">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="card">
              <div className="hd"><h3>Needs you</h3><span className="muted" style={{ fontSize: 12.5 }}>{todos.length ? plural(todos.length, "thing") : "All clear"}</span></div>
              {todos.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {todos.map((x, i) => (
                    <Link key={i} href={x.href} className="todo">
                      <span className="ic"><Ic name={x.icon} /></span>
                      <span style={{ flex: 1, minWidth: 0 }}><b>{x.title}</b><span>{x.sub}</span></span>
                      {x.pill}
                    </Link>
                  ))}
                </div>
              ) : <Empty title="Nothing needs you right now">New requests, messages and low stock show up here.</Empty>}
            </div>

            <div className="card">
              <div className="hd"><h3>Up next</h3><Link href="/business/calendar">Open calendar</Link></div>
              {upNext.length ? (
                <div className="up">
                  {upNext.map((b) => (
                    <Link key={b.id} href={`/business/calendar?booking=${b.id}`} className="row">
                      <time>{clock(b.starts_at, tz)}</time>
                      <Avatar name={b.client_name} tone={b.staff_tone} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <b>{shortName(b.client_name)} · {b.services ?? "Visit"}</b>
                        <small>with {firstName(b.staff)} · {dur((Date.parse(b.ends_at) - Date.parse(b.starts_at)) / 60000)}{b.status === "in_progress" ? " · in progress" : b.status === "checked_in" ? " · arrived" : b.status === "completed" ? " · finished" : ""}</small>
                      </div>
                      {b.status === "paid" ? <Pill tone="ok">Paid</Pill> : b.status === "completed" ? <Pill tone="gold">Check out</Pill> : b.status === "requested" ? <Pill tone="new">Request</Pill> : b.deposit_paid ? <Pill tone="gold">Deposit</Pill> : null}
                    </Link>
                  ))}
                </div>
              ) : <Empty title="Nothing else today">Bookings for the rest of the day appear here.</Empty>}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="ai">
              <Ic name="spark" size={22} color="#D4AF5A" />
              <div style={{ flex: 1 }}>
                <b style={{ fontSize: 14 }}>Your {hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"} note</b>
                <ul>{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
              </div>
            </div>

            <div className="card">
              <div className="hd"><h3>Team today</h3><Link href="/business/staff">Roster</Link></div>
              <div className="staff">
                {team.map((p) => (
                  <div key={p.id} className="sc">
                    <div className="who"><Avatar text={p.initials} tone={p.tone} size={28} />{firstName(p.name)}</div>
                    <div className="m"><i style={{ width: `${p.off ? 0 : pct(p.bookings, maxBookings)}%` }} /></div>
                    <span>{p.off ? "Off today" : `${p.bookings} booked · ${money(p.cents, cur)}`}</span>
                  </div>
                ))}
              </div>
            </div>

            {manager && (
              <div className="card">
                <div className="hd"><h3>This week</h3><Link href="/business/reports">Reports</Link></div>
                <div className="bars">
                  {week.map((w) => {
                    const day = String(w.day).slice(0, 10), total = w.cents + w.booked_cents;
                    return (
                      <div key={day} className={"bar" + (day === d.date ? " today" : day < d.date ? " on" : "")} title={`${dateOnly(w.day)} · ${money(total, cur)}`}>
                        <i style={{ height: total ? Math.max(4, Math.round((total / peak) * 96)) : 0 }} />
                        <span>{dateOnly(w.day)[0]}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="sub">
                  <b style={{ color: "#1A1513" }}>{money(weekSoFar, cur)}</b> so far
                  {weekBooked > 0 ? ` · ${money(weekBooked, cur)} more booked` : ""}
                  {change !== null ? ` · ${change >= 0 ? "up" : "down"} ${Math.abs(change)}% on last week` : ""}
                </div>
              </div>
            )}

            <div className="card">
              <div className="hd"><h3>Inbox</h3><Link href="/business/inbox">Open</Link></div>
              {inbox.length ? (
                <div className="inbox">
                  {inbox.map((x) => (
                    <Link key={x.id} href={`/business/inbox?thread=${x.id}`} className="msg">
                      <span className="dot" style={x.unread_business ? undefined : { background: "transparent" }} />
                      <div style={{ flex: 1, minWidth: 0 }}><b>{x.client_name}</b> · {CHANNEL_LABEL[x.channel] ?? x.channel} · {when(x.last_message_at, tz)}<p>{x.last_preview}</p></div>
                    </Link>
                  ))}
                </div>
              ) : <Empty title="No messages yet">When a client writes, it lands here.</Empty>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
