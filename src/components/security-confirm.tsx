"use client";
import { useEffect, useState } from "react";

export function SecurityConfirm({ onVerified, allowPIN = true }: { onVerified?: () => void; allowPIN?: boolean }) {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []);
  const call = async (action: "send" | "verify") => {
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/account/security/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "verify" ? { password, code, pin: allowPIN ? pin : "" } : {}), signal: AbortSignal.timeout(25000) });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || "Verification failed.");
      if (action === "send") setSent(`Code sent by ${out.via} to your verified contact.`);
      else { setPassword(""); setCode(""); setPin(""); setUntil(Date.now() + 300000); onVerified?.(); }
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  return <div className="rounded-2xl border border-line bg-white p-4 my-4" aria-label="Account verification">
    <p className="font-semibold">Confirm it’s you</p>
    {until > now ? <p role="status" className="text-sm mt-2">Verified for five minutes in this browser.</p> : <>
      <p className="text-sm text-muted mt-2">Use your account password or a code sent to your existing verified contact.</p>
      <label className="block text-sm mt-3">Account password<input className="block w-full rounded-xl border border-line p-3 mt-1" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
      {allowPIN ? <label className="block text-sm mt-3">Security PIN (if you have set one)<input className="block w-full rounded-xl border border-line p-3 mt-1" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin(e.target.value)} /></label> : null}
      {sent ? <><p className="text-sm mt-2">{sent}</p><label className="block text-sm mt-3">Six-digit security code<input className="block w-full rounded-xl border border-line p-3 mt-1" value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} /></label></> : null}
      <div className="flex flex-wrap gap-3 mt-3"><button type="button" className="btn btn-ink" disabled={busy} onClick={() => void call("verify")}>{busy ? "Please wait…" : "Verify account"}</button><button type="button" className="btn btn-out" disabled={busy} onClick={() => void call("send")}>Send a code</button></div>
    </>}
    {error ? <p role="alert" className="text-sm text-wine mt-2">{error}</p> : null}
  </div>;
}
