"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { money } from "@/lib/api";
import { buyGiftCard, type GiftState } from "./actions";

const AMOUNTS = [2500, 5000, 10000, 15000];
const MIN = 1000, MAX = 50000, NOTE_MAX = 300;
const NONE: GiftState = { error: "" };
const cap = "text-[11px] font-semibold uppercase tracking-[.06em] text-muted";
const chip = (on: boolean) =>
  `flex min-h-[46px] cursor-pointer items-center rounded-full border px-5 text-[15px] font-semibold transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold ${on ? "border-ink bg-ink text-cream" : "border-line bg-white hover:border-ink"}`;

/** Buys a gift card: an amount, who it is for, and who is paying. The code is emailed and never shown here. */
export function GiftForm({ me }: { me?: { name: string; email: string } }) {
  // After a card is sent, "Buy another" starts the form afresh.
  const [round, setRound] = useState(0);
  return <OneCard key={round} me={me} another={() => setRound((n) => n + 1)} />;
}

function OneCard({ me, another }: { me?: { name: string; email: string }; another: () => void }) {
  const [state, send, sending] = useActionState(buyGiftCard, NONE);
  const [pick, setPick] = useState<number | "own">(5000);
  const [own, setOwn] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [note, setNote] = useState("");
  const ownCents = Math.round((Number(own) || 0) * 100);
  const cents = pick === "own" ? ownCents : pick;
  const valid = cents >= MIN && cents <= MAX;
  // Payments are live: the card is paid for on Stripe's page, and made when the payment arrives.
  useEffect(() => { if (state.url) window.location.href = state.url; }, [state.url]);

  if (state.sentTo !== undefined && !state.url && !state.error) {
    return (
      <div className="card mx-auto flex max-w-[620px] flex-col gap-4 rounded-[20px] p-6 md:p-8" role="status">
        <h2 className="serif text-[30px] leading-[1.05]">Your gift card is on its way</h2>
        <p className="text-[15.5px] leading-relaxed [overflow-wrap:anywhere]">
          Sent to <b className="font-semibold">{state.sentTo || "the email you gave"}</b>.{state.amountCents ? ` It holds ${money(state.amountCents)}.` : ""} The code is in that email. It is spent at checkout in the LogaLuxe shop, and whatever is not spent stays on the card.
        </p>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/shop" className="btn btn-ink">Back to the shop</Link>
          <button type="button" className="btn btn-out" onClick={another}>Buy another</button>
        </div>
      </div>
    );
  }

  return (
    <form action={send} className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
      <input type="hidden" name="amount_cents" value={valid ? cents : ""} />
      <div className="flex min-w-0 flex-col gap-5">
        <section className="card flex flex-col gap-4 rounded-[20px] p-5 md:p-6" aria-labelledby="gc-amount">
          <h2 id="gc-amount" className="serif text-[26px] leading-[1.05]">Amount</h2>
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Amount in US dollars</legend>
            {AMOUNTS.map((a) => (
              <label key={a} className={chip(pick === a)}>
                <input type="radio" name="choice" className="sr-only" checked={pick === a} onChange={() => setPick(a)} />{money(a)}
              </label>
            ))}
            <label className={chip(pick === "own")}>
              <input type="radio" name="choice" className="sr-only" checked={pick === "own"} onChange={() => setPick("own")} />Another amount
            </label>
          </fieldset>
          {pick === "own" && (
            <label className="field max-w-[240px]"><span className={cap}>Amount in dollars, $10 to $500</span>
              <input type="number" inputMode="decimal" min={MIN / 100} max={MAX / 100} step="0.01" value={own} onChange={(e) => setOwn(e.target.value)} required aria-invalid={own !== "" && !valid} />
            </label>
          )}
        </section>

        <section className="card flex flex-col gap-4 rounded-[20px] p-5 md:p-6" aria-labelledby="gc-for">
          <h2 id="gc-for" className="serif text-[26px] leading-[1.05]">Who it is for</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="field"><span className={cap}>Their name</span><input name="recipient_name" required maxLength={80} autoComplete="off" /></label>
            <label className="field"><span className={cap}>Their email, if you have it</span><input name="recipient_email" type="email" maxLength={200} autoComplete="off" value={toEmail} onChange={(e) => setToEmail(e.target.value)} /></label>
          </div>
          <label className="field"><span className={cap}>A message, if you like</span>
            <textarea name="note" maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} aria-describedby="gc-count" />
          </label>
          <p id="gc-count" className="-mt-2 text-[12.5px] text-muted">{note.length} of {NOTE_MAX} characters</p>
        </section>

        <section className="card flex flex-col gap-4 rounded-[20px] p-5 md:p-6" aria-labelledby="gc-from">
          <h2 id="gc-from" className="serif text-[26px] leading-[1.05]">From you</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="field"><span className={cap}>Your name</span><input name="buyer_name" required maxLength={80} defaultValue={me?.name ?? ""} autoComplete="name" /></label>
            <label className="field"><span className={cap}>Your email, for the receipt</span><input name="buyer_email" type="email" required maxLength={200} defaultValue={me?.email ?? ""} autoComplete="email" /></label>
          </div>
        </section>
      </div>

      <aside className="card flex min-w-0 flex-col gap-3.5 rounded-[20px] p-5 md:sticky md:top-6" aria-label="Your gift card">
        <div className="flex items-baseline justify-between gap-3 text-[15px]"><span>LogaLuxe gift card</span><b className="text-[20px] font-semibold">{valid ? money(cents) : "$10 to $500"}</b></div>
        <ul className="flex list-disc flex-col gap-1.5 border-t border-line-2 pl-5 pt-3.5 text-[13.5px] leading-relaxed text-muted">
          <li className="[overflow-wrap:anywhere]">{toEmail.trim() ? `The code is emailed to ${toEmail.trim()}. You get a receipt without the code.` : "The code is emailed to them, or to you if you leave their email empty."}</li>
          <li>It is spent at checkout in the LogaLuxe shop.</li>
          <li>Whatever is not spent stays on the card.</li>
          <li>It is in US dollars.</li>
        </ul>
        <div aria-live="polite">{state.error ? <p role="alert" className="text-[13.5px] font-medium text-bad">{state.error}</p> : null}</div>
        <button className="btn btn-ink min-h-[52px] w-full disabled:cursor-not-allowed disabled:opacity-50" disabled={sending || !!state.url || !valid}>
          {sending || state.url ? "Opening the payment page…" : valid ? `Buy a ${money(cents)} gift card` : "Choose an amount"}
        </button>
        <p className="text-[12.5px] leading-relaxed text-muted">You will pay on Stripe&apos;s secure page. LogaLuxe never sees your card.</p>
      </aside>
    </form>
  );
}
