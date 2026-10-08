"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { draftReply } from "./actions";

/** A button that puts a piece of text into the reply box, ready to edit before sending. */
export function InsertText({ text, children, className, target = "reply-body", title }: { text: string; children: ReactNode; className?: string; target?: string; title?: string }) {
  return (
    <button type="button" className={className} title={title} onClick={() => {
      const box = document.getElementById(target) as HTMLTextAreaElement | null;
      if (!box) return;
      const now = box.value.trimEnd();
      box.value = now ? `${now}\n${text}` : text;
      box.focus();
      box.setSelectionRange(box.value.length, box.value.length);
      box.scrollIntoView({ block: "nearest" });
    }}>
      {children}
    </button>
  );
}

/** The messages of a conversation. It opens scrolled to the newest one. */
export function Messages({ count, children }: { count: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [count]);
  return <div ref={ref} className="msgs scroll" tabIndex={0} role="log" aria-label="Messages">{children}</div>;
}

/** Asks for a draft and puts it in the reply box. Nothing is sent: the person still presses the send button. */
export function DraftReply({ threadId, used, limit, target = "reply-body" }: { threadId: string; used: number; limit: number; target?: string }) {
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [count, setCount] = useState(used);
  const write = async () => {
    setBusy(true);
    setError("");
    setDone(false);
    const out = await draftReply(threadId, hint).catch(() => ({ ok: false as const, error: "The draft could not be written. Try again." }));
    setBusy(false);
    if (!out.ok) { setError(out.error); return; }
    setCount((n) => n + 1);
    const box = document.getElementById(target) as HTMLTextAreaElement | null;
    if (!box) return;
    // What was already typed is kept: the draft goes underneath it.
    const now = box.value.trimEnd();
    box.value = now ? `${now}\n\n${out.draft}` : out.draft;
    box.focus();
    box.scrollIntoView({ block: "nearest" });
    setDone(true);
  };
  return (
    <div className="draftai">
      <label className="fld">
        <span>Anything it should say (optional)</span>
        <input value={hint} maxLength={300} onChange={(e) => setHint(e.target.value)} placeholder="Say we can do 5pm" disabled={busy} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (!busy) write(); } }} />
      </label>
      <button type="button" className="btn btn-out btn-sm" onClick={write} disabled={busy} aria-busy={busy}>{busy ? "Writing a draft…" : "Draft a reply"}</button>
      <div aria-live="polite">
        {error ? <div role="alert" style={{ fontSize: 12.5, color: "#9B2C2C" }}>{error}</div> : null}
        {done ? <div style={{ fontSize: 12.5, color: "#1F6B3A" }}>The draft is in the reply box. Nothing has been sent.</div> : null}
      </div>
      <div className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
        Written by AI from your menu, hours and this conversation. Read it before you send. The conversation is sent to OpenAI to write it.
        {limit > 0 ? ` ${count} of ${limit} drafts used today.` : ""}
      </div>
    </div>
  );
}
