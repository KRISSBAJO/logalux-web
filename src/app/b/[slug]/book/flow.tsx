"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { duration, money, type Service } from "@/lib/api";
import { CardChoice, NO_PAY, WalletNote, cardsFor, walletsFor, type PayFeatures } from "@/components/pay-bits";
import { clock, dayLabel, firstName, initialsOf, inZone, lateRule, MONTHS, whenLabel, type DayCell, type Policy, type Question, type Slot } from "../shared";
import { useUrlState } from "../url-state";

export type Pro = { id: string; name: string; initials: string; tone: string; sub: string };
type Me = { first: string; last: string; phone: string; email: string };
type Props = {
  slug: string; src: string; name: string; tone: string; logoId: string | null; currency: string; tz: string; market: string;
  place: string; verified: boolean; reviewCount: number; services: Service[]; pros: Pro[]; anyone: boolean; policy: Policy;
  /** Today's date on the business's clock. */
  today: string; me: Me | null;
  /** The questions this business asks for the chosen services, in its own order. */
  intake: Question[];
  /** Shown inside a frame on the business's own website: links stay in the frame, payment opens at the top level, and the booking counts as the business's own link. */
  embed?: boolean;
  /** Kept cards and wallets, each only while LogaLuxe staff have it switched on. */
  pay?: PayFeatures;
  /** The channel a confirmation also goes to the phone on, when one is switched on for this person. */
  tell?: "" | "whatsapp" | "sms";
};

type Details = { first: string; last: string; phone: string; email: string; note: string; who: "me" | "other"; guest: string; answers: Record<string, string> };
/** What the API says when an answer is missing or wrong. Each is followed by the question's own wording. */
const REFUSALS = ["please answer:", "please tick:", "choose one of the options:"];
const sentence = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) + (/[.!?]$/.test(t) ? "" : ".") : t);

const KEEP = "lx_book_details";
const GUEST = "lx_book_guest_";

/**
 * "For Tola" on the confirmation. The account's copy of a booking says who it is for; the public copy
 * (all a guest can read) does not, so the browser that made the booking remembers the name for this visit.
 */
export function GuestLine({ id, name, side }: { id: string; name: string; side?: boolean }) {
  const [guest, setGuest] = useState(name);
  useEffect(() => {
    if (name) return;
    try { setGuest((window.sessionStorage.getItem(GUEST + id) ?? "").slice(0, 80)); } catch {}
  }, [id, name]);
  if (!guest) return null;
  return side
    ? <div className="muted" style={{ fontSize: 13, overflowWrap: "anywhere" }}>For <b style={{ color: "#1A1513" }}>{guest}</b></div>
    : <div style={{ fontSize: 15, overflowWrap: "anywhere" }}>For <b>{guest}</b></div>;
}
const addDays = (date: string, n: number) => { const [y, m, d] = date.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const shiftMonth = (month: string, n: number) => { const [y, m] = month.split("-").map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7); };
const CHECK = "M20 6 9 17l-5-5";

