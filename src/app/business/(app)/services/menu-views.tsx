import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { ConfirmButton, Sheet } from "@/components/merchant-client";
import { Empty, Fld, Ic } from "@/components/merchant-ui";
import type { Row } from "@/lib/merchant-api";
import { dateMed, dateOnly, money, plural } from "@/lib/merchant-format";
import { holderCancel, holderReactivate, planCreate, planDelete, planSave, planToggle, resourceCreate, resourceDelete, resourceSave, ruleCreate, ruleDelete, ruleSave, ruleToggle, rulesOrder } from "./menu-actions";
import { PriceChecker } from "./price-checker";

// The views of the menu that are not the list of services: pricing rules,
// packages, memberships, and the rooms and chairs a service can require.

const DAYS: [string, string][] = [["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"]];
const LEVEL: Record<string, string> = { junior: "Junior", senior: "Senior", master: "Master" };
const day10 = (v: unknown) => (v ? String(v).slice(0, 10) : "");
const major = (cents: number) => String(Math.abs(cents) / 100);

const daysText = (days: string[]) => (!days?.length || days.length === 7 ? "Every day" : DAYS.filter(([k]) => days.includes(k)).map(([, v]) => v).join(", "));
const timeText = (r: Row) => (r.from_time && r.to_time ? `${r.from_time} to ${r.to_time}` : r.from_time ? `from ${r.from_time}` : r.to_time ? `until ${r.to_time}` : "All day");
const datesText = (r: Row) => (r.starts_on && r.ends_on ? `${dateOnly(r.starts_on)} to ${dateOnly(r.ends_on)}` : r.starts_on ? `from ${dateOnly(r.starts_on)}` : r.ends_on ? `until ${dateOnly(r.ends_on)}` : "Always");
const changeText = (r: Row, cur: string) => (r.adjust_kind === "percent" ? `${r.adjust_value > 0 ? "+" : "−"}${Math.abs(r.adjust_value)}%` : money(r.adjust_value, cur, { sign: true }));

function RuleFields({ r, services, cur }: { r?: Row; services: Row[]; cur: string }) {
  return (
    <>
      <Fld label="Name" hint="Staff see this name next to the price it changed."><input type="text" name="name" required minLength={2} maxLength={80} defaultValue={r?.name ?? ""} placeholder="Saturday peak" /></Fld>
      <Fld label="Applies to">
        <select name="service_id" defaultValue={r?.service_id ?? ""}>
          <option value="">Every service</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Fld>
      <div className="f3">
        <Fld label="The price is"><select name="direction" defaultValue={r && r.adjust_value < 0 ? "less" : "more"}><option value="more">Higher by</option><option value="less">Lower by</option></select></Fld>
        <Fld label="How much"><input type="number" name="adjust" required min={0} step="0.01" inputMode="decimal" defaultValue={r ? (r.adjust_kind === "percent" ? Math.abs(r.adjust_value) : major(r.adjust_value)) : ""} /></Fld>
        <Fld label="As"><select name="adjust_kind" defaultValue={r?.adjust_kind ?? "amount"}><option value="amount">An amount in {cur}</option><option value="percent">A percentage</option></select></Fld>
      </div>
      <div>
        <div className="cap muted">On these days</div>
        <div className="days">{DAYS.map(([k, v]) => <label key={k}><input type="checkbox" name="days" value={k} defaultChecked={((r?.days ?? []) as string[]).includes(k)} /><span>{v}</span></label>)}</div>
        <small className="hint">Tick none and it applies every day.</small>
      </div>
      <div className="f2">
        <Fld label="From this time"><input type="time" name="from_time" defaultValue={r?.from_time ?? ""} /></Fld>
        <Fld label="Until this time" hint="Leave both empty for all day."><input type="time" name="to_time" defaultValue={r?.to_time ?? ""} /></Fld>
      </div>
      <Fld label="Only for this staff level"><select name="level" defaultValue={r?.level ?? ""}><option value="">Any level</option><option value="junior">Junior</option><option value="senior">Senior</option><option value="master">Master</option></select></Fld>
      <div className="f2">
        <Fld label="First day"><input type="date" name="starts_on" defaultValue={day10(r?.starts_on)} /></Fld>
        <Fld label="Last day" hint="Leave both empty to keep it running."><input type="date" name="ends_on" defaultValue={day10(r?.ends_on)} /></Fld>
      </div>
      <label className="chk"><input type="checkbox" name="active" defaultChecked={r ? !!r.active : true} />Switched on</label>
    </>
  );
}

