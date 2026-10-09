import { MerchantHistoryPagination } from "@/components/merchant-history-pagination";
import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { ConfirmButton, Sheet } from "@/components/merchant-client";
import { Avatar, Empty, Flash, Fld, Ic, LoadError, Topbar } from "@/components/merchant-ui";
import { getMe, mCan, mLoad, qs, type Row } from "@/lib/merchant-api";
import { addDays, dateMed, dateOnly, dur, firstName, money, pct, plural, ymd } from "@/lib/merchant-format";
import { timeOffDecide } from "../actions";
import { rentAction, staffAction, staffCreate, staffHours, staffInvite, staffSave, staffUninvite, timeOffCreate, timeOffReassign } from "./actions";
import { HoursEditor } from "./hours-editor";
import "../../css/staff.css";

export const metadata = { title: "Staff" };

type SP = { [key: string]: string | undefined; ok?: string; err?: string; tab?: string; week?: string; staff?: string; hours?: string; from?: string; to?: string; new?: string };
type Hours = Record<string, string[] | null> | null;

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_NAME = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const ROLE: Record<string, string> = { owner: "Owner", manager: "Manager", staff: "Team member" };
const TABS = [["roster", "Roster"], ["timeoff", "Time off"], ["pay", "Commission & pay"], ["rent", "Chair rental"]];
const PAY: Record<string, string> = { commission: "Commission only", hourly: "Hourly + commission", salary: "Salary + commission", owner: "Owner", renter: "Chair renter" };
const PERMS: [string, string][] = [["see_all_calendars", "See other staff's calendars"], ["take_payments", "Take payments and refunds"], ["see_reports", "See reports and payroll"]];
const METHOD: Record<string, string> = { cash: "Cash", transfer: "Bank transfer", card: "Card", other: "Other" };
const major = (cents: number | null | undefined) => (cents ? String(cents / 100) : "");
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const mins = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const hm = (hhmm: string) => hhmm.replace(/^0/, "");
const day10 = (v: string) => String(v).slice(0, 10);
const span = (o: Row) => dateOnly(o.starts_on) + (day10(o.ends_on) !== day10(o.starts_on) ? ` to ${dateOnly(o.ends_on)}` : "");

/** The fields that describe a person: the same for a new one and for one being changed. */
function RentFields({ p, cur, id }: { p?: Row; cur: string; id: string }) {
  return (
    <>
      <input type="hidden" name="has_rent" value="1" />
      <div className="field"><label htmlFor={id + "tn"}>Their business name</label><input id={id + "tn"} name="trading_name" type="text" maxLength={80} defaultValue={p?.trading_name ?? ""} placeholder="Lash Haus" /></div>
      <div className="two">
        <div className="field"><label htmlFor={id + "rent"}>Rent ({cur})</label><input id={id + "rent"} name="rent" type="number" min={0} step="0.01" inputMode="decimal" defaultValue={major(p?.rent_cents)} /></div>
        <div className="field"><label htmlFor={id + "rp"}>Charged</label><select id={id + "rp"} name="rent_period" defaultValue={p?.rent_period ?? "weekly"}><option value="weekly">Every week</option><option value="monthly">Every month</option></select></div>
      </div>
      <div>
        <div className="cap">Days the chair is theirs</div>
        <div className="daypick">{DAYS.map((d, i) => <label key={d}><input type="checkbox" name="rent_days" value={d} defaultChecked={((p?.rent_days ?? []) as string[]).includes(d)} /><span>{DAY_NAME[i]}</span></label>)}</div>
      </div>
    </>
  );
}

