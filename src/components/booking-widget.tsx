"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar, Icon } from "./icons";
import { money, duration, type Service, type Staff } from "@/lib/api";

type Slot = { time: string; starts_at: string; staff_id: string; staff: string; price_cents?: number };

export function BookingWidget({ slug, source = "link", currency, services, staff, groups, me, showDurations = true, instant = true, cancelHours = 24, anyone = true, multi = true }: { slug: string; /** "search" when the visitor found the business on LogaLuxe, "link" when they followed the business's own link. */ source?: string; currency: string; services: Service[]; staff: Staff[]; groups: string[]; me?: { name: string; phone: string }; showDurations?: boolean; instant?: boolean; cancelHours?: number; /** Clients may choose "anyone free". */ anyone?: boolean; /** More than one service per booking. */ multi?: boolean }) {
  const [picked, setPicked] = useState<string[]>(services[0] ? [services[0].id] : []);
  const [staffId, setStaffId] = useState<string>(anyone || !staff[0] ? "any" : staff[0].id);
  const [date, setDate] = useState<string>(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); });
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [step, setStep] = useState<"pick" | "details" | "done">("pick");
  const [name, setName] = useState(me?.name ?? ""); const [phone, setPhone] = useState(me?.phone ?? ""); const [notes, setNotes] = useState(""); const [promo, setPromo] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [booking, setBooking] = useState<Record<string, unknown> | null>(null);

  const chosen = services.filter((s) => picked.includes(s.id));
  const menuTotal = chosen.reduce((a, s) => a + s.price_cents, 0);
  // The business can price a time differently (a busy Saturday, a junior stylist). The chosen time decides.
  const total = slot?.price_cents ?? menuTotal;
  const varies = !!slots && new Set(slots.map((s) => s.price_cents)).size > 1;
  const deposit = chosen.reduce((a, s) => a + s.deposit_cents, 0);
  const mins = chosen.reduce((a, s) => a + s.duration_min + s.processing_min, 0);

  const days = useMemo(() => Array.from({ length: 10 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; }), []);

  useEffect(() => {
    if (!picked.length) { setSlots([]); return; }
    let live = true;
    setSlots(null); setSlot(null);
    fetch(`/api/availability?slug=${slug}&date=${date}&services=${picked.join(",")}&staff=${staffId}`)
      .then((r) => r.json()).then((j) => { if (live) setSlots(j.slots ?? []); }).catch(() => { if (live) setSlots([]); });
    return () => { live = false; };
  }, [slug, date, picked, staffId]);

  async function confirm() {
    if (!slot || !name) { setError("Add your name to continue."); return; }
    setBusy(true); setError("");
    const res = await fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_slug: slug, staff_id: slot.staff_id, starts_at: slot.starts_at, service_ids: picked, client_name: name, client_phone: phone, notes, source, promo_code: promo.trim() }) });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) { setError(j.error ?? "Could not book"); if (res.status === 409) { setStep("pick"); setSlot(null); setSlots(null); setDate((d) => d); } return; }
    // A deposit that is paid online: go to the secure payment page. The booking is confirmed when the payment arrives.
    if (j.booking?.payment?.url) { setBusy(true); window.location.href = j.booking.payment.url; return; }
    setBooking(j.booking); setStep("done");
  }

  if (step === "done" && booking) {
    return (
      <div className="card flex flex-col items-center gap-3 p-8 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gold"><Icon.Check width={30} height={30} strokeWidth={2.6} /></span>
        <h3 className="serif text-[32px] font-semibold leading-none">{booking.status === "requested" ? "Request sent" : "You\u2019re booked"}, {name.split(" ")[0]}.</h3>
        {booking.status === "requested" && <p className="text-[14px] font-medium text-gold-ink">This business confirms each booking itself. You will hear back soon; the time is held for you meanwhile.</p>}
        <p className="text-[15px] text-muted">{String(booking.business)} with {String(booking.staff)} · {new Date(String(booking.starts_at)).toLocaleString("en-US", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</p>
        {Number(booking.discount_cents) > 0 && <p className="text-[13.5px] font-medium text-ok">{money(Number(booking.discount_cents), currency)} off with {String(booking.promo_code)}. New total {money(Number(booking.total_cents), currency)}.</p>}
        <p className="text-[13px] text-muted">Booking {String(booking.id).slice(0, 8)} · {Number(booking.deposit_cents) > 0 ? `${money(Number(booking.deposit_cents), currency)} deposit held` : "pay at the visit"}</p>
        <button className="btn btn-out btn-sm" onClick={() => { setStep("pick"); setBooking(null); setSlot(null); setSlots(null); }}>Book another</button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div>
        {groups.map((g) => (
          <div key={g}>
            <div className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-[.08em] text-muted">{g}</div>
            {services.filter((s) => s.category === g).map((s) => {
              const on = picked.includes(s.id);
              return (
                <div key={s.id} className="flex items-center gap-3.5 border-b border-line-2 py-3.5 last:border-0">
                  <div className="min-w-0 flex-1"><b className="block text-[16px] font-semibold">{s.name}</b><span className="text-[13px] leading-snug text-muted">{[showDurations ? duration(s.duration_min + s.processing_min) : "", s.description].filter(Boolean).join(" · ")}</span></div>
                  <span className="whitespace-nowrap text-[16px] font-bold">{money(s.price_cents, currency)}</span>
                  <button type="button" aria-label={`${on ? "Remove" : "Add"} ${s.name}`} onClick={() => setPicked(on ? picked.filter((p) => p !== s.id) : multi ? [...picked, s.id] : [s.id])} className={`flex h-11 w-11 flex-none items-center justify-center rounded-full border-[1.5px] border-ink ${on ? "bg-ink text-cream" : "bg-white text-ink"}`}>{on ? <Icon.Check /> : <Icon.Plus />}</button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="card flex flex-col gap-3 self-start p-4.5 p-[18px]">
        <div className="flex items-center justify-between"><div><div className="text-[11px] font-semibold uppercase tracking-[.06em] text-muted">{chosen.length} service{chosen.length === 1 ? "" : "s"}</div><b className="text-[22px] font-bold">{money(total, currency)}</b></div><span className="text-[13px] text-muted">{duration(mins)}</span></div>

        {step === "pick" && (
          <>
            <div className="text-[11px] font-semibold uppercase tracking-[.08em] text-muted">With</div>
            <div className="flex flex-wrap gap-1.5">
              {(anyone || staff.length === 0) && <button onClick={() => setStaffId("any")} className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold ${staffId === "any" ? "border-ink bg-ink text-cream" : "border-line bg-white"}`}>Anyone</button>}
              {staff.map((s) => <button key={s.id} onClick={() => setStaffId(s.id)} className={`flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-[12.5px] font-semibold ${staffId === s.id ? "border-ink bg-ink text-cream" : "border-line bg-white"}`}><Avatar initials={s.initials} tone={s.tone} size={22} />{s.name.split(" ")[0]}</button>)}
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-[.08em] text-muted">Day</div>
            <div className="grid grid-cols-5 gap-1.5">
              {days.map((d) => { const v = d.toISOString().slice(0, 10); const on = v === date; return <button key={v} onClick={() => setDate(v)} className={`flex flex-col items-center rounded-xl border py-1.5 text-[11px] ${on ? "border-ink bg-ink text-cream" : "border-line bg-white text-muted"}`}><span>{d.toLocaleDateString("en-US", { weekday: "short" })}</span><b className={`text-[15px] ${on ? "text-cream" : "text-ink"}`}>{d.getDate()}</b></button>; })}
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-[.08em] text-muted">Open times</div>
            {slots === null && <div className="text-[13px] text-muted">Checking the calendar…</div>}
            {slots && slots.length === 0 && <div className="rounded-xl bg-warn-bg px-3 py-2.5 text-[13px] text-gold-ink">Nothing open that day for {duration(mins)}. Try another day or professional.</div>}
            {varies && <div className="text-[12px] text-muted">The price depends on the day, the time and who you choose.</div>}
            {slots && slots.length > 0 && (
              <div className="grid max-h-[180px] grid-cols-3 gap-1.5 overflow-auto">
                {slots.map((s) => <button key={s.starts_at + s.staff_id} onClick={() => setSlot(s)} className={`flex flex-col items-center rounded-xl border py-1.5 ${slot?.starts_at === s.starts_at && slot?.staff_id === s.staff_id ? "border-ink bg-ink text-cream" : "border-line bg-white"}`}><b className="text-[14px]">{s.time}</b>{staffId === "any" && <span className={`text-[10.5px] ${slot === s ? "text-[#C9BCB0]" : "text-muted"}`}>{s.staff.split(" ")[0]}</span>}{varies && s.price_cents !== undefined && <span className={`text-[10.5px] ${slot === s ? "text-[#C9BCB0]" : "text-muted"}`}>{money(s.price_cents, currency)}</span>}</button>)}
              </div>
            )}
            <button disabled={!slot || !chosen.length} onClick={() => setStep("details")} className="btn btn-ink disabled:opacity-40">{slot ? `Continue · ${slot.time}` : "Pick a time"}</button>
          </>
        )}

        {step === "details" && slot && (
          <>
            <div className="rounded-xl bg-cream-2 px-3 py-2.5 text-[14px]"><b>{new Date(slot.starts_at).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" })} · {slot.time}</b><div className="text-[12.5px] text-muted">with {slot.staff} · {duration(mins)}</div></div>
            {me ? <p className="text-[12.5px] text-ok">Signed in. This booking will be saved to your account.</p> : <p className="text-[12.5px] text-muted"><a href={`/signin?next=/b/${slug}`} className="font-semibold text-wine">Sign in</a> to keep this booking in your account, or carry on as a guest.</p>}
            <label className="field"><span>First and last name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kemi Adeyemi" /></label>
            <label className="field"><span>Mobile · for reminders</span><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 615 555 0144" /></label>
            <label className="field"><span>Note · optional</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Hair length, allergies…" /></label>
            <label className="field"><span>Promo code · optional</span><input value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} placeholder="WELCOME10" autoCapitalize="characters" style={{ fontFamily: "ui-monospace, monospace", letterSpacing: ".04em" }} /></label>
            {deposit > 0 && <div className="rounded-xl bg-ok-bg px-3 py-2.5 text-[12.5px] text-ok">{money(deposit, currency)} deposit holds the slot and comes off the total. Free cancellation until {cancelHours} h before.</div>}
            {error && <div className="rounded-xl bg-bad-bg px-3 py-2.5 text-[13px] text-bad">{error}</div>}
            <div className="flex gap-2"><button className="btn btn-out" onClick={() => setStep("pick")}>Back</button><button disabled={busy} className="btn btn-ink flex-1" onClick={confirm}>{busy ? "Booking…" : deposit ? `Pay ${money(deposit, currency)} and confirm` : "Confirm booking"}</button></div>
          </>
        )}
        <div className="text-[12px] leading-relaxed text-muted">{instant ? "Confirmed at once" : "The business confirms each request"} · free to cancel until {cancelHours} h before · the calendar never double-books.</div>
      </div>
    </div>
  );
}
