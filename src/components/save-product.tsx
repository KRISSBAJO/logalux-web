"use client";

import { useEffect, useRef, useState } from "react";

const Heart = ({ on, size }: { on: boolean; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
  </svg>
);
const sentence = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) + (/[.!?]$/.test(s) ? "" : ".") : s);

/**
 * The heart. `card` is the round one on a shop tile, `page` the outlined one beside Add to cart.
 * It changes at once, then asks the API; if the API refuses, it goes back and says why.
 * A guest is sent to sign in and comes back to `next`.
 */
export function SaveProduct({ slug, name, saved: initial, signedIn, next, variant }: { slug: string; name: string; saved: boolean; signedIn: boolean; next: string; variant: "card" | "page" }) {
  const [saved, setSaved] = useState(initial);
  const [error, setError] = useState("");
  const busy = useRef(false);
  useEffect(() => { setSaved(initial); }, [initial]);

  const signIn = () => { window.location.href = `/signin?next=${encodeURIComponent(next)}`; };

  async function toggle() {
    if (!signedIn) { signIn(); return; }
    if (busy.current) return;
    busy.current = true;
    const want = !saved;
    setSaved(want); setError("");
    try {
      const res = await fetch(`/api/favourite-products/${encodeURIComponent(slug)}`, { method: want ? "PUT" : "DELETE" });
      const j: { saved?: boolean; error?: string } = await res.json().catch(() => ({}));
      if (res.status === 401) { setSaved(!want); signIn(); return; }
      if (!res.ok) throw new Error(j.error || "");
      setSaved(j.saved ?? want);
    } catch (e) {
      setSaved(!want);
      const why = (e as Error).message;
      setError(why && why !== "Failed to fetch" ? `Not ${want ? "saved" : "removed"}. ${sentence(why)}` : `Not ${want ? "saved" : "removed"}. We could not reach the shop. Try again in a moment.`);
    } finally {
      busy.current = false;
    }
  }

  return (
    <>
      <button type="button" className={`${variant === "card" ? "fav" : "btn btn-out save"} ${saved ? "on" : ""}`} aria-pressed={saved} aria-label={saved ? `Saved. Remove ${name}` : `Save ${name}`} title={saved ? "Saved. Remove" : "Save"} onClick={toggle}>
        <Heart on={saved} size={variant === "card" ? 15 : 18} />
      </button>
      {error && <span role="alert" className="favmsg">{error}</span>}
    </>
  );
}
