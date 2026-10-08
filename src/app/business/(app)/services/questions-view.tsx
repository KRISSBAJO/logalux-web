import { DataTable } from "@/components/data-table";
import { ConfirmButton, Sheet } from "@/components/merchant-client";
import { Empty, Ic } from "@/components/merchant-ui";
import type { Row } from "@/lib/merchant-api";
import { plural } from "@/lib/merchant-format";
import { questionCreate, questionDelete, questionSave, questionToggle } from "./question-actions";
import { QuestionFields, type QuestionValue } from "./question-fields";

// The questions a business asks when a client books online: the list, the
// form to add or change one, and how they will look to a client.

const KIND_NAME: Record<string, string> = { text: "Short answer", yesno: "Yes or no", choice: "Choose one", consent: "Must tick" };
const MOST = 20;
const cut = (text: string, n = 60) => (text.length > n ? text.slice(0, n - 1).trimEnd() + "…" : text);

export function QuestionsView({ questions, services, manager, back, error }: { questions: Row[]; services: Row[]; manager: boolean; back: string; error?: string }) {
  if (!manager || error) {
    return (
      <div className="card">
        <h3>Questions at booking</h3>
        {error && manager ? <div role="alert" className="flash flash-err">{error}</div> : <Empty title="For managers and the owner">They choose what clients are asked when they book online.</Empty>}
      </div>
    );
  }
  const live = questions.filter((q) => q.active);
  const picks = services.map((s) => ({ id: String(s.id), name: String(s.name) }));
  const nextSort = questions.reduce((n, q) => Math.max(n, Number(q.sort) || 0), 0) + 1;
  const value = (q: Row): QuestionValue => ({ label: String(q.label ?? ""), kind: String(q.kind ?? "text"), options: ((q.options ?? []) as string[]).map(String), service_id: q.service_id ? String(q.service_id) : "", required: !!q.required, sort: Number(q.sort) || 0, active: !!q.active });
  const full = live.length >= MOST;

  return (
    <>
      <div className="card">
        <div className="hd">
          <h3>Questions at booking</h3>
          <Sheet trigger={<><Ic name="plus" size={14} stroke={2.4} />New question</>} triggerClass="btn btn-ink btn-sm" title="New question" sub="Clients answer it when they book online.">
            <form action={questionCreate}>
              <input type="hidden" name="back" value={back} />
              <QuestionFields services={picks} nextSort={nextSort} />
              <div className="sheet-ft"><button className="btn btn-ink">Add question</button></div>
            </form>
          </Sheet>
        </div>
        <div className="sub">
          Clients answer these when they book online, and you see the answers on the booking. A &quot;Must tick&quot; question is for things they have to agree to, such as arriving with clean, dry hair. Up to {MOST} can be on at once: {live.length} {live.length === 1 ? "is" : "are"} on now.
        </div>
        {full ? <div className="qfull">{MOST} questions are on, which is the most a booking can ask. Switch one off before you add or switch on another.</div> : null}
        {questions.length ? (
          <div className="boxed">
            <DataTable id="questions" search="Search questions" filters={["Kind", "Asked for", "On"]} pageSize={10} noun="question">
              <table className="tbl">
                <thead><tr><th>Question</th><th>Kind</th><th>Asked for</th><th>Answer</th><th>On</th><th className="num">Answered</th><th className="num">Order</th><th data-nosort><span className="sr">Actions</span></th></tr></thead>
                <tbody>
                  {questions.map((q) => {
                    const options = ((q.options ?? []) as string[]);
                    return (
                      <tr key={q.id}>
                        <td className="qlabel"><b>{q.label}</b>{q.kind === "choice" && options.length ? <small>{options.join(" · ")}</small> : null}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{KIND_NAME[q.kind] ?? q.kind}</td>
                        <td>{q.service_id ? (q.service ?? "A service that was removed") : "Every booking"}</td>
                        <td>{q.required ? "Required" : "Optional"}</td>
                        <td data-filter={q.active ? "On" : "Off"} data-sort={q.active ? "On" : "Off"}>
                          <form action={questionToggle}>
                            <input type="hidden" name="back" value={back} />
                            <input type="hidden" name="id" value={q.id} />
                            <button className={"sw" + (q.active ? "" : " off")} role="switch" aria-checked={!!q.active} aria-label={`${cut(q.label)}: switched on`} title={q.active ? "Asked at booking. Select to switch it off." : "Not asked. Select to switch it on."} />
                          </form>
                        </td>
                        <td className="num" data-sort={q.answers ?? 0}>{q.answers > 0 ? plural(q.answers, "booking") : <span className="muted">None yet</span>}</td>
                        <td className="num" data-sort={q.sort ?? 0}>{q.sort ?? 0}</td>
                        <td>
                          <div className="acts">
                            <Sheet trigger="Edit" triggerClass="btn btn-out btn-sm" title="Question" sub={q.answers > 0 ? `${plural(q.answers, "booking")} answered it. They keep the wording they were asked.` : cut(q.label, 80)}>
                              <form action={questionSave}>
                                <input type="hidden" name="back" value={back} />
                                <input type="hidden" name="id" value={q.id} />
                                <QuestionFields q={value(q)} services={picks} nextSort={nextSort} />
                                <div className="sheet-ft"><button className="btn btn-ink">Save question</button></div>
                              </form>
                            </Sheet>
                            <form action={questionDelete}>
                              <input type="hidden" name="back" value={back} />
                              <input type="hidden" name="id" value={q.id} />
                              <ConfirmButton className="btn btn-ghost btn-sm" message={q.answers > 0 ? `Remove "${cut(q.label)}"? ${plural(q.answers, "booking")} answered it, so it will be switched off instead of removed.` : `Remove "${cut(q.label)}"? Clients will no longer be asked it.`}>Remove</ConfirmButton>
                            </form>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </DataTable>
          </div>
        ) : <Empty title="No questions yet">Add one and clients are asked it when they book online.</Empty>}
      </div>

      {live.length > 0 && (
        <div className="card">
          <h3>How a client sees them</h3>
          <div className="sub">A preview of the questions that are on, in the order they are asked. Nothing here can be filled in.</div>
          <div className="qprev" aria-label="Preview of the questions">
            {live.map((q) => {
              const options = ((q.options ?? []) as string[]);
              const only = q.service_id ? <small>Only when booking {q.service ?? "one service"}</small> : null;
              if (q.kind === "consent") return <div key={q.id} className="qp"><label className="qtick"><input type="checkbox" disabled /><span>{q.label}</span></label>{only}</div>;
              return (
                <div key={q.id} className="qp">
                  <b>{q.label}{q.required ? null : <i> (optional)</i>}</b>
                  {q.kind === "text" ? <input type="text" disabled aria-label={q.label} placeholder="Their answer" />
                    : <div className="qopts">{(q.kind === "yesno" ? ["Yes", "No"] : options).map((o) => <span key={o}>{o}</span>)}</div>}
                  {only}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
