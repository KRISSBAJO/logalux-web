"use client";

import { useState } from "react";
import { money } from "@/lib/merchant-format";

const fee = (valueCents: number, pct: number, capCents: number | null) => {
  const f = Math.round((valueCents * pct) / 100);
  return capCents !== null && f > capCents ? capCents : f;
};

/** The promotion controls: the extra share, the monthly budget and the pause, with what a first visit would cost. */
export function BoostFields({ basePct, capCents, maxBoost, boost, budgetCents, paused, currency, sampleCents }: {
  basePct: number; capCents: number | null; maxBoost: number; boost: number; budgetCents: number; paused: boolean; currency: string; sampleCents: number;
}) {
  const [bid, setBid] = useState(boost);
  const [off, setOff] = useState(paused);
  const total = basePct + (off ? 0 : bid);
  const cost = fee(sampleCents, total, capCents), plain = fee(sampleCents, basePct, capCents);
  return (
    <>
      <div className="field">
        <label htmlFor="boost">Extra share on new clients · 0 to {maxBoost}%</label>
        <div className="rng">
          <input id="boost" name="boost_pct" type="range" min={0} max={maxBoost} step={0.5} value={bid} onChange={(e) => setBid(Number(e.target.value))} aria-describedby="boost-live" />
          <output htmlFor="boost">+{bid}%</output>
        </div>
      </div>
      <div className="f2">
        <div className="field">
          <label htmlFor="budget">Monthly budget · {currency}</label>
          <input id="budget" name="budget" type="number" min={0} step="any" defaultValue={budgetCents / 100} inputMode="decimal" />
          <small className="muted">0 means no limit.</small>
        </div>
        <label className="togrow" style={{ alignSelf: "center" }}>
          <span style={{ flex: 1 }}><b>Pause promotion</b><small>Keeps your numbers, stops the extra share</small></span>
          <span className="tog"><input type="checkbox" name="paused" checked={off} onChange={(e) => setOff(e.target.checked)} /><span className="sw" aria-hidden="true" /></span>
        </label>
      </div>
      <div className="note" id="boost-live" role="status">
        <b>A {money(sampleCents, currency)} first visit would cost {money(cost, currency)}</b> ({total}%{bid > 0 && !off ? `: ${basePct}% plus your ${bid}%` : ""}{capCents !== null && cost === capCents ? `, held at the cap of ${money(capCents, currency)}` : ""}).
        {bid > 0 && !off ? ` Without promotion it would cost ${money(plain, currency)}.` : bid > 0 ? " Promotion is paused, so only the usual share applies." : " You are not offering anything extra, so you are listed in the usual order."}
      </div>
    </>
  );
}

/** The loyalty rules, with an example worked out in the business's own money as the numbers change. */
export function LoyaltyFields({ rules, currency }: { rules: { enabled: boolean; earn_points: number; per_cents: number; point_value_cents: number; min_redeem: number }; currency: string }) {
  const [earn, setEarn] = useState(String(rules.earn_points));
  const [per, setPer] = useState(String(rules.per_cents / 100));
  const [value, setValue] = useState(String(rules.point_value_cents / 100));
  const [least, setLeast] = useState(String(rules.min_redeem));
  const e = Math.max(0, Math.round(Number(earn) || 0)), p = Math.round((Number(per) || 0) * 100), v = Math.round((Number(value) || 0) * 100), l = Math.max(0, Math.round(Number(least) || 0));
  const spend = p > 0 ? p * 100 : 0, points = p > 0 ? Math.floor(spend / p) * e : 0;
  const back = p > 0 ? (e * v) / p : 0;
  return (
    <>
      <label className="togrow">
        <span style={{ flex: 1 }}><b>Give loyalty points</b><small>When this is off nobody earns or spends points. Balances are kept.</small></span>
        <span className="tog"><input type="checkbox" name="enabled" defaultChecked={rules.enabled} /><span className="sw" aria-hidden="true" /></span>
      </label>
      <div className="f2">
        <div className="field"><label htmlFor="ly-earn">Points earned</label><input id="ly-earn" name="earn_points" type="number" min={1} max={1000} step={1} required value={earn} onChange={(x) => setEarn(x.target.value)} /></div>
        <div className="field"><label htmlFor="ly-per">Per {currency} spent</label><input id="ly-per" name="per" type="number" min={0.01} step="any" required value={per} onChange={(x) => setPer(x.target.value)} inputMode="decimal" /></div>
        <div className="field"><label htmlFor="ly-val">Point worth · {currency}</label><input id="ly-val" name="point_value" type="number" min={0.01} step="any" required value={value} onChange={(x) => setValue(x.target.value)} inputMode="decimal" /></div>
        <div className="field"><label htmlFor="ly-min">Fewest to spend</label><input id="ly-min" name="min_redeem" type="number" min={1} max={100000} step={1} required value={least} onChange={(x) => setLeast(x.target.value)} /></div>
      </div>
      <div className="note" role="status">
        {p > 0 && e > 0 && v > 0 ? (
          <>
            <b>Spend {money(spend, currency)}, earn {points.toLocaleString("en-US")} points. {l.toLocaleString("en-US")} points = {money(l * v, currency)} off.</b>{" "}
            That gives back {(back * 100).toFixed(back < 0.1 ? 1 : 0).replace(/\.0$/, "")}% of what a client spends.
            {back > 0.5 ? <> <b>That is more than half of every sale, so it will not be saved. Check the numbers.</b></> : null}
          </>
        ) : "Fill in all four numbers to see an example."}
      </div>
    </>
  );
}

