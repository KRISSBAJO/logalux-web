import Link from "next/link";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { Sheet } from "@/components/merchant-client";
import { Avatar, Empty, Flash, Fld, LoadError, Topbar } from "@/components/merchant-ui";
import { getMe, mCan, mLoad, qs, type Row } from "@/lib/merchant-api";
import { CHANNEL_LABEL, clock, dayShort, firstName, money, STATUS_LABEL, when, ymd } from "@/lib/merchant-format";
import { careCounts } from "../care-counts";
import { messageClient } from "../clients/actions";
import { assignThread, replyThread, saveReplies, setThreadStatus } from "./actions";
import { deliveryLabel } from "./delivery";
import { Problems } from "./problems";
import { DraftReply, InsertText, Messages } from "./reply-tools";
import "../../css/inbox.css";

export const metadata = { title: "Inbox" };

type SP = { filter?: string; q?: string; thread?: string; new?: string; cq?: string; ok?: string; err?: string; tab?: string; problem?: string };

const FILTERS: [string, string][] = [["open", "Open"], ["unread", "Unread"], ["mine", "Assigned to me"], ["closed", "Closed"]];
const CH_CLASS: Record<string, string> = { whatsapp: "ch-wa", sms: "ch-sms", in_app: "ch-app", email: "ch-mail" };
const TONES = ["#4A3426", "#1F2A33", "#7A1F2B", "#3A3A2E", "#2A3A33", "#5A4A3A", "#2E2538", "#4A2A2A"];
const tone = (name: string) => TONES[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % TONES.length];
const label = (channel: string) => (channel === "in_app" ? "In-app" : CHANNEL_LABEL[channel] ?? channel);

function Who({ name, channel, size }: { name: string; channel: string; size?: number }) {
  return (
    <span className="avatar" style={{ background: tone(name), ...(size ? { width: size, height: size } : {}) }}>
      {name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("")}
      <span className={"ch " + (CH_CLASS[channel] ?? "ch-sms")} title={label(channel)} />
    </span>
  );
}

