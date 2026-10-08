"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { money } from "@/lib/api";
import { CardChoice, WalletNote, type SavedCard } from "@/components/pay-bits";
import { CodeAlert, CodeField, useWait } from "@/components/code-signin";
import { addReviewPhoto, addTip, askReturn, moveMyBooking, phoneStep, removeReviewPhoto, reportProblem, type CareState, type PhoneState, type PhotoState } from "./actions";

const MAX_PHOTOS = 3;
const NO_PHOTO: PhotoState = { error: "", done: 0 };

/** The photos on a review the client wrote: each can be removed, and up to three can be added. */
export function ReviewPhotos({ reviewId, photos, business }: { reviewId: string; photos: string[]; business: string }) {
  const [added, add, adding] = useActionState(addReviewPhoto, NO_PHOTO);
  const [removed, remove, removing] = useActionState(removeReviewPhoto, NO_PHOTO);
  const [local, setLocal] = useState("");
  const form = useRef<HTMLFormElement>(null);
  // Once a photo is in, the file field is emptied for the next one.
  useEffect(() => { if (added.done > 0) form.current?.reset(); }, [added.done]);
  const error = local || added.error || removed.error;
  const room = MAX_PHOTOS - photos.length;
  return (
    <div className="flex flex-col gap-3">
      {photos.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {photos.map((id, i) => (
            <li key={id} className="flex flex-col items-start gap-1.5">
              <a href={`/media/${id}`} target="_blank" rel="noreferrer" className="block h-[84px] w-[84px] overflow-hidden rounded-xl bg-cream-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/media/${id}`} alt={`Photo ${i + 1} on your review of ${business}. Opens larger in a new tab.`} loading="lazy" className="h-full w-full object-cover" />
              </a>
              <form action={remove}>
                <input type="hidden" name="photo_id" value={id} />
                <button className="text-[13px] font-semibold text-wine underline underline-offset-2 disabled:opacity-50" disabled={removing} aria-label={`Remove photo ${i + 1} from your review of ${business}`}>Remove</button>
              </form>
            </li>
          ))}
        </ul>
      )}
      {room > 0 ? (
        <form
          ref={form} action={add} className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            const f = (e.currentTarget.elements.namedItem("file") as HTMLInputElement | null)?.files?.[0];
            // Checked here too, so a file that is far too large is never sent.
            if (f && f.size > 8 * 1024 * 1024) { e.preventDefault(); setLocal("The photo is too large. The limit is 8 MB."); } else setLocal("");
          }}
        >
          <input type="hidden" name="review_id" value={reviewId} />
          <label className="flex min-w-0 flex-col gap-1.5 text-[13.5px]">
            <span className="font-semibold">Add a photo <span className="font-normal text-muted">· {photos.length} of {MAX_PHOTOS} added · JPEG, PNG or WebP, up to 8 MB</span></span>
            <input type="file" name="file" accept="image/jpeg,image/png,image/webp" required className="max-w-full text-[13.5px] file:mr-3 file:min-h-[38px] file:cursor-pointer file:rounded-full file:border file:border-solid file:border-line file:bg-white file:px-3.5 file:text-[13px] file:font-semibold file:text-ink" />
          </label>
          <button className="btn btn-ink btn-sm disabled:cursor-not-allowed disabled:opacity-50" disabled={adding}>{adding ? "Uploading…" : "Upload photo"}</button>
        </form>
      ) : (
        <p className="text-[13.5px] text-muted">A review can have three photos. Remove one to add another.</p>
      )}
      <div aria-live="polite">{error ? <p role="alert" className="text-[13.5px] font-medium text-bad">{error}</p> : null}</div>
    </div>
  );
}

/** Copies a piece of text, and says so. Where the browser will not copy, the text is shown to copy by hand. */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [note, setNote] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setNote("Copied");
      window.setTimeout(() => setNote(""), 2500);
    } catch {
      window.prompt("Copy this", text);
    }
  }
  return <button type="button" className="btn btn-ink btn-sm" onClick={copy}><span aria-live="polite">{note || label}</span></button>;
}

/**
 * Older links point at a section with a hash: /account#orders, /account#details.
 * The sections are now tabs kept in the address, so a hash that names a tab opens that tab.
 */