/** A saved code, as the edit form needs it: the dates already as YYYY-MM-DD in the business zone. */
export type PromoValues = { code: string; description: string; kind: string; value: number; min_cents: number; max_uses: number | null; starts: string; ends: string; used: number };

/**
 * The fields of a promo code. The value box follows the kind of discount. With `p` the form edits
 * a saved code: the code itself never changes, and once it has been used the discount is locked too.
 */
export function PromoFields({ currency, p, idp = "pc" }: { currency: string; p?: PromoValues; idp?: string }) {
  const [kind, setKind] = useState(p?.kind ?? "percent");
  const [code, setCode] = useState(p?.code ?? "");
  const locked = !!p && p.used > 0;
  const id = (k: string) => `${idp}-${k}`;
  return (
    <>
      <div className="field">
        <label htmlFor={id("code")}>Code · 4 to 20 letters and numbers</label>
        {p
          ? <input id={id("code")} type="text" value={p.code} readOnly />
          : <input id={id("code")} name="code" type="text" required minLength={4} maxLength={20} pattern="[A-Za-z0-9]{4,20}" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="WELCOME10" autoCapitalize="characters" spellCheck={false} />}
        {p ? <small className="muted">The code itself cannot change. Make a new one for a different code.</small> : null}
      </div>
      <div className="field"><label htmlFor={id("desc")}>Note · only you see it</label><input id={id("desc")} name="description" type="text" maxLength={120} defaultValue={p?.description ?? ""} placeholder="For first-time clients from Instagram" /></div>
      <div className="f2">
        <div className="field">
          <label htmlFor={id("kind")}>Kind of discount</label>
          <select id={id("kind")} name="kind" value={kind} onChange={(e) => setKind(e.target.value)} disabled={locked}><option value="percent">A percentage off</option><option value="fixed">A fixed amount off</option></select>
        </div>
        {kind === "percent"
          ? <div className="field"><label htmlFor={id("val")}>Percent off</label><input id={id("val")} name="value" type="number" required min={1} max={100} step={1} defaultValue={p && p.kind === "percent" ? p.value : ""} placeholder="10" disabled={locked} /></div>
          : <div className="field"><label htmlFor={id("val")}>Amount off · {currency}</label><input id={id("val")} name="value" type="number" required min={0.01} step="any" inputMode="decimal" defaultValue={p && p.kind === "fixed" ? p.value / 100 : ""} disabled={locked} /></div>}
        {locked ? <small className="muted" style={{ gridColumn: "1 / -1" }}>This code has been used {p.used === 1 ? "once" : `${p.used} times`}, so its discount cannot change. Switch it off and make a new one instead.</small> : null}
        <div className="field"><label htmlFor={id("min")}>Minimum spend · {currency}</label><input id={id("min")} name="min" type="number" min={0} step="any" defaultValue={p ? p.min_cents / 100 : 0} inputMode="decimal" /><small className="muted">0 for none.</small></div>
        <div className="field"><label htmlFor={id("uses")}>Most times it can be used</label><input id={id("uses")} name="max_uses" type="number" min={1} step={1} defaultValue={p?.max_uses ?? ""} placeholder="No limit" /><small className="muted">Empty for no limit.</small></div>
        <div className="field"><label htmlFor={id("from")}>First day</label><input id={id("from")} name="starts_at" type="date" defaultValue={p?.starts ?? ""} /><small className="muted">Empty starts now.</small></div>
        <div className="field"><label htmlFor={id("to")}>Last day</label><input id={id("to")} name="ends_at" type="date" defaultValue={p?.ends ?? ""} /><small className="muted">Empty never ends.</small></div>
      </div>
    </>
  );
}
