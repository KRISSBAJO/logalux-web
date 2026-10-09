import { MerchantHistoryPagination } from "@/components/merchant-history-pagination";
import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { ConfirmButton, Sheet } from "@/components/merchant-client";
import { Empty, Flash, Fld, LoadError, NoAccess, Topbar } from "@/components/merchant-ui";
import { mLoad, qs, type Merchant, type Row } from "@/lib/merchant-api";
import { clock, dateMed, money } from "@/lib/merchant-format";
import { answerProblem } from "./actions";

// Problems clients reported about a visit. The business gives its side once, before the
// deadline; LogaLuxe then decides and emails both sides.

const FILTERS: [string, string][] = [["open", "Open"], ["unread", "Unread"], ["mine", "Assigned to me"], ["closed", "Closed"]];
const ABOUT: Record<string, string> = {
  quality: "The result was not what was agreed", charged: "Charged the wrong amount", no_show: "The professional did not show up", conduct: "How the client was treated", other: "Something else",
};
const STATE: Record<string, [string, string]> = {
  with_business: ["Waiting for your answer", "pill-gold"], needs_decision: ["With LogaLuxe to decide", "pill-new"], resolved: ["Decided", "pill-ok"], out_of_scope: ["Closed", "pill-grey"],
};
const OUTCOME: Record<string, string> = {
  full: "Full refund to the client", partial: "Part refund to the client", credit: "LogaLuxe credit to the client", decline: "Nothing returned to the client", out_of_scope: "Not something LogaLuxe decides",
};

