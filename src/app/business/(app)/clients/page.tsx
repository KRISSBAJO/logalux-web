import Link from "next/link";
import { AutoForm, ConfirmButton, Sheet } from "@/components/merchant-client";
import { Avatar, Empty, Flash, Fld, Ic, LoadError, Pill, Switch, Topbar, TopSearch, type PillTone } from "@/components/merchant-ui";
import { getMe, mCan, mLoad, qs, type Row } from "@/lib/merchant-api";
import { CHANNEL_LABEL, clock, dateMed, dateOnly, dayShort, money, plural, STATUS_LABEL, when, ymd } from "@/lib/merchant-format";
import { adjustPoints, createClient, importClients, messageClient, planAction, updateClient } from "./actions";
import "../../css/clients.css";

export const metadata = { title: "Clients" };

type SP = { q?: string; segment?: string; sort?: string; page?: string; client?: string; new?: string; ok?: string; err?: string };

const SEGMENTS: { id: string; name: string; count?: string }[] = [
  { id: "", name: "All", count: "all" },
  { id: "new", name: "New this month", count: "new" },
  { id: "regulars", name: "Regulars", count: "regulars" },
  { id: "upcoming", name: "Booked ahead", count: "upcoming" },
  { id: "lapsed", name: "Lapsed 60+ days", count: "lapsed" },
  { id: "no_show", name: "No-shows", count: "no_show" },
  { id: "waitlist", name: "Waitlist" },
];
const SORTS: [string, string][] = [["", "last visit"], ["name", "name"], ["spent", "most spent"], ["visits", "most visits"], ["new", "newest"]];
const TONES = ["#7A1F2B", "#2E2538", "#1F2A33", "#4A3426", "#5A4A3A", "#2A3A33", "#3A3A2E", "#4A2A2A"];
const tone = (name: string) => TONES[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % TONES.length];
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const DAY = 864e5;

/** The pills in the Tags column: the client's own tags first, otherwise what their history says. */
function tagPills(c: Row): { tone: PillTone; text: string }[] {
  const tags = (c.tags ?? []) as string[];
  if (tags.length) return tags.slice(0, 2).map((t) => ({ tone: t === "vip" ? "gold" : t === "waitlist" ? "ok" : t === "new" ? "new" : "grey", text: t === "vip" ? "VIP" : cap(t) }));
  if (c.last_visit && !c.next_visit && Date.now() - Date.parse(c.last_visit) > 60 * DAY) return [{ tone: "wine", text: "Lapsed" }];
  if (Date.now() - Date.parse(c.created_at) < 30 * DAY) return [{ tone: "new", text: "New" }];
  if (c.visits >= 3) return [{ tone: "grey", text: "Regular" }];
  return [];
}

