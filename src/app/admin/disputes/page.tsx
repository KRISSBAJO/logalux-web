import Link from "next/link";
import { Btn, Content, Empty, Field, Flash, Hidden, Panel, ReadOnly, Tabs, Topbar, ago, fmtMoney, inputCls, statusPill } from "@/components/admin-ui";
import { can, getAdmin, load, qs, type Row } from "@/lib/admin-api";
import { resolveDispute } from "../actions";

const outcomeName: Record<string, string> = { full: "Full refund", partial: "Partial refund", credit: "LogaLuxe store credit", decline: "Declined", out_of_scope: "Out of scope" };

export default async function Disputes({ searchParams }: { searchParams: Promise<{ status?: string; id?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const status = sp.status ?? "";
  const [admin, res] = await Promise.all([getAdmin(), load(`/disputes${qs({ status })}`)]);
  const list: Row[] = res.data.disputes ?? [];
  const sel = list.find((d) => d.id === sp.id) ?? list[0];
  const back = `/admin/disputes${qs({ status, id: sel?.id })}`;
  const open = sel && (sel.status === "with_business" || sel.status === "needs_decision");

  return (
    <>
      <Topbar title="Disputes" sub="The business gets 48 hours to answer before we decide">
        <Tabs items={[["", "All"], ["needs_decision", "Needs decision"], ["with_business", "With business"], ["resolved", "Resolved"]]} current={status} href={(s) => `/admin/disputes${qs({ status: s })}`} />
      </Topbar>
      <Content>
        <Flash sp={sp} error={res.error} />
        <div className="grid items-start gap-5 lg:grid-cols-[360px_1fr]">
          <Panel flush>
            {list.map((d) => (
              <Link key={d.id} href={`/admin/disputes${qs({ status, id: d.id })}`} className={`block border-b border-line-2 px-4 py-3 last:border-0 ${sel?.id === d.id ? "bg-cream-3" : "hover:bg-cream"}`}>
                <div className="flex items-center gap-2"><b className="text-[14px] font-semibold">{d.ref}</b>{statusPill(d.status)}<span className="ml-auto text-[14px] font-semibold">{fmtMoney(d.amount_cents, d.currency)}</span></div>
                <div className="mt-1 truncate text-[12.5px] text-muted">{d.client_name} · {d.business}</div>
                <div className="mt-0.5 text-[12.5px]">{d.reason}{(d.status === "with_business" || d.status === "needs_decision") && <span className={d.hours_left < 0 ? " font-semibold text-bad" : " text-muted"}> · {d.hours_left < 0 ? `${Math.round(-d.hours_left)} h overdue` : `${Math.round(d.hours_left)} h left`}</span>}</div>
              </Link>
            ))}
            {list.length === 0 && <Empty>No disputes here.</Empty>}
          </Panel>

          {sel && (
            <div className="flex min-w-0 flex-col gap-5">
              <Panel>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="mr-auto min-w-0">
                    <div className="serif text-[28px] font-semibold leading-none">{sel.ref} · {sel.reason}</div>
                    <div className="mt-1.5 text-[13px] text-muted">Opened {ago(sel.created_at)} · {sel.market} · <Link href={`/admin/businesses/${sel.business_id}`} className="font-medium text-ink underline decoration-line underline-offset-2">{sel.business}</Link></div>
                  </div>
                  {statusPill(sel.status)}
                  <span className="text-[22px] font-semibold">{fmtMoney(sel.amount_cents, sel.currency)}</span>
                </div>
              </Panel>
              <div className="grid gap-5 md:grid-cols-2">
                <Panel title={`Client · ${sel.client_name}`}><p className="text-[14.5px] leading-relaxed">{sel.client_statement || "No statement."}</p></Panel>
                <Panel title={`Business · ${sel.business}`}><p className="text-[14.5px] leading-relaxed">{sel.business_statement || "No reply yet."}</p></Panel>
              </div>
              <Panel title={open ? "Decision" : "Outcome"}>
                {!open ? (
                  <p className="text-[14.5px]"><b className="font-semibold">{outcomeName[sel.outcome] ?? sel.outcome}</b>{sel.outcome_cents ? ` · ${fmtMoney(sel.outcome_cents, sel.currency)}` : ""} · {ago(sel.resolved_at)}{sel.decision_note ? ` · ${sel.decision_note}` : ""}</p>
                ) : can(admin, "ops") ? (
                  <form action={resolveDispute} className="flex flex-col gap-3">
                    <Hidden values={{ id: sel.id, back }} />
                    <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                      <Field label={`Amount (${sel.currency})`}><input name="amount" type="number" min="0" step="0.01" defaultValue={sel.amount_cents / 100} className={inputCls} /></Field>
                      <Field label="Reason, sent to both sides"><input name="note" required className={inputCls} /></Field>
                    </div>
                    <p className="text-[12.5px] text-muted">The amount is used for a partial refund or a credit. A full refund always returns {fmtMoney(sel.amount_cents, sel.currency)}.</p>
                    <div className="flex flex-wrap gap-2">
                      <Btn kind="ok" name="decision" value="full">Full refund</Btn>
                      <Btn kind="ink" name="decision" value="partial">Partial refund</Btn>
                      <Btn name="decision" value="credit">LogaLuxe store credit</Btn>
                      <Btn kind="danger" name="decision" value="decline">Decline</Btn>
                      <Btn name="decision" value="out_of_scope">Out of scope</Btn>
                    </div>
                  </form>
                ) : <ReadOnly need="ops" />}
              </Panel>
            </div>
          )}
        </div>
      </Content>
    </>
  );
}
