import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { Fragment } from "react";
import { ConfirmButton, Sheet } from "@/components/merchant-client";
import { Avatar, Empty, Flash, Fld, Ic, LoadError, Topbar } from "@/components/merchant-ui";
import { getMe, mCan, mLoad, qs, type Row } from "@/lib/merchant-api";
import { clock, dur, firstName, money, plural, ymd } from "@/lib/merchant-format";
import { serviceArchive, serviceCreate, serviceDelete, serviceDuplicate, serviceRestore, serviceMove, serviceOnline, serviceSave } from "./actions";
import { serviceImport } from "./menu-actions";
import { PlansView, ResourcesView, RulesView } from "./menu-views";
import { QuestionsView } from "./questions-view";
import "../../css/services.css";

export const metadata = { title: "Services" };

type SP = { ok?: string; err?: string; cat?: string; view?: string; s?: string; new?: string };

const major = (cents: number | null | undefined) => (cents === null || cents === undefined ? "" : String(cents / 100));
const cut = (text: string, n = 64) => (text.length > n ? text.slice(0, n - 1).trimEnd() + "…" : text);
const names = (list: string[]) => (list.length <= 2 ? list.join(" and ") : `${list.slice(0, 2).join(", ")} and ${list.length - 2} more`);

/** The fields of a service: the same for a new one and for one being changed. */
function ServiceFields({ sv, staff, cats, cur, p, resources }: { sv?: Row; staff: Row[]; cats: string[]; cur: string; p: string; resources: Row[] }) {
  const own = new Map<string, number | null>(((sv?.staff ?? []) as Row[]).map((x) => [x.staff_id, x.price_cents]));
  return (
    <>
      <div className="field"><label htmlFor={p + "n"}>Name</label><input id={p + "n"} name="name" type="text" required maxLength={80} defaultValue={sv?.name ?? ""} /></div>
      <div className="field">
        <label htmlFor={p + "c"}>Menu group</label>
        <input id={p + "c"} name="category" type="text" required maxLength={40} list={p + "cats"} defaultValue={sv?.category ?? ""} placeholder="Braids, Nails, Add-ons" />
        <datalist id={p + "cats"}>{cats.map((c) => <option key={c} value={c} />)}</datalist>
        <small>Pick one you have, or type a new name to start a new group.</small>
      </div>
      <div className="two">
        <div className="field"><label htmlFor={p + "d"}>Duration (min)</label><input id={p + "d"} name="duration" type="number" required min={5} max={720} step={5} defaultValue={sv?.duration_min ?? 60} /></div>
        <div className="field"><label htmlFor={p + "p"}>Processing (min)</label><input id={p + "p"} name="processing" type="number" min={0} max={480} step={5} defaultValue={sv?.processing_min ?? 0} /></div>
      </div>
      <div className="two">
        <div className="field"><label htmlFor={p + "pr"}>Price ({cur})</label><input id={p + "pr"} name="price" type="number" required min={0} step="0.01" inputMode="decimal" defaultValue={major(sv?.price_cents ?? null)} /></div>
        <div className="field"><label htmlFor={p + "dp"}>Deposit ({cur})</label><input id={p + "dp"} name="deposit" type="number" min={0} step="0.01" inputMode="decimal" defaultValue={major(sv?.deposit_cents ?? 0)} /></div>
      </div>
      <div className="field">
        <label htmlFor={p + "b"}>Clean-up time after (min)</label>
        <input id={p + "b"} name="buffer" type="number" min={0} max={120} step={5} defaultValue={sv?.buffer_min ?? 0} />
        <small>Processing time is when the client waits and the stylist is free. Clean-up time keeps the next booking from starting too soon.</small>
      </div>
      <div>
        <div className="muted cap">Who performs it, and their price</div>
        {staff.length ? (
          <div className="levels">
            {staff.map((st) => (
              <div key={st.id} className="lvl">
                <label>
                  <input type="checkbox" name="staff" value={st.id} defaultChecked={sv ? own.has(st.id) : !!st.bookable} />
                  <Avatar text={st.initials} tone={st.tone} size={24} />
                  <span>{firstName(st.name)} · {st.level}</span>
                </label>
                <input className="lp" name={`price_${st.id}`} type="number" min={0} step="0.01" inputMode="decimal" defaultValue={major(own.get(st.id))} placeholder="Menu price" aria-label={`Price with ${st.name}`} />
              </div>
            ))}
          </div>
        ) : <div className="muted" style={{ fontSize: 13 }}>Add your team first, then choose who does this service.</div>}
        <small className="muted hint">Leave a price empty to charge the menu price. If nobody is ticked, everyone who takes bookings can do it. A person's own price replaces the menu price, and <Link href="/business/services?view=rules">pricing rules</Link> then adjust it.</small>
      </div>
      <div>
        <input type="hidden" name="has_resources" value="1" />
        <div className="muted cap">Requires</div>
        {resources.length ? (
          <div className="days">
            {resources.map((re) => <label key={re.id}><input type="checkbox" name="res" value={re.id} defaultChecked={!!sv && ((re.service_ids ?? []) as string[]).includes(sv.id)} /><span>{re.name} · {re.qty}</span></label>)}
          </div>
        ) : <div className="muted" style={{ fontSize: 13 }}>No rooms, chairs or stations listed yet.</div>}
        <small className="muted hint">A time is only offered when the person and everything ticked here are free. <Link href="/business/services?view=resources">Rooms, chairs and stations</Link></small>
      </div>
      <div className="field"><label htmlFor={p + "desc"}>Description on booking page</label><textarea id={p + "desc"} name="description" defaultValue={sv?.description ?? ""} /></div>
      <label className="chk"><input type="checkbox" name="online" defaultChecked={sv ? !!sv.online : true} />Clients can book it online</label>
    </>
  );
}

