"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { draftCampaign } from "./actions";

/** The same replacement the server makes when it sends: {first name} and friends. */
const fill = (tpl: string, v: Record<string, string>) => Object.entries(v).reduce((t, [k, val]) => t.split(`{${k}}`).join(val), tpl);

/**
 * The message box, the placeholders that can go in it, and how the message reads
 * with them filled in. Without scripts the box still works and the list still shows.
 */
export function MessageField({ id, value = "", max, tokens, sample, previewLabel, rows, inject }: {
  id: string; value?: string; max: number;
  /** Placeholder name and what it becomes, in the order shown. */
  tokens: [string, string][];
  /** What each placeholder is filled with in the preview. */
  sample: Record<string, string>;
  previewLabel: string; rows?: number;
  /** Text to put in the box from outside (an AI draft). A new `n` replaces what is there. */
  inject?: { text: string; n: number };
}) {
  const [text, setText] = useState(value);
  useEffect(() => { if (inject && inject.n > 0) setText(inject.text.slice(0, max)); }, [inject, max]);
  const box = useRef<HTMLTextAreaElement>(null);
  const insert = (token: string) => {
    const el = box.current;
    const at = el ? el.selectionStart ?? text.length : text.length, end = el ? el.selectionEnd ?? at : at;
    const next = (text.slice(0, at) + token + text.slice(end)).slice(0, max);
    setText(next);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + token.length, at + token.length); });
  };
  return (
    <>
      <div className="field">
        <label htmlFor={id}>Message</label>
        <textarea id={id} name="message" ref={box} value={text} onChange={(e) => setText(e.target.value)} required minLength={10} maxLength={max} rows={rows} />
        <small className="muted" style={{ fontSize: 12 }}>{text.length} of {max} characters. At least 10.</small>
      </div>
      <div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Placeholders. Each one is replaced for every client:</div>
        <div className="chips">
          {tokens.map(([k, what]) => <button key={k} type="button" className="chip" title={what} onClick={() => insert(`{${k}}`)}>{`{${k}}`}</button>)}
        </div>
      </div>
      <div className="preview">
        <div className="muted" style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase" }}>{previewLabel}</div>
        <div className="bubble">{fill(text, sample) || "Your message shows here."}</div>
      </div>
    </>
  );
}

type Size = { total: number; email: number; phone: number };

/** The fields of a new campaign. The audience size follows the two pickers. */
export function CampaignFields({ audiences, audienceLabels, channelLabels, modes, cap, tokens, sample, pick = "all", ai }: {
  audiences: Record<string, Size>; audienceLabels: [string, string][]; channelLabels: [string, string][]; modes: Record<string, string>; cap: number;
  tokens: [string, string][]; sample: Record<string, string>; pick?: string;
  /** Present only when AI drafts are switched on for this business. */
  ai?: { used: number; limit: number };
}) {
  const [goal, setGoal] = useState("");
  const [subject, setSubject] = useState("");
  const [draft, setDraft] = useState({ text: "", n: 0 });
  const [aiError, setAiError] = useState("");
  const [writing, startWriting] = useTransition();
  const [audience, setAudience] = useState(audienceLabels.some(([k]) => k === pick) ? pick : "all");
  const [channel, setChannel] = useState("whatsapp");
  const a = audiences[audience] ?? { total: 0, email: 0, phone: 0 };
  const reach = channel === "email" ? a.email : a.phone;
  const name = channelLabels.find(([k]) => k === channel)?.[1] ?? channel;
  const logged = modes[channel] === "log";
  const write = () => {
    if (goal.trim().length < 5) { setAiError("Say in a sentence what the message is for."); return; }
    setAiError("");
    startWriting(async () => {
      const out = await draftCampaign(audience, channel, goal);
      if (out.error || !out.message) { setAiError(out.error || "The draft came back empty. Try again."); return; }
      setDraft((d) => ({ text: out.message!, n: d.n + 1 }));
      if (out.subject) setSubject(out.subject);
    });
  };
  return (
    <>
      <div className="field"><label htmlFor="c-name">Name · only you see it</label><input id="c-name" name="name" type="text" required maxLength={80} placeholder="October offer" /></div>
      <div className="f2">
        <div className="field">
          <label htmlFor="c-aud">Who it goes to</label>
          <select id="c-aud" name="audience" value={audience} onChange={(e) => setAudience(e.target.value)}>
            {audienceLabels.map(([k, l]) => <option key={k} value={k}>{l} · {audiences[k]?.total ?? 0}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="c-ch">Channel</label>
          <select id="c-ch" name="channel" value={channel} onChange={(e) => setChannel(e.target.value)}>
            {channelLabels.map(([k, l]) => <option key={k} value={k}>{l}{modes[k] === "log" ? " · logged only" : ""}</option>)}
          </select>
        </div>
      </div>
      <div className="note" role="status">
        <b>{a.total} {a.total === 1 ? "client" : "clients"} in this audience.</b>{" "}
        {reach} {reach === 1 ? "has" : "have"} {channel === "email" ? "an email address" : "a phone number"} and can be reached on {name}
        {a.total - reach > 0 ? `; the other ${a.total - reach} will be skipped` : ""}.{" "}
        Clients who opted out of marketing are never included, and anyone who already had {cap} marketing messages in 30 days is skipped.
        {logged ? <> <b>{name} is not connected yet, so these messages are logged, not delivered.</b></> : null}
      </div>
      {ai ? (
        <div className="aibox">
          <div className="field">
            <label htmlFor="c-goal">Write it for me · what should this message do?</label>
            <div className="airow">
              <input id="c-goal" type="text" value={goal} maxLength={400} onChange={(e) => setGoal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); write(); } }} placeholder="Fill quiet Tuesdays with 15% off silk press this month" />
              <button type="button" className="btn btn-out btn-sm" onClick={write} disabled={writing} aria-busy={writing}>{writing ? "Writing…" : draft.n ? "Write again" : "Write it for me"}</button>
            </div>
          </div>
          {aiError ? <div role="alert" className="aierr">{aiError}</div> : null}
          {draft.n && !aiError && !writing ? <div role="status" className="muted" style={{ fontSize: 12 }}>The draft is in the message box below. Edit it as you like.</div> : null}
          <div className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>Written by AI from your menu and what you asked for. It never invents a discount: say the offer in your own words. Read it before you send.{ai.limit > 0 ? ` ${ai.used} of ${ai.limit} drafts used today.` : ""}</div>
        </div>
      ) : null}
      {channel === "email" ? <div className="field"><label htmlFor="c-sub">Subject</label><input id="c-sub" name="subject" type="text" required maxLength={120} value={subject} onChange={(e) => setSubject(e.target.value)} /></div> : null}
      <MessageField id="c-msg" inject={draft} max={1200} tokens={tokens} sample={sample} previewLabel={`Preview · ${name} · sample values`} rows={6} />
    </>
  );
}
