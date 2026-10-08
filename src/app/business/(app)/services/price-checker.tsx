"use client";

import { useState } from "react";
import { money } from "@/lib/merchant-format";

type Answer = { menu_cents: number; price_cents: number; rules: string[] };

/** Asks the server what one service costs with one person at one time, and which rules made it so. */
export function PriceChecker({ services, staff, cur, at }: { services: { id: string; name: string }[]; staff: { id: string; name: string }[]; cur: string; at: string }) {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function check(form: FormData) {
    setBusy(true);
    setError("");
    try {
      const q = new URLSearchParams({ service: String(form.get("service") ?? ""), staff: String(form.get("staff") ?? ""), at: String(form.get("at") ?? "") });
      const res = await fetch(`/business/services/price-check?${q}`, { cache: "no-store" });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error ?? "Could not work that out.");
      setAnswer(out as Answer);
    } catch (e) {
      setAnswer(null);
      setError((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <form className="pc" onSubmit={(e) => { e.preventDefault(); void check(new FormData(e.currentTarget)); }}>
      <div className="f3">
        <label className="fld"><span>Service</span><select name="service" required>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="fld"><span>With</span><select name="staff">{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="fld"><span>When</span><input type="datetime-local" name="at" defaultValue={at} required /></label>
      </div>
      <div className="rowx">
        <button className="btn btn-out btn-sm" disabled={busy || !services.length}>{busy ? "Checking" : "Check the price"}</button>
        <div role="status" aria-live="polite" style={{ fontSize: 13.5, flex: 1, minWidth: 200 }}>
          {error ? <span style={{ color: "#9B2C2C" }}>{error}</span> : answer ? (
            <>
              <b>{money(answer.price_cents, cur)}</b>
              {answer.price_cents !== answer.menu_cents ? <> instead of the menu price of {money(answer.menu_cents, cur)}.</> : <>, the same as the menu price.</>}{" "}
              {answer.rules.length ? <>Rules that applied: {answer.rules.join(", ")}.</> : "No rule applied."}
              {answer.price_cents !== answer.menu_cents && !answer.rules.length ? " This person has their own price for it." : ""}
            </>
          ) : <span className="muted">Pick a service, a person and a time to see what a client would pay.</span>}
        </div>
      </div>
    </form>
  );
}
