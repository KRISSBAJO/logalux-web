"use client";
import { useEffect, useState } from "react";

export default function MobileContinue() {
  const [link, setLink] = useState<{ code: string; name: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const code = window.location.hash.slice(1);
    // The code never goes in a URL query, access log, referrer, analytics or local storage.
    let active = true;
    fetch("/api/mobile-session/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }), signal: AbortSignal.timeout(15000) })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); if (active) { window.history.replaceState(null, "", window.location.pathname); setLink({ code, name: data.first_name || "your app account" }); } })
      .catch(error => { if (active) setError(error.message || "This link could not be checked. Open the shop from the app again."); });
    return () => { active = false; };
  }, []);
  const continueShopping = async () => {
    if (!link || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/mobile-session/exchange", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: link.code }), signal: AbortSignal.timeout(15000) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      window.location.replace(data.next);
    } catch (error) { setError((error as Error).message || "Open the shop from the app again."); setBusy(false); }
  };
  return <main className="min-h-screen bg-cream flex items-center justify-center p-6"><section className="max-w-md w-full bg-white rounded-3xl border border-black/10 p-8 shadow-sm">
    <p className="eyebrow">LogaLuxe · From your app</p><h1 className="serif text-4xl mt-3">Continue shopping</h1>
    <p className="mt-4 text-sm text-black/60 leading-relaxed">Continue with the same account as your app. Your purchase will appear in your mobile order history. This replaces any account currently signed in on this browser.</p>
    {error ? <p role="alert" className="mt-5 text-sm text-red-800">{error}</p> : null}
    {!link && !error ? <p role="status" className="mt-6">Checking your secure link…</p> : null}
    {link ? <button className="btn mt-6 w-full" onClick={continueShopping} disabled={busy}>{busy ? "Signing you in…" : `Continue as ${link.name}`}</button> : null}
    <a className="block mt-5 text-center text-sm underline" href="/shop">Browse without changing accounts</a>
  </section></main>;
}
