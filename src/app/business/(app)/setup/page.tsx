import Link from "next/link";
import { ConfirmButton } from "@/components/merchant-client";
import { Empty, Flash, Ic, LoadError, NoAccess, Pill, Topbar } from "@/components/merchant-ui";
import { getMe, mLoad, type Row } from "@/lib/merchant-api";
import { dateMed, pct } from "@/lib/merchant-format";
import { dismissSetup, removeDocument, sendForChecking, uploadDocument } from "./actions";
import { ID_TYPES, KIND_ORDER, MAX_DOCUMENTS, fileSize, papersState, standing, stepsOf } from "./shared";
import "../../css/setup.css";

export const metadata = { title: "Setup" };

const PAPERS_PILL: Record<string, [tone: "ok" | "gold" | "wine" | "grey", label: string]> = {
  verified: ["ok", "Confirmed"], waiting: ["gold", "Being checked"], needs_info: ["wine", "More needed"], rejected: ["wine", "Not approved"], open: ["grey", "Not sent yet"],
};

export default async function Setup({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const me = (await getMe())!;
  const { merchant: m } = me;
  const { data: ob, error, status } = await mLoad("/onboarding");
  if (status === 403) return <div className="main pg-setup"><NoAccess title="Setup" need="manager" /></div>;
  if (error) return <div className="main pg-setup"><LoadError title="Setup" error={error} /></div>;

  const steps = stepsOf(ob);
  const done = Number(ob.done ?? 0), total = Number(ob.total ?? steps.length);
  const next = steps.find((s) => !s.done);
  const v = (ob.verification ?? {}) as Row;
  const docs = (v.documents ?? []) as Row[];
  const kinds = (v.kinds ?? {}) as Record<string, string>;
  const kindKeys = [...KIND_ORDER.filter((k) => kinds[k]), ...Object.keys(kinds).filter((k) => !KIND_ORDER.includes(k))];
  const papers = papersState(ob);
  const live = !!ob.live;
  const left = total - done;

  const canUpload = papers !== "verified" && docs.length < MAX_DOCUMENTS;
  const canRemove = papers === "open" || papers === "needs_info" || papers === "rejected";
  const canSend = canRemove;
  const hasId = docs.some((d) => d.kind === "id");
  const [tone, label] = PAPERS_PILL[papers];
  const back = "/business/setup", backVerify = "/business/setup#verify";

  return (
    <div className="main pg-setup">
      <Topbar eyebrow={m.business} title="Get ready to take bookings" />

      <div className="content">
        <Flash sp={sp} />

        <section className="card head">
          <div className="rowx" style={{ justifyContent: "space-between" }}>
            <h2 className="serif">{done} of {total} done</h2>
            {live ? <Pill tone="ok">Live</Pill> : <Pill tone="grey">Not live yet</Pill>}
          </div>
          <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label={`${done} of ${total} steps done`}><i style={{ width: `${pct(done, total)}%` }} /></div>
          {live ? (
            <p className="where">
              You are live. Clients can book you at <a href={`/b/${m.slug}`} target="_blank" rel="noreferrer">/b/{m.slug}</a>.
              {left > 0 ? ` ${left === 1 ? "One step is" : `${left} steps are`} still open below.` : ""}
            </p>
          ) : (
            <p className={"where" + (papers === "needs_info" || papers === "rejected" ? " warn" : "")}>{standing(ob)}</p>
          )}
          {(papers === "needs_info" || papers === "rejected") && !live ? <div><a href="#verify" className="btn btn-ink btn-sm">Go to your papers</a></div> : null}
        </section>

        <section className="card">
          <h3>Steps</h3>
          {steps.length ? (
            <ol className="steps">
              {steps.map((s) => (
                <li key={s.key} className={"step" + (s.done ? " done" : "") + (s === next ? " next" : "")}>
                  <span className="tick" aria-hidden="true">{s.done ? <Ic name="check" size={14} stroke={3} /> : null}</span>
                  <span className="txt">
                    <b>{s.title}{s === next ? <Pill tone="gold">Next</Pill> : null}</b>
                    <span>{s.hint}</span>
                    <span className="sr">{s.done ? "Done" : "Not done yet"}</span>
                  </span>
                  <Link href={s.href} className={"btn btn-sm " + (s === next ? "btn-ink" : "btn-out")}>{s.done ? "Review" : "Do this"}</Link>
                </li>
              ))}
            </ol>
          ) : <Empty title="No steps to show" />}
        </section>

        <section className="card" id="verify">
          <div className="rowx" style={{ justifyContent: "space-between" }}>
            <h3>Confirm who you are</h3>
            <Pill tone={tone}>{label}</Pill>
          </div>

          {papers === "verified" ? (
            <p className="lead">LogaLuxe has checked your identity. There is nothing more to send.</p>
          ) : (
            <>
              <p className="lead">
                LogaLuxe checks who runs each business before its page goes live. A government photo ID is required. A professional licence and proof of your business address are optional and can speed things up.
              </p>
              <p className="lead">Your files are stored privately. Only LogaLuxe staff who check identities can open them.</p>
            </>
          )}

          {papers === "waiting" ? <div className="state">Your papers are with LogaLuxe. We will email you when they are checked. You can add another document, but you cannot remove one while they are being checked.</div> : null}
          {papers === "needs_info" ? <div className="state warn">{standing(ob)} Upload what is missing, then send your papers again.</div> : null}
          {papers === "rejected" ? <div className="state warn">{standing(ob)}</div> : null}

          {papers !== "verified" ? (
            canUpload ? (
              <form action={uploadDocument} className="up">
                <input type="hidden" name="back" value={backVerify} />
                <label className="fld"><span>What is it</span>
                  <select name="kind" required defaultValue={hasId ? "" : "id"}>
                    {hasId ? <option value="" disabled>Choose one</option> : null}
                    {kindKeys.map((k) => <option key={k} value={k}>{kinds[k]}</option>)}
                  </select>
                </label>
                <label className="fld"><span>File</span>
                  <input name="file" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" />
                  <small>A photo (JPEG, PNG or WebP) or a PDF, up to 9 MB.</small>
                </label>
                <button className="btn btn-ink">Upload</button>
              </form>
            ) : (
              <div className="state">You have uploaded {MAX_DOCUMENTS} documents, which is the most LogaLuxe keeps.{canRemove ? " Remove one to add another." : ""}</div>
            )
          ) : null}

          {docs.length ? (
            <ul className="docs">
              {docs.map((d) => (
                <li key={d.id}>
                  <span className="ic"><Ic name="shield" size={16} /></span>
                  <span className="txt">
                    <b>{kinds[d.kind] ?? d.kind}</b>
                    <span>{d.file_name} · {fileSize(d.size_bytes)} · {dateMed(d.created_at, m.timezone)}</span>
                  </span>
                  {canRemove ? (
                    <form action={removeDocument}>
                      <input type="hidden" name="back" value={backVerify} />
                      <input type="hidden" name="id" value={d.id} />
                      <ConfirmButton className="btn btn-danger btn-sm" message={`Remove ${d.file_name}?`}>Remove</ConfirmButton>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : papers !== "verified" ? (
            <Empty title="No documents uploaded yet">Start with a photo of your ID.</Empty>
          ) : null}

          {canSend ? (
            <form action={sendForChecking} className="send">
              <input type="hidden" name="back" value={backVerify} />
              <h4>Send for checking</h4>
              <label className="fld"><span>Which ID did you upload</span>
                <select name="id_type" required defaultValue="" disabled={!hasId}>
                  <option value="" disabled>Choose one</option>
                  {ID_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="fld"><span>Note for LogaLuxe (optional)</span>
                <textarea name="note" maxLength={1000} disabled={!hasId} placeholder="Anything that helps us check your papers" />
              </label>
              <div className="rowx">
                <button className="btn btn-wine" disabled={!hasId}>Send for checking</button>
                {!hasId ? <span className="muted" style={{ fontSize: 13 }}>Upload a photo of your ID first.</span> : null}
              </div>
            </form>
          ) : null}
        </section>

        {(live || (total > 0 && done === total)) ? (
          <section className="card">
            {ob.dismissed ? (
              <div className="sub">This list is hidden from Home.</div>
            ) : (
              <form action={dismissSetup} className="rowx" style={{ justifyContent: "space-between" }}>
                <input type="hidden" name="back" value={back} />
                <div className="sub" style={{ flex: "1 1 220px" }}>{left > 0 ? "You are live, so you can put this list away. The open steps stay here." : "Everything is done. You can put this list away."}</div>
                <button className="btn btn-out btn-sm">Hide this from Home</button>
              </form>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