export default async function Clients({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const me = (await getMe())!;
  const { merchant: m } = me;
  const tz = m.timezone, cur = m.currency;
  const manager = mCan(me, "manager");

  const segment = SEGMENTS.some((s) => s.id === sp.segment) ? sp.segment! : "";
  const sort = SORTS.some(([id]) => id === sp.sort) ? sp.sort! : "";
  const filters = { q: sp.q, segment, sort, page: sp.page };
  const { data: d, error } = await mLoad("/clients" + qs(filters));
  if (error) return <div className="main pg-clients"><LoadError title="Clients" error={error} /></div>;

  const rows = (d.clients ?? []) as Row[], counts = (d.counts ?? {}) as Row;
  const total = Number(d.total ?? 0), page = Number(d.page ?? 1), per = Number(d.per_page ?? 25);
  const pages = Math.max(1, Math.ceil(total / per));

  // The side panel shows the client named in the address, or the first one in the list.
  const selId = sp.client || rows[0]?.id || "";
  // One call tells who holds a membership or a package, for the marks in the list. The panel loads the detail of one client.
  const [detail, held, menu] = await Promise.all([
    selId ? mLoad(`/clients/${encodeURIComponent(selId)}`) : null,
    selId ? mLoad(`/clients/${encodeURIComponent(selId)}/plans`) : null,
    mLoad("/menu"),
  ]);
  const holders = ((menu.data.holders ?? []) as Row[]).filter((h) => h.status === "active");
  const members = new Set(holders.filter((h) => h.kind === "membership").map((h) => h.client_id as string));
  const packaged = new Set(holders.filter((h) => h.kind === "package").map((h) => h.client_id as string));
  const plans = (held && !held.error ? held.data.plans ?? [] : []) as Row[];
  const loyalty = (held && !held.error ? held.data.loyalty ?? null : null) as Row | null;
  const pointsHeld = Number(held?.data.points ?? 0);
  const off = (p: Row) => [p.service_discount_pct > 0 ? `${p.service_discount_pct}% off services` : "", p.retail_discount_pct > 0 ? `${p.retail_discount_pct}% off retail` : ""].filter(Boolean).join(", ");
  const sel = detail && !detail.error ? (detail.data.client as Row) : null;
  const visits = (detail?.data.visits ?? []) as Row[];

  const href = (over: Record<string, string | number | undefined> = {}) => "/business/clients" + qs({ ...filters, client: sp.client, ...over });
  const back = href({ client: sel?.id ?? sp.client });
  // The list is paged and sorted by the API, so headings and page numbers are links.
  const pageHref = (p: number) => href({ page: p <= 1 ? undefined : Math.min(p, pages), client: undefined });
  const pageList = Array.from({ length: pages }, (_, i) => i + 1).filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 2)
    .flatMap((p, i, all) => (i > 0 && p - all[i - 1] > 1 ? [0, p] : [p]));
  const sortHead = (text: string, id: string, dir: "ascending" | "descending") => (
    <th key={text} aria-sort={sort === id ? dir : undefined} className={sort === id ? "sorted" : undefined}>
      <Link href={"/business/clients" + qs({ q: sp.q, segment, sort: id })} title={`Sort by ${text.toLowerCase()}`}>{text}<span aria-hidden="true">{sort === id ? (dir === "ascending" ? " ↑" : " ↓") : " ↕"}</span></Link>
    </th>
  );
  const today = ymd(new Date(), tz);
  const lastLabel = (v: string | null) => (!v ? "—" : ymd(v, tz) === today ? "Today" : cap(when(v, tz)));
  const nextLabel = (v: string | null) => (!v ? "—" : ymd(v, tz) === today ? `Today ${clock(v, tz)}` : dayShort(v, tz));
  const since = (v: string) => new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", year: "numeric" }).format(new Date(v));
  const birthday = (v: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(v.slice(0, 10) + "T12:00:00Z"));

  const consent = sel ? Object.entries((sel.consent ?? {}) as Record<string, unknown>).filter(([, v]) => v !== null && v !== "") : [];

  const clientForm = (c: Row | null) => (
    <div style={{ display: "contents" }}>
      <Fld label="Name"><input name="name" required maxLength={80} defaultValue={c?.name ?? ""} /></Fld>
      <div className="f2">
        <Fld label="Phone" hint="With the country code, like +234 or +1"><input name="phone" type="tel" defaultValue={c?.phone ?? ""} /></Fld>
        <Fld label="Email"><input name="email" type="email" defaultValue={c?.email ?? ""} /></Fld>
      </div>
      <div className="f2">
        <Fld label="Preferred channel">
          <select name="preferred_channel" defaultValue={c?.preferred_channel ?? "whatsapp"}>
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
          </select>
        </Fld>
        <Fld label="Birthday"><input name="birthday" type="date" defaultValue={c?.birthday ? String(c.birthday).slice(0, 10) : ""} /></Fld>
      </div>
      <Fld label="Tags" hint="Separate with commas. Up to 10. Use waitlist to put them in the Waitlist segment."><input name="tags" defaultValue={((c?.tags ?? []) as string[]).join(", ")} placeholder="vip, waitlist" /></Fld>
      <Fld label="Formula and preferences"><textarea name="notes" maxLength={4000} defaultValue={c?.notes ?? ""} placeholder="Colour formula, allergies, how they like it done" /></Fld>
      <Switch name="marketing_opt_in" on={c ? !!c.marketing_opt_in : true} label="Marketing messages" sub="They agreed to get offers and reminders to rebook" />
    </div>
  );

  return (
    <div className="main pg-clients">
      <Topbar title={<>Clients <span className="muted" style={{ fontSize: 16, fontFamily: "'DM Sans',sans-serif", fontWeight: 500 }}>{Number(counts.all ?? 0).toLocaleString("en-US")}</span></>}>
        <TopSearch action="/business/clients" value={sp.q ?? ""} placeholder="Name, phone, or email" hidden={{ segment, sort }} />
        <span style={{ flex: 1 }} />
        {manager && (
          <Sheet trigger="Import" title="Import clients" sub="Paste a list. Nobody already in your list is changed.">
            <form action={importClients}>
              <input type="hidden" name="back" value={href()} />
              <Fld label="One client per line" hint="Name, phone, email, in any order, separated by commas or tabs. You can paste straight from a spreadsheet. Up to 2,000 at a time.">
                <textarea name="rows" required rows={10} style={{ minHeight: 220, fontFamily: "ui-monospace,monospace", fontSize: 13 }} placeholder={"Kemi Adeyemi, +16155554471, kemi@example.com\nTomi Alade, +16155552210"} />
              </Fld>
              <div className="muted" style={{ fontSize: 12.5 }}>Imported clients get the tag &ldquo;imported&rdquo;. A row is skipped when its phone or email is already in your list.</div>
              <div className="sheet-ft"><button className="btn btn-ink">Import</button></div>
            </form>
          </Sheet>
        )}
        {manager && <a href="/business/clients/export" className="btn btn-out" download>Export</a>}
        <Sheet trigger={<span style={{ display: "contents" }}><Ic name="plus" size={16} stroke={2.4} />Add client</span>} triggerClass="btn btn-ink" title="New client" open={sp.new === "1"} closeHref={href()}>
          <form action={createClient}>
            <input type="hidden" name="back" value={href()} />
            {clientForm(null)}
            <div className="sheet-ft"><button className="btn btn-ink">Add client</button></div>
          </form>
        </Sheet>
      </Topbar>

      <div className="content">
        <Flash sp={sp} />
        <div className="tools">
          {SEGMENTS.map((s) => (
            <Link key={s.id} href={"/business/clients" + qs({ q: sp.q, segment: s.id, sort })} className={"chip" + (segment === s.id ? " on" : "")} aria-current={segment === s.id ? "true" : undefined}>
              {s.name}{s.count ? <small>{Number(counts[s.count] ?? 0).toLocaleString("en-US")}</small> : null}
            </Link>
          ))}
          <span style={{ flex: 1 }} />
          <AutoForm action="/business/clients">
            {sp.q ? <input type="hidden" name="q" value={sp.q} /> : null}
            {segment ? <input type="hidden" name="segment" value={segment} /> : null}
            <select name="sort" defaultValue={sort} className="btn btn-out btn-sm sortsel" aria-label="Sort clients">
              {SORTS.map(([id, name]) => <option key={id} value={id}>Sort: {name}</option>)}
            </select>
            <noscript><button className="btn btn-out btn-sm">Apply</button></noscript>
          </AutoForm>
        </div>

        {Number(counts.lapsed ?? 0) > 0 && segment !== "lapsed" && (
          <div className="insight">
            <Ic name="spark" size={22} color="#D4AF5A" />
            <div style={{ flex: 1, fontSize: 14, lineHeight: 1.45 }}><b>{plural(Number(counts.lapsed), "client")}</b> {Number(counts.lapsed) === 1 ? "has" : "have"} not been back in 60 days and {Number(counts.lapsed) === 1 ? "has" : "have"} nothing booked. A short message can bring them back.</div>
            {manager
              ? <Link href="/business/marketing" className="btn btn-sm" style={{ background: "#D4AF5A", color: "#1A1513" }}>Send win-back</Link>
              : <Link href={"/business/clients" + qs({ segment: "lapsed" })} className="btn btn-sm" style={{ background: "#D4AF5A", color: "#1A1513" }}>See them</Link>}
          </div>
        )}

        <div className="wrap">
          <div className="tablebox">
            {rows.length ? (
              <table>
                <thead><tr>{sortHead("Client", "name", "ascending")}{sortHead("Last visit", "", "descending")}<th>Next</th>{sortHead("Visits", "visits", "descending")}{sortHead("Spent", "spent", "descending")}<th>No-shows</th><th>Tags</th><th>Channel</th></tr></thead>
                <tbody>
                  {rows.map((r) => {
                    const pills = [...(members.has(r.id) ? [{ tone: "gold" as PillTone, text: "Member" }] : []), ...(packaged.has(r.id) ? [{ tone: "ok" as PillTone, text: "Package" }] : []), ...tagPills(r)].slice(0, 3);
                    return (
                      <tr key={r.id} className={"row" + (sel?.id === r.id ? " on" : "")}>
                        <td>
                          <div className="name">
                            <Avatar name={r.name} tone={tone(r.name)} />
                            <div><Link href={href({ client: r.id }) + "#client"} className="rowlink">{r.name}</Link><small>{r.phone || r.email || "No contact details"}</small></div>
                          </div>
                        </td>
                        <td>{lastLabel(r.last_visit)}</td>
                        <td>{nextLabel(r.next_visit)}</td>
                        <td>{r.visits}</td>
                        <td><b>{money(r.spent_cents, cur)}</b></td>
                        <td>{r.no_show_count}</td>
                        <td>{pills.length ? <span style={{ display: "inline-flex", gap: 4 }}>{pills.map((p) => <Pill key={p.text} tone={p.tone}>{p.text}</Pill>)}</span> : <span className="muted">—</span>}</td>
                        <td className="muted">{CHANNEL_LABEL[r.preferred_channel] ?? r.preferred_channel}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: 16 }}>
                {sp.q || segment
                  ? <Empty title="No clients match">Try another name or number, or <Link href="/business/clients">see everyone</Link>.</Empty>
                  : <Empty title="No clients yet">Add your first client, or paste a list with Import. Anyone who books online is added for you.</Empty>}
              </div>
            )}
            {total > 0 && (
              <div className="dt-foot">
                <span className="dt-count">{((page - 1) * per + 1).toLocaleString("en-US")} to {((page - 1) * per + rows.length).toLocaleString("en-US")} of {total.toLocaleString("en-US")} {total === 1 ? "client" : "clients"} · {per} a page</span>
                <span className="dt-grow" />
                <nav className="dt-pages" aria-label="Pages">
                  <Link href={pageHref(page - 1)} aria-disabled={page <= 1} aria-label="Previous page">‹</Link>
                  {pageList.map((p, i) => p === 0
                    ? <span key={"gap" + i}>…</span>
                    : <Link key={p} href={pageHref(p)} className={p === page ? "on" : ""} aria-current={p === page ? "page" : undefined}>{p}</Link>)}
                  <Link href={pageHref(page + 1)} aria-disabled={page >= pages} aria-label="Next page">›</Link>
                </nav>
              </div>
            )}
          </div>

          {sel ? (
            <aside className="panel" id="client" key={sel.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar name={sel.name} tone={tone(sel.name)} size={48} style={{ fontSize: 15 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="serif" style={{ fontSize: 24, fontWeight: 600, lineHeight: 1 }}>{sel.name}</div>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>Since {since(sel.created_at)}{sel.phone ? ` · ${sel.phone}` : ""}</div>
                  {sel.email ? <div className="muted" style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis" }}>{sel.email}</div> : null}
                </div>
              </div>
              {sel.blocked ? <div className="flash flash-err" style={{ fontSize: 13 }}>This phone number is on the blocked list.</div> : null}
              <div className="stats">
                <div><b>{sel.visits}</b><small>Visits</small></div>
                <div><b>{money(sel.spent_cents, cur)}</b><small>Spent</small></div>
                <div><b>{money(sel.tips_cents, cur)}</b><small>Tips</small></div>
                <div><b>{sel.no_show_count}</b><small>No-show</small></div>
              </div>
              <div className="acts">
                <Link href={"/business/calendar" + qs({ new: 1, client: sel.id })} className="btn btn-ink btn-sm">Book</Link>
                <Sheet trigger="Message" triggerClass="btn btn-out btn-sm" title={`Message ${sel.name}`} sub="This starts a conversation in your Inbox, or adds to the one already there.">
                    <form action={messageClient}>
                      <input type="hidden" name="back" value={back} />
                      <input type="hidden" name="client_id" value={sel.id} />
                      <Fld label="Send by" hint="In-app reaches clients who have a LogaLuxe account. Email goes out when a mail provider is set. WhatsApp and SMS are not connected on this install, so those messages are logged, not sent.">
                        <select name="channel" defaultValue="">
                          <option value="">Best way to reach them</option>
                          <option value="in_app">In-app</option>
                          <option value="email" disabled={!sel.email}>Email{sel.email ? "" : " (no address on file)"}</option>
                          <option value="whatsapp" disabled={!sel.phone}>WhatsApp, logged only{sel.phone ? "" : " (no number on file)"}</option>
                          <option value="sms" disabled={!sel.phone}>SMS, logged only{sel.phone ? "" : " (no number on file)"}</option>
                        </select>
                      </Fld>
                      <Fld label="Message"><textarea name="body" required maxLength={4000} rows={5} /></Fld>
                      <div className="sheet-ft"><button className="btn btn-ink">Send</button></div>
                    </form>
                </Sheet>
                <Link href={"/business/checkout" + qs({ sale: "new", client: sel.id })} className="btn btn-out btn-sm">Charge</Link>
                <Sheet trigger="Edit" triggerClass="btn btn-out btn-sm" title="Edit client" sub={sel.name}>
                  <form action={updateClient}>
                    <input type="hidden" name="back" value={back} />
                    <input type="hidden" name="id" value={sel.id} />
                    {clientForm(sel)}
                    <div className="sheet-ft"><button className="btn btn-ink">Save</button></div>
                  </form>
                </Sheet>
              </div>
              <div className="note"><b>Formula and preferences</b><br />{sel.notes ? <span style={{ whiteSpace: "pre-wrap" }}>{sel.notes}</span> : <span className="muted">Nothing noted yet. Use Edit to add it.</span>}</div>
              {((sel.tags ?? []) as string[]).length ? (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(sel.tags as string[]).map((t) => <Pill key={t} tone={t === "vip" ? "gold" : t === "waitlist" ? "ok" : "grey"}>{t === "vip" ? "VIP" : cap(t)}</Pill>)}
                </div>
              ) : null}
              {loyalty?.enabled ? (
                <div className="loyal">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b>{pointsHeld.toLocaleString("en-US")} loyalty {pointsHeld === 1 ? "point" : "points"}</b>
                    <span>Worth {money(pointsHeld * loyalty.point_value_cents, cur)} off. {pointsHeld >= loyalty.min_redeem ? "They can spend them at checkout." : `They can spend them from ${loyalty.min_redeem} points.`}</span>
                  </div>
                  {manager && (
                    <Sheet trigger="Adjust points" triggerClass="btn btn-out btn-sm" title="Adjust points" sub={`${sel.name} has ${pointsHeld.toLocaleString("en-US")} points`}>
                      <form action={adjustPoints}>
                        <input type="hidden" name="back" value={back} />
                        <input type="hidden" name="client_id" value={sel.id} />
                        <Fld label="Points to add or take away" hint="Use a minus sign to take points away, like -50. The balance cannot go below zero."><input name="points" type="number" step={1} min={-100000} max={100000} required placeholder="50" /></Fld>
                        <Fld label="Reason" hint="Kept with the change, so the team can see why."><input name="note" required minLength={3} maxLength={200} placeholder="Goodwill after a late start" /></Fld>
                        <div className="sheet-ft"><button className="btn btn-ink">Save</button></div>
                      </form>
                    </Sheet>
                  )}
                </div>
              ) : null}
              <div>
                <div className="muted" style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 6 }}>Packages and memberships</div>
                {held?.error ? <div className="muted" style={{ fontSize: 13 }}>{held.error}</div> : plans.length ? plans.map((p) => {
                  const live = p.status === "active" || p.status === "past_due";
                  const expired = !!p.expires_at && Date.parse(p.expires_at) < Date.now();
                  return (
                    <div key={p.id} className="plan">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <b>{p.name} <Pill tone={p.status === "active" ? "ok" : p.status === "past_due" ? "gold" : p.status === "cancelled" ? "wine" : "grey"}>{p.status === "active" ? (p.kind === "membership" ? "Member" : "Active") : p.status === "past_due" ? "Payment owing" : p.status === "cancelled" ? "Cancelled" : p.status === "used" ? "Used up" : p.status === "expired" ? "Expired" : p.status}</Pill></b>
                        <span>
                          {[
                            p.kind === "membership" ? `Membership · ${money(p.price_cents, cur)} a month` : `Package · ${money(p.price_cents, cur)}`,
                            p.kind === "membership" ? off(p) : "",
                            p.kind === "membership" ? (p.renews_on ? `${p.status === "cancelled" ? "would have renewed" : "renews"} ${dateOnly(p.renews_on, "med")}` : "") : p.expires_at ? `${expired ? "ran out" : "use by"} ${dateOnly(p.expires_at, "med")}` : "",
                          ].filter(Boolean).join(" · ")}
                        </span>
                        {p.kind === "membership" && live ? <span>{p.card_on_file ? "Card on file · renews automatically" : "No card on file · collect at the desk"}</span> : null}
                        {p.status === "past_due" ? <span style={{ color: "#9B2C2C" }}>{p.charge_problem ? `The last renewal was declined: ${p.charge_problem}` : "The renewal is owed. Collect it at checkout."}</span> : null}
                        {((p.credits ?? []) as Row[]).map((c) => <span key={c.id}>{c.service}: {c.left} of {c.total} left{c.left > 0 && !c.usable && live ? " (cannot be used now)" : ""}</span>)}
                      </div>
                      {manager && (live || (p.status === "cancelled" && !expired)) ? (
                        <form action={planAction}>
                          <input type="hidden" name="back" value={back} />
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="kind" value={p.kind} />
                          <input type="hidden" name="action" value={p.status === "active" ? "cancel" : "reactivate"} />
                          {p.status === "active"
                            ? <ConfirmButton className="btn btn-danger btn-sm" message={p.kind === "membership" ? `Cancel ${p.name} for ${sel.name}? It will not renew and the member discount stops.` : `Cancel ${p.name} for ${sel.name}? The visits left on it are forfeited.`}>Cancel</ConfirmButton>
                            : <button className="btn btn-out btn-sm">Reactivate</button>}
                        </form>
                      ) : null}
                    </div>
                  );
                }) : <div className="muted" style={{ fontSize: 13 }}>None yet.</div>}
                <Link href={"/business/checkout" + qs({ sale: "new", client: sel.id })} style={{ fontSize: 13, fontWeight: 600, display: "inline-block", marginTop: 6 }}>Sell a package or membership</Link>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 6 }}>Recent visits</div>
                {visits.length ? visits.map((v) => {
                  const ahead = Date.parse(v.starts_at) > Date.now() && (v.status === "requested" || v.status === "confirmed");
                  const gone = String(v.status).startsWith("cancelled") || v.status === "no_show" || v.status === "rescheduled";
                  return (
                    <Link key={v.id} href={`/business/calendar?booking=${v.id}`} className="visit">
                      <span className="ph" style={ahead ? { background: "#D4AF5A" } : gone ? { background: "#C9BCB0" } : undefined} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <b>{v.services ?? "Visit"}</b>
                        <span>{dateMed(v.starts_at, tz)} · {money(v.total_cents, cur)}{v.tip_cents > 0 ? ` + ${money(v.tip_cents, cur)} tip` : ""} · {v.staff} · {ahead ? "Booked" : STATUS_LABEL[v.status] ?? v.status}</span>
                      </div>
                    </Link>
                  );
                }) : <div className="muted" style={{ fontSize: 13 }}>No visits yet.</div>}
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                {[
                  `Marketing messages ${sel.marketing_opt_in ? "on" : "off"}`,
                  `prefers ${CHANNEL_LABEL[sel.preferred_channel] ?? sel.preferred_channel}`,
                  sel.birthday ? `birthday ${birthday(String(sel.birthday))}` : "",
                  consent.length ? `consent on file: ${consent.map(([k, v]) => `${k.replace(/_/g, " ")}${v === true ? " yes" : v === false ? " no" : ` ${String(v)}`}`).join(", ")}` : "no consent forms on file",
                ].filter(Boolean).join(" · ")}.
              </div>
            </aside>
          ) : sp.client ? (
            <aside className="panel" id="client"><Empty title="Client not found">They may have been removed. Pick someone from the list.</Empty></aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}
