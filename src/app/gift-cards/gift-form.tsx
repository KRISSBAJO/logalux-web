"use client";

import Link from "next/link";
import { WalletNote } from "@/components/pay-bits";
import { useActionState, useEffect, useState } from "react";
import { money } from "@/lib/api";
import { buyGiftCard, type GiftState } from "./actions";

/** What a card can be in one country, as GET /v1/gift-cards/options says. */
export type GiftOption = { country: "US" | "NG"; country_name: string; currency: string; min_cents: number; max_cents: number; amounts_cents: number[]; provider: string };
// Dollars, as the card has always been, when the options could not be read.
const FALLBACK: GiftOption = { country: "US", country_name: "United States", currency: "USD", min_cents: 1000, max_cents: 50000, amounts_cents: [2500, 5000, 10000, 15000], provider: "stripe" };
const NOTE_MAX = 300;
const NONE: GiftState = { error: "" };
const cap = "text-[11px] font-semibold uppercase tracking-[.06em] text-muted";
const chip = (on: boolean) =>
  `flex min-h-[46px] cursor-pointer items-center rounded-full border px-5 text-[15px] font-semibold transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold ${on ? "border-ink bg-ink text-cream" : "border-line bg-white hover:border-ink"}`;

/** Buys a gift card: an amount, who it is for, and who is paying. The code is emailed and never shown here. */
export function GiftForm({ me, wallets = false, options = [], start = "US" }: {
  me?: { name: string; email: string };
  /** Apple Pay and Google Pay are switched on. They apply to a card paid in dollars, on Stripe. */
  wallets?: boolean;
  options?: GiftOption[];
  /** The country the form opens on. */
  start?: string;
}) {
  // After a card is sent, "Buy another" starts the form afresh.
  const [round, setRound] = useState(0);
  const list = options.length ? options : [FALLBACK];
  return <OneCard key={round} me={me} wallets={wallets} options={list} start={list.some((o) => o.country === start) ? start : list[0].country} another={() => setRound((n) => n + 1)} />;
}

function OneCard({ me, another, wallets, options, start }: { me?: { name: string; email: string }; another: () => void; wallets: boolean; options: GiftOption[]; start: string }) {
  const [state, send, sending] = useActionState(buyGiftCard, NONE);
  const [country, setCountry] = useState(start);
  const opt = options.find((o) => o.country === country) ?? options[0];
  const { currency, min_cents: MIN, max_cents: MAX } = opt;
  const AMOUNTS = opt.amounts_cents;
  const naira = currency === "NGN";
  const [pick, setPick] = useState<number | "own">(opt.amounts_cents[1] ?? opt.amounts_cents[0]);
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
          Sent to <b className="font-semibold">{state.sentTo || "the email you gave"}</b>.{state.amountCents ? ` It holds ${money(state.amountCents, state.currency ?? currency)}.` : ""} The code is in that email. It is spent at checkout in the LogaLuxe shop{(state.currency ?? currency) === "NGN" ? " in Nigeria" : ""}, and whatever is not spent stays on the card.
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
      <input type="hidden" name="country" value={country} />
      <div className="flex min-w-0 flex-col gap-5">
        {options.length > 1 && (
          <section className="card flex flex-col gap-4 rounded-[20px] p-5 md:p-6" aria-labelledby="gc-where">
            <h2 id="gc-where" className="serif text-[26px] leading-[1.05]">Where they will spend it</h2>
            <fieldset className="flex flex-wrap gap-2">
              <legend className="sr-only">The country of the person it is for</legend>
              {options.map((o) => (
                <label key={o.country} className={chip(country === o.country)}>
                  <input type="radio" name="where" className="sr-only" checked={country === o.country} onChange={() => { setCountry(o.country); setPick(o.amounts_cents[1] ?? o.amounts_cents[0]); setOwn(""); }} />
                  {o.country_name} · {o.currency === "NGN" ? "₦" : "$"}
                </label>
              ))}
            </fieldset>
            <p className="-mt-1 text-[13.5px] text-muted">A card is spent in its own money: {naira ? "this one in naira, in the shop in Nigeria" : "this one in US dollars, in the shop in the United States"}.</p>
          </section>
        )}
        <section className="card flex flex-col gap-4 rounded-[20px] p-5 md:p-6" aria-labelledby="gc-amount">
          <h2 id="gc-amount" className="serif text-[26px] leading-[1.05]">Amount</h2>
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Amount in {naira ? "naira" : "US dollars"}</legend>
            {AMOUNTS.map((a) => (
              <label key={a} className={chip(pick === a)}>
                <input type="radio" name="choice" className="sr-only" checked={pick === a} onChange={() => setPick(a)} />{money(a, currency)}
              </label>
            ))}
            <label className={chip(pick === "own")}>
              <input type="radio" name="choice" className="sr-only" checked={pick === "own"} onChange={() => setPick("own")} />Another amount
            </label>
          </fieldset>
          {pick === "own" && (
            <label className="field max-w-[260px]"><span className={cap}>Amount in {naira ? "naira" : "dollars"}, {money(MIN, currency)} to {money(MAX, currency)}</span>
              <input type="number" inputMode="decimal" min={MIN / 100} max={MAX / 100} step={naira ? "100" : "0.01"} value={own} onChange={(e) => setOwn(e.target.value)} required aria-invalid={own !== "" && !valid} />
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
        <div className="flex items-baseline justify-between gap-3 text-[15px]"><span>LogaLuxe gift card</span><b className="text-[20px] font-semibold">{valid ? money(cents, currency) : `${money(MIN, currency)} to ${money(MAX, currency)}`}</b></div>
        <ul className="flex list-disc flex-col gap-1.5 border-t border-line-2 pl-5 pt-3.5 text-[13.5px] leading-relaxed text-muted">
          <li className="[overflow-wrap:anywhere]">{toEmail.trim() ? `The code is emailed to ${toEmail.trim()}. You get a receipt without the code.` : "The code is emailed to them, or to you if you leave their email empty."}</li>
          <li>It is spent at checkout in the LogaLuxe shop{naira ? " in Nigeria" : ""}.</li>
          <li>Whatever is not spent stays on the card.</li>
          <li>It is in {naira ? "naira" : "US dollars"}, and you are charged in {naira ? "naira" : "US dollars"}.</li>
        </ul>
        <div aria-live="polite">{state.error ? <p role="alert" className="text-[13.5px] font-medium text-bad">{state.error}</p> : null}</div>
        <button className="btn btn-ink min-h-[52px] w-full disabled:cursor-not-allowed disabled:opacity-50" disabled={sending || !!state.url || !valid}>
          {sending || state.url ? "Opening the payment page…" : valid ? `Buy a ${money(cents, currency)} gift card` : "Choose an amount"}
        </button>
        <p className="text-[12.5px] leading-relaxed text-muted">You will pay {naira ? "in naira on Paystack" : "in US dollars on Stripe"}&apos;s secure page. LogaLuxe never sees your card.{wallets && !naira ? <WalletNote /> : null}</p>
      </aside>
    </form>
  );
}