export default async function Inbox({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const me = (await getMe())!;
  const { merchant: m } = me;
  const tz = m.timezone, cur = m.currency;
  const manager = mCan(me, "manager");
  if (sp.tab === "problems") return <Problems sp={sp} m={m} />;
  const care = await careCounts();
  const filter = FILTERS.some(([id]) => id === sp.filter) ? sp.filter! : "open";
  const listPath = "/inbox" + qs({ filter, q: sp.q });

  // Opening a conversation marks it read, so it is loaded before the list when one is named in the address.
  let one = sp.thread ? await mLoad(`/inbox/${encodeURIComponent(sp.thread)}`) : null;
  const { data: d, error } = await mLoad(listPath);
  if (error) return <div className="main pg-inbox"><LoadError title="Inbox" error={error} /></div>;
  const threads = (d.threads ?? []) as Row[], counts = (d.counts ?? {}) as Row;
  // With nothing chosen, show the newest conversation only if it has already been read: looking at the list must not mark anything read.
  if (!sp.thread && threads[0] && !threads[0].unread_business) one = await mLoad(`/inbox/${encodeURIComponent(threads[0].id)}`);

  const t = one && !one.error ? (one.data.thread as Row) : null;
  const messages = (one?.data.messages ?? []) as Row[], client = (one?.data.client ?? null) as Row | null, booking = (one?.data.booking ?? null) as Row | null;
  const saved = (one?.data.saved_replies ?? []) as Row[], staff = (one?.data.staff ?? []) as Row[];
  const assignee = t?.assigned_staff_id ? staff.find((p) => p.id === t.assigned_staff_id)?.name ?? "" : "";

  const base = { filter: filter === "open" ? undefined : filter, q: sp.q };
  const href = (over: Record<string, string | number | undefined> = {}) => "/business/inbox" + qs({ ...base, thread: sp.thread, ...over });
  const back = href({ thread: t?.id ?? sp.thread });

  const h = await headers();
  const bookingLink = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost"}/b/${m.slug}`;

  const today = ymd(new Date(), tz), yesterday = ymd(new Date(Date.now() - 864e5), tz);
  const dayName = (v: string) => { const day = ymd(v, tz); return day === today ? "Today" : day === yesterday ? "Yesterday" : dayShort(v, tz); };
  const dayIn = (v: string) => { const day = ymd(v, tz); return day === today ? "today" : day === yesterday ? "yesterday" : dayShort(v, tz); };

  // What this install can really do on the channel of the open conversation.
  let notice = "";
  if (t) {
    if (t.channel === "whatsapp" || t.channel === "sms") notice = `${label(t.channel)} is not connected on this install. Replies are logged here, not sent to the client.`;
    else if (t.channel === "email" && one?.data.mail_mode !== "live" && one?.data.mail_mode !== "resend" && one?.data.mail_mode !== "smtp") notice = "No mail provider is set on this install. Email replies are logged here, not sent.";
    else if (t.channel === "in_app" && !t.has_account) notice = "This client has no LogaLuxe account, so in-app replies are logged here and not delivered.";
  }

  // The conversation, oldest first, with a divider at each new day. The note about the channel sits last, next to the reply box.
  const flow: ReactNode[] = [];
  let lastDay = "";
  for (const msg of messages) {
    const day = ymd(msg.created_at, tz);
    if (day !== lastDay) { flow.push(<div key={"d" + day} className="day">{dayName(msg.created_at)}</div>); lastDay = day; }
    const state = msg.from_business ? deliveryLabel(msg.delivery ?? "") : "";
    flow.push(
      <div key={msg.id} className={"m " + (msg.from_business ? "me" : "them") + (msg.from_business && msg.delivery !== "delivered" && msg.delivery !== "sent" && msg.delivery !== "logged" ? " failed" : "")}>
        {msg.body}
        <time dateTime={msg.created_at}>{[msg.from_business ? firstName(msg.author ?? "") : "", clock(msg.created_at, tz), state].filter(Boolean).join(" · ")}</time>
      </div>,
    );
  }
  if (notice) flow.push(<div key="notice" className="sys">{notice}</div>);

  // Drafting with AI is offered only when the API says it is switched on.
  const ai = t ? ((await mLoad("/ai")).data as Row) : null;

  const pickClients = sp.new === "1" ? await mLoad("/clients" + qs({ q: sp.cq, sort: "name" })) : null;
  const people = (pickClients?.data.clients ?? []) as Row[];

  return (
    <div className="main pg-inbox">
      <Topbar title="Inbox">
        {FILTERS.map(([id, name]) => (
          <Link key={id} href={"/business/inbox" + qs({ filter: id === "open" ? undefined : id, q: sp.q })} className={"chip" + (filter === id ? " on" : "")} aria-current={filter === id ? "true" : undefined}>
            {name}{Number(counts[id] ?? 0) > 0 ? <small>{counts[id]}</small> : null}
          </Link>
        ))}
        {manager && <Link href="/business/inbox?tab=problems" className="chip" title="Problems clients reported about a visit">Problems{care.problems > 0 ? <small>{care.problems}</small> : null}</Link>}
        <span style={{ flex: 1 }} />
        {t && (
          <Sheet trigger="Assign" title="Assign conversation" sub={`${t.client_name} · ${assignee ? `with ${assignee} now` : "nobody has it yet"}`}>
            <form action={assignThread}>
              <input type="hidden" name="back" value={back} />
              <input type="hidden" name="id" value={t.id} />
              <Fld label="Who looks after it" hint="It shows under Assigned to me for that person. The first person to reply to an unassigned conversation takes it.">
                <select name="assigned_staff_id" defaultValue={t.assigned_staff_id ?? ""}>
                  <option value="">Nobody</option>
                  {staff.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Fld>
              <div className="sheet-ft"><button className="btn btn-ink">Save</button></div>
            </form>
          </Sheet>
        )}
        <Link href={href({ new: 1 })} className="btn btn-ink">New message</Link>
        <Sheet title="New message" sub="Write to one of your clients. It opens a conversation here." open={sp.new === "1"} closeHref={href()}>
          <form action="/business/inbox" className="rowx" style={{ flexDirection: "row", alignItems: "flex-end" }}>
            <input type="hidden" name="new" value="1" />
            {base.filter ? <input type="hidden" name="filter" value={base.filter} /> : null}
            {sp.thread ? <input type="hidden" name="thread" value={sp.thread} /> : null}
            <Fld label="Find a client" style={{ flex: 1 }}><input type="search" name="cq" defaultValue={sp.cq ?? ""} placeholder="Name, phone, or email" /></Fld>
            <button className="btn btn-out">Find</button>
          </form>
          {pickClients?.error ? <div role="alert" className="flash flash-err">{pickClients.error}</div> : people.length ? (
            <form action={messageClient}>
              <input type="hidden" name="back" value={href({ new: 1, cq: sp.cq })} />
              <div className="pick" role="radiogroup" aria-label="Client">
                {people.map((p, i) => (
                  <label key={p.id}>
                    <input type="radio" name="client_id" value={p.id} required defaultChecked={people.length === 1 && i === 0} />
                    <span style={{ minWidth: 0 }}>{p.name}<small>{[p.phone, p.email].filter(Boolean).join(" · ") || "No contact details"}</small></span>
                  </label>
                ))}
              </div>
              {Number(pickClients?.data.total ?? 0) > people.length ? <div className="muted" style={{ fontSize: 12.5 }}>Showing the first {people.length} of {pickClients?.data.total}. Search to narrow it down.</div> : null}
              <Fld label="Send by" hint="In-app reaches clients who have a LogaLuxe account. Email goes out when a mail provider is set. WhatsApp and SMS are not connected on this install, so those messages are logged, not sent.">
                <select name="channel" defaultValue="">
                  <option value="">Best way to reach them</option>
                  <option value="in_app">In-app</option>
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp, logged only</option>
                  <option value="sms">SMS, logged only</option>
                </select>
              </Fld>
              <Fld label="Message"><textarea name="body" required maxLength={4000} rows={5} /></Fld>
              <div className="sheet-ft"><button className="btn btn-ink">Send</button></div>
            </form>
          ) : sp.new === "1" ? (
            <Empty title={sp.cq ? "No client matches" : "No clients yet"}>{sp.cq ? "Try another name or number." : <span>Add one on the <Link href="/business/clients?new=1">Clients</Link> screen first.</span>}</Empty>
          ) : null}
        </Sheet>
      </Topbar>

      <div className="content">
        <Flash sp={sp} />
        <div className="wrap">
          <div className="threads">
            <form action="/business/inbox" className="search" role="search">
              {base.filter ? <input type="hidden" name="filter" value={base.filter} /> : null}
              <span className="sr">Search</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input type="search" name="q" defaultValue={sp.q ?? ""} placeholder="Search conversations" aria-label="Search conversations" />
            </form>
            <div className="list">
              {threads.length ? threads.map((x) => (
                <Link key={x.id} href={href({ thread: x.id }) + "#conversation"} className={"th" + (t?.id === x.id ? " on" : "") + (x.unread_business ? " unread" : "")} aria-current={t?.id === x.id ? "true" : undefined}>
                  <Who name={x.client_name} channel={x.channel} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b>{x.client_name}</b><time dateTime={x.last_message_at}>{when(x.last_message_at, tz)}</time></span>
                    <p>{x.last_preview || "No messages yet"}</p>
                  </span>
                  {x.unread_business ? <span className="dot" role="img" aria-label="Unread" /> : null}
                </Link>
              )) : (
                <div style={{ padding: 14 }}>
                  {sp.q ? <Empty title="No conversation matches">Try another name or word.</Empty>
                    : filter === "open" ? <Empty title="No open conversations">When a client writes to you, or you write to them, it shows here.</Empty>
                    : filter === "unread" ? <Empty title="Nothing unread">You are up to date.</Empty>
                    : filter === "mine" ? <Empty title="Nothing assigned to you">Conversations you reply to, or are given, show here.</Empty>
                    : <Empty title="No closed conversations">Close a conversation when it is dealt with.</Empty>}
                </div>
              )}
            </div>
          </div>

          <div className="conv" id="conversation">
            {t ? (
              <>
                <div className="hd">
                  <Who name={t.client_name} channel={t.channel} size={40} />
                  <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                    <b>{t.client_name}</b>
                    <span>{label(t.channel)} · {booking ? `${booking.services ?? "visit"} ${dayIn(booking.starts_at)} ${clock(booking.starts_at, tz)}` : "no upcoming booking"} · {assignee ? `assigned to ${firstName(assignee)}` : "unassigned"}{t.status === "closed" ? " · closed" : ""}</span>
                  </div>
                  {t.client_id ? <Link href={"/business/calendar" + qs({ new: 1, client: t.client_id })} className="btn btn-out btn-sm">Book</Link> : null}
                  {t.client_id ? <Link href={`/business/clients?client=${t.client_id}`} className="btn btn-out btn-sm">Profile</Link> : null}
                  <form action={setThreadStatus}>
                    <input type="hidden" name="back" value={back} />
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="status" value={t.status === "closed" ? "open" : "closed"} />
                    <button className="btn btn-out btn-sm">{t.status === "closed" ? "Reopen" : "Close"}</button>
                  </form>
                </div>
                <Messages count={messages.length}>
                  {flow.length ? flow : <div className="sys">No messages in this conversation yet.</div>}
                </Messages>
                <form className="compose" action={replyThread}>
                  <input type="hidden" name="back" value={back} />
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="channel" value={t.channel} />
                  <label>
                    <span className="sr">Message</span>
                    <textarea id="reply-body" name="body" required maxLength={4000} rows={2} placeholder={notice ? "Write a reply to log" : `Reply on ${label(t.channel)}`} />
                  </label>
                  <InsertText text={`Book here: ${bookingLink}`} className="btn btn-out btn-sm" title="Puts your booking link in the reply">Add booking link</InsertText>
                  <button className="btn btn-ink" style={{ minHeight: 46 }}>{notice ? "Log reply" : "Send"}</button>
                </form>
              </>
            ) : (
              <div className="blank">
                {one?.error ? <Empty title="Conversation not found">It may belong to another business. Pick one from the list.</Empty>
                  : threads.length ? <Empty title="Choose a conversation">Pick one from the list to read it and reply. Opening it marks it as read.</Empty>
                  : <Empty title="No conversation open">Start one with New message.</Empty>}
              </div>
            )}
          </div>

          <aside className="ctx">
            {t ? (
              <>
                <h3>About {firstName(t.client_name)}</h3>
                {client ? (
                  <div className="kv">
                    <div><span>Client since</span><b>{new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", year: "numeric" }).format(new Date(client.created_at))}</b></div>
                    <div><span>Visits</span><b>{client.visits}</b></div>
                    <div><span>Spent</span><b>{money(client.spent_cents, cur)}</b></div>
                    <div><span>No-shows</span><b>{client.no_show_count}</b></div>
                    <div><span>Prefers</span><b>{label(client.preferred_channel)}</b></div>
                    {client.phone ? <div><span>Phone</span><b>{client.phone}</b></div> : null}
                    {client.email ? <div><span>Email</span><b style={{ overflowWrap: "anywhere" }}>{client.email}</b></div> : null}
                  </div>
                ) : <div className="muted" style={{ fontSize: 13 }}>This person is not in your client list yet.</div>}

                <h3>Next booking</h3>
                {booking ? (
                  <Link href={`/business/calendar?booking=${booking.id}`} className="bk">
                    <b>{booking.services ?? "Visit"} · {dayIn(booking.starts_at)} {clock(booking.starts_at, tz)}</b>
                    <span>with {booking.staff} · {(STATUS_LABEL[booking.status] ?? booking.status).toLowerCase()}</span>
                  </Link>
                ) : (
                  <div className="bk"><b>No upcoming booking</b><span>Add your booking link to a reply, or book them in yourself.</span></div>
                )}

                <h3>Saved replies</h3>
                {saved.length ? (
                  <div className="saved">
                    {saved.map((r) => <InsertText key={r.id} text={r.body} title={r.body}>{r.title}</InsertText>)}
                  </div>
                ) : <div className="muted" style={{ fontSize: 13 }}>None yet.{manager ? " Add the answers you type most often." : " A manager can add them."}</div>}
                {saved.length ? <div className="muted" style={{ fontSize: 12 }}>Pressing one puts it in the reply box. Nothing is sent until you send it.</div> : null}
                {ai?.enabled ? (
                  <div style={{ display: "contents" }}>
                    <h3>Draft a reply</h3>
                    <DraftReply key={t.id} threadId={t.id} used={Number(ai.used_today ?? 0)} limit={Number(ai.limit ?? 0)} />
                  </div>
                ) : null}
                {manager && (
                  <Sheet trigger="Edit saved replies" triggerClass="btn btn-out btn-sm" title="Saved replies" sub="Short answers anyone on the team can drop into a reply." wide>
                    <form action={saveReplies}>
                      <input type="hidden" name="back" value={back} />
                      {[...saved, ...Array.from({ length: saved.length >= 28 ? Math.max(0, 30 - saved.length) : 2 }, () => ({ id: "", title: "", body: "" }))].map((r, i) => (
                        <div key={r.id || `new-${i}`} className="stack" style={{ gap: 8, paddingBottom: 12, borderBottom: "1px solid #E6DCD2" }}>
                          <Fld label={r.id ? "Name" : "New reply · name"}><input name="title" defaultValue={r.title} maxLength={40} placeholder="Directions" /></Fld>
                          <Fld label="Message"><textarea name="body" defaultValue={r.body} maxLength={1000} placeholder="What the client reads" /></Fld>
                        </div>
                      ))}
                      <div className="muted" style={{ fontSize: 12.5 }}>To remove a reply, clear both of its boxes. Up to 30. Save, then open this again to add more.</div>
                      <div className="sheet-ft"><button className="btn btn-ink">Save replies</button></div>
                    </form>
                  </Sheet>
                )}
                <div className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>In-app messages reach a client&rsquo;s LogaLuxe account. Email goes out when a mail provider is set. WhatsApp and SMS are logged here, not sent. Each message shows what happened to it.</div>
              </>
            ) : (
              <>
                <h3>About the client</h3>
                <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>Open a conversation to see who you are talking to, their next booking and your saved replies.</div>
              </>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