export function RulesView({ rules, services, staff, cur, manager, back, now }: { rules: Row[]; services: Row[]; staff: Row[]; cur: string; manager: boolean; back: string; now: string }) {
  return (
    <>
      <div className="card">
        <div className="hd">
          <h3>Pricing rules</h3>
          {manager && (
            <Sheet trigger={<><Ic name="plus" size={14} stroke={2.4} />New rule</>} triggerClass="btn btn-ink btn-sm" title="New pricing rule">
              <form action={ruleCreate}>
                <input type="hidden" name="back" value={back} />
                <RuleFields services={services} cur={cur} />
                <div className="sheet-ft"><button className="btn btn-ink">Add rule</button></div>
              </form>
            </Sheet>
          )}
        </div>
        <div className="sub">
          A rule raises or lowers a price when it matches the service, the day, the time, the level of the person doing it and the date. A person&apos;s own price replaces the menu price first, then every rule that matches adjusts it, from the top of the list down, each on the price the one above left. Clients see the final price when they book.{manager ? " Use the arrows to change the order; clear any sorting first to see it." : ""}
        </div>
        {rules.length ? (
          <div className="boxed">
            <DataTable id="price-rules" search="Search rules" filters={["Applies to", "Level", "On"]} pageSize={10} noun="rule">
              <table className="tbl">
                <thead><tr>{manager && <th style={{ width: 28 }} data-nosort><span className="sr">Order</span></th>}<th>Rule</th><th>Applies to</th><th>Days</th><th>Time</th><th>Level</th><th>Dates</th><th className="num">Change</th><th>On</th>{manager && <th data-nosort><span className="sr">Actions</span></th>}</tr></thead>
                <tbody>
                  {rules.map((r, i) => (
                    <tr key={r.id}>
                      {manager && (
                        <td>
                          <form action={rulesOrder} className="mv">
                            <input type="hidden" name="back" value={back} />
                            <input type="hidden" name="id" value={r.id} />
                            <button name="dir" value="up" disabled={i === 0} aria-label={`Move ${r.name} up`}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6" /></svg></button>
                            <button name="dir" value="down" disabled={i === rules.length - 1} aria-label={`Move ${r.name} down`}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></button>
                          </form>
                        </td>
                      )}
                      <td><b>{r.name}</b></td>
                      <td>{r.service ?? "Every service"}</td>
                      <td>{daysText((r.days ?? []) as string[])}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{timeText(r)}</td>
                      <td>{LEVEL[r.level] ?? "Any level"}</td>
                      <td data-sort={day10(r.starts_on) || "0"}>{datesText(r)}</td>
                      <td className="num" data-sort={r.adjust_value}><b style={{ color: r.adjust_value < 0 ? "#1F6B3A" : "#7A1F2B" }}>{changeText(r, cur)}</b></td>
                      <td data-filter={r.active ? "On" : "Off"} data-sort={r.active ? "On" : "Off"}>
                        {manager ? (
                          <form action={ruleToggle}>
                            <input type="hidden" name="back" value={back} />
                            <input type="hidden" name="id" value={r.id} />
                            <button className={"sw" + (r.active ? "" : " off")} role="switch" aria-checked={!!r.active} aria-label={`${r.name}: switched on`} />
                          </form>
                        ) : <span className={"pill " + (r.active ? "pill-ok" : "pill-grey")}>{r.active ? "On" : "Off"}</span>}
                      </td>
                      {manager && (
                        <td>
                          <div className="acts">
                            <Sheet trigger="Edit" triggerClass="btn btn-out btn-sm" title="Pricing rule" sub={r.name}>
                              <form action={ruleSave}>
                                <input type="hidden" name="back" value={back} />
                                <input type="hidden" name="id" value={r.id} />
                                <RuleFields r={r} services={services} cur={cur} />
                                <div className="sheet-ft"><button className="btn btn-ink">Save rule</button></div>
                              </form>
                            </Sheet>
                            <form action={ruleDelete}>
                              <input type="hidden" name="back" value={back} />
                              <input type="hidden" name="id" value={r.id} />
                              <ConfirmButton className="btn btn-ghost btn-sm" message={`Delete the rule ${r.name}? Prices go back to what they were without it.`}>Delete</ConfirmButton>
                            </form>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
          </div>
        ) : <Empty title="No pricing rules">{manager ? "Add one to charge more at busy times or less at quiet ones." : "A manager or the owner can add them."}</Empty>}
      </div>

      <div className="card">
        <h3>What would it cost</h3>
        {services.length && staff.length
          ? <PriceChecker services={services.map((s) => ({ id: s.id, name: s.name }))} staff={staff.map((s) => ({ id: s.id, name: s.name }))} cur={cur} at={now} />
          : <div className="sub">Add a service and a team member first.</div>}
      </div>
    </>
  );
}

function PlanFields({ p, pkg, services, cur }: { p?: Row; pkg: boolean; services: Row[]; cur: string }) {
  const has = new Map<string, number>(((p?.items ?? []) as Row[]).map((i) => [i.service_id, i.qty]));
  return (
    <>
      <input type="hidden" name="kind" value={pkg ? "package" : "membership"} />
      <Fld label="Name"><input type="text" name="name" required minLength={2} maxLength={80} defaultValue={p?.name ?? ""} placeholder={pkg ? "Wash day trio" : "Braid club"} /></Fld>
      <Fld label="Description" hint="Shown to staff at Checkout."><textarea name="description" maxLength={600} defaultValue={p?.description ?? ""} /></Fld>
      {pkg ? (
        <div className="f2">
          <Fld label={`Price (${cur})`}><input type="number" name="price" required min={0} step="0.01" inputMode="decimal" defaultValue={p ? major(p.price_cents) : ""} /></Fld>
          <Fld label="Can be used for (days)"><input type="number" name="valid_days" required min={1} max={1825} step={1} defaultValue={p?.valid_days ?? 365} /></Fld>
        </div>
      ) : (
        <div className="f3">
          <Fld label={`Price a month (${cur})`}><input type="number" name="price" required min={0} step="0.01" inputMode="decimal" defaultValue={p ? major(p.price_cents) : ""} /></Fld>
          <Fld label="Off services (%)"><input type="number" name="service_discount_pct" min={0} max={100} step={1} defaultValue={p?.service_discount_pct ?? 0} /></Fld>
          <Fld label="Off products (%)"><input type="number" name="retail_discount_pct" min={0} max={100} step={1} defaultValue={p?.retail_discount_pct ?? 0} /></Fld>
        </div>
      )}
      <div>
        <div className="cap muted">{pkg ? "What is in it" : "Included every month"}</div>
        {services.length ? (
          <div className="incl">
            {services.map((s) => (
              <label key={s.id}>
                <span>{s.name}<small>{money(s.price_cents, cur)}</small></span>
                <input className="inp" type="number" name={`qty_${s.id}`} min={0} max={100} step={1} defaultValue={has.get(s.id) ?? ""} placeholder="0" aria-label={`How many: ${s.name}`} />
              </label>
            ))}
          </div>
        ) : <div className="sub">Add services to your menu first.</div>}
        <small className="hint">{pkg ? "Type how many visits of each service the package holds. It needs at least one." : "Type how many of each service a member gets each month. Leave them empty for a membership that only gives discounts."}</small>
      </div>
      <label className="chk"><input type="checkbox" name="active" defaultChecked={p ? !!p.active : true} />On sale at Checkout</label>
    </>
  );
}

const HOLD: Record<string, [string, string]> = { active: ["Active", "pill-ok"], past_due: ["Owing", "pill-wine"], cancelled: ["Cancelled", "pill-grey"], expired: ["Expired", "pill-grey"] };

export function PlansView({ kind, plans, holders, services, cur, tz, manager, back, autoRenew }: { kind: "package" | "membership"; plans: Row[]; holders: Row[]; services: Row[]; cur: string; tz: string; manager: boolean; back: string; autoRenew: boolean }) {
  const pkg = kind === "package", noun = pkg ? "package" : "membership";
  const mine = holders.filter((h) => h.kind === kind);
  return (
    <>
      <div className="card">
        <div className="hd">
          <h3>{pkg ? "Packages" : "Memberships"}</h3>
          {manager && (
            <Sheet trigger={<><Ic name="plus" size={14} stroke={2.4} />{pkg ? "New package" : "New membership"}</>} triggerClass="btn btn-ink btn-sm" title={pkg ? "New package" : "New membership"}>
              <form action={planCreate}>
                <input type="hidden" name="back" value={back} />
                <PlanFields pkg={pkg} services={services} cur={cur} />
                <div className="sheet-ft"><button className="btn btn-ink">{pkg ? "Add package" : "Add membership"}</button></div>
              </form>
            </Sheet>
          )}
        </div>
        <div className="sub">
          {pkg
            ? "A package is a set of visits paid for up front. You sell it to a client at Checkout. Each visit is then taken off the package when that service is checked out, until the last day it can be used."
            : <>A membership is paid every month and gives discounts, included services, or both. You sell it to a client at Checkout. {autoRenew
              ? "Payments run in simulation here, so on each renewal day the monthly charge is recorded automatically and the included services are topped up. No real money moves."
              : "On each renewal day the membership is marked as owing and the front desk takes the payment at Checkout. Nothing is charged automatically."}</>}
          {" "}<Link href="/business/checkout">Open Checkout</Link>
        </div>
        {plans.length ? (
          <div className="plans">
            {plans.map((p) => {
              const items = (p.items ?? []) as Row[], worth = items.reduce((a, i) => a + i.qty * i.price_cents, 0);
              return (
                <div key={p.id} className={"plan" + (p.active ? "" : " offsale")}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <b className="serif">{p.name}</b>
                    <span className={"pill " + (p.active ? "pill-ok" : "pill-grey")}>{p.active ? "On sale" : "Off sale"}</span>
                  </div>
                  <div className="price">{money(p.price_cents, cur)}<small>{pkg ? `valid ${plural(p.valid_days, "day")}` : "a month"}</small></div>
                  {p.description ? <p>{p.description}</p> : null}
                  <ul>
                    {!pkg && p.service_discount_pct > 0 && <li>{p.service_discount_pct}% off every service</li>}
                    {!pkg && p.retail_discount_pct > 0 && <li>{p.retail_discount_pct}% off products</li>}
                    {items.map((i) => <li key={i.service_id}>{i.qty} × {i.name}{pkg ? "" : " each month"}</li>)}
                  </ul>
                  <div className="stat">
                    {pkg ? `${p.sold} sold · ${p.active_holders} in use` : `${plural(p.members, "member")}${p.past_due > 0 ? ` · ${p.past_due} owing` : ""}`}
                    {worth > 0 ? ` · ${pkg ? "worth" : "includes"} ${money(worth, cur)} at menu prices` : ""}
                  </div>
                  {manager && (
                    <div className="acts">
                      <Sheet trigger="Edit" triggerClass="btn btn-out btn-sm" title={pkg ? "Package" : "Membership"} sub={p.name}>
                        <form action={planSave}>
                          <input type="hidden" name="back" value={back} />
                          <input type="hidden" name="id" value={p.id} />
                          <PlanFields p={p} pkg={pkg} services={services} cur={cur} />
                          <div className="sheet-ft"><button className="btn btn-ink">Save</button></div>
                        </form>
                      </Sheet>
                      <form action={planToggle}>
                        <input type="hidden" name="back" value={back} />
                        <input type="hidden" name="kind" value={kind} />
                        <input type="hidden" name="id" value={p.id} />
                        <button className="btn btn-out btn-sm">{p.active ? "Take off sale" : "Put on sale"}</button>
                      </form>
                      <form action={planDelete}>
                        <input type="hidden" name="back" value={back} />
                        <input type="hidden" name="kind" value={kind} />
                        <input type="hidden" name="id" value={p.id} />
                        <ConfirmButton className="btn btn-ghost btn-sm" message={`Delete ${p.name}? If a client has ever held it, it is switched off instead and their record is kept.`}>Delete</ConfirmButton>
                      </form>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : <Empty title={pkg ? "No packages yet" : "No memberships yet"}>{manager ? `Add a ${noun} and it can be sold at Checkout.` : "A manager or the owner can add them."}</Empty>}
      </div>

      <div className="card">
        <h3>{pkg ? "Clients with a package" : "Members"}</h3>
        {mine.length ? (
          <div className="boxed">
            <div className="dt">
              <table className="tbl">
                <thead><tr><th>Client</th><th data-col="Plan">{pkg ? "Package" : "Membership"}</th><th>Status</th><th className="num">{pkg ? "Visits left" : "Included visits left"}</th><th>Started</th><th>{pkg ? "Use by" : "Renews"}</th>{manager && <th data-nosort><span className="sr">Actions</span></th>}</tr></thead>
                <tbody>
                  {mine.map((h) => {
                    const [label, cls] = HOLD[h.status] ?? [h.status, "pill-grey"], end = pkg ? h.expires_at : h.renews_on;
                    return (
                      <tr key={h.id}>
                        <td><Link href={`/business/clients?client=${h.client_id}`}><b>{h.client}</b></Link></td>
                        <td>{h.name}</td>
                        <td data-filter={label}><span className={"pill " + cls}>{label}</span></td>
                        <td className="num">{h.credits_left}</td>
                        <td data-sort={h.started_at} style={{ whiteSpace: "nowrap" }}>{dateMed(h.started_at, tz)}</td>
                        <td data-sort={end ?? ""} style={{ whiteSpace: "nowrap" }}>{end ? (pkg ? dateMed(end, tz) : h.status === "active" ? dateOnly(end, "med") : <span className="muted">Will not renew</span>) : <span className="muted">No end</span>}</td>
                        {manager && (
                          <td>
                            <form action={h.status === "active" || h.status === "past_due" ? holderCancel : holderReactivate} className="acts">
                              <input type="hidden" name="back" value={back} />
                              <input type="hidden" name="kind" value={kind} />
                              <input type="hidden" name="id" value={h.id} />
                              {h.status === "past_due" && <button className="btn btn-out btn-sm" formAction={holderReactivate}>Mark as paid up</button>}
                              {h.status === "active" || h.status === "past_due"
                                ? <ConfirmButton className="btn btn-ghost btn-sm" message={pkg ? `End the package of ${h.client}? The ${plural(h.credits_left, "visit")} left on it can no longer be used. No refund is made here.` : `Cancel the membership of ${h.client}? It stops now and will not renew. No refund is made here.`}>Cancel</ConfirmButton>
                                : h.status === "cancelled" ? <button className="btn btn-out btn-sm">Reactivate</button> : null}
                            </form>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : <Empty title={pkg ? "No client holds a package yet" : "No members yet"}>Sell one at Checkout and it shows here.</Empty>}
      </div>
    </>
  );
}

export function ResourcesView({ resources, services, manager, back }: { resources: Row[]; services: Row[]; manager: boolean; back: string }) {
  const name = new Map(services.map((s) => [s.id as string, s.name as string]));
  return (
    <div className="card">
      <h3>Rooms, chairs and stations</h3>
      <div className="sub">
        Some services need more than a person: a braiding chair, a wash station, a treatment room. List what you have and how many. A time is only offered to a client when the person is free and everything the service requires is free too. Choose what a service requires in its panel, under Requires.
      </div>
      {resources.length ? resources.map((re) => {
        const used = ((re.service_ids ?? []) as string[]).map((id) => name.get(id)).filter(Boolean);
        return manager ? (
          <div key={re.id} className="res">
            <form action={resourceSave} className="rowx" style={{ flex: 1 }}>
              <input type="hidden" name="back" value={back} />
              <input type="hidden" name="id" value={re.id} />
              <input className="inp" style={{ flex: "1 1 180px" }} type="text" name="name" required minLength={2} maxLength={60} defaultValue={re.name} aria-label="Name" />
              <input className="inp" style={{ width: 84 }} type="number" name="qty" required min={1} max={50} step={1} defaultValue={re.qty} aria-label={`How many: ${re.name}`} />
              <button className="btn btn-out btn-sm">Save</button>
            </form>
            <form action={resourceDelete}>
              <input type="hidden" name="back" value={back} />
              <input type="hidden" name="id" value={re.id} />
              <ConfirmButton className="btn btn-ghost btn-sm" message={`Remove ${re.name}? ${used.length ? `${plural(used.length, "service")} will stop waiting for it.` : "No service requires it."}`}>Remove</ConfirmButton>
            </form>
            <small>{used.length ? `Required by ${used.join(", ")}` : "No service requires it yet"}</small>
          </div>
        ) : (
          <div key={re.id} className="res"><b style={{ flex: 1 }}>{re.name} × {re.qty}</b><small>{used.length ? `Required by ${used.join(", ")}` : "No service requires it yet"}</small></div>
        );
      }) : <Empty title="Nothing listed yet">Without any, a time is offered whenever the person is free.</Empty>}
      {manager && (
        <form action={resourceCreate} className="rowx" style={{ borderTop: "1px solid #EDE4DA", paddingTop: 12 }}>
          <input type="hidden" name="back" value={back} />
          <input className="inp" style={{ flex: "1 1 180px" }} type="text" name="name" required minLength={2} maxLength={60} placeholder="Treatment room" aria-label="Name of the new room, chair or station" />
          <input className="inp" style={{ width: 84 }} type="number" name="qty" required min={1} max={50} step={1} defaultValue={1} aria-label="How many you have" />
          <button className="btn btn-ink btn-sm">Add</button>
        </form>
      )}
    </div>
  );
}
