import Link from "next/link";
import { Btn, Content, Empty, Field, FilterSearch, Flash, Hidden, Panel, Pill, Tabs, Topbar, ago, inputCls, statusPill } from "@/components/admin-ui";
import { getAdmin, load, qs, type Row } from "@/lib/admin-api";
import { replyTicket, updateTicket } from "../actions-growth";

type SP = { status?: string; q?: string; mine?: string; id?: string; ok?: string; err?: string };
const roleName: Record<string, string> = { client: "Client", business: "Business", other: "Other" };

export default async function Support({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const status = sp.status ?? "open";
  const { q = "", mine = "" } = sp;
  const filters = { status, q, mine };
  const [admin, res] = await Promise.all([getAdmin(), load(`/support${qs({ status: status === "all" ? "" : status, q, mine })}`)]);
  const tickets: Row[] = res.data.tickets ?? [];
  const selId = sp.id ?? tickets[0]?.id;
  const detail = selId ? await load(`/support/${encodeURIComponent(selId)}`) : null;
  const t: Row | undefined = detail?.data.ticket;
  const here = (extra: Record<string, string | undefined>) => `/admin/support${qs({ ...filters, ...extra })}`;
  const back = here({ id: t?.id });
  const c = res.data.counts ?? {};
  const emailOn = res.data.mail_mode && res.data.mail_mode !== "log";

  return (
    <>
      <Topbar title="Support" sub="Messages from the help page. Replies go to the customer by email.">
        <Tabs items={[["open", `Open · ${c.open ?? 0}`], ["waiting", `Waiting on customer · ${c.waiting ?? 0}`], ["closed", "Closed"], ["all", "All"]]} current={status} href={(s) => `/admin/support${qs({ status: s, q, mine })}`} />
      </Topbar>
      <Content>
        <Flash sp={sp} error={res.error || detail?.error} />
        {!emailOn && <p className="rounded-xl bg-warn-bg px-4 py-2.5 text-[13.5px]">Email is not set up, so replies are saved but not sent. Contact the customer by phone until it is.</p>}
        <div className="flex flex-wrap items-center gap-3">
          <FilterSearch action="/admin/support" q={q} placeholder="Reference, name, email or subject" keep={{ status, mine }} />
          <Tabs items={[["", "Everyone's"], ["1", "Mine"]]} current={mine} href={(m) => `/admin/support${qs({ status, q, mine: m })}`} />
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[380px_1fr]">
          <Panel flush>
            {tickets.map((x) => (
              <Link key={x.id} href={here({ id: x.id })} className={`block border-b border-line-2 px-4 py-3 last:border-0 ${t?.id === x.id ? "bg-cream-3" : "hover:bg-cream"}`}>
                <div className="flex items-center gap-2"><b className="text-[13px] font-semibold text-muted">{x.ref}</b>{x.priority === "urgent" && <Pill kind="wine">urgent</Pill>}{statusPill(x.status)}<span className="ml-auto text-[12px] text-muted">{ago(x.updated_at)}</span></div>
                <div className="mt-1 truncate text-[14.5px] font-semibold">{x.subject}</div>
                <div className="truncate text-[12.5px] text-muted">{x.name} · {roleName[x.role]}{x.business ? ` · ${x.business}` : ""}</div>
                <div className="mt-0.5 truncate text-[12.5px] text-muted-2">{x.preview}</div>
              </Link>
            ))}
            {tickets.length === 0 && <Empty>Nothing here.</Empty>}
          </Panel>

          {t && detail && (
            <div className="flex min-w-0 flex-col gap-5">
              <Panel>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="mr-auto min-w-0">
                    <div className="serif text-[26px] font-semibold leading-tight">{t.subject}</div>
                    <div className="mt-1.5 text-[13px] text-muted">{t.ref} · {t.name} · {roleName[t.role]} · opened {ago(t.created_at)}</div>
                    <div className="mt-1 text-[13.5px]">{t.email && <a href={`mailto:${t.email}`} className="font-medium underline decoration-line underline-offset-2">{t.email}</a>}{t.email && t.phone ? " · " : ""}{t.phone}{t.business && <> · <Link href={`/admin/businesses/${t.business_ref}`} className="font-medium text-wine">{t.business}</Link></>}</div>
                  </div>
                  {statusPill(t.status)}
                </div>
                <form action={updateTicket} className="mt-4 flex flex-wrap items-end gap-2 border-t border-line-2 pt-4">
                  <Hidden values={{ id: t.id, back }} />
                  <Field label="Assigned to" className="w-[220px]"><select name="assigned_to" defaultValue={t.assigned_to} className={inputCls}><option value="">Nobody</option>{(detail.data.staff ?? []).map((p: Row) => <option key={p.email} value={p.email}>{p.name}{p.email === admin?.email ? " (you)" : ""}</option>)}</select></Field>
                  <Field label="Priority" className="w-[140px]"><select name="priority" defaultValue={t.priority} className={inputCls}><option value="normal">Normal</option><option value="urgent">Urgent</option></select></Field>
                  <Field label="Status" className="w-[200px]"><select name="status" defaultValue={t.status} className={inputCls}><option value="open">Open</option><option value="waiting">Waiting on customer</option><option value="closed">Closed</option></select></Field>
                  <Btn>Save</Btn>
                </form>
              </Panel>

              <div className="flex flex-col gap-3">
                {(detail.data.messages ?? []).map((m: Row) => (
                  <div key={m.id} className={`max-w-[760px] rounded-2xl border px-4 py-3 ${m.internal ? "self-end border-dashed border-gold-ink/40 bg-warn-bg" : m.from_staff ? "self-end border-line bg-white" : "border-line bg-cream"}`}>
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-[12px] text-muted">
                      <b className="font-semibold text-ink">{m.author}</b>
                      {m.internal ? <Pill kind="gold">staff note</Pill> : m.from_staff ? <Pill kind="info">reply</Pill> : null}
                      {m.delivery && !m.internal && <span>{m.delivery === "sent" ? "emailed" : m.delivery === "logged" ? "not sent, email is off" : m.delivery}</span>}
                      <span>{ago(m.created_at)}</span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-[14.5px] leading-relaxed">{m.body}</p>
                  </div>
                ))}
              </div>

              <Panel title="Reply">
                <form action={replyTicket} className="flex flex-col gap-3">
                  <Hidden values={{ id: t.id, back }} />
                  <textarea name="body" required rows={5} maxLength={6000} placeholder={`Write to ${t.name}. Your name is added at the end.`} className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[14.5px] leading-relaxed outline-none focus:border-ink" />
                  <div className="flex flex-wrap gap-2">
                    <Btn kind="ink" name="kind" value="reply">{t.email ? "Send reply" : "Save reply"}</Btn>
                    <Btn name="kind" value="close">{t.email ? "Send and close" : "Save and close"}</Btn>
                    <Btn name="kind" value="note">Add as a staff note</Btn>
                  </div>
                  {!t.email && <p className="text-[12.5px] text-muted">There is no email on this ticket. The reply is saved here; call or message {t.phone}.</p>}
                </form>
              </Panel>
            </div>
          )}
        </div>
      </Content>
    </>
  );
}
