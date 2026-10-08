import Link from "next/link";
import { ConfirmButton, Sheet } from "@/components/merchant-client";
import { DataTable } from "@/components/data-table";
import { Empty, Flash, Ic, LoadError, NoAccess, Topbar } from "@/components/merchant-ui";
import { getMe, mCan, mLoad, qs, type Row } from "@/lib/merchant-api";
import { CHANNEL_LABEL, dateMed, firstName, money, pct, plural, when } from "@/lib/merchant-format";
import { createCampaign, deleteCampaign, saveAutomation, sendCampaign, testCampaign } from "./actions";
import { CampaignFields, MessageField } from "./compose";
import { LeadsTab, LoyaltyTab, PromosTab } from "./tabs";
import "../../css/marketing.css";

export const metadata = { title: "Marketing" };

type SP = { ok?: string; err?: string; tab?: string; auto?: string; camp?: string; new?: string; audience?: string; find?: string };

const TABS: [string, string][] = [["auto", "Automations"], ["camp", "Campaigns"], ["leads", "New clients"], ["loyalty", "Loyalty"], ["promos", "Promo codes"]];

const ICON: Record<string, string> = {
  confirmation: "M22 2 11 13M22 2l-7 20-4-9-9-4z",
  reminder_24h: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  reminder_2h: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  review_request: "m12 2 3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21l1.4-7L2 9.3l7-.8z",
  rebook: "M21 12a9 9 0 1 1-3-6.7M21 3v6h-6",
  win_back: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z",
  birthday: "M20 12v8H4v-8M2 7h20v5H2zM12 7v13M12 7c-2-3-6-3-6 0M12 7c2-3 6-3 6 0",
};
/** Automations tied to one booking: these know the time of the visit and who is doing it. */
const BOOKING_KEYS = new Set(["confirmation", "reminder_24h", "reminder_2h", "review_request"]);

