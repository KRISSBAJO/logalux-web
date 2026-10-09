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
  // The papers the selected business uploaded. Identity documents are for ops and above; support sees the queue and
  // the decision. The files themselves open through /admin/verification/document/[id].
  const ops = can(admin, "ops");
  const papers = sel && ops ? await load(`/verification/${sel.id}/documents`) : null;
  const docs: Row[] = papers?.data.documents ?? [];
  const hasID = ops ? docs.some((d) => d.kind === "id") : Number(sel?.documents ?? 0) > 0;
  const kinds: Record<string, string> = papers?.data.kinds ?? {};
  const size = (n: number) => (n < 1024 ? `${n} bytes` : n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);

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
                    [hasID, hasID ? (ops ? "Photo ID uploaded" : "Documents uploaded") : "No photo ID yet", hasID ? (ops ? `${sel.id_type || "Kind not stated"}. Open it below and compare the name with the owner's.` : `${sel.documents} on file. Ops and above can open them.`) : sel.id_provider ? `Recorded when the business was added: ${sel.id_provider}` : "The business has not uploaded one."],
                    [!!sel.submitted_at, sel.submitted_at ? "Sent for checking" : "Not sent yet", sel.submitted_at ? "The business pressed Send for checking." : "Documents may be uploaded but the business has not asked for a check."],
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

              <Panel title="Documents" sub="Uploaded by the business. Each time a file is opened it is written to the audit log." flush={docs.length > 0}>
                {!ops ? (
                  <p className="text-[14px] text-muted">Identity documents are private. Ops and above can open them.</p>
                ) : papers?.error ? (
                  <p className="text-[13px] text-bad">The documents could not be loaded: {papers.error}</p>
                ) : docs.length === 0 ? (
                  <p className="text-[14px] text-muted">This business has not uploaded any documents.</p>
                ) : (
                  <table className="w-full min-w-[560px] text-left text-[13.5px]">
                    <thead>
                      <tr className="border-b border-line-2 text-[11px] font-semibold uppercase tracking-[.05em] text-muted">
                        <th className="px-5 py-2.5">Kind</th><th className="px-3 py-2.5">File</th><th className="px-3 py-2.5">Size</th><th className="px-3 py-2.5">Uploaded by</th><th className="px-3 py-2.5">When</th><th className="px-5 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {docs.map((d) => (
                        <tr key={d.id} className="border-b border-line-2 last:border-0">
                          <td className="px-5 py-3 font-semibold">{kinds[d.kind] ?? d.kind}</td>
                          <td className="max-w-[220px] break-words px-3 py-3">{d.file_name}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-muted">{size(Number(d.size_bytes ?? 0))}</td>
                          <td className="break-all px-3 py-3 text-muted">{d.uploaded_by || "Not recorded"}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-muted">{ago(d.created_at)}</td>
                          <td className="px-5 py-3 text-right"><a href={`/admin/verification/document/${d.id}`} target="_blank" rel="noreferrer" className="font-semibold text-wine hover:underline">Open<span className="sr-only"> {d.file_name}</span></a></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Panel>

              <Panel title="Decision" sub={sel.decided_by ? `Last decided by ${sel.decided_by}, ${ago(sel.decided_at)}` : undefined}>
                <div className="mb-3"><Facts narrow items={[["ID type", sel.id_type || "Not given"], ["Note from the business", sel.portfolio_note || "None"]]} /></div>
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