export async function Problems({ sp, m }: { sp: { ok?: string; err?: string; problem?: string }; m: Merchant }) {
  const res = await mLoad("/problems"+qs(sp));
  if (res.status === 403) return <div className="main pg-inbox"><NoAccess title="Problems clients reported" need="manager" /></div>;
  if (res.error) return <div className="main pg-inbox"><LoadError title="Inbox" error={res.error} /></div>;

  const tz = m.timezone, now = Date.now();
  const rows = (res.data.problems ?? []) as Row[];
  const waiting = Number(res.data.waiting??0);
  const here = "/business/inbox" + qs({ tab: "problems" });
  const one = sp.problem ? res.data.selected_problem ?? rows.find((p) => p.id === sp.problem) : undefined;
  const stamp = (v: string) => `${dateMed(v, tz)}, ${clock(v, tz)}`;
  const late = (p: Row) => p.status === "with_business" && !!p.business_deadline && Date.parse(p.business_deadline) < now;

  return (
    <div className="main pg-inbox">
      <Topbar title="Inbox">
        {FILTERS.map(([id, name]) => <Link key={id} href={"/business/inbox" + qs({ filter: id === "open" ? undefined : id })} className="chip">{name}</Link>)}
        <Link href={here} className="chip on" aria-current="true">Problems{waiting > 0 ? <small>{waiting}</small> : null}</Link>
        <span style={{ flex: 1 }} />
      </Topbar>

      <div className="content">
        <Flash sp={sp} />
        <div className="pb-note">
          When a client reports a problem with a visit, you have 48 hours to give your side. LogaLuxe then decides and emails you both.
          If you do not answer by the deadline, they decide with what they have. Times are shown in your time zone.
        </div>
        {sp.problem && !one ? <div role="alert" className="flash flash-err">That report was not found. It may belong to another business.</div> : null}

        <MerchantHistoryPagination name="problems" label="Visit problems" pagination={res.data.problems_pagination} />
        {rows.length ? (
          <div className="pb-box">
            <DataTable id="problems" search="Search problems" filters={["About", "Status"]} pageSize={25} noun="problem">
              <table className="tbl">
                <thead><tr><th>Reference</th><th>Client</th><th>Visit</th><th>About</th><th>Status</th><th>Answer by</th><th data-nosort></th></tr></thead>
                <tbody>
                  {rows.map((p) => {
                    const [label, cls] = STATE[p.status] ?? [p.status, "pill-grey"], about = ABOUT[p.reason] ?? p.reason;
                    return (
                      <tr key={p.id}>
                        <td data-sort={p.created_at}><b>{p.ref}</b><small className="sub">Reported {dateMed(p.created_at, tz)}</small></td>
                        <td>{p.client_name}</td>
                        <td className="wrapc" data-sort={p.starts_at ?? ""}>
                          {p.starts_at ? dateMed(p.starts_at, tz) : "Visit not on record"}
                          <small className="sub">{[p.services, Number(p.amount_cents) > 0 ? money(p.amount_cents, p.currency || m.currency) : ""].filter(Boolean).join(" · ")}</small>
                        </td>
                        <td className="wrapc" data-filter={about}>{about}</td>
                        <td data-filter={label} data-sort={label}><span className={"pill " + cls}>{label}</span></td>
                        <td data-sort={p.business_deadline ?? ""}>
                          {p.status === "with_business" && p.business_deadline ? (
                            <>{stamp(p.business_deadline)}{late(p) ? <small className="sub"><span className="pill pill-bad">Overdue</span></small> : null}</>
                          ) : p.business_statement ? <span className="muted">Answered</span>
                            : p.status === "with_business" ? <span className="muted">No deadline set</span> : <span className="muted">Not answered</span>}
                        </td>
                        <td><Link href={here + "&problem=" + encodeURIComponent(p.id)} className={"btn btn-sm " + (p.status === "with_business" ? "btn-ink" : "btn-out")}>{p.status === "with_business" ? "Answer" : "Open"}</Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </DataTable>
          </div>
        ) : (
          <Empty title="No problems reported">If a client reports a problem with a visit, it shows here with the time you have to answer.</Empty>
        )}

        {one ? (
          <Sheet title={`Problem ${one.ref}`} sub={`${one.client_name} · ${ABOUT[one.reason] ?? one.reason}`} open wide closeHref={here}>
            <div className="kv">
              <div><span>Status</span><b>{(STATE[one.status] ?? [one.status])[0]}</b></div>
              <div><span>Reported</span><b>{stamp(one.created_at)}</b></div>
              <div><span>Visit</span><b>{one.starts_at ? stamp(one.starts_at) : "Not on record"}</b></div>
              {one.services ? <div><span>Services</span><b>{one.services}</b></div> : null}
              {Number(one.amount_cents) > 0 ? <div><span>Visit cost</span><b>{money(one.amount_cents, one.currency || m.currency)}</b></div> : null}
              {one.status === "with_business" && one.business_deadline ? <div><span>Answer by</span><b>{stamp(one.business_deadline)}{late(one) ? " · overdue" : ""}</b></div> : null}
            </div>

            <div className="pb-say">
              <h3>What the client said</h3>
              <p>{one.client_statement || "The client gave no statement."}</p>
            </div>

            {one.business_statement ? (
              <div className="pb-say mine">
                <h3>Your answer</h3>
                <p>{one.business_statement}</p>
              </div>
            ) : one.status !== "with_business" ? (
              <div className="pb-say mine"><h3>Your answer</h3><p className="muted">No answer was given before the deadline.</p></div>
            ) : null}

            {one.status === "with_business" && (
              <form action={answerProblem}>
                <input type="hidden" name="back" value={here} />
                <input type="hidden" name="id" value={one.id} />
                <Fld label="Your answer" hint="20 to 2,000 characters. You can answer once, so say everything that matters: what was agreed, what was done, what you offered.">
                  <textarea name="statement" required minLength={20} maxLength={2000} rows={7} />
                </Fld>
                <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
                  Your answer goes to LogaLuxe, who decide and email you both. If you do not answer by {one.business_deadline ? stamp(one.business_deadline) : "the deadline"}, they decide with what they have.
                </div>
                <div className="sheet-ft"><ConfirmButton className="btn btn-ink" message="Send this answer to LogaLuxe? You can answer once and cannot change it afterwards.">Send answer</ConfirmButton></div>
              </form>
            )}

            {one.status === "needs_decision" && <div className="pb-say"><h3>What happens next</h3><p>LogaLuxe are deciding. They email you and the client when they have.</p></div>}

            {(one.status === "resolved" || one.status === "out_of_scope") && (
              <div className="pb-say done">
                <h3>The decision</h3>
                <div className="kv">
                  <div><span>Outcome</span><b>{OUTCOME[one.outcome] ?? one.outcome ?? "Decided"}</b></div>
                  <div><span>Returned to the client</span><b>{Number(one.outcome_cents) > 0 ? money(one.outcome_cents, one.currency || m.currency) : "Nothing"}</b></div>
                  {one.resolved_at ? <div><span>Decided</span><b>{stamp(one.resolved_at)}</b></div> : null}
                </div>
                {one.decision_note ? <p>{one.decision_note}</p> : <p className="muted">No note was given with the decision.</p>}
              </div>
            )}
          </Sheet>
        ) : null}
      </div>
    </div>
  );
}
