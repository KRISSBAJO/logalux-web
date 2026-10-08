"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { duration, money } from "@/lib/api";

type Svc = { id: string; name: string; category: string; description: string; duration_min: number; price_cents: number; deposit_cents: number };

/**
 * The first screen of the embedded booking page: what would you like done. The rest (who and when,
 * details, confirm) is the site's own booking flow, shown in the same frame.
 */
export function EmbedServices({ slug, currency, multi, showDurations, services, picked: start }: { slug: string; currency: string; multi: boolean; showDurations: boolean; services: Svc[]; picked: string[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>(multi ? start : start.slice(0, 1));
  const [going, setGoing] = useState(false);
  const toggle = (id: string) => setPicked((now) => (multi ? (now.includes(id) ? now.filter((x) => x !== id) : [...now, id]) : [id]));
  const chosen = services.filter((s) => picked.includes(s.id));
  const total = chosen.reduce((n, s) => n + s.price_cents, 0);
  const mins = chosen.reduce((n, s) => n + s.duration_min, 0);
  const anyDeposit = services.some((s) => s.deposit_cents > 0);

  return (
    <form
      className="left" style={{ marginTop: 16 }}
      onSubmit={(e) => {
        e.preventDefault();
        if (chosen.length === 0) return;
        setGoing(true);
        // The services go in the order the business lists them, in the frame's own address.
        router.push(`/embed/${slug}?services=${chosen.map((s) => s.id).join(",")}`);
      }}>
      <div className="card">
        <h2 className="serif">{multi ? "Choose your services" : "Choose a service"}</h2>
        {services.length === 0
          ? <div className="muted" style={{ fontSize: 14 }}>This business has not put its services online yet.</div>
          : <div className="muted" style={{ fontSize: 13.5 }}>{multi ? "Choose one or more." : "This business takes one service per booking."}{anyDeposit ? " Where a deposit is asked, it holds your slot and comes off the total." : ""}</div>}
        {[...new Set(services.map((s) => s.category))].map((g) => (
          <fieldset className="q" key={g}>
            <legend className="grp">{g || "Services"}</legend>
            <div className="esvcs">
              {services.filter((s) => s.category === g).map((s) => {
                const sub = [showDurations ? duration(s.duration_min) : "", s.description, s.deposit_cents > 0 ? `${money(s.deposit_cents, currency)} deposit` : ""].filter(Boolean).join(" · ");
                return (
                  <label className="esvc" key={s.id}>
                    <input type={multi ? "checkbox" : "radio"} name="service" checked={picked.includes(s.id)} onChange={() => toggle(s.id)} />
                    <span className="t"><b>{s.name}</b>{sub ? <span>{sub}</span> : null}</span>
                    <span className="p">{money(s.price_cents, currency)}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
      {services.length > 0 ? (
        <div className="ebar">
          <div aria-live="polite" style={{ fontSize: 13.5, minWidth: 0 }}>
            {chosen.length === 0 ? <span className="muted">Nothing chosen yet</span> : <><b>{money(total, currency)}</b><span className="muted"> · {chosen.length === 1 ? "1 service" : `${chosen.length} services`}{showDurations ? ` · ${duration(mins)}` : ""}</span></>}
          </div>
          <button type="submit" className="btn btn-ink" disabled={chosen.length === 0 || going}>{going ? "Loading…" : "Choose a time"}</button>
        </div>
      ) : null}
    </form>
  );
}