export default async function Services({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const me = (await getMe())!;
  const { merchant: m } = me;
  const [{ data, error }, menuRes, intake] = await Promise.all([mLoad("/services"), mLoad("/menu"), mCan(me, "manager") ? mLoad("/intake") : null]);
  if (error) return <div className="main pg-services"><LoadError title="Services & pricing" error={error} /></div>;

  const cur = m.currency, manager = mCan(me, "manager");
  const every = (data.services ?? []) as Row[], staff = (data.staff ?? []) as Row[];
  const active = every.filter((s) => !s.archived), archived = every.filter((s) => s.archived);
  const cats: string[] = [];
  for (const s of active) if (!cats.includes(s.category)) cats.push(s.category);
  const allCats = [...cats];
  for (const s of archived) if (!allCats.includes(s.category)) allCats.push(s.category);

  const menu = menuRes.data;
  const resources = (menu.resources ?? []) as Row[], rules = (menu.price_rules ?? []) as Row[], packages = (menu.packages ?? []) as Row[], memberships = (menu.memberships ?? []) as Row[], holders = (menu.holders ?? []) as Row[];
  const page = ["rules", "packages", "memberships", "resources", "questions"].includes(sp.view ?? "") ? sp.view! : "";
  const view = sp.view === "archived" && archived.length ? "archived" : "";
  const cat = !view && !page && sp.cat && cats.includes(sp.cat) ? sp.cat : "";
  const shown = view ? archived : cat ? active.filter((s) => s.category === cat) : active;
  const tz = m.timezone;
  const questions = ((intake?.data.questions ?? []) as Row[]);
  const groups = view ? [{ name: "", rows: shown }] : (cat ? [cat] : cats).map((c) => ({ name: c, rows: active.filter((s) => s.category === c) }));
  const sel = every.find((s) => s.id === sp.s) ?? shown[0];
  const href = (extra: Record<string, string | undefined> = {}) => "/business/services" + qs({ cat, view: view || page, ...extra });
  const back = page ? href() : href({ s: sel?.id });

  const byId = new Map(staff.map((st) => [st.id as string, st]));
  const bookable = staff.filter((st) => st.bookable);
  const doers = (sv: Row) => ((sv.staff ?? []) as Row[]).filter((x) => byId.has(x.staff_id));
  const who = (sv: Row) => {
    const d = doers(sv);
    if (!d.length) return "Nobody yet";
    if (bookable.length > 1 && bookable.every((b) => d.some((x) => x.staff_id === b.id))) return "Everyone";
    return d.map((x) => firstName(byId.get(x.staff_id)!.name)).join(", ");
  };
  const priceNote = (sv: Row) => {
    const own = doers(sv).filter((x) => x.price_cents !== null && x.price_cents !== sv.price_cents);
    if (!own.length) return "same for everyone";
    const low = own.reduce((a, b) => (b.price_cents < a.price_cents ? b : a)), high = own.reduce((a, b) => (b.price_cents > a.price_cents ? b : a));
    return low.price_cents < sv.price_cents
      ? `from ${money(low.price_cents, cur)} with ${firstName(byId.get(low.staff_id)!.name)}`
      : `up to ${money(high.price_cents, cur)} with ${firstName(byId.get(high.staff_id)!.name)}`;
  };
  const extraTime = (sv: Row) => [sv.processing_min > 0 ? `${dur(sv.processing_min)} processing` : "", sv.buffer_min > 0 ? `${dur(sv.buffer_min)} clean-up` : ""].filter(Boolean).join(" · ");

  // The note: only what the bookings of the last 30 days say.
  const top = active.reduce<Row | null>((a, b) => (b.booked_30d > (a?.booked_30d ?? 0) ? b : a), null);
  const quiet = active.filter((s) => s.online && s.booked_30d === 0), hidden = active.filter((s) => !s.online);
  const note: string[] = [];
  if (!active.length) note.push("Your menu is empty. Clients cannot book until it has at least one service.");
  else {
    note.push(top ? `${top.name} is your most booked service: ${plural(top.booked_30d, "booking")} in the last 30 days.` : "Nothing on your menu was booked in the last 30 days.");
    if (top && quiet.length) note.push(`${names(quiet.map((s) => s.name))} had none in that time.`);
    if (hidden.length) note.push(`${plural(hidden.length, "service")} ${hidden.length === 1 ? "is" : "are"} hidden from online booking.`);
  }

  return (
    <div className="main pg-services">
      <Topbar title="Services & pricing">
        <span className="muted" style={{ fontSize: 13 }}>
          {plural(active.length, "service")} · {plural(packages.filter((x) => x.active).length, "package")} · {plural(memberships.filter((x) => x.active).length, "membership")}
        </span>
        <span style={{ flex: 1 }} />
        {manager && (
          <Sheet trigger="Import price list" title="Import price list" sub="Paste your services, one on each line." wide>
            <form action={serviceImport}>
              <input type="hidden" name="back" value="/business/services" />
              <Fld label="Your price list" hint={<>One service on each line: name, group, minutes, price, deposit. Separate them with commas or tabs, so a paste from a spreadsheet works. A heading line is skipped. Write prices without a thousands comma: 1500, not 1,500. The deposit can be left out.</>}>
                <textarea name="lines" required rows={12} style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }} placeholder={"Name, Group, Minutes, Price, Deposit\nGel manicure, Nails, 45, 40, 10\nPedicure, Nails, 60, 55"} />
              </Fld>
              <div className="muted" style={{ fontSize: 12.5 }}>Each service is added to the end of your menu, bookable online, for everyone who takes bookings. A line whose name is already on your menu is skipped, and you are told which lines were skipped and why.</div>
              <div className="sheet-ft"><button className="btn btn-ink">Import</button></div>
            </form>
          </Sheet>
        )}
        <Link href="/business/services?view=rules" className="btn btn-out">Pricing rules</Link>
        {manager && (
          <Sheet trigger={<><Ic name="plus" size={16} stroke={2.4} />New service</>} triggerClass="btn btn-ink" title="New service" sub="It joins the end of your menu." open={sp.new === "1"} closeHref={href({ s: sp.s })}>
            <form action={serviceCreate}>
              <input type="hidden" name="back" value={back} />
              <ServiceFields staff={staff} cats={allCats} cur={cur} p="new-" resources={resources} />
              <div className="sheet-ft"><button className="btn btn-ink">Add service</button></div>
            </form>
          </Sheet>
        )}
      </Topbar>

      <div className="content">
        <Flash sp={sp} />
        <div className="ai">
          <Ic name="spark" size={22} color="#D4AF5A" />
          <div style={{ flex: 1, fontSize: 14, lineHeight: 1.45 }}>{note.join(" ")}</div>
          {manager && active.length > 0 && <Link href="/business/reports" className="btn btn-sm" style={{ background: "#D4AF5A", color: "#1A1513" }}>See reports</Link>}
        </div>

        <div className="wrap">
          <nav className="cats" aria-label="Menu groups">
            <Link href="/business/services" className={"cat" + (!cat && !view && !page ? " on" : "")}>All services<small>{active.length}</small></Link>
            {cats.map((c) => (
              <Link key={c} href={"/business/services" + qs({ cat: c })} className={"cat" + (cat === c ? " on" : "")}>{c}<small>{active.filter((s) => s.category === c).length}</small></Link>
            ))}
            <div style={{ height: 1, background: "#E6DCD2", margin: "6px 4px" }} />
            <Link href="/business/services?view=packages" className={"cat" + (page === "packages" ? " on" : "")}>Packages<small>{packages.length}</small></Link>
            <Link href="/business/services?view=memberships" className={"cat" + (page === "memberships" ? " on" : "")}>Memberships<small>{memberships.length}</small></Link>
            <Link href="/business/services?view=rules" className={"cat" + (page === "rules" ? " on" : "")}>Pricing rules<small>{rules.filter((x) => x.active).length}</small></Link>
            <Link href="/business/services?view=resources" className={"cat" + (page === "resources" ? " on" : "")}>Rooms and chairs<small>{resources.length}</small></Link>
            {manager && <Link href="/business/services?view=questions" className={"cat" + (page === "questions" ? " on" : "")}>Questions<small>{intake?.error ? "" : questions.filter((x) => x.active).length}</small></Link>}
            {archived.length > 0 && <Link href={"/business/services" + qs({ view: "archived" })} className={"cat" + (view ? " on" : "")}>Archived<small>{archived.length}</small></Link>}
            {manager && <Link href="/business/inventory?filter=retail" className="cat">Retail products<small>Inventory</small></Link>}
            {manager && <Link href={"/business/services" + qs({ cat, view, s: sp.s, new: "1" })} className="cat" style={{ color: "#7A1F2B" }}>+ Add group</Link>}
          </nav>

          <div className="list">
            {page === "questions" ? <QuestionsView questions={questions} services={active} manager={manager} back={back} error={intake?.error} />
              : page && menuRes.error ? <div role="alert" className="flash flash-err">{menuRes.error}</div>
              : page === "rules" ? <RulesView rules={rules} services={active} staff={staff} cur={cur} manager={manager} back={back} now={`${ymd(new Date(), tz)}T${clock(new Date(), tz)}`} />
              : page === "packages" ? <PlansView kind="package" plans={packages} holders={holders} services={active} cur={cur} tz={tz} manager={manager} back={back} autoRenew={!!menu.auto_renew} />
              : page === "memberships" ? <PlansView kind="membership" plans={memberships} holders={holders} services={active} cur={cur} tz={tz} manager={manager} back={back} autoRenew={!!menu.auto_renew} />
              : page === "resources" ? <ResourcesView resources={resources} services={active} manager={manager} back={back} />
              : shown.length ? (
              <div className="tablebox">
                <DataTable id="services" search="Search services" filters={["Staff", "Online"]} pageSize={25} noun="service"><table>
                  <thead><tr><th style={{ width: 28 }} data-nosort><span className="sr">Order</span></th><th>Service</th><th>Duration</th><th>Price</th><th>Deposit</th><th>Staff</th><th>Online</th><th>Booked 30d</th></tr></thead>
                  <tbody>
                    {groups.map((g) => (
                      <Fragment key={g.name || "archived"}>
                        {!cat && !view && <tr className="grp" data-group><td colSpan={8}>{g.name} <span>{g.rows.length}</span></td></tr>}
                        {g.rows.map((r, i) => (
                          <tr key={r.id} className={"row" + (sel?.id === r.id ? " on" : "")}>
                            <td>
                              {manager && !view && (
                                <form action={serviceMove} className="mv">
                                  <input type="hidden" name="back" value={back} />
                                  <input type="hidden" name="id" value={r.id} />
                                  <button name="dir" value="up" disabled={i === 0} aria-label={`Move ${r.name} up`}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6" /></svg></button>
                                  <button name="dir" value="down" disabled={i === g.rows.length - 1} aria-label={`Move ${r.name} down`}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></button>
                                </form>
                              )}
                            </td>
                            <td><Link href={href({ s: r.id })} className="nm"><b>{r.name}</b></Link><small>{r.description ? cut(r.description) : view ? r.category : "No description yet"}</small></td>
                            <td data-sort={r.duration_min}>{dur(r.duration_min)}{extraTime(r) ? <small>{extraTime(r)}</small> : null}</td>
                            <td data-sort={r.price_cents}><b>{money(r.price_cents, cur)}</b><small>{priceNote(r)}</small></td>
                            <td data-sort={r.deposit_cents}>{r.deposit_cents > 0 ? money(r.deposit_cents, cur) : <span className="muted">None</span>}</td>
                            <td className="muted">{who(r)}</td>
                            <td data-filter={view ? "Archived" : r.online ? "Online" : "Hidden"} data-sort={view ? "Archived" : r.online ? "Online" : "Hidden"}>
                              {view ? <span className="pill pill-grey">Archived</span> : manager ? (
                                <form action={serviceOnline}>
                                  <input type="hidden" name="back" value={back} />
                                  <input type="hidden" name="id" value={r.id} />
                                  <button className={"sw" + (r.online ? "" : " off")} role="switch" aria-checked={!!r.online} aria-label={`${r.name}: bookable online`} title={r.online ? "Bookable online. Select to hide it." : "Hidden online. Select to show it."} />
                                </form>
                              ) : <span className={"pill " + (r.online ? "pill-ok" : "pill-grey")}>{r.online ? "Online" : "Hidden"}</span>}
                            </td>
                            <td>{r.booked_30d}</td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table></DataTable>
              </div>
            ) : (
              <Empty title="No services yet">{manager ? "Add your first service and clients can start booking." : "A manager or the owner can add the menu."}</Empty>
            )}
            {!page && shown.length > 0 && (
              <div className="muted" style={{ fontSize: 12.5 }}>
                {view ? "Archived services cannot be booked. Past bookings keep them on record. Restore one to put it back on the menu."
                  : manager ? "Use the arrows to set the order services appear in on your booking page. They move a service within its group in the saved order, so clear any sorting first to see the result. Each move and each switch saves at once."
                    : "This is the menu clients see on the booking page. A manager or the owner can change it."}
              </div>
            )}
          </div>

          {!page && sel && (
            <aside className="panel" aria-label="Selected service">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div className="serif" style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.1 }}>{sel.name}</div>
                <span className={"pill " + (sel.archived ? "pill-grey" : sel.online ? "pill-ok" : "pill-grey")}>{sel.archived ? "Archived" : sel.online ? "Live" : "Hidden online"}</span>
              </div>
              {manager && !sel.archived ? (
                <form action={serviceSave} key={sel.id} className="pform">
                  <input type="hidden" name="back" value={back} />
                  <input type="hidden" name="id" value={sel.id} />
                  <ServiceFields sv={sel} staff={staff} cats={allCats} cur={cur} p="ed-" resources={resources} />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn btn-ink btn-sm" style={{ flex: 1 }}>Save</button>
                    <button className="btn btn-out btn-sm" formAction={serviceDuplicate} formNoValidate>Duplicate</button>
                    <button className="btn btn-out btn-sm" style={{ color: "#9B2335" }} formAction={serviceArchive} formNoValidate>Archive</button>
                  </div>
                  <ConfirmButton className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} formAction={serviceDelete} formNoValidate message={`Delete ${sel.name}? This cannot be undone. A service that has ever been booked is kept and can only be archived.`}>Delete this service</ConfirmButton>
                </form>
              ) : (
                <>
                  <dl className="kv">
                    <dt>Menu group</dt><dd>{sel.category}</dd>
                    <dt>Duration</dt><dd>{dur(sel.duration_min)}</dd>
                    {sel.processing_min > 0 && <><dt>Processing</dt><dd>{dur(sel.processing_min)}</dd></>}
                    {sel.buffer_min > 0 && <><dt>Clean-up after</dt><dd>{dur(sel.buffer_min)}</dd></>}
                    <dt>Price</dt><dd>{money(sel.price_cents, cur)}</dd>
                    <dt>Deposit</dt><dd>{sel.deposit_cents > 0 ? money(sel.deposit_cents, cur) : "None"}</dd>
                    <dt>Booked, last 30 days</dt><dd>{sel.booked_30d}</dd>
                  </dl>
                  {doers(sel).length > 0 && (
                    <div>
                      <div className="muted cap">Who performs it</div>
                      <div className="levels">
                        {doers(sel).map((x) => {
                          const st = byId.get(x.staff_id)!;
                          return <div key={x.staff_id} className="lvl"><Avatar text={st.initials} tone={st.tone} size={24} />{firstName(st.name)} · {st.level}<b>{money(x.price_cents ?? sel.price_cents, cur)}</b></div>;
                        })}
                      </div>
                    </div>
                  )}
                  {resources.some((re) => ((re.service_ids ?? []) as string[]).includes(sel.id)) && (
                    <div><div className="muted cap">Requires</div><div style={{ fontSize: 13.5 }}>{resources.filter((re) => ((re.service_ids ?? []) as string[]).includes(sel.id)).map((re) => re.name).join(", ")}</div></div>
                  )}
                  {sel.description ? <p style={{ fontSize: 13.5, lineHeight: 1.5 }}>{sel.description}</p> : null}
                  {manager && sel.archived && (
                    <form action={serviceRestore} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input type="hidden" name="back" value={back} />
                      <input type="hidden" name="id" value={sel.id} />
                      <button className="btn btn-ink btn-sm" style={{ flex: 1 }}>Restore to the menu</button>
                      <ConfirmButton className="btn btn-danger btn-sm" formAction={serviceDelete} message={`Delete ${sel.name}? This cannot be undone. A service that has ever been booked is kept on record.`}>Delete</ConfirmButton>
                    </form>
                  )}
                </>
              )}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
