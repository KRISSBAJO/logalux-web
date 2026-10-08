"use client";

import { useState } from "react";

export const KIND: [string, string, string][] = [
  ["text", "Short answer", "The client types a few words."],
  ["yesno", "Yes or no", "The client picks yes or no."],
  ["choice", "Choose one", "The client picks one of your options."],
  ["consent", "Must tick", "A box the client has to tick to book."],
];

export type QuestionValue = { label: string; kind: string; options: string[]; service_id: string; required: boolean; sort: number; active: boolean };

/** The fields of one question: the same for a new one and for one being changed. */
export function QuestionFields({ q, services, nextSort }: { q?: QuestionValue; services: { id: string; name: string }[]; nextSort: number }) {
  const [kind, setKind] = useState(q?.kind ?? "text");
  const [required, setRequired] = useState(q ? q.required : false);
  const consent = kind === "consent";
  return (
    <>
      <label className="fld">
        <span>Question</span>
        <textarea name="label" required minLength={3} maxLength={300} rows={2} defaultValue={q?.label ?? ""} placeholder={consent ? "I agree to arrive with clean, dry hair." : "How long is your hair now?"} />
        <small>{consent ? "Write it as the thing the client agrees to. 3 to 300 characters." : "3 to 300 characters."}</small>
      </label>
      <label className="fld">
        <span>Kind of answer</span>
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
          {KIND.map(([k, name]) => <option key={k} value={k}>{name}</option>)}
        </select>
        <small>{KIND.find(([k]) => k === kind)?.[2]}</small>
      </label>
      {kind === "choice" ? (
        <label className="fld">
          <span>Options</span>
          <textarea name="options" rows={5} defaultValue={(q?.options ?? []).join("\n")} placeholder={"Short\nShoulder length\nLong"} />
          <small>One on each line. Between 2 and 12 options, each up to 80 characters.</small>
        </label>
      ) : null}
      <label className="fld">
        <span>Ask it for</span>
        <select name="service_id" defaultValue={q?.service_id ?? ""}>
          <option value="">Every booking</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <small>Pick a service to ask it only when that service is being booked.</small>
      </label>
      <div>
        <label className="chk">
          <input type="checkbox" name="required" checked={consent || required} disabled={consent} onChange={(e) => setRequired(e.target.checked)} />
          The client must answer it to book
        </label>
        {consent ? <small className="hint">Always required: a box the client must tick cannot be skipped.</small> : null}
      </div>
      <label className="fld">
        <span>Order</span>
        <input type="number" name="sort" min={0} max={999} step={1} inputMode="numeric" defaultValue={q ? q.sort : nextSort} style={{ maxWidth: 120 }} />
        <small>Lower numbers are asked first.</small>
      </label>
      <label className="chk"><input type="checkbox" name="active" defaultChecked={q ? q.active : true} />Switched on</label>
    </>
  );
}