export function HashTab({ current, tabs: names }: { current: string; tabs: string }) {
  const router = useRouter();
  useEffect(() => {
    const tabs = names.split(",");
    const go = (hash: string, search: string) => {
      const p = new URLSearchParams(search);
      p.set("tab", hash);
      router.replace(`/account?${p}`);
    };
    const fromHash = () => {
      const h = window.location.hash.slice(1);
      if (tabs.includes(h) && h !== current) go(h, window.location.search);
    };
    // A link to /account#orders clicked while already on this page changes only the hash, so it is caught here.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank") return;
      const url = new URL(a.href, window.location.href);
      const h = url.hash.slice(1);
      if (url.origin !== window.location.origin || url.pathname !== "/account" || !tabs.includes(h) || url.searchParams.has("tab")) return;
      if (h === current && url.search === window.location.search) return; // already there: let the browser scroll to it
      e.preventDefault();
      url.searchParams.set("tab", h);
      router.push(`/account?${url.searchParams}`);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("hashchange", fromHash);
      document.removeEventListener("click", onClick, true);
    };
  }, [current, names, router]);
  return null;
}

type Slot = { time: string; starts_at: string; staff_id: string; staff: string };

const dayIn = (at: Date, timeZone: string) => {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
};
const longDay = (date: string) => new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