function PersonFields({ p, owner, id, cur }: { p?: Row; owner: boolean; id: string; cur: string }) {
  const lockedOwner = p?.role === "owner" && !owner;
  if (p?.pay_type === "renter") {
    return (
      <>
        <input type="hidden" name="role" value={p.role} /><input type="hidden" name="level" value={p.level} />
        <input type="hidden" name="commission" value={p.commission_pct} /><input type="hidden" name="retail_commission" value={p.retail_commission_pct} />
        <div className="field"><label htmlFor={id + "n"}>Name on the roster</label><input id={id + "n"} name="name" type="text" required maxLength={60} defaultValue={p.name} /></div>
        <div className="field">
          <label htmlFor={id + "pt"}>Pay</label>
          <select id={id + "pt"} name="pay_type" defaultValue="renter">
            <option value="renter">Chair renter</option><option value="commission">Commission only</option><option value="hourly">Hourly + commission</option><option value="salary">Salary + commission</option>
          </select>
        </div>
        <RentFields p={p} cur={cur} id={id} />
        <div className="two">
          <div className="field"><label htmlFor={id + "e"}>Email</label><input id={id + "e"} name="email" type="email" defaultValue={p.email ?? ""} /></div>
          <div className="field"><label htmlFor={id + "ph"}>Phone</label><input id={id + "ph"} name="phone" type="tel" defaultValue={p.phone ?? ""} /></div>
        </div>
        <div className="field"><label htmlFor={id + "t"}>Colour on the roster</label><input id={id + "t"} name="tone" type="color" defaultValue={p.tone ?? "#9A8E85"} style={{ padding: 4 }} /></div>
      </>
    );
  }
  return (
    <>
      <div className="field"><label htmlFor={id + "n"}>Name</label><input id={id + "n"} name="name" type="text" required maxLength={60} defaultValue={p?.name ?? ""} /></div>
      <div className="two">
        <div className="field">
          <label htmlFor={id + "r"}>Role</label>
          {lockedOwner ? <><input type="hidden" name="role" value="owner" /><input id={id + "r"} type="text" value="Owner" disabled readOnly /></> : (
            <select id={id + "r"} name="role" defaultValue={p?.role ?? "staff"}>
              <option value="staff">Team member</option>
              <option value="manager">Manager</option>
              {owner && <option value="owner">Owner</option>}
            </select>
          )}
        </div>
        <div className="field">
          <label htmlFor={id + "l"}>Level</label>
          <select id={id + "l"} name="level" defaultValue={p?.level ?? "senior"}><option value="junior">Junior</option><option value="senior">Senior</option><option value="master">Master</option></select>
        </div>
      </div>
      <div className="field">
        <label htmlFor={id + "pt"}>Pay</label>
        <select id={id + "pt"} name="pay_type" defaultValue={p?.pay_type ?? "commission"}>
          <option value="commission">Commission only</option><option value="hourly">Hourly + commission</option><option value="salary">Salary + commission</option><option value="owner">Owner: takes what is left, no commission</option>
          {p ? <option value="renter">Chair renter: set the rent after saving</option> : null}
        </select>
      </div>
      <div className="two">
        <div className="field"><label htmlFor={id + "hr"}>Hourly rate ({cur})</label><input id={id + "hr"} name="hourly" type="number" min={0} step="0.01" inputMode="decimal" defaultValue={major(p?.hourly_cents)} /></div>
        <div className="field"><label htmlFor={id + "sal"}>Salary a month ({cur})</label><input id={id + "sal"} name="salary" type="number" min={0} step="0.01" inputMode="decimal" defaultValue={major(p?.salary_cents)} /></div>
      </div>
      <small className="hint">The hourly rate counts with hourly pay, on rostered hours without breaks or approved time off. The salary counts with salary pay, by the day.</small>
      <div className="two">
        <div className="field"><label htmlFor={id + "c"}>Service commission %</label><input id={id + "c"} name="commission" type="number" min={0} max={100} step="0.5" defaultValue={p?.commission_pct ?? 0} /></div>
        <div className="field"><label htmlFor={id + "rc"}>Retail commission %</label><input id={id + "rc"} name="retail_commission" type="number" min={0} max={100} step="0.5" defaultValue={p?.retail_commission_pct ?? 0} /></div>
      </div>
      <div className="two">
        <div className="field"><label htmlFor={id + "e"}>Email</label><input id={id + "e"} name="email" type="email" defaultValue={p?.email ?? ""} /></div>
        <div className="field"><label htmlFor={id + "ph"}>Phone</label><input id={id + "ph"} name="phone" type="tel" defaultValue={p?.phone ?? ""} /></div>
      </div>
      <div className="field"><label htmlFor={id + "t"}>Colour on the calendar</label><input id={id + "t"} name="tone" type="color" defaultValue={p?.tone ?? "#7A1F2B"} style={{ padding: 4 }} /></div>
    </>
  );
}

function TimeOffForm({ back, people, staffId, manager, today }: { back: string; people: Row[]; staffId: string; manager: boolean; today: string }) {
  return (
    <form action={timeOffCreate}>
      <input type="hidden" name="back" value={back} />
      {manager ? (
        <Fld label="Who"><select name="staff_id" defaultValue={staffId} required>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Fld>
      ) : <input type="hidden" name="staff_id" value={staffId} />}
      <div className="f2">
        <Fld label="First day"><input type="date" name="starts_on" required min={addDays(today, -14)} defaultValue={today} /></Fld>
        <Fld label="Last day" hint="Leave empty for one day."><input type="date" name="ends_on" /></Fld>
      </div>
      <Fld label="Reason"><input type="text" name="reason" maxLength={120} placeholder="Holiday, training, family" /></Fld>
      <div className="muted" style={{ fontSize: 12.5 }}>
        {manager ? "It is approved at once and those days stop taking bookings. Bookings already made stay where they are: move them from the calendar." : "A manager will approve or decline it. You stay bookable until then."}
      </div>
      <div className="sheet-ft"><button className="btn btn-ink">{manager ? "Add time off" : "Send request"}</button></div>
    </form>
  );
}