const AUDIENCES: [string, string][] = [["all", "All clients"], ["new", "New in the last 30 days"], ["regulars", "Regulars, 3 or more visits"], ["lapsed", "Lapsed, no visit in 60 days"], ["birthday", "Birthday this month"]];
const AUDIENCE_LABEL = Object.fromEntries(AUDIENCES);
const CHANNELS: [string, string][] = [["whatsapp", "WhatsApp"], ["sms", "SMS"], ["email", "Email"]];
const EYEBROW = { fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase" } as const;

const sentStat = (sent: number, delivered: number) => {
  const logged = Math.max(0, sent - delivered);
  if (!sent) return "None in 30 days";
  if (!logged) return `${delivered} delivered`;
  if (!delivered) return `${logged} logged, not delivered`;
  return `${delivered} delivered · ${logged} logged`;
};

export default async function Marketing({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const me = (await getMe())!;
  const { merchant: m } = me;
  const [{ data: d, error, status }, aiState] = await Promise.all([mLoad("/marketing"), mLoad("/ai")]);
  const ai = !aiState.error && aiState.data.enabled ? { used: Number(aiState.data.used_today ?? 0), limit: Number(aiState.data.limit ?? 0) } : undefined;
  if (status === 403) return <div className="main pg-marketing"><NoAccess title="Marketing" need="manager" /></div>;
  if (error) return <div className="main pg-marketing"><LoadError title="Marketing" error={error} /></div>;

  const cur = m.currency, tz = m.timezone;
  const k = d.kpis as Row, cap = Number(d.cap), modes = d.modes as Record<string, string>;
  const autos = (d.automations ?? []) as Row[], campaigns = (d.campaigns ?? []) as Row[];
  const audiences = d.audiences as Record<string, { total: number; email: number; phone: number }>;
  const link = String(d.booking_link ?? "");
  const emailLive = modes.email !== "log";
  // Which channels really deliver for this business right now, in the order they are offered.
  const onChannels = CHANNELS.filter(([key]) => modes[key] !== "log").map(([, name]) => name);
  const offChannels = CHANNELS.filter(([key]) => modes[key] === "log").map(([, name]) => name);
  const inWords = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1] === "Email" ? "email" : names[names.length - 1]}` : names[0] ?? "");
  const whatsappLive = modes.whatsapp === "live";

  const tab = sp.tab === "leads" || sp.tab === "loyalty" || sp.tab === "promos" ? sp.tab : sp.tab === "camp" || sp.camp ? "camp" : "auto";
  const tabsNav = (
    <div className="seg">
      {TABS.map(([key, name]) => <Link key={key} href={"/business/marketing" + qs({ tab: key === "auto" ? undefined : key })} className={tab === key ? "on" : ""} aria-current={tab === key ? "page" : undefined}>{name}</Link>)}
    </div>
  );
  if (tab === "leads" || tab === "loyalty" || tab === "promos") {
    return (
      <div className="main pg-marketing">
        <Topbar title="Marketing">{tabsNav}</Topbar>
        <div className="content">
          <Flash sp={sp} />
          {tab === "leads" ? <LeadsTab m={m} owner={mCan(me, "owner")} link={String(d.booking_link ?? "")} /> : tab === "loyalty" ? <LoyaltyTab m={m} find={sp.find} /> : <PromosTab m={m} open={sp.new === "1"} />}
        </div>
      </div>
    );
  }
  const sel = autos.find((a) => a.key === sp.auto) ?? autos[0];
  const camp = tab === "camp" ? campaigns.find((c) => c.id === sp.camp) ?? campaigns[0] : undefined;
  const back = "/business/marketing" + qs({ tab: tab === "camp" ? "camp" : undefined, auto: tab === "auto" ? sp.auto : undefined, camp: tab === "camp" ? camp?.id : undefined });

  // What the preview fills in. These are the values the server uses for a test message.
  const mine = firstName(m.name);
  const sample = { "first name": mine, "last service": "your last service", "booking link": link, staff: mine, business: m.business, time: "Saturday at 10:00" };
  const tokensFor = (booking: boolean): [string, string][] => [
    ["first name", "The client's first name"],
    ["last service", booking ? "The service they booked" : "The service they had last"],
    ["booking link", "The address of your booking page"],
    ["business", "The name of your business"],
    ...(booking ? [["staff", "Who is looking after them"], ["time", "The day and time of the visit"]] as [string, string][] : []),
  ];

  // A plain suggestion worked out from the audience numbers. Nothing here is written by a machine.
  const lapsed = audiences.lapsed?.total ?? 0, birthdays = audiences.birthday?.total ?? 0;
  const idea = lapsed > 0
    ? { text: <><b>{plural(lapsed, "client")}</b> {lapsed === 1 ? "has" : "have"} not been back in 60 days and can still get marketing from you. A short message with your booking link is the usual way to bring them back.</>, audience: "lapsed" }
    : birthdays > 0
      ? { text: <><b>{plural(birthdays, "client")}</b> {birthdays === 1 ? "has" : "have"} a birthday this month. A short note with your booking link is a good reason to write.</>, audience: "birthday" }
      : null;

  const campaignTable = (list: Row[], pageSize: number) => (
    <div className="tablebox">
      <DataTable id="campaigns" search="Search campaigns" filters={["Audience", "Channel", "Status"]} pageSize={pageSize} noun="campaign" sort={{ col: "Created", dir: "desc" }}>
      <table>
        <thead><tr><th>Campaign</th><th>Audience</th><th>Channel</th><th>Created</th><th>Sent</th><th>To</th><th>Delivered</th><th>Logged only</th><th>Booked</th><th>Revenue</th><th>Status</th></tr></thead>
        <tbody>
          {list.map((c) => {
            const done = c.status === "sent";
            return (
              <tr key={c.id}>
                <td><Link href={`/business/marketing${qs({ tab: "camp", camp: c.id })}`}><b>{c.name}</b></Link></td>
                <td>{AUDIENCE_LABEL[c.audience] ?? c.audience}</td>
                <td>{CHANNEL_LABEL[c.channel] ?? c.channel}</td>
                <td data-sort={c.created_at}>{when(c.created_at, tz)}</td>
                <td data-sort={c.sent_at ?? ""}>{c.sent_at ? when(c.sent_at, tz) : "—"}</td>
                <td data-sort={c.recipients}>{c.recipients}</td>
                <td data-sort={done ? c.delivered : -1}>{done ? c.delivered : "—"}</td>
                <td data-sort={done ? c.logged : -1}>{done ? c.logged : "—"}</td>
                <td data-sort={done ? c.booked : -1}>{done ? c.booked : "—"}</td>
                <td data-sort={done ? c.booked_cents : -1}>{done ? money(c.booked_cents, cur) : "—"}</td>
                <td data-filter={c.status === "draft" ? "Draft" : c.status === "sending" ? "Sending" : "Sent"}>{c.status === "draft" ? <span className="pill pill-grey">Draft</span> : c.status === "sending" ? <span className="pill pill-gold">Sending</span> : <span className="pill pill-ok">Sent</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </DataTable>
    </div>
  );

  const size = camp ? audiences[camp.audience] ?? { total: 0, email: 0, phone: 0 } : { total: 0, email: 0, phone: 0 };
  const reach = camp?.channel === "email" ? size.email : size.phone;
  const campLogged = camp ? modes[camp.channel] === "log" : false;

  return (
    <div className="main pg-marketing">
      <Topbar title="Marketing">
        {tabsNav}
        <span style={{ flex: 1 }} />
        <span className="muted" style={{ fontSize: 13 }}>{emailLive ? "Sent" : "Recorded"} this month: {k.sent_month} · cap of {cap} marketing messages per client</span>
        <Sheet trigger={<><Ic name="plus" size={16} stroke={2.4} />New campaign</>} triggerClass="btn btn-ink" title="New campaign" sub="It is saved as a draft. Nothing goes out until you press send." open={sp.new === "1"} closeHref={back}>
          <form action={createCampaign}>
            <input type="hidden" name="back" value={"/business/marketing?tab=camp&new=1"} />
            <CampaignFields audiences={audiences} audienceLabels={AUDIENCES} channelLabels={CHANNELS} modes={modes} cap={cap} tokens={tokensFor(false)} sample={{ ...sample, staff: "the team", time: "" }} pick={sp.audience} ai={ai} />
            <div className="sheet-ft"><button className="btn btn-ink">Save draft</button></div>
          </form>
        </Sheet>
      </Topbar>

      <div className="content">
        <Flash sp={sp} />
        {/* Each channel says for itself whether it is connected: the API reports it per channel. */}
        {offChannels.length === 0 ? null : onChannels.length === 0 ? (
          <div><span className="sim">{inWords(offChannels)} are not connected yet. Messages are logged, not delivered.</span></div>
        ) : (
          <div><span className="sim">{inWords(onChannels)} {onChannels.length > 1 ? "are" : "is"} delivered. {inWords(offChannels)} {offChannels.length > 1 ? "are" : "is"} not connected yet: {offChannels.length > 1 ? "those messages are" : "messages there are"} logged, not delivered.</span></div>
        )}

        <div className="kpis">
          <div className="kpi"><small>Rebook rate · 30d</small><b>{pct(k.rebooked, k.visited)}%</b><span>{k.visited ? `${k.rebooked} of ${plural(k.visited, "client")} who visited booked again` : "No visits in the last 30 days"}</span></div>
          <div className="kpi"><small>Brought back by win-back</small><b>{k.win_back_bookings}</b><span>{k.win_back_bookings ? `${money(k.win_back_cents, cur)} in bookings within 14 days` : "No bookings after a win-back yet"}</span></div>
          <div className="kpi"><small>Reviews · 30d</small><b>{pct(k.reviews, k.visits)}%</b><span>{k.visits ? `${plural(k.reviews, "review")} from ${plural(k.visits, "visit")}` : "No visits in the last 30 days"}</span></div>
          <div className="kpi"><small>Marketing this month</small><b>{k.marketing_month}</b><span>of {plural(k.sent_month, "message")} {emailLive ? "sent" : "recorded"} in all</span></div>
          <div className="kpi"><small>Opted out</small><b>{k.clients ? ((k.opted_out / k.clients) * 100).toFixed(1).replace(/\.0$/, "") : 0}%</b><span>{k.opted_out} of {plural(k.clients, "client")}</span></div>
        </div>

        <div className="wrap">
          <div className="left">
            {tab === "auto" ? (
              <>
                {idea ? (
                  <div className="ai">
                    <Ic name="spark" size={22} color="#D4AF5A" />
                    <div style={{ flex: 1, fontSize: 14, lineHeight: 1.45 }}>{idea.text}</div>
                    <Link href={`/business/marketing${qs({ tab: "camp", new: 1, audience: idea.audience })}`} className="btn btn-sm">Start a campaign</Link>
                  </div>
                ) : null}

                <div className="muted" style={EYEBROW}>Automations</div>
                {m.status !== "live" ? <div className="note">Automations only run for a live business. Yours is {m.status === "paused" ? "paused" : "not live yet"}, so nothing goes out for now. You can still set the wording.</div> : null}
                {autos.map((a) => (
                  <div key={a.key} className={"auto" + (a.key === sel?.key ? " on" : "")}>
                    <Link href={`/business/marketing${qs({ auto: a.key })}`} className="auto-l" aria-current={a.key === sel?.key ? "true" : undefined}>
                      <span className="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICON[a.key] ?? ICON.confirmation} /></svg></span>
                      <span style={{ flex: 1, minWidth: 0 }}><b>{a.name}</b><span>{a.when}{a.marketing ? " · counts toward the cap" : ""}</span></span>
                    </Link>
                    <span className="st">
                      <span>{sentStat(a.sent_30d, a.delivered_30d)}</span>
                      <form action={saveAutomation}>
                        <input type="hidden" name="back" value={back} />
                        <input type="hidden" name="key" value={a.key} />
                        <input type="hidden" name="enabled_set" value="1" />
                        <input type="hidden" name="enabled" value={a.enabled ? "0" : "1"} />
                        <button className={"sw" + (a.enabled ? "" : " off")} role="switch" aria-checked={!!a.enabled} aria-label={`${a.name}: ${a.enabled ? "on, turn off" : "off, turn on"}`} />
                      </form>
                    </span>
                  </div>
                ))}

                <div className="muted" style={{ ...EYEBROW, marginTop: 4 }}>Recent campaigns</div>
                {campaigns.length ? campaignTable(campaigns, 5) : <Empty title="No campaigns yet">A campaign is a one-off message to a group of clients, such as everyone who has not been back in 60 days.</Empty>}
              </>
            ) : (
              <>
                <div className="muted" style={EYEBROW}>Who you can reach</div>
                <div className="tablebox">
                  <table>
                    <thead><tr><th>Audience</th><th>Clients</th><th>With a phone number</th><th>With an email address</th><th /></tr></thead>
                    <tbody>
                      {AUDIENCES.map(([key, label]) => {
                        const a = audiences[key] ?? { total: 0, email: 0, phone: 0 };
                        return <tr key={key}><td><b>{label}</b></td><td>{a.total}</td><td>{a.phone}</td><td>{a.email}</td><td><Link href={`/business/marketing${qs({ tab: "camp", new: 1, audience: key })}`}>Write to them</Link></td></tr>;
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="muted" style={{ fontSize: 12.5 }}>Only clients who agreed to marketing are counted. {k.opted_out > 0 ? `${plural(k.opted_out, "client")} opted out and ${k.opted_out === 1 ? "is" : "are"} left out.` : "Nobody has opted out."}</div>

                <div className="muted" style={{ ...EYEBROW, marginTop: 4 }}>Campaigns</div>
                {campaigns.length ? campaignTable(campaigns, 25) : <Empty title="No campaigns yet">Press New campaign to write one. It is saved as a draft first, so you can send yourself a test.</Empty>}
              </>
            )}
          </div>

          {tab === "auto" && sel ? (
            <aside className="panel" aria-label={sel.name}>
              <form action={saveAutomation} key={sel.key} style={{ display: "contents" }}>
                <input type="hidden" name="back" value={back} />
                <input type="hidden" name="key" value={sel.key} />
                <input type="hidden" name="enabled_set" value="1" />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div className="serif" style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.1 }}>{sel.name}</div>
                  <span className={"pill " + (sel.enabled ? "pill-ok" : "pill-grey")}>{sel.enabled ? "On" : "Off"}</span>
                </div>
                <div className="field"><label htmlFor="trig">Trigger</label><input id="trig" type="text" readOnly value={sel.when} /></div>
                <div className="field">
                  <label>Sent on</label>
                  <div className="chips">
                    <span className="chip stat">Email{emailLive ? "" : " · logged only"}</span>
                    <span className="chip stat">WhatsApp{whatsappLive ? "" : " · logged only"}</span>
                  </div>
                  <small className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>You do not choose the channel here. A client with an email address gets an email; a client with only a phone number gets WhatsApp{whatsappLive ? "." : ", which is not connected yet."}</small>
                </div>
                <MessageField id="msg" value={sel.message} max={600} tokens={tokensFor(BOOKING_KEYS.has(sel.key))} sample={BOOKING_KEYS.has(sel.key) ? sample : { ...sample, staff: "the team", time: "" }} previewLabel="Preview · sample values" />
                <label className="togrow">
                  <span style={{ flex: 1 }}><b>Send this automatically</b><small>{sel.enabled ? "On now" : "Off now"}</small></span>
                  <span className="tog"><input type="checkbox" name="enabled" defaultChecked={!!sel.enabled} /><span className="sw" aria-hidden="true" /></span>
                </label>
                <div className="note">
                  <b>Last 30 days:</b> {sentStat(sel.sent_30d, sel.delivered_30d).toLowerCase()}.{" "}
                  {sel.marketing
                    ? `This is a marketing message. It counts toward the cap of ${cap} per client in 30 days, and clients who opted out do not get it.`
                    : `This is not a marketing message, so it does not count toward the cap of ${cap} per client.`}
                </div>
                <div style={{ display: "flex", gap: 8 }}><button className="btn btn-ink btn-sm" style={{ flex: 1 }}>Save</button></div>
              </form>
            </aside>
          ) : null}

          {tab === "camp" && camp ? (
            <aside className="panel" aria-label={camp.name}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div className="serif" style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.1, overflowWrap: "anywhere" }}>{camp.name}</div>
                {camp.status === "draft" ? <span className="pill pill-grey">Draft</span> : camp.status === "sending" ? <span className="pill pill-gold">Sending</span> : <span className="pill pill-ok">Sent</span>}
              </div>
              <dl className="kv">
                <dt>Goes to</dt><dd>{AUDIENCE_LABEL[camp.audience] ?? camp.audience}</dd>
                <dt>Channel</dt><dd>{CHANNEL_LABEL[camp.channel] ?? camp.channel}{campLogged ? " · logged only" : ""}</dd>
                {camp.subject ? <><dt>Subject</dt><dd>{camp.subject}</dd></> : null}
                <dt>Written by</dt><dd style={{ overflowWrap: "anywhere" }}>{camp.created_by}</dd>
                <dt>Created</dt><dd>{dateMed(camp.created_at, tz)}</dd>
                {camp.sent_at ? <><dt>Sent</dt><dd>{dateMed(camp.sent_at, tz)}</dd></> : null}
              </dl>
              <div className="preview">
                <div className="muted" style={EYEBROW}>Preview · {CHANNEL_LABEL[camp.channel] ?? camp.channel} · sample values</div>
                <div className="bubble">{Object.entries({ ...sample, staff: "the team", time: "" }).reduce((t, [key, v]) => t.split(`{${key}}`).join(v), String(camp.message))}</div>
              </div>

              {camp.status === "draft" ? (
                <>
                  <div className="note">
                    <b>{plural(size.total, "client")} in this audience right now.</b> {reach} can be reached on {CHANNEL_LABEL[camp.channel] ?? camp.channel}. Anyone who already had {cap} marketing messages in 30 days is skipped.
                    {campLogged ? <> <b>{CHANNEL_LABEL[camp.channel] ?? camp.channel} is not connected yet, so these messages will be logged, not delivered.</b></> : null}
                  </div>
                  <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>A draft cannot be edited. To change the wording, delete it and write a new one.</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <form action={sendCampaign} style={{ flex: 1 }}>
                      <input type="hidden" name="back" value={back} /><input type="hidden" name="id" value={camp.id} />
                      <ConfirmButton className="btn btn-ink btn-sm" style={{ width: "100%" }} disabled={reach === 0} message={`Send "${camp.name}" to the ${plural(reach, "client")} who can be reached? ${campLogged ? "The messages will be logged, not delivered. " : ""}This cannot be undone.`}>{campLogged ? `Log for ${plural(reach, "client")}` : `Send to ${plural(reach, "client")}`}</ConfirmButton>
                    </form>
                    <form action={testCampaign}>
                      <input type="hidden" name="back" value={back} /><input type="hidden" name="id" value={camp.id} />
                      <button className="btn btn-out btn-sm">Send test to me</button>
                    </form>
                  </div>
                  <div className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>The test goes by email to {m.email}, whatever the channel.{emailLive ? "" : " Email is not connected yet, so the test is logged, not delivered."}</div>
                  <form action={deleteCampaign}>
                    <input type="hidden" name="back" value="/business/marketing?tab=camp" /><input type="hidden" name="id" value={camp.id} />
                    <ConfirmButton className="btn btn-danger btn-sm" message={`Delete the draft "${camp.name}"?`}>Delete draft</ConfirmButton>
                  </form>
                </>
              ) : camp.status === "sending" ? (
                <>
                  <div className="note"><b>Sending is under way.</b> It carries on in the background. The numbers appear when it has finished.</div>
                  <div><Link href={back} className="btn btn-out btn-sm">Reload</Link></div>
                </>
              ) : (
                <>
                  <dl className="kv">
                    <dt>Clients in the audience</dt><dd>{camp.recipients}</dd>
                    <dt>Delivered</dt><dd>{camp.delivered}</dd>
                    <dt>Logged, not delivered</dt><dd>{camp.logged}</dd>
                    <dt>Skipped</dt><dd>{camp.skipped}</dd>
                    <dt>Failed</dt><dd>{camp.failed}</dd>
                    <dt>Booked within 14 days</dt><dd>{camp.booked}</dd>
                    <dt>Value of those bookings</dt><dd>{money(camp.booked_cents, cur)}</dd>
                  </dl>
                  <div className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>Skipped means the client had no {camp.channel === "email" ? "email address" : "phone number"}, or had already had {cap} marketing messages in 30 days.{camp.logged > 0 ? " Logged messages were recorded but did not reach anyone." : ""}</div>
                </>
              )}
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}