/** Picks a new day and a free time for a booking, then hands them to the server to move it. */
export function BookingMover({ id, slug, timezone, services, staffId, staff, startsAt, day }: {
  id: string; slug: string; timezone: string; /** Service ids, comma separated. */ services: string; staffId: string; staff: string; startsAt: string; day?: string;
}) {
  const today = dayIn(new Date(), timezone);
  const booked = dayIn(new Date(startsAt), timezone);
  const [date, setDate] = useState(day && /^\d{4}-\d{2}-\d{2}$/.test(day) && day >= today ? day : booked);
  const [who, setWho] = useState<"same" | "any">("same");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pick, setPick] = useState<Slot | null>(null);

  useEffect(() => {
    let live = true;
    setSlots(null); setPick(null); setError(""); setNote("");
    const qs = new URLSearchParams({ slug, date, services, staff: who === "same" ? staffId : "any" });
    fetch(`/api/availability?${qs}`)
      .then(async (r) => ({ ok: r.ok, body: await r.json().catch(() => ({})) }))
      .then(({ ok, body }) => {
        if (!live) return;
        if (!ok) { setSlots([]); setError(body.error ?? "We could not load the free times."); return; }
        // The time the booking already has is not a move.
        setSlots(((body.slots ?? []) as Slot[]).filter((s) => new Date(s.starts_at).getTime() !== new Date(startsAt).getTime()));
        setNote(body.note ?? "");
      })
      .catch(() => { if (live) { setSlots([]); setError("We could not load the free times. Check your connection and try again."); } });
    return () => { live = false; };
  }, [slug, date, who, staffId, startsAt, services]);

  // The chosen day is kept in the address, so a reload or a shared link opens the same day.
  const chooseDay = (d: string) => {
    if (!d) return;
    setDate(d);
    const p = new URLSearchParams(window.location.search);
    p.set("day", d);
    window.history.replaceState(null, "", `${window.location.pathname}?${p}${window.location.hash}`);
  };

  return (
    <form action={moveMyBooking} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="timezone" value={timezone} />
      <input type="hidden" name="day" value={date} />
      <input type="hidden" name="starts_at" value={pick?.starts_at ?? ""} />
      <input type="hidden" name="staff_id" value={pick?.staff_id ?? ""} />

      <div className="flex flex-wrap items-end gap-3">
        <label className="field w-full max-w-[220px]"><span className="text-[11px] font-semibold uppercase tracking-[.06em] text-muted">New day</span>
          <input type="date" value={date} min={today} onChange={(e) => chooseDay(e.target.value)} required />
        </label>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">With whom</legend>
          {([["same", `With ${staff}`], ["any", "Anyone free"]] as const).map(([k, label]) => (
            <label key={k} className={`flex min-h-[44px] cursor-pointer items-center rounded-full border px-4 text-[13.5px] font-semibold transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold ${who === k ? "border-ink bg-ink text-cream" : "border-line bg-white hover:border-ink"}`}>
              <input type="radio" name="who" value={k} checked={who === k} onChange={() => setWho(k)} className="sr-only" />{label}
            </label>
          ))}
        </fieldset>
      </div>

      <div aria-live="polite">
        <div className="mb-2 text-[13.5px] text-muted">Free times on {longDay(date)}</div>
        {slots === null && <p className="text-[14.5px] text-muted">Looking for free times…</p>}
        {error && <p role="alert" className="text-[14.5px] font-medium text-bad">{error}</p>}
        {slots !== null && !error && slots.length === 0 && (
          <p className="text-[14.5px] text-muted">{note || (who === "same" ? `${staff} has no free time that day. Try another day, or choose Anyone free.` : "Nothing is free that day. Try another day.")}</p>
        )}
        {slots !== null && slots.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => {
              const on = pick?.starts_at === s.starts_at && pick?.staff_id === s.staff_id;
              return (
                <button key={s.starts_at + s.staff_id} type="button" aria-pressed={on} onClick={() => setPick(s)}
                  className={`min-h-[42px] rounded-full border px-3.5 text-[14px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${on ? "border-ink bg-ink text-cream" : "border-line bg-white hover:border-ink"}`}>
                  {s.time}{who === "any" && s.staff ? <span className={`ml-1.5 text-[12px] font-medium ${on ? "text-[#C9BCB0]" : "text-muted"}`}>{s.staff}</span> : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-ink disabled:cursor-not-allowed disabled:opacity-50" disabled={!pick}>{pick ? `Move to ${longDay(date)}, ${pick.time}` : "Choose a time"}</button>
        {pick && <span className="text-[13px] text-muted">With {pick.staff}. The price you agreed stays the same.</span>}
      </div>
    </form>
  );
}

// ---------- after the sale: a return, a tip, a problem with a visit ----------

const NO_CARE: CareState = { error: "" };
const capLabel = "text-[11px] font-semibold uppercase tracking-[.06em] text-muted";
const summaryLink = "cursor-pointer text-[14px] font-semibold text-wine";
const CareError = ({ text }: { text: string }) => <div aria-live="polite">{text ? <p role="alert" className="text-[13.5px] font-medium text-bad">{text}</p> : null}</div>;

// The API sends the reasons as a map, so the order they are offered in is set here. A reason added later still shows, at the end.
const RETURN_ORDER = ["damaged", "wrong_item", "not_as_described", "changed_mind", "other"];

/** Asks one seller to take back their part of an order. */
export function ReturnForm({ orderId, seller, reasons, until }: { orderId: string; seller: string; /** Reason key to its wording, from the API. */ reasons: Record<string, string>; /** The last day, already written out. */ until: string }) {
  const [state, send, sending] = useActionState(askReturn, NO_CARE);
  const [reason, setReason] = useState("");
  const needNote = reason === "other" || reason === "not_as_described";
  return (
    <details className="mt-1.5">
      <summary className={summaryLink}>Return these items</summary>
      <form action={send} className="mt-3 flex max-w-[520px] flex-col gap-3">
        <input type="hidden" name="order" value={orderId} />
        <input type="hidden" name="seller" value={seller} />
        <p className="text-[13.5px] leading-relaxed text-muted">
          {until ? `You can ask until ${until}. ` : ""}{seller} answers by email. If the return is approved, the refund goes back to the card you paid with. Any part you paid with store credit or a gift card comes back as store credit.
        </p>
        <label className="field"><span className={capLabel}>Why are you returning it?</span>
          <select name="reason" required value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Choose a reason</option>
            {[...RETURN_ORDER.filter((k) => k in reasons), ...Object.keys(reasons).filter((k) => !RETURN_ORDER.includes(k))].map((k) => <option key={k} value={k}>{reasons[k]}</option>)}
          </select>
        </label>
        <label className="field"><span className={capLabel}>{needNote ? "What is wrong? A sentence or two" : "A note for the seller, if you like"}</span>
          <textarea name="note" required={needNote} minLength={needNote ? 10 : undefined} maxLength={1000} />
        </label>
        <CareError text={state.error} />
        <div><button className="btn btn-ink btn-sm disabled:cursor-not-allowed disabled:opacity-50" disabled={sending}>{sending ? "Sending…" : "Ask for a return"}</button></div>
      </form>
    </details>
  );
}

/** A tip for a finished visit: a share of what the visit cost, or an amount of the client's own. */
export function TipForm({ id, business, totalCents, currency, tipped, saved = false, cards = [], wallets = false }: {
  id: string; business: string; totalCents: number; currency: string; /** Tipped already, with this in mind another can still be added. */ tipped: number;
  /** Saved cards are switched on: a kept card in this currency can pay, and a new one can be kept. */
  saved?: boolean; cards?: SavedCard[]; /** Apple Pay and Google Pay may be named: switched on, and the tip is in dollars. */ wallets?: boolean;
}) {
  const [cardId, setCardId] = useState(cards[0]?.id ?? "");
  const [keepCard, setKeepCard] = useState(false);
  const useCard = saved ? cards.find((c) => c.id === cardId) : undefined;
  const [state, send, sending] = useActionState(addTip, NO_CARE);
  // The smallest tip the API takes, and what a choice is rounded to: whole dollars, or the nearest 100 naira.
  const ngn = currency === "NGN";
  const floor = ngn ? 20000 : 100, step = ngn ? 10000 : 100;
  const choices = [15, 20, 25]
    .map((pct) => ({ pct, cents: Math.round((totalCents * pct) / 100 / step) * step }))
    .filter((c, i, all) => c.cents >= floor && c.cents <= totalCents && all.findIndex((x) => x.cents === c.cents) === i);
  const [pick, setPick] = useState<number | "own">(choices[1]?.cents ?? choices[0]?.cents ?? "own");
  const [own, setOwn] = useState("");
  const ownCents = Math.round((Number(own.replace(/,/g, "")) || 0) * 100);
  const cents = pick === "own" ? ownCents : pick;
  // Payments are live: the tip is paid on the provider's page.
  useEffect(() => { if (state.url) window.location.href = state.url; }, [state.url]);
  const chip = (on: boolean) => `flex min-h-[42px] cursor-pointer items-center rounded-full border px-3.5 text-[14px] font-semibold transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold ${on ? "border-ink bg-ink text-cream" : "border-line bg-white hover:border-ink"}`;
  return (
    <details>
      <summary className={summaryLink}>{tipped > 0 ? "Add another tip" : "Add a tip"}</summary>
      <form action={send} className="mt-3 flex max-w-[520px] flex-col gap-3">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="business" value={business} />
        <input type="hidden" name="amount_cents" value={cents > 0 ? cents : ""} />
        {useCard ? <input type="hidden" name="card_id" value={useCard.id} /> : saved && keepCard ? <input type="hidden" name="save_card" value="1" /> : null}
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-2 text-[13.5px] text-muted">A tip for {business}, in {ngn ? "naira" : "US dollars"}. The visit was {money(totalCents, currency)}.</legend>
          {choices.map((c) => (
            <label key={c.pct} className={chip(pick === c.cents)}>
              <input type="radio" name="choice" className="sr-only" checked={pick === c.cents} onChange={() => setPick(c.cents)} />{c.pct}% · {money(c.cents, currency)}
            </label>
          ))}
          <label className={chip(pick === "own")}>
            <input type="radio" name="choice" className="sr-only" checked={pick === "own"} onChange={() => setPick("own")} />Another amount
          </label>
        </fieldset>
        {pick === "own" && (
          <label className="field max-w-[220px]"><span className={capLabel}>Amount in {ngn ? "naira (₦)" : "dollars ($)"}</span>
            <input type="number" inputMode="decimal" min={floor / 100} max={totalCents > 0 ? totalCents / 100 : undefined} step={ngn ? 1 : 0.01} value={own} onChange={(e) => setOwn(e.target.value)} required />
          </label>
        )}
        <p className="text-[13px] text-muted">From {money(floor, currency)}{totalCents > 0 ? ` up to ${money(totalCents, currency)}, the price of the visit` : ""}. {useCard ? " It is charged to your kept card at once. If your bank asks you to approve it, a payment page opens." : <> If a payment page opens, you pay there. LogaLuxe never sees your card.{wallets ? <WalletNote /> : null}</>}</p>
        {saved ? <CardChoice look="chips" cards={cards} provider={ngn ? "Paystack" : "Stripe"} value={useCard ? useCard.id : ""} onChange={setCardId} keep={keepCard} onKeep={setKeepCard} name={`tip-card-${id}`} /> : null}
        <CareError text={state.error} />
        <div><button className="btn btn-ink btn-sm disabled:cursor-not-allowed disabled:opacity-50" disabled={sending || !!state.url || cents <= 0}>{sending || state.url ? "Sending…" : cents > 0 ? `Tip ${money(cents, currency)}` : "Choose an amount"}</button></div>
      </form>
    </details>
  );
}

/** A submit button that asks first. */
export function ConfirmSubmit({ message, children, ...props }: { message: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} onClick={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>{children}</button>;
}

const NO_PHONE: PhoneState = { stage: "idle", sent: "", error: "", sends: 0 };

/** Confirms the number on the account: a code is sent to it, and typed here. */
export function PhoneConfirm({ phone, whatsapp }: { phone: string; /** WhatsApp is switched on, so the code can go there. */ whatsapp: boolean }) {
  const [state, step, pending] = useActionState(phoneStep, NO_PHONE);
  const [channel, setChannel] = useState<"sms" | "whatsapp">("sms");
  const [code, setCode] = useState("");
  const left = useWait(state.sends);
  // A code that was refused is cleared, ready for the next try.
  useEffect(() => { if (state.error) setCode(""); }, [state]);
  const chip = (on: boolean) => `flex min-h-[42px] cursor-pointer items-center rounded-full border px-3.5 text-[14px] font-semibold transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold ${on ? "border-ink bg-ink text-cream" : "border-line bg-white hover:border-ink"}`;
  const link = "text-[13.5px] font-semibold text-wine underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50";

  if (state.stage === "idle") {
    return (
      <form action={step} className="flex flex-col gap-3">
        <input type="hidden" name="intent" value="send" />
        {whatsapp ? (
          <fieldset className="flex flex-wrap gap-2">
            <legend className="mb-2 text-[13.5px] text-muted">Send the code</legend>
            <label className={chip(channel === "sms")}><input type="radio" name="channel" value="sms" className="sr-only" checked={channel === "sms"} onChange={() => setChannel("sms")} />By text</label>
            <label className={chip(channel === "whatsapp")}><input type="radio" name="channel" value="whatsapp" className="sr-only" checked={channel === "whatsapp"} onChange={() => setChannel("whatsapp")} />On WhatsApp</label>
          </fieldset>
        ) : <input type="hidden" name="channel" value="sms" />}
        <CodeAlert text={state.error} />
        <div><button className="btn btn-ink btn-sm disabled:cursor-not-allowed disabled:opacity-50" disabled={pending}>{pending ? "Sending…" : channel === "whatsapp" ? "Send me a code on WhatsApp" : "Text me a code"}</button></div>
      </form>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p role="status" className={`rounded-xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ${state.sent === "logged" ? "bg-warn-bg text-gold-ink" : "bg-cream-2 text-muted"}`}>
        {state.sent === "logged"
          ? `We could not send a message to ${phone}, so no code is on its way. Check the number in your details.`
          : `We sent a 6-digit code to ${phone} ${channel === "whatsapp" ? "on WhatsApp" : "by text"}. It works for 10 minutes.`}
      </p>
      <form action={step} className="flex max-w-[280px] flex-col gap-3">
        <input type="hidden" name="intent" value="check" />
        <CodeField value={code} onChange={setCode} />
        <CodeAlert text={state.error} />
        <div><button className="btn btn-ink btn-sm disabled:cursor-not-allowed disabled:opacity-50" disabled={pending || code.length !== 6}>{pending ? "Checking…" : "Confirm number"}</button></div>
      </form>
      <form action={step}>
        <input type="hidden" name="intent" value="send" />
        <input type="hidden" name="channel" value={channel} />
        {left > 0 ? <span className="text-[13.5px] text-muted">Send a new code in {left} {left === 1 ? "second" : "seconds"}</span> : <button className={link} disabled={pending}>Send a new code</button>}
      </form>
    </div>
  );
}

const PROBLEMS: [string, string][] = [["quality", "The result was not what was agreed"], ["charged", "I was charged the wrong amount"], ["no_show", "The professional did not show up"], ["conduct", "How I was treated"], ["other", "Something else"]];

/** Reports a problem with a visit, and says what happens next. */
export function ProblemForm({ id, business }: { id: string; business: string }) {
  const [state, send, sending] = useActionState(reportProblem, NO_CARE);
  const [text, setText] = useState("");
  const short = text.trim().length < 20;
  return (
    <details>
      <summary className={summaryLink}>Report a problem</summary>
      <form action={send} className="mt-3 flex max-w-[560px] flex-col gap-3">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="business" value={business} />
        <p className="text-[13.5px] leading-relaxed text-muted">Your report goes to {business} and to LogaLuxe. {business} has 48 hours to give its side. Then LogaLuxe decides and emails you. You can report a visit once.</p>
        <label className="field max-w-[360px]"><span className={capLabel}>What went wrong?</span>
          <select name="reason" required defaultValue="">
            <option value="">Choose one</option>
            {PROBLEMS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </label>
        <label className="field"><span className={capLabel}>What happened? 20 characters or more</span>
          <textarea name="statement" required minLength={20} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="What was agreed, what happened, and what you would like done" />
        </label>
        <CareError text={state.error} />
        <div><button className="btn btn-ink btn-sm disabled:cursor-not-allowed disabled:opacity-50" disabled={sending || short}>{sending ? "Sending…" : "Send the report"}</button></div>
      </form>
    </details>
  );
}