export default async function Staff({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const me = (await getMe())!;
  const { merchant: m } = me;
  const manager = mCan(me, "manager"), owner = mCan(me, "owner");
  const weekAsk = sp.week && ISO_DAY.test(sp.week) ? sp.week : "";
  const from = sp.from && ISO_DAY.test(sp.from) ? sp.from : "", to = sp.to && ISO_DAY.test(sp.to) ? sp.to : "";
  const [{ data, error }, pay] = await Promise.all([
    mLoad("/staff" + qs({ ...sp, week: weekAsk })),
    manager ? mLoad("/payroll" + qs({ from, to })) : Promise.resolve({ data: {} as Row, error: "", status: 200 }),
  ]);
  if (error) return <div className="main pg-staff"><LoadError title="Staff & rosters" error={error} /></div>;

  const tz = m.timezone, cur = m.currency, today = ymd(new Date(), tz);
  const everyone = (data.staff ?? []) as Row[], team = everyone.filter((p) => !p.archived);
  const loc = (data.location_hours ?? null) as Hours, services = (data.services ?? []) as Row[];
  const workers = team.filter((p) => p.pay_type !== "renter");
  const timeOff = (data.time_off ?? []) as Row[], asked = timeOff.filter((o) => o.status === "requested");
  const payroll = (pay.data.payroll ?? []) as Row[];
  const payFrom = String(pay.data.from ?? from), payTo = String(pay.data.to ?? to);
  const rent = (data.rent ?? []) as Row[], renters = (pay.data.renters ?? []) as Row[];
  const permDefaults = (data.permission_defaults ?? {}) as Record<string, boolean>;
  const isRenter = (p: Row) => p.pay_type === "renter";
  const breaksOf = (p: Row, d: string) => (((p.breaks ?? {}) as Record<string, string[][]>)[d] ?? []).filter((b) => b.length === 2);
  const rentDueCount = ((data.rent_due ?? []) as Row[]).reduce((sum,c) => sum + Number(c.charges ?? 0),0);
  const owed = (p: Row) => Number(((data.rent_due ?? []) as Row[]).find(c => c.staff_id === p.id)?.cents ?? 0);
  const rentDays = (p: Row) => { const d = DAYS.map((k, i) => (((p.rent_days ?? []) as string[]).includes(k) ? i : -1)).filter((i) => i >= 0); return !d.length ? "no days set" : d.length > 1 && d[d.length - 1] - d[0] === d.length - 1 ? `${DAY_NAME[d[0]]} to ${DAY_NAME[d[d.length - 1]]}` : d.map((i) => DAY_NAME[i]).join(", "); };
  const week = String(data.week), days = DAYS.map((_, i) => addDays(week, i));
  const tab = TABS.some(([id]) => id === sp.tab) ? sp.tab! : "roster";
  const sel = everyone.find((p) => p.id === sp.staff) ?? everyone.find((p) => p.id === m.staff_id) ?? everyone[0];
  const href = (extra: Record<string, string | undefined> = {}) => "/business/staff" + qs({ tab: tab === "roster" ? "" : tab, week: weekAsk, staff: sp.staff, from, to, ...extra });
  const back = href();

  const hoursOf = (p: Row) => (p.hours ?? loc ?? {}) as Record<string, string[] | null>;
  const offOn = (p: Row, day: string, status: string) => timeOff.find((o) => o.staff_id === p.id && o.status === status && day10(o.starts_on) <= day && day <= day10(o.ends_on));
  const rostered = (p: Row) => DAYS.reduce((a, d, i) => { const h = hoursOf(p)[d]; return a + (h && !offOn(p, days[i], "approved") ? Math.max(0, mins(h[1]) - mins(h[0]) - breaksOf(p, d).reduce((x, b) => x + Math.max(0, mins(b[1]) - mins(b[0])), 0)) : 0); }, 0);
  const pattern = (p: Row) => {
    const open = DAYS.map((d, i) => (hoursOf(p)[d] ? i : -1)).filter((i) => i >= 0);
    if (!open.length) return "No working days";
    const joined = open[open.length - 1] - open[0] === open.length - 1;
    return open.length === 1 ? DAY_NAME[open[0]] : joined ? `${DAY_NAME[open[0]]} to ${DAY_NAME[open[open.length - 1]]}` : open.map((i) => DAY_NAME[i]).join(", ");
  };
  const state = (p: Row): [string, string] => {
    if (p.archived) return ["Left the team", "pill-grey"];
    if (isRenter(p)) return ["Renter", "pill-grey"];
    if (offOn(p, today, "approved")) return ["Off today", "pill-wine"];
    if (asked.some((o) => o.staff_id === p.id)) return ["Time off requested", "pill-gold"];
    if (!p.bookable) return ["Not bookable", "pill-grey"];
    return ["Working", "pill-ok"];
  };
  const since = (p: Row) => new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: tz }).format(new Date(p.created_at));
  const selPay = sel ? payroll.find((x) => x.id === sel.id) : undefined;
  const selHours = sel ? hoursOf(sel) : {};
  const mayEdit = manager && sel && !sel.archived;
  const full = !!sel && (sel.login_role === "manager" || sel.login_role === "owner");
  const total = (k: string) => payroll.reduce((a, x) => a + Number(x[k] ?? 0), 0);
  const [, d0, mo0] = dateOnly(week).split(" ");
  const thisMonday = addDays(today, -((new Date(today + "T12:00:00Z").getUTCDay() + 6) % 7));

  return (
    <div className="main pg-staff">
      <Topbar title="Staff & rosters">
        <nav className="seg" aria-label="Sections">
          {TABS.filter(([id]) => (id !== "pay" && id !== "rent") || manager).map(([id, name]) => (
            <Link key={id} href={"/business/staff" + qs({ tab: id === "roster" ? "" : id, week: weekAsk, staff: sp.staff })} className={tab === id ? "on" : ""} aria-current={tab === id ? "page" : undefined}>
              {name}{id === "timeoff" && asked.length ? ` (${asked.length})` : ""}{id === "rent" && rentDueCount > 0 ? ` (${rentDueCount})` : ""}
            </Link>
          ))}
        </nav>
        <span style={{ flex: 1 }} />
        {manager && <a href={"/business/staff/export" + qs({ from, to })} className="btn btn-out" download><Ic name="download" size={16} />Export payroll</a>}
        {manager && (
          <Sheet trigger={<><Ic name="plus" size={16} stroke={2.4} />Add staff</>} triggerClass="btn btn-ink" title="Add to the team" sub="They follow the location hours and can do every service until you change it." open={sp.new === "1"} closeHref={back}>
            <form action={staffCreate}>
              <input type="hidden" name="back" value={back} />
              <PersonFields owner={owner} id="new-" cur={cur} />
              <label className="chk"><input type="checkbox" name="bookable" defaultChecked />Clients can book them</label>
              <div className="rentbox">
                <label className="chk"><input type="checkbox" name="renter" /><span><b>This person rents a chair from you</b></span></label>
                <div className="muted" style={{ fontSize: 12.5 }}>A renter runs their own book and keeps their own takings, so clients do not book them here and they earn no commission. Fill in the rent below. Pay and commission above are then ignored.</div>
                <RentFields cur={cur} id="new-" />
              </div>
              <div className="muted" style={{ fontSize: 12.5 }}>This adds them to the roster. To let them sign in, the owner sends an invite from their card afterwards.</div>
              <div className="sheet-ft"><button className="btn btn-ink">Add to the team</button></div>
            </form>
          </Sheet>
        )}
      </Topbar>

      <div className="content">
        <Flash sp={sp} />
        {asked.filter((o) => manager || o.staff_id === m.staff_id).map((o) => (
          <div key={o.id} className="req">
            <Ic name="calendar" size={20} color="#7A5A12" />
            <span style={{ flex: 1, minWidth: 180 }}>
              <b>{firstName(o.staff)}</b> requested time off {span(o)}{o.reason ? ` (${o.reason})` : ""}.{" "}
              {o.bookings_affected > 0 ? <>{plural(o.bookings_affected, "booking")} would need moving. <Link href={`/business/calendar?date=${day10(o.starts_on)}`}>Open the calendar</Link></> : "No bookings are affected."}
            </span>
            {manager ? (
              <form action={timeOffDecide} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input type="hidden" name="back" value={back} />
                <input type="hidden" name="id" value={o.id} />
                <button className="btn btn-out btn-sm" name="decision" value="decline">Decline</button>
                <button className={"btn btn-sm " + (o.bookings_affected > 0 ? "btn-out" : "btn-ink")} name="decision" value="approve">Approve</button>
                {o.bookings_affected > 0 && <button className="btn btn-ink btn-sm" formAction={timeOffReassign}>Approve and reassign</button>}
              </form>
            ) : <span className="pill pill-gold">Waiting for a manager</span>}
          </div>
        ))}

        {tab === "roster" && (
          <div className="wrap">
            <div className="left">
              {everyone.length ? (
                <div className="cards">
                  {everyone.map((p) => {
                    const [label, cls] = state(p), roster = rostered(p);
                    return (
                      <Link key={p.id} href={href({ staff: p.id, hours: undefined })} className={"scard" + (sel?.id === p.id ? " on" : "")} aria-current={sel?.id === p.id ? "true" : undefined}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Avatar text={p.initials} tone={p.archived ? "#9A8E85" : p.tone} />
                          <div style={{ flex: 1, minWidth: 0 }}><b>{p.name}</b><span>{isRenter(p) ? `Independent${p.trading_name ? ` · ${p.trading_name}` : ""}` : `${ROLE[p.role] ?? p.role} · ${p.level}`}</span></div>
                          <span className={"pill " + cls}>{label}</span>
                        </div>
                        {isRenter(p) ? (
                          <div className="mini">
                            <div><b>{money(p.rent_cents, cur)}</b><small>{p.rent_period === "monthly" ? "A month" : "A week"}</small></div>
                            <div><b>{((p.rent_days ?? []) as string[]).length}</b><small>Days</small></div>
                            <div><b>{manager ? money(owed(p), cur) : "Own book"}</b><small>{manager ? "Owed" : "Bookings"}</small></div>
                          </div>
                        ) : <div className="mini">
                          <div><b>{p.week_bookings}</b><small>Bookings</small></div>
                          <div><b>{roster > 0 ? `${pct(p.week_booked_min, roster)}%` : dur(p.week_booked_min)}</b><small>Booked</small></div>
                          {manager ? <div><b>{money(p.week_cents, cur)}</b><small>Revenue</small></div> : <div><b>{Number(p.rating) > 0 ? Number(p.rating).toFixed(1) : "New"}</b><small>Rating</small></div>}
                        </div>}
                      </Link>
                    );
                  })}
                </div>
              ) : <Empty title="Nobody on the team yet">{manager ? "Add the people who take bookings." : "A manager or the owner can add the team."}</Empty>}

              {team.length > 0 && (
                <div className="rosterbox">
                  <div className="roster">
                    <div className="rhead">
                      <div className="wk">
                        <Link href={href({ week: addDays(week, -7), hours: undefined })} aria-label="Week before"><Ic name="chevL" size={14} stroke={2.4} /></Link>
                        <span>Week of {d0} {mo0}</span>
                        <Link href={href({ week: addDays(week, 7), hours: undefined })} aria-label="Week after"><Ic name="chevR" size={14} stroke={2.4} /></Link>
                      </div>
                      {days.map((day, i) => <div key={day} className={day === today ? "now" : ""}>{DAY_NAME[i]}<b>{Number(day.slice(8))}</b></div>)}
                    </div>
                    {team.map((p) => (
                      <div key={p.id} className="rrow">
                        <div className="who">
                          <Avatar text={p.initials} tone={p.tone} />
                          <div><b>{p.name}</b><span>{isRenter(p) ? `Rental · ${rentDays(p)}` : `${dur(rostered(p))} · ${pattern(p)}`}</span></div>
                        </div>
                        {days.map((day, i) => {
                          const h = hoursOf(p)[DAYS[i]], off = offOn(p, day, "approved"), ask = offOn(p, day, "requested");
                          const rented = isRenter(p) && ((p.rent_days ?? []) as string[]).includes(DAYS[i]);
                          const brk = breaksOf(p, DAYS[i]).map((b) => hm(b[0])).join(", ");
                          const cls = "shift" + (isRenter(p) ? (rented ? " rent" : " off") : off ? " leave" : h ? "" : " off");
                          const inner = isRenter(p) ? (rented ? <><b>Rented</b><span>{p.trading_name || "chair rental"}</span></> : <><b>{h ? "Free" : "Off"}</b><span>{h ? "chair not rented" : ""}</span></>)
                            : off ? <><b>Off</b><span>{off.reason || "time off"}</span></>
                            : h ? <><b>{hm(h[0])} to {hm(h[1])}</b><span>{ask ? "time off requested" : brk ? `break ${brk}` : p.hours ? "own hours" : ""}</span></>
                              : <><b>Off</b><span>{ask ? "time off requested" : ""}</span></>;
                          return (
                            <div key={day} className="cell">
                              {manager ? <Link href={href({ staff: p.id, hours: isRenter(p) ? undefined : "1" })} className={cls} aria-label={`${p.name}, ${DAY_LONG[i]}: ${isRenter(p) ? "open the rental" : "change hours"}`}>{inner}</Link> : <div className={cls}>{inner}</div>}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="muted" style={{ fontSize: 12.5 }}>
                {week !== thisMonday ? <><Link href={href({ week: undefined, hours: undefined })}>Back to this week</Link>. </> : null}
                {manager ? "Select a shift to change that person's week. " : ""}A person's hours and breaks repeat every week until they are changed. People without their own hours follow the location hours. Approved time off shows as off. A rented chair shows the renter's days: they run their own bookings.
              </div>
            </div>

            {sel && (
              <aside className="panel" aria-label="Selected person">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar text={sel.initials} tone={sel.archived ? "#9A8E85" : sel.tone} size={48} style={{ fontSize: 15 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="serif" style={{ fontSize: 24, fontWeight: 600, lineHeight: 1 }}>{sel.name}</div>
                    <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{isRenter(sel) ? `Chair renter${sel.trading_name ? ` · ${sel.trading_name}` : ""}` : `${ROLE[sel.role] ?? sel.role} · ${sel.level}`} · since {since(sel)}</div>
                  </div>
                </div>

                {mayEdit ? (
                  <form action={staffSave} key={sel.id} className="pform">
                    <input type="hidden" name="back" value={back} />
                    <input type="hidden" name="id" value={sel.id} />
                    {!isRenter(sel) && <input type="hidden" name="has_services" value="1" />}
                    <PersonFields p={sel} owner={owner} id="ed-" cur={cur} />
                    {isRenter(sel) && (
                      <div style={{ background: "#F6EBD2", color: "#7A5A12", borderRadius: 12, padding: "10px 12px", fontSize: 13 }}>
                        <b>{money(sel.rent_cents, cur)} {sel.rent_period === "monthly" ? "a month" : "a week"}</b> · {owed(sel) > 0 ? `${money(owed(sel), cur)} owed` : "nothing owed"}. <Link href="/business/staff?tab=rent">Chair rental</Link>
                        <div style={{ marginTop: 4 }}>LogaLuxe records the rent and does not collect it. A renter is not booked through your page and earns no commission.</div>
                      </div>
                    )}
                    {!isRenter(sel) && <div>
                      <div className="cap">Can perform</div>
                      {services.length ? (
                        <div className="svcs">
                          {services.map((sv) => <label key={sv.id} className="chk"><input type="checkbox" name="svc" value={sv.id} defaultChecked={(sel.service_ids as string[]).includes(sv.id)} /><span>{sv.name}<small>{sv.category}</small></span></label>)}
                        </div>
                      ) : <div className="muted" style={{ fontSize: 13 }}>No services on the menu yet. <Link href="/business/services">Add services</Link></div>}
                    </div>}
                    {!isRenter(sel) && <div>
                      <div className="cap">Permissions</div>
                      <label className="perm"><span>Bookable online</span><input type="checkbox" name="bookable" defaultChecked={!!sel.bookable} className="tick" /></label>
                      {!full && <input type="hidden" name="has_perms" value="1" />}
                      {PERMS.map(([k, label]) => (
                        <label key={k} className="perm"><span>{label}</span><input type="checkbox" name={k} className="tick" disabled={full} defaultChecked={full || (((sel.permissions ?? {}) as Record<string, boolean>)[k] ?? permDefaults[k] ?? false)} /></label>
                      ))}
                      <div className="perm"><span>Signs in</span><b>{sel.login_email ? `${sel.login_email} · ${ROLE[sel.login_role] ?? sel.login_role}` : "No sign-in"}</b></div>
                      <small className="hint">{full ? `${firstName(sel.name)} signs in as ${sel.login_role === "owner" ? "the owner" : "a manager"}, who can always do all three.` : "These three apply to a team member sign-in. Managers and the owner can always do all three."}</small>
                    </div>}
                    {selPay && (
                      <div style={{ background: "#F4ECE2", borderRadius: 12, padding: "10px 12px", fontSize: 13 }}>
                        <b>{dateOnly(payFrom)} to {dateOnly(payTo)}:</b> {money(selPay.service_cents, cur)} services · {money(selPay.tips_cents, cur)} tips{selPay.wage_cents > 0 ? ` · ${money(selPay.wage_cents, cur)} ${selPay.pay_type === "salary" ? "salary" : "wage"}` : ""}{selPay.service_commission_cents + selPay.retail_commission_cents > 0 ? ` · ${money(selPay.service_commission_cents + selPay.retail_commission_cents, cur)} commission` : ""} · <b>{money(selPay.earned_cents, cur)} earned</b>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8 }}><button className="btn btn-ink btn-sm" style={{ flex: 1 }}>Save</button></div>
                  </form>
                ) : (
                  <>
                    <dl className="kv">
                      <dt>This week</dt><dd>{plural(sel.week_bookings, "booking")} · {dur(sel.week_booked_min)}</dd>
                      <dt>Rostered</dt><dd>{dur(rostered(sel))} · {pattern(sel)}</dd>
                      <dt>Hours</dt><dd>{sel.hours ? "Own hours" : "Follows the location"}</dd>
                      <dt>Can perform</dt><dd>{(sel.service_ids as string[]).length === services.length && services.length ? "Every service" : plural(services.filter((sv) => (sel.service_ids as string[]).includes(sv.id)).length, "service")}</dd>
                      <dt>Bookable online</dt><dd>{sel.bookable ? "Yes" : "No"}</dd>
                      {Number(sel.rating) > 0 && <><dt>Rating</dt><dd>{Number(sel.rating).toFixed(1)}</dd></>}
                    </dl>
                    {manager && sel.archived && (
                      <form action={staffAction}>
                        <input type="hidden" name="back" value={back} />
                        <input type="hidden" name="id" value={sel.id} />
                        <button className="btn btn-ink btn-sm" name="action" value="restore" style={{ width: "100%" }}>Bring back to the team</button>
                      </form>
                    )}
                  </>
                )}

                {!sel.archived && (manager || sel.id === m.staff_id) && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {manager && !isRenter(sel) && (
                      <Sheet trigger="Edit hours" triggerClass="btn btn-out btn-sm" title={`${firstName(sel.name)}'s week`} sub="Hours and breaks repeat every week until you change them." open={sp.hours === "1"} closeHref={href({ staff: sel.id, hours: undefined })}>
                        <form action={staffHours} key={sel.id}>
                          <input type="hidden" name="back" value={href({ staff: sel.id, hours: undefined })} />
                          <input type="hidden" name="id" value={sel.id} />
                          <div className="muted" style={{ fontSize: 12.5 }}>{loc ? `The location is open ${DAYS.filter((d) => loc[d]).map((d, i, a) => `${DAY_NAME[DAYS.indexOf(d)]} ${hm(loc[d]![0])} to ${hm(loc[d]![1])}${i < a.length - 1 ? "," : "."}`).join(" ") || "on no days yet."}` : "The location has no opening hours yet. Set them in Settings."}</div>
                          <HoursEditor key={sel.id} who={firstName(sel.name)} follow={!sel.hours} days={DAYS.map((d, i) => ({ key: d, name: DAY_LONG[i], open: !!selHours[d], from: selHours[d]?.[0] ?? "09:00", to: selHours[d]?.[1] ?? "18:00", breaks: breaksOf(sel, d).map((b) => [b[0], b[1]] as [string, string]) }))} />
                          <div className="muted" style={{ fontSize: 12.5 }}>Nobody can be booked during a break. Bookings already made are not moved.</div>
                          <div className="sheet-ft"><button className="btn btn-ink">Save hours</button></div>
                        </form>
                      </Sheet>
                    )}
                    {!isRenter(sel) && <Sheet trigger={manager ? "Time off" : "Ask for time off"} triggerClass="btn btn-out btn-sm" title={manager ? "Add time off" : "Ask for time off"}>
                      <TimeOffForm back={back} people={workers} staffId={sel.id} manager={manager} today={today} />
                    </Sheet>}
                    {manager && sel.role !== "owner" && (
                      <form action={staffAction}>
                        <input type="hidden" name="back" value={back} />
                        <input type="hidden" name="id" value={sel.id} />
                        <input type="hidden" name="action" value="archive" />
                        <ConfirmButton className="btn btn-out btn-sm" style={{ color: "#9B2335" }} message={`Remove ${sel.name} from the team? Their history is kept and their sign-in stops working here. This is refused while they have upcoming bookings.`}>Remove</ConfirmButton>
                      </form>
                    )}
                  </div>
                )}

                {owner && !sel.archived && sel.login_role !== "owner" && !isRenter(sel) && (
                  <div className="signin">
                    <div className="cap">Sign-in</div>
                    <form action={staffInvite} className="stack" style={{ gap: 10 }}>
                      <input type="hidden" name="back" value={back} />
                      <input type="hidden" name="id" value={sel.id} />
                      {sel.login_email
                        ? <><input type="hidden" name="email" value={sel.login_email} /><input type="hidden" name="change" value="1" /><div style={{ fontSize: 13 }}>{firstName(sel.name)} signs in as <b>{sel.login_email}</b>.</div></>
                        : <div className="field"><label htmlFor="inv-e">Email to invite</label><input id="inv-e" name="email" type="email" required defaultValue={sel.email ?? ""} placeholder="name@example.com" /></div>}
                      <div className="field">
                        <label htmlFor="inv-r">What they can do</label>
                        <select id="inv-r" name="login_role" defaultValue={sel.login_role === "manager" ? "manager" : "staff"}>
                          <option value="staff">Team member: calendar, clients, checkout, inbox</option>
                          <option value="manager">Manager: also the menu, team, stock, marketing and reports</option>
                        </select>
                      </div>
                      <button className="btn btn-out btn-sm">{sel.login_email ? "Change what they can do" : "Send invite"}</button>
                      {!sel.login_email && <div className="muted" style={{ fontSize: 12 }}>They get an email with a link to choose a password. Someone who already has a LogaLuxe account is added without an email.</div>}
                    </form>
                    {sel.login_email && (
                      <form action={staffUninvite}>
                        <input type="hidden" name="back" value={back} />
                        <input type="hidden" name="id" value={sel.id} />
                        <ConfirmButton className="btn btn-ghost btn-sm" message={`Remove the sign-in of ${sel.name}? They stay on the roster but can no longer open this business.`}>Remove sign-in</ConfirmButton>
                      </form>
                    )}
                  </div>
                )}
              </aside>
            )}
          </div>
        )}

        {tab === "timeoff" && (
          <div className="card">
            <div className="hd">
              <h3>Time off</h3>
              {(manager || m.staff_id) && workers.length > 0 && (
                <Sheet trigger={manager ? "Add time off" : "Ask for time off"} triggerClass="btn btn-ink btn-sm" title={manager ? "Add time off" : "Ask for time off"}>
                  <TimeOffForm back={back} people={workers} staffId={manager ? (sel && !sel.archived && !isRenter(sel) ? sel.id : workers[0]?.id ?? "") : m.staff_id} manager={manager} today={today} />
                </Sheet>
              )}
            </div>
            {timeOff.length ? (
              <DataTable id="time-off" search="Search time off" filters={["Who", "Status"]} pageSize={10} noun="entry">
                <table className="tbl">
                  <thead><tr><th>Who</th><th>Days</th><th>Reason</th><th>Bookings affected</th><th>Status</th>{manager && <th data-nosort><span className="sr">Actions</span></th>}</tr></thead>
                  <tbody>
                    {timeOff.map((o) => {
                      const n = Math.round((Date.parse(day10(o.ends_on)) - Date.parse(day10(o.starts_on))) / 864e5) + 1;
                      return (
                        <tr key={o.id}>
                          <td><b>{o.staff}</b></td>
                          <td style={{ whiteSpace: "nowrap" }} data-sort={day10(o.starts_on)}>{span(o)}<small className="muted" style={{ display: "block" }}>{plural(n, "day")}</small></td>
                          <td>{o.reason || <span className="muted">Not given</span>}</td>
                          <td data-sort={o.bookings_affected}>{o.bookings_affected > 0 ? <Link href={`/business/calendar?date=${day10(o.starts_on)}`}>{plural(o.bookings_affected, "booking")} to move</Link> : <span className="muted">None</span>}</td>
                          <td><span className={"pill " + (o.status === "approved" ? "pill-ok" : o.status === "requested" ? "pill-gold" : "pill-grey")}>{o.status === "approved" ? "Approved" : o.status === "requested" ? "Requested" : "Declined"}</span></td>
                          {manager && (
                            <td>
                              <form action={timeOffDecide} style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                <input type="hidden" name="back" value={back} />
                                <input type="hidden" name="id" value={o.id} />
                                {o.status === "requested" && <button className="btn btn-ink btn-sm" name="decision" value="approve">Approve</button>}
                                {o.status === "requested" && o.bookings_affected > 0 && <button className="btn btn-out btn-sm" formAction={timeOffReassign}>Approve and reassign</button>}
                                {o.status === "requested" && <button className="btn btn-out btn-sm" name="decision" value="decline">Decline</button>}
                                <ConfirmButton className="btn btn-ghost btn-sm" name="decision" value="cancel" message={`Remove this time off for ${o.staff}? Those days become bookable again.`}>Remove</ConfirmButton>
                              </form>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </DataTable>
            ) : <Empty title="No time off">Requests and approved days from the last two weeks onwards show here.</Empty>}
            <div className="sub">Approved days cannot be booked online or from the calendar. Bookings made before the approval stay until someone moves them.</div>
          </div>
        )}

        {tab === "pay" && manager && (
          <>
            <div className="card">
              <div className="hd" style={{ flexWrap: "wrap" }}>
                <h3>Pay, {dateOnly(payFrom, "med")} to {dateOnly(payTo, "med")}</h3>
                <form action="/business/staff" className="rowx">
                  <input type="hidden" name="tab" value="pay" />
                  <input className="inp" style={{ width: 150 }} type="date" name="from" defaultValue={payFrom} aria-label="From" />
                  <span className="muted">to</span>
                  <input className="inp" style={{ width: 150 }} type="date" name="to" defaultValue={payTo} aria-label="To" />
                  <button className="btn btn-out btn-sm">Show</button>
                </form>
              </div>
              {pay.error ? <div role="alert" className="flash flash-err">{pay.error}</div> : payroll.length ? (
                <div className="boxed">
                  <DataTable id="payroll" search="Search people" filters={["Pay"]} pageSize={25} noun="team member" tools={<a href={"/business/staff/export" + qs({ from, to })} className="btn btn-out btn-sm" download>Download CSV</a>}>
                    <table className="tbl">
                      <thead><tr><th>Person</th><th>Pay</th><th className="num">Hours</th><th className="num" data-col="Wage">Wage or salary</th><th className="num">Sales</th><th className="num">Services</th><th className="num">Rate</th><th className="num">Commission</th><th className="num">Retail</th><th className="num" data-col="Retail rate">Rate</th><th className="num" data-col="Retail commission">Commission</th><th className="num">Tips</th><th className="num">Earned</th></tr></thead>
                      <tbody>
                        {payroll.map((x) => (
                          <tr key={x.id}>
                            <td><b>{x.name}</b></td>
                            <td data-filter={PAY[x.pay_type] ?? x.pay_type}>{PAY[x.pay_type] ?? x.pay_type}{x.pay_type === "hourly" ? <small className="muted" style={{ display: "block" }}>{money(x.hourly_cents, cur)} an hour</small> : x.pay_type === "salary" ? <small className="muted" style={{ display: "block" }}>{money(x.salary_cents, cur)} a month</small> : null}</td>
                            <td className="num" data-sort={x.rostered_min}>{dur(x.rostered_min)}</td>
                            <td className="num" data-sort={x.wage_cents}>{x.wage_cents > 0 ? money(x.wage_cents, cur) : <span className="muted">None</span>}</td>
                            <td className="num">{x.sales}</td>
                            <td className="num" data-sort={x.service_cents}>{money(x.service_cents, cur)}</td>
                            <td className="num" data-sort={x.commission_pct}>{x.pay_type === "owner" ? <span className="muted">None</span> : `${x.commission_pct}%`}</td>
                            <td className="num" data-sort={x.service_commission_cents}>{money(x.service_commission_cents, cur)}</td>
                            <td className="num" data-sort={x.retail_cents}>{money(x.retail_cents, cur)}</td>
                            <td className="num" data-sort={x.retail_commission_pct}>{x.pay_type === "owner" ? <span className="muted">None</span> : `${x.retail_commission_pct}%`}</td>
                            <td className="num" data-sort={x.retail_commission_cents}>{money(x.retail_commission_cents, cur)}</td>
                            <td className="num" data-sort={x.tips_cents}>{money(x.tips_cents, cur)}</td>
                            <td className="num" data-sort={x.earned_cents}><b>{money(x.earned_cents, cur)}</b></td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td><b>Total</b></td><td /><td className="num"><b>{dur(total("rostered_min"))}</b></td><td className="num"><b>{money(total("wage_cents"), cur)}</b></td><td className="num"><b>{total("sales")}</b></td>
                          <td className="num"><b>{money(total("service_cents"), cur)}</b></td><td /><td className="num"><b>{money(total("service_commission_cents"), cur)}</b></td>
                          <td className="num"><b>{money(total("retail_cents"), cur)}</b></td><td /><td className="num"><b>{money(total("retail_commission_cents"), cur)}</b></td>
                          <td className="num"><b>{money(total("tips_cents"), cur)}</b></td><td className="num"><b>{money(total("earned_cents"), cur)}</b></td>
                        </tr>
                      </tfoot>
                    </table>
                  </DataTable>
                </div>
              ) : <Empty title="Nothing to show">Add the team and take a sale to see pay here.</Empty>}
              <div className="sub">
                Hours are rostered hours in these days, without breaks or approved time off. Hourly pay is those hours at the person&apos;s rate; a salary is counted by the day. Commission is worked out on what each person sold, at the rate they have today, and refunded sales are left out. The owner takes what is left, so no commission is counted for them. Earned is wage or salary, plus commission, plus tips. This is a summary to pay from: LogaLuxe does not send wages.
              </div>
            </div>

            {renters.length > 0 && (
              <div className="card">
                <div className="hd"><h3>Chair renters</h3><Link href="/business/staff?tab=rent">Rent by period</Link></div>
                <div className="boxed">
                  <DataTable id="pay-renters" search="Search renters" pageSize={10} noun="renter">
                    <table className="tbl">
                      <thead><tr><th>Renter</th><th>Business</th><th className="num">Rent</th><th>Days</th><th className="num">Owed now</th><th className="num">Paid in these days</th></tr></thead>
                      <tbody>
                        {renters.map((x) => (
                          <tr key={x.id}>
                            <td><Link href={"/business/staff" + qs({ staff: x.id })}><b>{x.name}</b></Link></td>
                            <td>{x.trading_name || <span className="muted">Not given</span>}</td>
                            <td className="num" data-sort={x.rent_cents}>{money(x.rent_cents, cur)} {x.rent_period === "monthly" ? "a month" : "a week"}</td>
                            <td>{rentDays(x)}</td>
                            <td className="num" data-sort={x.owed_cents}><b style={x.owed_cents > 0 ? { color: "#7A1F2B" } : undefined}>{money(x.owed_cents, cur)}</b></td>
                            <td className="num" data-sort={x.paid_cents}>{money(x.paid_cents, cur)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </DataTable>
                </div>
                <div className="sub">Renters are not paid by the business, so they are listed apart with the rent they owe you. Their own takings are not in LogaLuxe.</div>
              </div>
            )}
          </>
        )}

        {tab === "rent" && manager && (
          <div className="card">
            <div className="hd"><h3>Chair rental</h3><Link href={"/business/staff" + qs({ new: "1" })}>Add a chair renter</Link></div>
            <div className="sub">
              Each week or month a rent charge is opened for every chair renter. LogaLuxe records the rent and does not collect it: take the money yourself, then mark the period as paid here. To add a renter, choose Add staff and tick that they rent a chair.
            </div>
            <MerchantHistoryPagination name="rent" label="Rent charges" pagination={data.rent_pagination} />
{rent.length ? (
              <div className="boxed">
                <div className="dt">
                  <table className="tbl">
                    <thead><tr><th>Renter</th><th>Period</th><th className="num">Amount</th><th>Status</th><th>Paid</th><th data-nosort><span className="sr">Actions</span></th></tr></thead>
                    <tbody>
                      {rent.map((c) => (
                        <tr key={c.id}>
                          <td data-filter={c.staff}><Link href={"/business/staff" + qs({ staff: c.staff_id })}><b>{c.staff}</b></Link>{c.trading_name ? <small className="muted" style={{ display: "block" }}>{c.trading_name}</small> : null}</td>
                          <td data-sort={day10(c.period_start)} style={{ whiteSpace: "nowrap" }}>{dateOnly(c.period_start)} to {dateOnly(c.period_end)}</td>
                          <td className="num" data-sort={c.amount_cents}>{money(c.amount_cents, cur)}</td>
                          <td data-filter={c.status === "due" ? "Owing" : c.status === "paid" ? "Paid" : "Waived"}><span className={"pill " + (c.status === "due" ? "pill-wine" : c.status === "paid" ? "pill-ok" : "pill-grey")}>{c.status === "due" ? "Owing" : c.status === "paid" ? "Paid" : "Waived"}</span></td>
                          <td data-sort={c.paid_at ?? ""}>{c.status === "paid" && c.paid_at ? <>{dateMed(c.paid_at, tz)}{c.method ? ` · ${METHOD[c.method] ?? c.method}` : ""}</> : <span className="muted">{c.note || "Not yet"}</span>}</td>
                          <td>
                            <form action={rentAction} className="rowx" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                              <input type="hidden" name="back" value={back} />
                              <input type="hidden" name="id" value={c.id} />
                              {c.status === "due" ? (
                                <>
                                  <select className="inp" name="method" defaultValue="transfer" aria-label={`How ${c.staff} paid`} style={{ width: 132, minHeight: 36 }}>{Object.entries(METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                                  <button className="btn btn-ink btn-sm" name="action" value="paid">Mark paid</button>
                                  <ConfirmButton className="btn btn-ghost btn-sm" name="action" value="waive" message={`Waive the rent of ${c.staff} for this period? It will no longer show as owed.`}>Waive</ConfirmButton>
                                </>
                              ) : <button className="btn btn-out btn-sm" name="action" value="reopen">Reopen</button>}
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : <Empty title="No rent charges yet">{team.some((p) => p.pay_type === "renter") ? "The first charge opens at the start of the next period." : "Nobody rents a chair from you."}</Empty>}
          </div>
        )}
      </div>
    </div>
  );
}
