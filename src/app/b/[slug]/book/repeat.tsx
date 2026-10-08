"use client";

import { useRouter } from "next/navigation";
import { WalletNote } from "@/components/pay-bits";
import { useState, type FormEvent } from "react";
import { money } from "@/lib/api";
import { clock, dayLabel, inZone, whenLabel } from "../shared";

type Made = { id: string; starts_at: string; deposit_cents?: number | null; payment?: { url?: string; amount_cents?: number; currency?: string } | null };
type Skipped = { starts_at: string; why: string };
type Result = { series_id?: string; made: Made[]; skipped: Skipped[] };

const EVERY = [1, 2, 3, 4, 6, 8];
const addDays = (date: string, n: number) => { const [y, m, d] = date.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const sentence = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) + (/[.!?]$/.test(t) ? "" : ".") : t);

/**
 * Makes a booking repeat: every so many weeks, for the next few visits, on the same weekday and at the
 * same clock time at the business. Each date is booked on its own by the API, so some may not be free:
 * what was booked and what was not are both listed, with the API's reason.
 * `look` is where it is drawn: on the booking pages (their own stylesheet) or in the account (the site's).
 */
export function RepeatCard({ id, startsAt, tz, currency, business, look, wallets = false }: { id: string; startsAt: string; tz: string; currency: string; business: string; look: "book" | "account"; /** Apple Pay and Google Pay may be named: switched on, and the deposits go to Stripe. */ wallets?: boolean }) {
  const router = useRouter();
  const [every, setEvery] = useState(2);
  const [times, setTimes] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Result | null>(null);

  const first = inZone(startsAt, tz);
  const weekday = new Date(`${first.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  const dates = Array.from({ length: times }, (_, i) => addDays(first.date, 7 * every * (i + 1)));
  const muted = look === "book" ? "muted" : "text-muted";
  const cap = look === "book" ? undefined : "text-[11px] font-semibold uppercase tracking-[.06em] text-muted";
  const box = (ok: boolean) => ({ background: ok ? "#E3F2E7" : "#F6E3E6", color: ok ? "#1F6B3A" : "#9B2335", borderRadius: 12, padding: "10px 12px", fontSize: 13.5, lineHeight: 1.5 });
  const list = { margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column" as const, gap: 6, fontSize: 14 };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/bookings/${id}/repeat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ every_weeks: every, times }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(res.status === 401 ? "You are signed out. Sign in and try again." : sentence(j.error ?? "") || "We could not set that up. Nothing was booked. Try again."); setBusy(false); return; }
      setDone({ series_id: j.series_id, made: Array.isArray(j.made) ? j.made : [], skipped: Array.isArray(j.skipped) ? j.skipped : [] });
      // The account's list of bookings now has more in it.
      router.refresh();
    } catch {
      setError("We could not reach the service. Try again in a moment.");
    }
    setBusy(false);
  }

  if (done) {
    const owing = done.made.filter((m) => m.payment?.url);
    return (
      <div role="status" style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: "left" }}>
        {done.made.length > 0 ? (
          <div>
            <b style={{ fontSize: 14.5 }}>{done.made.length === 1 ? "1 visit booked" : `${done.made.length} visits booked`}</b>
            <ul style={{ ...list, marginTop: 6 }}>
              {done.made.map((m) => (
                <li key={m.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 12px" }}>
                  <span>{whenLabel(m.starts_at, tz, " · ")}</span>
                  {m.payment?.url
                    ? <a href={m.payment.url} target="_top" rel="noopener" style={{ fontWeight: 600, color: "#7A1F2B" }}>Pay {Number(m.payment.amount_cents ?? m.deposit_cents) > 0 ? `${money(Number(m.payment.amount_cents ?? m.deposit_cents), m.payment.currency || currency)} ` : ""}deposit</a>
                    : null}
                </li>
              ))}
            </ul>
          </div>
        ) : <div style={box(false)}>None of those dates could be booked.</div>}
        {owing.length > 0 ? <div className={muted} style={{ fontSize: 13 }}>Each visit with a deposit is held for a while. If its deposit is not paid, that visit is released. You pay on the payment provider&apos;s secure page. LogaLuxe never sees your card.{wallets ? <WalletNote /> : null}</div> : null}
        {done.skipped.length > 0 ? (
          <div style={box(false)}>
            <b>{done.skipped.length === 1 ? "1 date could not be booked" : `${done.skipped.length} dates could not be booked`}</b>
            <ul style={{ ...list, marginTop: 6, fontSize: 13.5 }}>
              {done.skipped.map((s) => <li key={s.starts_at}>{whenLabel(s.starts_at, tz, " · ")}: {sentence(s.why)}</li>)}
            </ul>
            <div style={{ marginTop: 6 }}>Nothing else was tried in their place.</div>
          </div>
        ) : null}
        <div className={muted} style={{ fontSize: 13 }}>
          {done.made.length > 0 ? <>The visits are in <a href="/account?tab=bookings" target="_top" style={{ fontWeight: 600, color: "#7A1F2B" }}>your bookings</a>, where each can be moved or cancelled. </> : null}
          <button type="button" onClick={() => setDone(null)} style={{ border: 0, background: "transparent", padding: 0, font: "inherit", fontWeight: 600, color: "#7A1F2B", cursor: "pointer" }}>Repeat again</button>
        </div>
      </div>
    );
  }

  const fieldEvery = (
    <select id={`rp-every-${id}`} value={every} onChange={(e) => setEvery(Number(e.target.value))}>
      {EVERY.map((n) => <option key={n} value={n}>{n === 1 ? "Every week" : `Every ${n} weeks`}</option>)}
    </select>
  );
  const fieldTimes = (
    <select id={`rp-times-${id}`} value={times} onChange={(e) => setTimes(Number(e.target.value))}>
      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n === 1 ? "The next visit" : `The next ${n} visits`}</option>)}
    </select>
  );
  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: "left" }}>
      <div className={muted} style={{ fontSize: 13.5 }}>
        The same services with the same person, on {weekday}s at {clock(first.time)} at {business}. Each date is booked only if it is free.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        {look === "book"
          ? <><div className="field"><label htmlFor={`rp-every-${id}`}>How often</label>{fieldEvery}</div><div className="field"><label htmlFor={`rp-times-${id}`}>For</label>{fieldTimes}</div></>
          : <><label className="field"><span className={cap}>How often</span>{fieldEvery}</label><label className="field"><span className={cap}>For</span>{fieldTimes}</label></>}
      </div>
      <div aria-live="polite" style={{ fontSize: 13.5 }}>
        <span className={muted}>It will try: </span>{dates.map((d) => `${dayLabel(d)} · ${clock(first.time)}`).join(", ")}.
      </div>
      {error ? <div role="alert" style={box(false)}>{error}</div> : null}
      <div><button type="submit" className="btn btn-ink btn-sm" disabled={busy}>{busy ? "Booking…" : times === 1 ? "Book this visit" : `Book these ${times} visits`}</button></div>
    </form>
  );
}
