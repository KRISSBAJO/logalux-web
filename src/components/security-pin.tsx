"use client";
import { useState } from "react";
import { SecurityConfirm } from "./security-confirm";

export function SecurityPIN() {
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const save = async () => {
    setError(""); setMessage("");
    if (pin !== again) { setError("The PINs do not match."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/account/security/pin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }), signal: AbortSignal.timeout(25000) });
      const out = await res.json(); if (!res.ok) throw new Error(out.error || "Could not save your PIN.");
      setPin(""); setAgain(""); setMessage("Your security PIN is saved."); setRevision(x => x + 1);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <section className="card rounded-2xl p-5 my-5">
    <h3 className="font-semibold">Set, change or reset your security PIN</h3>
    <p className="text-sm text-muted mt-2">Confirm your account with your password or a code, then choose six digits. Five wrong PIN attempts lock PIN verification for 15 minutes.</p>
    <SecurityConfirm key={revision} allowPIN={false} />
    <div className="flex flex-wrap gap-3">
      <label>New PIN<input className="block border border-line rounded-xl p-3" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin(e.target.value)} /></label>
      <label>Confirm PIN<input className="block border border-line rounded-xl p-3" type="password" inputMode="numeric" maxLength={6} value={again} onChange={e => setAgain(e.target.value)} /></label>
    </div>
    <button type="button" className="btn btn-ink mt-3" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save PIN"}</button>
    {message ? <p role="status" className="mt-2">{message}</p> : null}
    {error ? <p role="alert" className="text-wine mt-2">{error}</p> : null}
  </section>;
}
