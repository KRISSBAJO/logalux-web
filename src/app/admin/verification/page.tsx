import Link from "next/link";
import { Btn, Content, Empty, Facts, Flash, Hidden, Panel, Pill, ReadOnly, Tabs, Topbar, ago, initials, statusPill } from "@/components/admin-ui";
import { Avatar } from "@/components/icons";
import { can, getAdmin, load, qs, type Row } from "@/lib/admin-api";
import { decideVerification } from "../actions";

export default async function Verification({ searchParams }: { searchParams: Promise<{ status?: string; id?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const status = sp.status ?? "";
  const [admin, res] = await Promise.all([getAdmin(), load(`/verification${qs({ status })}`)]);
  const reqs: Row[] = res.data.requests ?? [];
  const sel = reqs.find((r) => r.id === sp.id) ?? reqs[0];
  const back = `/admin/verification${qs({ status, id: sel?.id })}`;
  const risk = (n: number) => (n < 20 ? "low" : n < 50 ? "medium" : "high");

  return (
    <>
      <Topbar title="Verification" sub="Target: a decision within 24 hours of applying">
        <Tabs items={[["", "All"], ["pending", "Needs review"], ["needs_info", "Waiting on applicant"], ["approved", "Approved"], ["rejected", "Rejected"]]} current={status} href={(s) => `/admin/verification${qs({ status: s })}`} />
      </Topbar>
      <Content>
        <Flash sp={sp} error={res.error} />
        <div className="grid items-start gap-5 lg:grid-cols-[360px_1fr]">
          <Panel flush>
            {reqs.map((r) => (
              <Link key={r.id} href={`/admin/verification${qs({ status, id: r.id })}`} className={`flex items-center gap-3 border-b border-line-2 px-4 py-3 last:border-0 ${sel?.id === r.id ? "bg-cream-3" : "hover:bg-cream"}`}>
                <Avatar initials={initials(r.name)} tone={r.tone} />
                <span className="min-w-0 flex-1"><b className="block truncate text-[14px] font-semibold">{r.name}</b><span className="text-[12px] capitalize text-muted">{r.category} · {r.city}</span></span>
                <span className="flex flex-col items-end gap-1 text-[12px]"><span className={r.age_hours > 18 && r.status === "pending" ? "font-semibold text-bad" : "text-muted"}>{ago(r.created_at)}</span>{statusPill(r.status)}</span>
              </Link>
            ))}
            {reqs.length === 0 && <Empty>Nothing in this queue.</Empty>}
          </Panel>

          {sel && (
            <div className="flex min-w-0 flex-col gap-5">
              <Panel>
                <div className="mb-4 flex flex-wrap items-center gap-3.5">
                  <Avatar initials={initials(sel.name)} tone={sel.tone} size={52} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/businesses/${sel.business_id}`} className="serif text-[28px] font-semibold leading-none hover:text-wine">{sel.name}</Link>
                    <div className="mt-1 text-[13px] capitalize text-muted">{sel.owner_name} · {sel.category} · {sel.market} · applied {ago(sel.created_at)}</div>
                  </div>
                  {statusPill(sel.status)}
                  <Pill kind={sel.risk_score < 20 ? "ok" : sel.risk_score < 50 ? "gold" : "wine"}>Risk {sel.risk_score} · {risk(sel.risk_score)}</Pill>
                </div>
                <Facts items={[["Phone", sel.phone], ["Instagram", sel.instagram], ["Address", [sel.address, sel.city].filter(Boolean).join(", ")], ["ID", `${sel.id_type} · ${sel.id_provider}`], ["Licence", String(sel.licence_status).replace(/_/g, " ")], ["Booking link", `logaluxe.com/@${sel.slug}`]]} />
              </Panel>

              <Panel title="Checks">
                <div className="grid gap-2 sm:grid-cols-2">
                  {([
                    [true, "Identity verified", `${sel.id_provider} · name and date of birth match the ID`],
                    [true, "Phone verified", "WhatsApp reachable"],
                    [sel.licence_status !== "missing", sel.licence_status === "missing" ? "Certificate missing" : sel.licence_status === "not_required" ? "Licence not required" : "Licence valid", sel.licence_status === "missing" ? "Ask before approving regulated services" : "Checked against the local rule"],
                    [!String(sel.portfolio_note).includes("another"), "Portfolio", sel.portfolio_note || "No concerns"],
                  ] as [boolean, string, string][]).map(([ok, t, d]) => (
                    <div key={t} className="flex gap-2.5 rounded-xl bg-cream-2 px-3.5 py-3 text-[13px]">
                      <span className={`flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] font-bold text-white ${ok ? "bg-ok" : "bg-rose"}`}>{ok ? "✓" : "!"}</span>
                      <span><b className="block font-semibold">{t}</b><span className="text-muted">{d}</span></span>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Decision" sub={sel.decided_by ? `Last decided by ${sel.decided_by}, ${ago(sel.decided_at)}` : undefined}>
                {sel.decision_note && <p className="mb-3 rounded-xl bg-warn-bg px-3.5 py-2.5 text-[13px]">Last note: {sel.decision_note}</p>}
                {can(admin, "ops") ? (
                  <form action={decideVerification} className="flex flex-col gap-3">
                    <Hidden values={{ id: sel.id, back }} />
                    <textarea name="note" rows={3} placeholder="Note to the applicant. It is sent with the decision." className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[14px] outline-none focus:border-ink" />
                    <div className="flex flex-wrap gap-2">
                      <Btn kind="ok" name="decision" value="approve">Approve and verify</Btn>
                      <Btn name="decision" value="needs_info">Request more info</Btn>
                      <Btn kind="danger" name="decision" value="reject">Reject</Btn>
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
