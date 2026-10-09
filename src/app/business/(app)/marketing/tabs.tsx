import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { ConfirmButton, CopyButton, Sheet } from "@/components/merchant-client";
import { Empty } from "@/components/merchant-ui";
import { mLoad, qs, type Merchant, type Row } from "@/lib/merchant-api";
import { dateMed, money, pct, plural, when, ymd } from "@/lib/merchant-format";
import { adjustPoints, createPromo, deletePromo, disputeLead, saveLeadSettings, saveLoyalty, togglePromo, updatePromo } from "./actions";
import { BoostFields, LoyaltyFields, PromoFields, type PromoValues } from "./live";

// The three tabs that sit beside Automations and Campaigns: new clients from
// LogaLuxe (and what they cost), loyalty points, and the business's own promo codes.

const EYEBROW = { fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase" } as const;
const SOURCE: Record<string, string> = { search: "LogaLuxe search", marketplace: "LogaLuxe marketplace", app: "LogaLuxe app", category: "A category page" };
const n = (v: number) => Number(v ?? 0).toLocaleString("en-US");
const Fail = ({ error }: { error: string }) => <div role="alert" className="flash flash-err">{error}</div>;

// ---------- new clients ----------

export async function LeadsTab({ m, owner, link }: { m: Merchant; owner: boolean; link: string }) {
  const { data: d, error } = await mLoad("/leads");
  if (error) return <Fail error={error} />;
  const cur = m.currency, tz = m.timezone, back = "/business/marketing?tab=leads";
  const rate = d.rate as Row, k = d.kpis as Row, set = d.settings as Row, boost = d.boost as Row, rank = d.rank as Row;
  const leads = (d.leads ?? []) as Row[];
  const cap = rate.cap_cents === null || rate.cap_cents === undefined ? null : Number(rate.cap_cents);
  const base = Number(rate.base_pct), days = Number(rate.dispute_days);
  const sampleCents = cur === "NGN" ? 5000000 : 10000;
  const budget = Number(set.monthly_budget_cents ?? 0), spent = Number(boost.spent_cents ?? 0), bid = Number(set.boost_pct ?? 0);
  const multiple = k.all_fee_cents > 0 ? k.all_revenue_cents / k.all_fee_cents : 0;
  const steps: [string, number, string][] = [
    ["Shown in search", k.impressions_30d, "times your business appeared in results"],
    ["Opened your page", k.views_30d, k.impressions_30d > 0 ? `${((k.views_30d / k.impressions_30d) * 100).toFixed(1).replace(/\.0$/, "")}% of the times shown` : "from search"],
    ["First bookings", k.leads_30d, k.views_30d > 0 ? `${((k.leads_30d / k.views_30d) * 100).toFixed(1).replace(/\.0$/, "")}% of page visits` : "new clients who booked"],
  ];
  const peak = Math.max(1, ...steps.map((s) => s[1]));
  const others = Math.max(0, Number(rank.promoted_peers ?? 0) - (boost.running ? 1 : 0));
  const state = boost.running ? "running" : bid > 0 && set.paused ? "paused" : bid > 0 ? "spent" : "off";

  const statusOf = (l: Row): { label: string; tone: string; note: string } => {
    switch (l.status) {
      case "pending": return { label: "Visit to come", tone: "pill-gold", note: "Charged only when the visit is paid for" };
      case "charged": return { label: "Charged", tone: "pill-ok", note: l.resolved_at ? `Dispute looked at, charge stands${l.resolution_note ? `: ${l.resolution_note}` : ""}` : "" };
      case "void": return { label: "No charge", tone: "pill-grey", note: l.void_reason || (l.booking_status === "no_show" ? "The client did not come" : String(l.booking_status ?? "").startsWith("cancelled") ? "The booking was cancelled" : "") };
      case "disputed": return { label: "Disputed", tone: "pill-gold", note: "The LogaLuxe team is checking it" };
      case "refunded": return { label: "Refunded", tone: "pill-ok", note: l.resolution_note ? `Fee returned: ${l.resolution_note}` : "The fee was returned to your balance" };
      default: return { label: String(l.status), tone: "pill-grey", note: "" };
    }
  };

  return (
    <>
      <div className="cardx hero">
        <div style={{ flex: "1 1 420px", minWidth: 0 }}>
          <div className="muted" style={EYEBROW}>How new clients from LogaLuxe work</div>
          <p className="lead">
            When LogaLuxe brings you a client who has never booked you before, you pay <b>{base}% of their first visit</b>, once{cap !== null ? <>, capped at <b>{money(cap, cur)}</b></> : null}.
            Clients who use your own booking link are always free. Nothing is charged if they cancel or do not come.
          </p>
          <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>The share is taken on what the client pays for services on that visit, not on tips, tax or products, and it comes out of your payout balance. Every later visit from that client is yours in full.</p>
        </div>
        <div className="own">
          <div className="muted" style={EYEBROW}>Your own link · always free</div>
          <div className="linkrow"><span>{link}</span><CopyButton text={link}>Copy</CopyButton></div>
          <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>Put it in your Instagram bio, on WhatsApp and on your door. A client who books through it never costs you a fee.</div>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi"><small>New clients this month</small><b>{k.month_leads}</b><span>{k.month_charged} charged · {k.month_pending} still to come · {k.month_void} not charged</span></div>
        <div className="kpi"><small>Fees this month</small><b>{money(k.month_fee_cents, cur)}</b><span>{k.month_charged ? `for ${plural(k.month_charged, "new client")}` : "Nothing charged yet this month"}</span></div>
        <div className="kpi"><small>What they have been worth</small><b>{multiple > 0 ? `${multiple >= 10 ? Math.round(multiple) : multiple.toFixed(1)}×` : "None"}</b><span>{k.all_fee_cents > 0 ? `${money(k.all_fee_cents, cur)} in fees brought ${money(k.all_revenue_cents, cur)}` : "No fees charged so far"}</span></div>
        <div className="kpi"><small>Came back</small><b>{k.all_charged ? `${pct(k.came_back, k.all_charged)}%` : "None"}</b><span>{k.all_charged ? `${k.came_back} of ${plural(k.all_charged, "new client")} booked again` : "No new clients charged yet"}</span></div>
      </div>

      <div className="wrap">
        <div className="cardx" style={{ flex: "999 1 420px" }}>
          <div className="hdx"><h3>From search to first booking</h3><span className="muted" style={{ fontSize: 12.5 }}>Last 30 days</span></div>
          {k.impressions_30d || k.views_30d || k.leads_30d ? (
            <div className="funnel">
              {steps.map(([name, value, sub], i) => (
                <div key={name} className="fstep">
                  <div className="fbar"><i style={{ width: `${Math.max(value > 0 ? 3 : 0, (value / peak) * 100)}%`, opacity: 1 - i * 0.22 }} /></div>
                  <div className="ftxt"><b>{n(value)}</b><span>{name}</span><small>{sub}</small></div>
                </div>
              ))}
            </div>
          ) : <Empty title="Nothing to show yet">{m.status === "live" ? "Once clients find you in LogaLuxe search, the numbers appear here." : "Your business is not live in search yet, so nobody has found you there."}</Empty>}
          {k.promoted_impressions_30d > 0 ? <div className="muted" style={{ fontSize: 12.5 }}>{n(k.promoted_impressions_30d)} of those times you were shown as Promoted.</div> : null}
        </div>

        <div className="cardx" style={{ flex: "1 1 340px", maxWidth: 460 }}>
          <div className="hdx">
            <h3>Promotion</h3>
            {state === "running" ? <span className="pill pill-ok">Running · {boost.total_pct}% on new clients</span> : state === "paused" ? <span className="pill pill-grey">Paused</span> : state === "spent" ? <span className="pill pill-gold">Stopped · budget spent</span> : <span className="pill pill-grey">Off</span>}
          </div>
          <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
            Offer extra percentage points on new clients and you are listed first in search, marked &quot;Promoted&quot;. You still pay only when a new client&apos;s first visit is paid for. Set a monthly budget and promotion stops by itself when it is spent; the usual {base}% still applies after that.
          </p>
          {budget > 0 ? (
            <div>
              <div className="meter" role="img" aria-label={`${money(spent, cur)} of ${money(budget, cur)} spent this month`}><i style={{ width: `${Math.min(100, (spent / budget) * 100)}%` }} /></div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{money(spent, cur)} of {money(budget, cur)} spent this month. The budget counts every new-client fee charged this month.</div>
            </div>
          ) : <div className="muted" style={{ fontSize: 12.5 }}>{money(spent, cur)} in new-client fees this month. No budget is set.</div>}
          <div className="note">
            {rank.peers > 1
              ? <>There {rank.peers - 1 === 1 ? "is 1 other business" : `are ${rank.peers - 1} other businesses`} like yours nearby on LogaLuxe. {others > 0 ? `${others} of them ${others === 1 ? "is" : "are"} promoting now` : "None of them is promoting now"}{rank.top_bid_pct > 0 ? `, and the highest other offer is +${rank.top_bid_pct}%` : ""}. <b>You are listed number {rank.position} of {rank.peers}.</b></>
              : m.status === "live" ? "No other business like yours is listed nearby on LogaLuxe yet, so you are already first." : "Your place in search shows here once your business is live."}
          </div>
          {owner ? (
            <form action={saveLeadSettings} className="stack">
              <input type="hidden" name="back" value={back} />
              <BoostFields basePct={base} capCents={cap} maxBoost={Number(rate.max_boost_pct)} boost={bid} budgetCents={budget} paused={!!set.paused} currency={cur} sampleCents={sampleCents} />
              <div><button className="btn btn-ink btn-sm">Save promotion</button></div>
            </form>
          ) : (
            <><div className="muted" style={{ fontSize: 12.5 }}>Only the owner can change promotion.</div>
            <dl className="kv">
              <dt>Extra share offered</dt><dd>+{bid}%</dd>
              <dt>Monthly budget</dt><dd>{budget > 0 ? money(budget, cur) : "No limit"}</dd>
              <dt>Paused</dt><dd>{set.paused ? "Yes" : "No"}</dd>
            </dl></>
          )}
        </div>
      </div>

      <div className="muted" style={EYEBROW}>New clients LogaLuxe brought you</div>
      {leads.length ? (
        <div className="tablebox">
          <DataTable id="leads" search="Search new clients" filters={["Status", "Where from"]} pageSize={25} noun="new client" sort={{ col: "Date", dir: "desc" }}>
            <table>
              <thead><tr><th>Date</th><th>Client</th><th>Services</th><th>Where from</th><th>Status</th><th>First visit</th><th>Rate</th><th>Fee</th><th>Spent since</th><th data-nosort data-col="Action" /></tr></thead>
              <tbody>
                {leads.map((l) => {
                  const st = statusOf(l);
                  const ratePct = Number(l.base_pct) + Number(l.boost_pct);
                  const est = Math.round((l.value_cents * ratePct) / 100), estFee = l.cap_cents !== null && l.cap_cents !== undefined && est > l.cap_cents ? l.cap_cents : est;
                  const charged = l.status === "charged" || l.status === "disputed" || l.status === "refunded";
                  return (
                    <tr key={l.id}>
                      <td data-sort={l.created_at}>{when(l.created_at, tz)}{l.starts_at ? <div className="muted" style={{ fontSize: 12 }}>visit {dateMed(l.starts_at, tz)}</div> : null}</td>
                      <td>{l.client_id ? <Link href={`/business/clients${qs({ client: l.client_id })}`}><b>{l.client_name}</b></Link> : <b>{l.client_name}</b>}</td>
                      <td style={{ whiteSpace: "normal", minWidth: 150 }}>{l.services ?? <span className="muted">None</span>}</td>
                      <td>{SOURCE[l.source] ?? l.source}</td>
                      <td data-filter={st.label} style={{ whiteSpace: "normal", minWidth: 150 }}><span className={`pill ${st.tone}`}>{st.label}</span>{st.note ? <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{st.note}</div> : null}</td>
                      <td data-sort={l.value_cents}>{money(l.value_cents, cur)}</td>
                      <td data-sort={ratePct}>{ratePct}%{l.boosted ? <> <span className="pill pill-gold">Promoted</span><div className="muted" style={{ fontSize: 12 }}>{Number(l.base_pct)}% + {Number(l.boost_pct)}%</div></> : null}</td>
                      <td data-sort={charged ? l.fee_cents : l.status === "pending" ? estFee : 0}>{charged ? <b>{money(l.fee_cents, cur)}</b> : l.status === "pending" ? <span className="muted">about {money(estFee, cur)}</span> : <span className="muted">None</span>}{l.status === "refunded" ? <div className="muted" style={{ fontSize: 12 }}>returned</div> : null}</td>
                      <td data-sort={l.lifetime_cents}>{money(l.lifetime_cents, cur)}<div className="muted" style={{ fontSize: 12 }}>{plural(l.visits, "visit")}</div></td>
                      <td>
                        {owner && l.status === "charged" && l.can_dispute && !l.resolved_at ? (
                          <Sheet trigger="Dispute" triggerClass="btn btn-out btn-sm" title="Dispute this fee" sub={`${l.client_name} · ${money(l.fee_cents, cur)} charged ${l.charged_at ? dateMed(l.charged_at, tz) : ""}`}>
                            <div className="note">Use this when the client was already yours: they had been to you before, or they came through your own link or a friend, not through LogaLuxe. The LogaLuxe team checks every dispute and the answer shows on this page. If they agree, the fee goes back to your balance. A fee can be disputed for {days} days after it is charged.</div>
                            <form action={disputeLead}>
                              <input type="hidden" name="back" value={back} /><input type="hidden" name="id" value={l.id} />
                              <div className="field"><label htmlFor={`dr-${l.id}`}>Why was this not a new client from LogaLuxe?</label><textarea id={`dr-${l.id}`} name="reason" required minLength={10} maxLength={600} placeholder="She has been coming to me since 2024. I have her in my old booking app under the same number." /></div>
                              <div className="sheet-ft"><button className="btn btn-ink">Send dispute</button></div>
                            </form>
                          </Sheet>
                        ) : l.status === "disputed" && l.dispute_reason ? <span className="muted" style={{ fontSize: 12, whiteSpace: "normal", display: "block", maxWidth: 200 }}>You said: {l.dispute_reason}</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DataTable>
        </div>
      ) : <Empty title="No new clients from LogaLuxe yet">When someone who has never booked you finds you on LogaLuxe and books, they appear here with what the visit cost you and what they have spent since.</Empty>}
      <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>{owner ? `You can dispute a fee for ${days} days after it is charged.` : `The owner can dispute a fee for ${days} days after it is charged.`} Fees also show line by line under Money.</div>
    </>
  );
}

// ---------- loyalty ----------

const REASON: Record<string, string> = { earn: "Earned at checkout", redeem: "Spent at checkout", adjust: "Changed by hand" };

function AdjustSheet({ client, points, back }: { client: Row; points: number | null; back: string }) {
  return (
    <Sheet trigger={points === null ? "Give points" : "Adjust"} triggerClass="btn btn-out btn-sm" title={`Points for ${client.name}`} sub={points === null ? "Add points by hand, for a gift or to put right a mistake." : `${n(points)} points now. A balance cannot go below zero.`}>
      <form action={adjustPoints}>
        <input type="hidden" name="back" value={back} /><input type="hidden" name="client_id" value={client.id} />
        <div className="f2">
          <div className="field"><label htmlFor={`aj-d-${client.id}`}>Add or take away</label><select id={`aj-d-${client.id}`} name="dir" defaultValue="add"><option value="add">Add points</option><option value="take">Take points away</option></select></div>
          <div className="field"><label htmlFor={`aj-p-${client.id}`}>Points</label><input id={`aj-p-${client.id}`} name="points" type="number" required min={1} max={100000} step={1} /></div>
        </div>
        <div className="field"><label htmlFor={`aj-n-${client.id}`}>Reason · kept on the record</label><input id={`aj-n-${client.id}`} name="note" type="text" required minLength={3} maxLength={160} placeholder="Birthday gift" /></div>
        <div className="sheet-ft"><button className="btn btn-ink">Save</button></div>
      </form>
    </Sheet>
  );
}

export async function LoyaltyTab({ m, find }: { m: Merchant; find?: string }) {
  const q = (find ?? "").trim();
  const [{ data: d, error }, found] = await Promise.all([mLoad("/loyalty"), q ? mLoad("/clients" + qs({ q, per_page: 8 })) : Promise.resolve(null)]);
  if (error) return <Fail error={error} />;
  const cur = m.currency, tz = m.timezone, back = "/business/marketing?tab=loyalty";
  const rules = d.rules as { enabled: boolean; earn_points: number; per_cents: number; point_value_cents: number; min_redeem: number }, k = d.kpis as Row;
  const clients = (d.clients ?? []) as Row[], recent = (d.recent ?? []) as Row[];
  const matches = found && !found.error ? ((found.data.clients ?? []) as Row[]).slice(0, 8) : [];
  const balance = new Map(clients.map((c) => [String(c.id), Number(c.points)]));

  return (
    <>
      <div className="kpis">
        <div className="kpi"><small>Clients with points</small><b>{n(k.members)}</b><span>{rules.enabled ? "Loyalty is on" : "Loyalty is off"}</span></div>
        <div className="kpi"><small>Points not yet spent</small><b>{n(k.outstanding)}</b><span>worth {money(k.outstanding * rules.point_value_cents, cur)} off future visits</span></div>
        <div className="kpi"><small>Earned · 30d</small><b>{n(k.earned_30d)}</b><span>points given at checkout</span></div>
        <div className="kpi"><small>Spent · 30d</small><b>{n(k.redeemed_30d)}</b><span>{k.redeemed_30d ? `${money(k.redeemed_30d * rules.point_value_cents, cur)} off, across ${plural(k.redemptions_30d, "sale")}` : "No points spent"}</span></div>
      </div>

      <div className="wrap">
        <div className="left">
          <div className="muted" style={EYEBROW}>Clients with points</div>
          {clients.length ? (
            <div className="tablebox">
              <DataTable id="loyalty-clients" search="Search clients" pageSize={10} noun="client" sort={{ col: "Balance", dir: "desc" }}>
                <table>
                  <thead><tr><th>Client</th><th>Balance</th><th>Worth</th><th>Earned</th><th>Spent</th><th>Last activity</th><th data-nosort data-col="Action" /></tr></thead>
                  <tbody>
                    {clients.map((c) => (
                      <tr key={c.id}>
                        <td><Link href={`/business/clients${qs({ client: c.id })}`}><b>{c.name}</b></Link>{c.phone ? <div className="muted" style={{ fontSize: 12 }}>{c.phone}</div> : null}</td>
                        <td data-sort={c.points}><b>{n(c.points)}</b></td>
                        <td data-sort={c.points * rules.point_value_cents}>{money(c.points * rules.point_value_cents, cur)}</td>
                        <td data-sort={c.earned}>{n(c.earned)}</td>
                        <td data-sort={c.redeemed}>{n(c.redeemed)}</td>
                        <td data-sort={c.last_at}>{c.last_at ? when(c.last_at, tz) : <span className="muted">None</span>}</td>
                        <td><AdjustSheet client={c} points={Number(c.points)} back={back} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTable>
            </div>
          ) : <Empty title="Nobody has points yet">{rules.enabled ? "Clients earn points the next time they pay at Checkout." : "Switch loyalty on and clients earn points each time they pay at Checkout."}</Empty>}

          <div className="cardx">
            <div className="hdx"><h3>Give points to a client by hand</h3></div>
            <form action="/business/marketing" className="rowx" role="search">
              <input type="hidden" name="tab" value="loyalty" />
              <input className="inp" style={{ flex: "1 1 220px", width: "auto" }} type="search" name="find" defaultValue={q} placeholder="Name or phone number" aria-label="Find a client by name or phone number" />
              <button className="btn btn-out btn-sm">Find client</button>
            </form>
            {q ? (matches.length ? (
              <div>
                {matches.map((c) => (
                  <div key={c.id} className="rowline">
                    <div style={{ minWidth: 0 }}><b>{c.name}</b><span>{[c.phone, balance.has(String(c.id)) ? `${n(balance.get(String(c.id))!)} points` : "no points yet"].filter(Boolean).join(" · ")}</span></div>
                    <AdjustSheet client={c} points={balance.get(String(c.id)) ?? null} back={back + qs({ find: q }).replace("?", "&")} />
                  </div>
                ))}
              </div>
            ) : <div className="muted" style={{ fontSize: 13 }}>No client matches &quot;{q}&quot;.</div>) : null}
          </div>

          <div className="muted" style={{ ...EYEBROW, marginTop: 4 }}>Recent movements</div>
          {recent.length ? (
            <div className="tablebox">
              <DataTable id="loyalty-moves" search="Search movements" filters={["What"]} pageSize={10} noun="movement" sort={{ col: "When", dir: "desc" }}>
                <table>
                  <thead><tr><th>When</th><th>Client</th><th>Points</th><th>What</th><th>Note</th><th>By</th></tr></thead>
                  <tbody>
                    {recent.map((r) => (
                      <tr key={r.id}>
                        <td data-sort={r.created_at}>{when(r.created_at, tz)}</td>
                        <td><Link href={`/business/clients${qs({ client: r.client_id })}`}><b>{r.client}</b></Link></td>
                        <td data-sort={r.points}><b style={{ color: r.points < 0 ? "#9B2C2C" : "#1F6B3A" }}>{r.points > 0 ? "+" : "−"}{n(Math.abs(r.points))}</b></td>
                        <td>{REASON[r.reason] ?? r.reason}</td>
                        <td style={{ whiteSpace: "normal" }}>{r.note || <span className="muted">None</span>}</td>
                        <td>{r.actor || <span className="muted">System</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTable>
            </div>
          ) : <Empty title="No movements yet">Every time points are earned, spent or changed by hand, it is listed here.</Empty>}
        </div>

        <aside className="panel" aria-label="Loyalty rules">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div className="serif" style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.1 }}>Loyalty points</div>
            <span className={"pill " + (rules.enabled ? "pill-ok" : "pill-grey")}>{rules.enabled ? "On" : "Off"}</span>
          </div>
          <form action={saveLoyalty} className="stack">
            <input type="hidden" name="back" value={back} />
            <LoyaltyFields rules={rules} currency={cur} />
            <div><button className="btn btn-ink btn-sm" style={{ width: "100%" }}>Save rules</button></div>
          </form>
          <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.55 }}>
            Points are earned on what a client pays for services and products, not on tips or tax. They are spent at Checkout. A change to the rules applies from the next sale; points already earned stay as they are.
          </div>
        </aside>
      </div>
    </>
  );
}

// ---------- promo codes ----------

export async function PromosTab({ m, open }: { m: Merchant; open: boolean }) {
  const { data: d, error } = await mLoad("/promos");
  if (error) return <Fail error={error} />;
  const cur = m.currency, tz = m.timezone, back = "/business/marketing?tab=promos";
  const promos = (d.promos ?? []) as Row[], link = String(d.booking_link ?? "");
  const now = Date.now();
  const stateOf = (p: Row) => (!p.active ? "Off" : p.ends_at && Date.parse(p.ends_at) < now ? "Ended" : p.starts_at && Date.parse(p.starts_at) > now ? "Not started" : p.max_uses !== null && p.max_uses !== undefined && p.used >= p.max_uses ? "Used up" : "On");
  const tone: Record<string, string> = { On: "pill-ok", Off: "pill-grey", Ended: "pill-grey", "Not started": "pill-gold", "Used up": "pill-grey" };
  // The saved code as the edit form needs it. Its dates are moments in the business zone, so they are read back as days there.
  const values = (p: Row): PromoValues => ({
    code: String(p.code), description: String(p.description ?? ""), kind: String(p.kind), value: Number(p.value), min_cents: Number(p.min_cents ?? 0),
    max_uses: p.max_uses === null || p.max_uses === undefined ? null : Number(p.max_uses), starts: p.starts_at ? ymd(p.starts_at, tz) : "", ends: p.ends_at ? ymd(p.ends_at, tz) : "", used: Number(p.used ?? 0),
  });

  return (
    <>
      <div className="cardx hero">
        <div style={{ flex: "1 1 420px", minWidth: 0 }}>
          <div className="muted" style={EYEBROW}>Your own promo codes</div>
          <p className="lead">A code gives a client money off. It works on <b>your booking page</b> and at <b>Checkout</b>, for {m.business} only. The discount comes off what the client pays you.</p>
        </div>
        <div style={{ alignSelf: "center" }}>
          <Sheet trigger="New code" triggerClass="btn btn-ink" title="New promo code" sub={`Works on your booking page and at Checkout, for ${m.business} only.`} open={open} closeHref={back}>
            <form action={createPromo}>
              <input type="hidden" name="back" value={back} />
              <PromoFields currency={cur} />
              <div className="sheet-ft"><button className="btn btn-ink">Create code</button></div>
            </form>
          </Sheet>
        </div>
      </div>

      {promos.length ? (
        <div className="tablebox">
          <DataTable id="promos" search="Search codes" filters={["State"]} pageSize={25} noun="code">
            <table>
              <thead><tr><th>Code</th><th>What it does</th><th>Minimum spend</th><th>Uses</th><th>Dates</th><th>Given away</th><th>Bookings it brought</th><th>State</th><th data-nosort data-col="On">On</th><th data-nosort data-col="Action" /></tr></thead>
              <tbody>
                {promos.map((p) => {
                  const st = stateOf(p);
                  const what = p.kind === "percent" ? `${p.value}% off` : `${money(p.value, cur)} off`;
                  return (
                    <tr key={p.id}>
                      <td><b style={{ letterSpacing: ".04em" }}>{p.code}</b></td>
                      <td style={{ whiteSpace: "normal", minWidth: 140 }} data-sort={p.value}>{what}{p.description ? <div className="muted" style={{ fontSize: 12 }}>{p.description}</div> : null}</td>
                      <td data-sort={p.min_cents}>{p.min_cents > 0 ? money(p.min_cents, cur) : "None"}</td>
                      <td data-sort={p.used}>{p.max_uses !== null && p.max_uses !== undefined ? `${p.used} of ${p.max_uses}` : `${p.used}`}</td>
                      <td data-sort={p.ends_at ?? "9999"}>{p.starts_at || p.ends_at ? `${p.starts_at ? dateMed(p.starts_at, tz) : "Now"} to ${p.ends_at ? dateMed(p.ends_at, tz) : "no end"}` : "Always"}</td>
                      <td data-sort={p.given_cents}>{money(p.given_cents, cur)}</td>
                      <td data-sort={p.booked_cents}>{money(p.booked_cents, cur)}</td>
                      <td data-filter={st}><span className={`pill ${tone[st]}`}>{st}</span></td>
                      <td>
                        <form action={togglePromo}>
                          <input type="hidden" name="back" value={back} /><input type="hidden" name="id" value={p.id} /><input type="hidden" name="active" value={p.active ? "0" : "1"} />
                          <button className={"sw" + (p.active ? "" : " off")} role="switch" aria-checked={!!p.active} aria-label={`${p.code}: ${p.active ? "on, switch off" : "off, switch on"}`} />
                        </form>
                      </td>
                      <td>
                        <div className="rowx" style={{ flexWrap: "nowrap", gap: 6 }}>
                          <Sheet trigger="Edit" triggerClass="btn btn-out btn-sm" title={`Edit ${p.code}`} sub={p.used > 0 ? `Used ${p.used === 1 ? "once" : `${p.used} times`}. The discount is locked; the rest can change.` : "Not used yet, so everything but the code itself can change."}>
                            <form action={updatePromo}>
                              <input type="hidden" name="back" value={back} /><input type="hidden" name="id" value={p.id} />
                              <PromoFields currency={cur} p={values(p)} idp={`pe-${p.id}`} />
                              <div className="sheet-ft"><button className="btn btn-ink">Save code</button></div>
                            </form>
                          </Sheet>
                          <CopyButton text={`Use code ${p.code} at ${link}`}>Copy share line</CopyButton>
                          {p.used === 0 ? (
                            <form action={deletePromo}><input type="hidden" name="back" value={back} /><input type="hidden" name="id" value={p.id} /><ConfirmButton className="btn btn-danger btn-sm" message={`Delete the code ${p.code}?`}>Delete</ConfirmButton></form>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DataTable>
        </div>
      ) : <Empty title="No promo codes yet">Press New code to make one, then share it with your booking link.</Empty>}
      <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>A code that has been used cannot be deleted, so its record stays; switch it off instead. The share line reads &quot;Use code … at {link}&quot;.</div>
    </>
  );
}