export function BookFlow(p: Props) {
  const { slug, currency, tz, services, policy, intake } = p;
  const embed = !!p.embed;
  // A booking from the business's own website is the business's own link, never a LogaLuxe search lead.
  const src = embed ? "" : p.src;
  const base = embed ? `/embed/${slug}` : `/b/${slug}/book`;
  const out = embed ? { target: "_blank", rel: "noopener" } : {};
  const router = useRouter();
  const [sp, setUrl] = useUrlState();
  const ids = services.map((s) => s.id).join(",");
  const menuTotal = services.reduce((a, s) => a + s.price_cents, 0);
  const mins = services.reduce((a, s) => a + s.duration_min + s.processing_min, 0);
  const maxDays = policy.max_days ?? 60;
  const lastDay = addDays(p.today, maxDays);

  // ----- what has been chosen, read from the address -----
  const staffRaw = sp.get("staff") ?? "";
  const staff = staffRaw === "any" && p.anyone ? "any" : p.pros.some((x) => x.id === staffRaw) ? staffRaw : p.anyone || !p.pros[0] ? "any" : p.pros[0].id;
  const dateRaw = sp.get("date") ?? "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) && dateRaw >= p.today && dateRaw <= lastDay ? dateRaw : "";
  const time = /^\d{2}:\d{2}$/.test(sp.get("time") ?? "") ? sp.get("time")! : "";
  const monthRaw = sp.get("month") ?? "";
  const month = /^\d{4}-\d{2}$/.test(monthRaw) && monthRaw >= p.today.slice(0, 7) && monthRaw <= lastDay.slice(0, 7) ? monthRaw : date ? date.slice(0, 7) : p.today.slice(0, 7);

  // ----- the client's details: typed once, kept for this visit so a reload does not lose them -----
  const [d, setD] = useState<Details>({ first: p.me?.first ?? "", last: p.me?.last ?? "", phone: p.me?.phone ?? "", email: p.me?.email ?? "", note: "", who: "me", guest: "", answers: {} });
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    try {
      const kept = JSON.parse(window.sessionStorage.getItem(KEEP) ?? "null");
      if (kept && typeof kept === "object") {
        // Answers belong to one business's questions, so they come back only for that business.
        const answers: Record<string, string> = {};
        if (kept.slug === slug && kept.answers && typeof kept.answers === "object") for (const [k, v] of Object.entries(kept.answers)) if (typeof v === "string") answers[k] = v;
        setD((now) => ({
          first: now.first || String(kept.first ?? ""), last: now.last || String(kept.last ?? ""), phone: now.phone || String(kept.phone ?? ""), email: now.email || String(kept.email ?? ""), note: String(kept.note ?? ""),
          who: kept.who === "other" ? "other" : "me", guest: String(kept.guest ?? "").slice(0, 80), answers,
        }));
      }
    } catch {}
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    try { window.sessionStorage.setItem(KEEP, JSON.stringify({ ...d, slug })); } catch {}
  }, [d, restored, slug]);
  const guest = d.who === "other" ? d.guest.trim() : "";
  const answerOf = (q: Question) => (d.answers[q.id] ?? "").trim();
  // A box to tick is always required. A choice must be one of the options on offer today.
  const mustAnswer = (q: Question) => q.required || q.kind === "consent";
  const answered = (q: Question) => (q.kind === "consent" ? answerOf(q) === "yes" : q.kind === "yesno" ? ["yes", "no"].includes(answerOf(q)) : q.kind === "choice" ? (q.options ?? []).includes(answerOf(q)) : answerOf(q) !== "");
  const missing = intake.filter((q) => mustAnswer(q) && !answered(q));
  const detailsOk = d.first.trim() !== "" && d.phone.trim() !== "" && (d.who === "me" || guest !== "") && missing.length === 0;
  // Shown once the client has tried to go on, so an untouched form is not covered in warnings.
  const [tried, setTried] = useState(false);
  // What the API said about one question when it refused the booking.
  const [refused, setRefused] = useState<{ id: string; text: string } | null>(null);
  const setAnswer = (id: string, value: string) => { setRefused(null); setD((x) => ({ ...x, answers: { ...x.answers, [id]: value } })); };

  // ----- which days of the month have room -----
  const [reload, setReload] = useState(0);
  const dKey = `${month}|${staff}|${reload}`;
  const [days, setDays] = useState<{ key: string; days: DayCell[]; failed?: boolean } | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/businesses/${slug}/days?month=${month}&services=${ids}&staff=${staff}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => { if (live) setDays({ key: dKey, days: j.days ?? [] }); })
      .catch(() => { if (live) setDays({ key: dKey, days: [], failed: true }); });
    return () => { live = false; };
  }, [slug, ids, month, staff, dKey]);
  const daysReady = days?.key === dKey;
  const cells: DayCell[] = useMemo(() => {
    if (daysReady && days!.days.length) return days!.days;
    const [y, m] = month.split("-").map(Number);
    const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return Array.from({ length: n }, (_, i) => ({ date: `${month}-${String(i + 1).padStart(2, "0")}`, open: 0, from_cents: 0, past: false, too_far: false }));
  }, [daysReady, days, month]);
  const blanks = (new Date(`${month}-01T00:00:00Z`).getUTCDay() + 6) % 7;
  const openDays = daysReady ? cells.filter((c) => c.open > 0 && !c.past && !c.too_far) : [];
  // With no day chosen yet, start on the first one that has room.
  const firstOpen = openDays[0]?.date ?? "";
  useEffect(() => {
    if (!date && firstOpen) setUrl({ date: firstOpen, time: null });
  }, [date, firstOpen, setUrl]);

  // ----- the free times of the chosen day -----
  const aKey = `${date}|${staff}|${reload}`;
  const [avail, setAvail] = useState<{ key: string; slots: Slot[]; failed?: boolean } | null>(null);
  useEffect(() => {
    if (!date) return;
    let live = true;
    fetch(`/api/businesses/${slug}/availability?date=${date}&services=${ids}&staff=${staff}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => { if (live) setAvail({ key: aKey, slots: j.slots ?? [] }); })
      .catch(() => { if (live) setAvail({ key: aKey, slots: [], failed: true }); });
    return () => { live = false; };
  }, [slug, ids, date, staff, aKey]);
  const availReady = !!date && avail?.key === aKey;
  // With "anyone", the same time can be free with several people: offer each time once, at its lowest price.
  const times = useMemo(() => {
    const by = new Map<string, Slot>();
    for (const s of availReady ? avail!.slots : []) {
      const had = by.get(s.time);
      if (!had || s.price_cents < had.price_cents) by.set(s.time, s);
    }
    return [...by.values()].sort((a, b) => a.time.localeCompare(b.time));
  }, [availReady, avail]);
  const varies = new Set(times.map((s) => s.price_cents)).size > 1;
  const slot = time ? times.find((s) => s.time === time) ?? null : null;
  const am = times.filter((s) => s.time < "12:00"), pm = times.filter((s) => s.time >= "12:00");

  const [notice, setNotice] = useState("");
  // A time in the address that is no longer free (an old link, or someone else took it).
  useEffect(() => {
    if (availReady && !avail!.failed && time && !slot) {
      setNotice(`${clock(time)} on ${dayLabel(date)} is no longer free. Choose another time.`);
      setUrl({ time: null, step: null });
    }
  }, [availReady, avail, time, slot, date, setUrl]);

  // ----- steps -----
  const wanted = Number(sp.get("step")) || 1;
  const step = !time ? 1 : wanted >= 3 && restored && !detailsOk ? 2 : wanted >= 3 ? 3 : wanted === 2 ? 2 : 1;
  const top = useRef<HTMLDivElement>(null);
  const goStep = (n: number) => {
    setUrl({ step: n > 1 ? String(n) : null }, { push: true });
    top.current?.scrollIntoView({ block: "start" });
  };

  // ----- money: the chosen time decides the price, not the menu -----
  const total = slot?.price_cents ?? menuTotal;
  const deposit = Math.min(total, services.reduce((a, s) => a + s.deposit_cents, 0));
  const atVisit = total - deposit;
  const menuMatches = total === menuTotal;
  const pro = p.pros.find((x) => x.id === (slot?.staff_id ?? staff));
  const proName = slot ? slot.staff : pro ? pro.name : "anyone available";
  const provider = p.market === "NG" ? "Paystack" : "Stripe";
  const cancelHours = policy.cancel_hours ?? 24;
  const late = lateRule(policy.late_cancel_fee, deposit > 0);
  const freeUntil = slot ? new Date(new Date(slot.starts_at).getTime() - cancelHours * 3600_000) : null;
  const ends = slot ? clock(inZone(new Date(new Date(slot.starts_at).getTime() + mins * 60_000), tz).time) : "";
  const cancelText = !slot || !freeUntil ? ""
    : cancelHours <= 0 ? "Free to cancel at any time before your appointment."
    : freeUntil.getTime() > Date.now() ? `Free cancellation until ${whenLabel(freeUntil, tz)}.${late ? ` After that ${late}.` : ""}`
    : `This time is less than ${cancelHours} h away, so the free cancellation window has passed.${late ? ` If you cancel, ${late}.` : ""}`;
  const online = policy.payments_live !== false;
  // ----- paying: a card the client kept, or a different one. Offered only to a signed-in client while saved cards are switched on. -----
  const pay = p.pay ?? NO_PAY;
  const wallets = walletsFor(pay, provider);
  const kept = useMemo(() => cardsFor(pay.cards, currency), [pay.cards, currency]);
  const offerCards = pay.saved && !!p.me && online && deposit > 0;
  const [cardId, setCardId] = useState(kept[0]?.id ?? "");
  const [keepCard, setKeepCard] = useState(false);
  const useCard = offerCards ? kept.find((c) => c.id === cardId) : undefined;
  const firstPct = deposit === 0 ? policy.new_client_deposit_pct ?? 0 : 0;
  const firstNote = firstPct > 0 ? ` If this is your first visit here, a ${firstPct}% deposit (${money(Math.round(total * firstPct / 100), currency)}) is asked for when you confirm${online ? `, paid on ${provider}'s secure page` : ""}.${online && wallets ? " Apple Pay and Google Pay can be used there." : ""}` : "";
  const payText = deposit > 0
    ? atVisit > 0 ? ` The remaining ${money(atVisit, currency)} is paid at the visit.` : " Nothing more is due at the visit."
    : ` Nothing is due now. You pay ${money(total, currency)} at the visit.`;

  // ----- waitlist -----
  const [wl, setWl] = useState<{ open: boolean; date: string; when: string; name: string; phone: string; busy: boolean; error: string; done: string }>({ open: false, date: "", when: "Any time", name: "", phone: "", busy: false, error: "", done: "" });
  async function joinWaitlist(e: FormEvent) {
    e.preventDefault();
    const day = wl.date || date || p.today;
    setWl((w) => ({ ...w, busy: true, error: "" }));
    try {
      const res = await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_slug: slug, client_name: wl.name.trim(), client_phone: wl.phone.trim(), dates: [day], time_of_day: wl.when }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setWl((w) => ({ ...w, busy: false, error: j.error ?? "We could not add you. Try again." })); return; }
      setWl((w) => ({ ...w, busy: false, open: false, done: `You are on the waitlist for ${dayLabel(day)}${wl.when === "Any time" ? "" : `, ${wl.when.toLowerCase()}`}. ${p.name} can offer you a time if one opens.` }));
    } catch {
      setWl((w) => ({ ...w, busy: false, error: "We could not reach the service. Try again in a moment." }));
    }
  }

  // ----- confirm -----
  const [promo, setPromo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function confirm() {
    if (!slot || busy) return;
    setBusy(true); setError("");
    let res: Response, j: { error?: string; booking?: { id: string; payment?: { url?: string } } };
    try {
      res = await fetch("/api/bookings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_slug: slug, staff_id: slot.staff_id, starts_at: slot.starts_at, service_ids: services.map((s) => s.id), client_name: `${d.first} ${d.last}`.trim(), client_phone: d.phone.trim(), client_email: d.email.trim(), notes: d.note.trim(), promo_code: promo.trim(), source: src || "link",
          guest_name: guest, answers: intake.filter(answered).map((q) => ({ question_id: q.id, answer: answerOf(q) })),
          // A kept card is charged at once; a new card is kept only when the box is ticked.
          ...(useCard ? { card_id: useCard.id } : offerCards && keepCard ? { save_card: true } : {}),
        }),
      });
      j = await res.json().catch(() => ({}));
    } catch {
      setBusy(false); setError("We could not reach the service. Nothing was booked. Try again in a moment.");
      return;
    }
    if (res.status === 409) {
      // Someone else took the time while this client was filling in the form.
      setBusy(false);
      setNotice(`${clock(slot.time)} on ${dayLabel(date)} was just taken. Choose another time.`);
      setUrl({ time: null, step: null }, { push: true });
      setReload((n) => n + 1);
      top.current?.scrollIntoView({ block: "start" });
      return;
    }
    if (!res.ok || !j.booking) {
      setBusy(false);
      const said = j.error ?? "";
      // The API names the question it is not happy with: back to the details, with its words beside that question.
      if (res.status === 400 && REFUSALS.some((r) => said.toLowerCase().startsWith(r))) {
        const q = intake.find((x) => said.includes(x.label));
        setRefused({ id: q?.id ?? "", text: sentence(said) });
        setTried(true);
        // A question we do not have was added since this page was opened: fetch the questions again.
        if (!q) router.refresh();
        goStep(2);
        return;
      }
      setError(said ? sentence(said) : "We could not book that. Try again.");
      return;
    }
    try { window.sessionStorage.removeItem(KEEP); if (guest) window.sessionStorage.setItem(GUEST + j.booking.id, guest); } catch {}
    // A deposit paid online: on to the provider's secure page. The booking is confirmed when the payment arrives.
    // With a kept card the money may already be taken: then there is no payment page, and the booking is shown as paid.
    const payUrl = j.booking.payment?.url;
    if (payUrl) {
      if (!embed) { window.location.href = payUrl; return; }
      // Payment pages refuse to be shown inside a frame, so the whole tab goes there. If the browser
      // will not let the frame do that, the link shown under the form does the same thing on a click.
      setPayLink(payUrl);
      try { window.top!.location.href = payUrl; } catch {}
      return;
    }
    router.replace(`${base}?booking=${j.booking.id}${src ? `&src=${src}` : ""}`);
  }
  const [payLink, setPayLink] = useState("");

  const here = () => (typeof window === "undefined" ? base : window.location.pathname + window.location.search);
  const [signInHref, setSignInHref] = useState(`/signin?next=${encodeURIComponent(`/b/${slug}/book?services=${ids}`)}`);
  useEffect(() => { setSignInHref(`/signin?next=${encodeURIComponent(here())}`); }, [sp]); // eslint-disable-line react-hooks/exhaustive-deps

  const slotBtn = (s: Slot) => (
    <button type="button" key={s.time} className={`slot${time === s.time ? " on" : ""}`} aria-pressed={time === s.time} onClick={() => { setNotice(""); setUrl({ time: s.time }); }}>
      {clock(s.time)}{varies ? <small>{money(s.price_cents, currency)}</small> : null}
    </button>
  );
  const stepCls = (n: number) => `step${step === n ? " on" : step > n ? " done" : ""}`;
  const noteFor = pro ? firstName(pro.name) : slot ? firstName(slot.staff) : p.name;

  return (
    <>
      <div className="steps" ref={top} aria-label="Booking steps">
        <span className={stepCls(1)} aria-current={step === 1 ? "step" : undefined}><span className="n">1</span>Who and when</span><i />
        <span className={stepCls(2)} aria-current={step === 2 ? "step" : undefined}><span className="n">2</span>Your details</span><i />
        <span className={stepCls(3)} aria-current={step === 3 ? "step" : undefined}><span className="n">3</span>{deposit > 0 ? "Confirm and pay" : "Confirm"}</span>
      </div>

      <div className="layout">
        <div className="left">
          {step === 1 ? (
            <>
              {notice ? <div className="err" role="alert">{notice}</div> : null}
              <div className="card">
                <h2 className="serif">Who would you like?</h2>
                <div className="who">
                  {p.pros.map((x) => (
                    <button type="button" key={x.id} className={staff === x.id ? "on" : ""} aria-pressed={staff === x.id} onClick={() => setUrl({ staff: x.id, time: null })}>
                      <span className="avatar" style={{ background: x.tone }} aria-hidden="true">{x.initials}</span><span><b>{x.name}</b><span>{x.sub}</span></span>
                    </button>
                  ))}
                  {p.anyone ? (
                    <button type="button" className={staff === "any" ? "on" : ""} aria-pressed={staff === "any"} onClick={() => setUrl({ staff: "any", time: null })}>
                      <span className="avatar" style={{ background: "#1A1513" }} aria-hidden="true">✦</span><span><b>Anyone available</b><span>First open slot</span></span>
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <h2 className="serif">Pick a day</h2>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button type="button" className="btn btn-out btn-sm" aria-label="Previous month" disabled={month <= p.today.slice(0, 7)} onClick={() => setUrl({ month: shiftMonth(month, -1) })}>‹</button>
                    <b aria-live="polite" style={{ minWidth: 124, textAlign: "center" }}>{MONTHS[Number(month.slice(5)) - 1]} {month.slice(0, 4)}</b>
                    <button type="button" className="btn btn-out btn-sm" aria-label="Next month" disabled={shiftMonth(month, 1) > lastDay.slice(0, 7)} onClick={() => setUrl({ month: shiftMonth(month, 1) })}>›</button>
                  </div>
                </div>
                <div className="cal">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((h) => <div className="h" key={h}>{h}</div>)}
                  {Array.from({ length: blanks }, (_, i) => <span key={`b${i}`} />)}
                  {cells.map((c) => {
                    const free = daysReady && c.open > 0 && !c.past && !c.too_far;
                    const on = c.date === date;
                    return (
                      <button type="button" key={c.date} className={`day${on ? " on" : ""}${free ? "" : " off"}`} disabled={!free} aria-pressed={on}
                        aria-label={`${dayLabel(c.date)}${free ? `, ${c.open} time${c.open === 1 ? "" : "s"} free` : c.past ? ", past" : c.too_far ? ", too far ahead" : daysReady ? ", nothing free" : ""}`}
                        onClick={() => { setNotice(""); setUrl({ date: c.date, time: null }); }}>
                        {Number(c.date.slice(8))}<i style={{ opacity: free && !on ? 1 : 0 }} />
                      </button>
                    );
                  })}
                </div>
                <div aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {!daysReady ? <div className="muted" style={{ fontSize: 13.5 }}>Checking the calendar…</div> : null}
                  {daysReady && days!.failed ? <div className="muted" style={{ fontSize: 13.5 }}>We could not load the calendar. <button type="button" className="linkbtn" onClick={() => setReload((n) => n + 1)}>Try again</button>.</div> : null}
                  {daysReady && !days!.failed && openDays.length === 0 ? (
                    <div className="muted" style={{ fontSize: 13.5 }}>Nothing free in {MONTHS[Number(month.slice(5)) - 1]}{pro ? ` with ${firstName(pro.name)}` : ""}. {shiftMonth(month, 1) <= lastDay.slice(0, 7) ? "Try the next month" : `This business takes bookings up to ${maxDays} days ahead`}{p.pros.length > 1 && staff !== "any" ? ", or choose someone else" : ""}.</div>
                  ) : null}
                  {date && !availReady ? <div className="muted" style={{ fontSize: 13.5 }}>Checking {dayLabel(date)}…</div> : null}
                  {availReady && avail!.failed ? <div className="muted" style={{ fontSize: 13.5 }}>We could not load the times. <button type="button" className="linkbtn" onClick={() => setReload((n) => n + 1)}>Try again</button>.</div> : null}
                  {availReady && !avail!.failed && times.length === 0 ? <div className="muted" style={{ fontSize: 13.5 }}>Nothing free on {dayLabel(date)}. Pick another day.</div> : null}
                  {am.length > 0 ? <><div className="grp">{dayLabel(date)} · morning</div><div className="slots">{am.map(slotBtn)}</div></> : null}
                  {pm.length > 0 ? <><div className="grp">{am.length ? "Afternoon" : `${dayLabel(date)} · afternoon`}</div><div className="slots">{pm.map(slotBtn)}</div></> : null}
                  {varies ? <div className="muted" style={{ fontSize: 12.5 }}>The price depends on the time{staff === "any" && p.pros.length > 1 ? " and who is free" : ""}.</div> : null}
                </div>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  Only slots long enough for {duration(mins)} are shown.
                  {policy.waitlist !== false ? <> Full day? <button type="button" className="linkbtn" aria-expanded={wl.open} onClick={() => setWl((w) => ({ ...w, open: !w.open, done: "", error: "", date: w.date || date || p.today, name: w.name || `${d.first} ${d.last}`.trim(), phone: w.phone || d.phone }))}>Join the waitlist</button>.</> : null}
                </div>
                {wl.done ? <div className="ok" role="status">{wl.done}</div> : null}
                {wl.open ? (
                  <form className="wl" onSubmit={joinWaitlist}>
                    <div className="two">
                      <div className="field"><label htmlFor="wl-day">Day you want</label><input id="wl-day" type="date" required min={p.today} max={lastDay} value={wl.date} onChange={(e) => setWl((w) => ({ ...w, date: e.target.value }))} /></div>
                      <div className="field"><label id="wl-when">Time of day</label><div className="chips" role="group" aria-labelledby="wl-when">{["Any time", "Morning", "Afternoon"].map((c) => <button type="button" key={c} className={`chip${wl.when === c ? " on" : ""}`} aria-pressed={wl.when === c} onClick={() => setWl((w) => ({ ...w, when: c }))}>{c}</button>)}</div></div>
                      <div className="field"><label htmlFor="wl-name">Your name</label><input id="wl-name" type="text" required autoComplete="name" value={wl.name} onChange={(e) => setWl((w) => ({ ...w, name: e.target.value }))} /></div>
                      <div className="field"><label htmlFor="wl-phone">Mobile number</label><input id="wl-phone" type="tel" required autoComplete="tel" value={wl.phone} onChange={(e) => setWl((w) => ({ ...w, phone: e.target.value }))} /></div>
                    </div>
                    {wl.error ? <div className="err" role="alert">{wl.error}</div> : null}
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button type="button" className="btn btn-out btn-sm" onClick={() => setWl((w) => ({ ...w, open: false }))}>Close</button>
                      <button type="submit" className="btn btn-ink btn-sm" disabled={wl.busy}>{wl.busy ? "Adding…" : "Join the waitlist"}</button>
                    </div>
                  </form>
                ) : null}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}><button type="button" className="btn btn-ink" disabled={!slot} onClick={() => goStep(2)}>{slot ? "Continue" : "Pick a time to continue"}</button></div>
            </>
          ) : null}

          {step === 2 ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setTried(true); setRefused(null);
                if (missing.length > 0) {
                  const el = document.getElementById(`q-${missing[0].id}`);
                  el?.scrollIntoView({ block: "center" });
                  (el?.querySelector("input,textarea,select") as HTMLElement | null)?.focus({ preventScroll: true });
                  return;
                }
                goStep(3);
              }}
              style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {refused && !refused.id ? <div className="err" role="alert">{refused.text}</div> : null}
              <div className="card">
                <h2 className="serif">Your details</h2>
                <div className="muted" style={{ fontSize: 14 }}>
                  {p.me ? <>Signed in as {p.me.email}. This booking will be saved to your account.</> : embed ? <>No account needed.</> : <>No account needed. <a href={signInHref} style={{ fontWeight: 600 }}>Sign in</a> to keep this booking in your account.</>}
                </div>
                <fieldset className="q">
                  <legend>This booking is for</legend>
                  <div className="picks">
                    <label className="pick"><input type="radio" name="who" checked={d.who === "me"} onChange={() => setD((x) => ({ ...x, who: "me" }))} />Me</label>
                    <label className="pick"><input type="radio" name="who" checked={d.who === "other"} onChange={() => setD((x) => ({ ...x, who: "other" }))} />Someone else</label>
                  </div>
                </fieldset>
                {d.who === "other" ? (
                  <div className="field">
                    <label htmlFor="guest">Their name</label>
                    <input id="guest" type="text" required maxLength={80} autoComplete="off" aria-describedby="guest-note" value={d.guest} onChange={(e) => setD((x) => ({ ...x, guest: e.target.value }))} />
                    <div className="muted" id="guest-note" style={{ fontSize: 12.5 }}>The contact details below stay yours, so {p.name} can reach you.</div>
                  </div>
                ) : null}
                <div className="two">
                  <div className="field"><label htmlFor="fn">First name</label><input id="fn" type="text" required autoComplete="given-name" value={d.first} onChange={(e) => setD((x) => ({ ...x, first: e.target.value }))} /></div>
                  <div className="field"><label htmlFor="ln">Last name</label><input id="ln" type="text" autoComplete="family-name" value={d.last} onChange={(e) => setD((x) => ({ ...x, last: e.target.value }))} /></div>
                  <div className="field"><label htmlFor="ph">Mobile number</label><input id="ph" type="tel" required autoComplete="tel" placeholder={p.market === "NG" ? "+234 803 555 0144" : "+1 615 555 0144"} value={d.phone} onChange={(e) => setD((x) => ({ ...x, phone: e.target.value }))} /></div>
                  <div className="field"><label htmlFor="em">Email · for the receipt</label><input id="em" type="email" autoComplete="email" value={d.email} onChange={(e) => setD((x) => ({ ...x, email: e.target.value }))} /></div>
                </div>
                <div className="field"><label htmlFor="note">Note for {noteFor} · optional</label><textarea id="note" maxLength={1000} placeholder="Hair length, allergies, anything they should know…" value={d.note} onChange={(e) => setD((x) => ({ ...x, note: e.target.value }))} /></div>
              </div>
              {intake.length > 0 ? (
                <div className="card">
                  <h2 className="serif">A few questions from {p.name}</h2>
                  {intake.map((q) => {
                    const a = d.answers[q.id] ?? "";
                    const need = mustAnswer(q);
                    const problem = refused?.id === q.id ? refused.text : tried && missing.includes(q) ? (q.kind === "consent" ? "Tick this box to continue." : q.kind === "text" ? "Answer this question to continue." : "Choose an answer to continue.") : "";
                    const mark = <span className="req"> · {need ? "required" : "optional"}</span>;
                    const said = problem ? <div className="qerr" role="alert" id={`q-${q.id}-err`}>{problem}</div> : null;
                    const opts = q.kind === "yesno" ? [["yes", "Yes"], ["no", "No"]] : (q.options ?? []).map((o) => [o, o]);
                    if (q.kind === "consent") return (
                      <div className="q" id={`q-${q.id}`} key={q.id}>
                        <label className="tick"><input type="checkbox" checked={a === "yes"} aria-required="true" aria-invalid={!!problem} aria-describedby={problem ? `q-${q.id}-err` : undefined} onChange={(e) => setAnswer(q.id, e.target.checked ? "yes" : "")} /><span>{q.label}{mark}</span></label>
                        {said}
                      </div>
                    );
                    if (q.kind === "text") return (
                      <div className="field" id={`q-${q.id}`} key={q.id}>
                        <label htmlFor={`qa-${q.id}`}>{q.label}{mark}</label>
                        <textarea id={`qa-${q.id}`} maxLength={1000} aria-required={need} aria-invalid={!!problem} aria-describedby={problem ? `q-${q.id}-err` : undefined} value={a} onChange={(e) => setAnswer(q.id, e.target.value)} />
                        {said}
                      </div>
                    );
                    if (q.kind === "choice" && opts.length > 5) return (
                      <div className="field" id={`q-${q.id}`} key={q.id}>
                        <label htmlFor={`qa-${q.id}`}>{q.label}{mark}</label>
                        <select id={`qa-${q.id}`} aria-required={need} aria-invalid={!!problem} aria-describedby={problem ? `q-${q.id}-err` : undefined} value={a} onChange={(e) => setAnswer(q.id, e.target.value)}>
                          <option value="">Choose one</option>
                          {opts.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                        </select>
                        {said}
                      </div>
                    );
                    return (
                      <fieldset className="q" id={`q-${q.id}`} key={q.id} aria-describedby={problem ? `q-${q.id}-err` : undefined}>
                        <legend>{q.label}{mark}</legend>
                        <div className="picks">
                          {opts.map(([v, t]) => <label className="pick" key={v}><input type="radio" name={`qa-${q.id}`} checked={a === v} onChange={() => setAnswer(q.id, v)} />{t}</label>)}
                          {!need && a ? <button type="button" className="linkbtn" style={{ fontSize: 13 }} onClick={() => setAnswer(q.id, "")}>Clear</button> : null}
                        </div>
                        {said}
                      </fieldset>
                    );
                  })}
                </div>
              ) : null}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><button type="button" className="btn btn-out" onClick={() => goStep(1)}>Back</button><button type="submit" className="btn btn-ink">{deposit > 0 ? "Continue to payment" : "Continue"}</button></div>
            </form>
          ) : null}

          {step === 3 && !slot ? <div className="card"><div className="muted" style={{ fontSize: 14 }}>Checking that {clock(time)} on {dayLabel(date)} is still free…</div></div> : null}
          {step === 3 && slot ? (
            <>
              <div className="card">
                <h2 className="serif">{deposit > 0 ? "Hold your slot" : policy.instant === false ? "Send your request" : "Confirm your booking"}</h2>
                <div className="ok">{cancelText}{payText}{firstNote}</div>
                {policy.instant === false ? <div className="muted" style={{ fontSize: 13.5 }}>{p.name} confirms each booking itself. Your time is held while you wait to hear back.</div> : null}
                <div className="muted" style={{ fontSize: 13.5 }}>
                  {guest
                    ? <>For <b style={{ color: "#1A1513" }}>{guest}</b> · booked by {`${d.first} ${d.last}`.trim()}</>
                    : <>Booking for <b style={{ color: "#1A1513" }}>{`${d.first} ${d.last}`.trim()}</b></>} · {d.phone}{d.email ? ` · ${d.email}` : ""}. <button type="button" className="linkbtn" onClick={() => goStep(2)}>Edit</button>
                </div>
                {p.tell && d.phone.trim() ? <div className="muted" style={{ fontSize: 13.5 }}>We will also send the confirmation to {d.phone.trim()} {p.tell === "whatsapp" ? "on WhatsApp" : "by text"}.</div> : null}
                {deposit > 0 ? (
                  <>
                    <div className="grp">{online ? "Pay the deposit with" : "Deposit"}</div>
                    {offerCards && kept.length > 0 ? null : (
                      <div className="opt on" style={{ cursor: "default" }}>
                        <span className="radio"><i /></span>
                        <span style={{ flex: 1 }}><b>{online ? provider : "Not charged online"}</b><span>{online ? <>You will pay on {provider}&apos;s secure page. LogaLuxe never sees your card.{wallets ? <WalletNote /> : null}</> : "Online payment is not switched on for this business yet, so no card is asked for. The deposit is noted on your booking."}</span></span>
                      </div>
                    )}
                    {offerCards ? <CardChoice cards={kept} provider={provider} value={useCard ? useCard.id : ""} onChange={setCardId} keep={keepCard} onKeep={setKeepCard} name="pay-card" wallets={wallets} /> : null}
                  </>
                ) : null}
                <div className="field" style={{ maxWidth: 280 }}>
                  <label htmlFor="promo">Promo code · optional</label>
                  <input id="promo" type="text" autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={40} value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} style={{ letterSpacing: ".04em" }} />
                </div>
                {promo.trim() ? <div className="muted" style={{ fontSize: 12.5, marginTop: -6 }}>The code is checked when you confirm. If it works, the discount comes off the total.</div> : null}
                {error ? <div className="err" role="alert">{error}</div> : null}
                {payLink ? (
                  <div className="ok" role="status">
                    Your time is held. The payment page opens in the full window. If nothing happens, <a href={payLink} target="_top" rel="noopener" style={{ fontWeight: 600 }}>open {provider}&apos;s payment page</a>.
                  </div>
                ) : null}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <button type="button" className="btn btn-out" disabled={busy} onClick={() => goStep(2)}>Back</button>
                <button type="button" className="btn btn-ink" style={{ minHeight: 52 }} disabled={busy || !!payLink} onClick={confirm}>{busy ? (deposit > 0 && online ? (useCard ? "Paying…" : "Opening the payment page…") : "Booking…") : deposit > 0 && online ? `Pay ${money(deposit, currency)} deposit and confirm` : policy.instant === false ? "Send booking request" : "Confirm booking"}</button>
              </div>
              <div className="muted" style={{ fontSize: 12, textAlign: "right" }}>By confirming you agree to {p.name}&apos;s <Link href="/legal/cancellation" {...out}>cancellation policy</Link> and LogaLuxe&apos;s <Link href="/legal/terms" {...out}>terms</Link>.</div>
            </>
          ) : null}
        </div>

        <aside className="side">
          <div className="sum">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {p.logoId
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={`/media/${p.logoId}`} alt="" width={44} height={44} className="logoimg" />
                : <span className="avatar" style={{ width: 44, height: 44, fontSize: 14, background: p.tone }} aria-hidden="true">{initialsOf(p.name)}</span>}
              <div><b style={{ fontSize: 15 }}>{p.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{[p.place, `with ${slot || pro ? firstName(proName) : proName}`].filter(Boolean).join(" · ")}</div></div>
            </div>
            <div style={{ background: "#F4ECE2", borderRadius: 12, padding: "10px 12px", fontSize: 14 }}>
              <b>{date && time ? `${dayLabel(date)} · ${clock(time)}` : date ? dayLabel(date) : "Pick a day and time"}</b>
              <div className="muted" style={{ fontSize: 12.5 }}>{duration(mins)}{slot ? ` · ends ${ends}` : date && !time ? " · pick a time" : ""}</div>
            </div>
            <div>
              {services.map((s) => (
                <div className="line" key={s.id}><span>{s.name}</span><span>{services.length === 1 ? money(total, currency) : menuMatches ? money(s.price_cents, currency) : ""}</span></div>
              ))}
              {services.length > 1 ? <div className="line"><span className="muted">{slot && !menuMatches ? "Total at this time" : "Total"}</span><span>{money(total, currency)}</span></div> : null}
              {deposit > 0 ? <div className="line"><span className="muted">Deposit now</span><span>{money(deposit, currency)}</span></div> : null}
              <div className="line"><span className="muted">At the visit</span><span>{money(atVisit, currency)}</span></div>
              <div className="line total"><span>Due today</span><span>{money(deposit, currency)}</span></div>
            </div>
            {slot && !menuMatches && services.length === 1 ? <div className="muted" style={{ fontSize: 12.5 }}>The price for this time{staff === "any" ? " and person" : ""}. The menu price is {money(menuTotal, currency)}.</div> : null}
            {guest ? <div className="muted" style={{ fontSize: 13 }}>For <b style={{ color: "#1A1513" }}>{guest}</b></div> : null}
            <Link href={embed ? `/embed/${slug}?choose=1&services=${ids}` : `/b/${slug}?services=${ids}${src ? `&src=${src}` : ""}#services`} style={{ fontSize: 13, fontWeight: 600 }}>Change services</Link>
          </div>
          <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.55, padding: "0 4px" }}>
            {p.verified ? <span className="pill pill-ok" style={{ marginRight: 6 }}>Verified</span> : null}
            {p.verified ? `${p.name} has had its identity checked by LogaLuxe. ` : ""}
            {p.reviewCount > 0 ? `${p.reviewCount} review${p.reviewCount === 1 ? "" : "s"}, all from completed visits. ` : ""}
            With an account you can move or cancel a booking yourself while it is inside the free window.
          </div>
        </aside>
      </div>
    </>
  );
}
