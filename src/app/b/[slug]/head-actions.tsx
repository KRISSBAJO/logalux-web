"use client";

import { useState, useTransition } from "react";
import { setSaved } from "./actions";

const HEART = "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z";

/** Save: a signed-in client keeps the business in their account. A guest is sent to sign in and comes straight back. */
export function SaveButton({ slug, name, saved: initial, signedIn, signInHref }: { slug: string; name: string; saved: boolean; signedIn: boolean; signInHref: string }) {
  const [saved, setSavedState] = useState(initial);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const heart = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={HEART} /></svg>
  );
  if (!signedIn) return <a href={signInHref} className="btn btn-out" aria-label={`Sign in to save ${name}`}>{heart}Save</a>;
  return (
    <>
      <button
        type="button" className={`btn btn-out${saved ? " saved" : ""}`} aria-pressed={saved} disabled={pending}
        onClick={() => {
          const want = !saved;
          setSavedState(want); setError("");
          start(async () => {
            const r = await setSaved(slug, want);
            if (r.signedOut) { window.location.href = signInHref; return; }
            setSavedState(r.saved);
            if (r.error) setError(r.error);
          });
        }}
      >
        {heart}{saved ? "Saved" : "Save"}
      </button>
      {error ? <span role="alert" className="sr">{error}</span> : null}
    </>
  );
}

/** Share: the phone's own share sheet where there is one, otherwise the link is copied. */
export function ShareButton({ name, path }: { name: string; path: string }) {
  const [note, setNote] = useState("");
  async function share() {
    const url = window.location.origin + path;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: name, text: `${name} on LogaLuxe`, url });
        return;
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return; // the visitor closed the share sheet
    }
    try {
      await navigator.clipboard.writeText(url);
      setNote("Link copied");
    } catch {
      window.prompt("Copy this link", url);
      return;
    }
    window.setTimeout(() => setNote(""), 2500);
  }
  return <button type="button" className="btn btn-out" onClick={share}><span aria-live="polite">{note || "Share"}</span></button>;
}
