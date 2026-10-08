"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { dur, firstName, money } from "@/lib/merchant-format";

type Staff = { id: string; name: string; bookable?: boolean };
type Service = { id: string; name: string; category: string; duration_min: number; price_cents: number };
type Slot = { time: string; starts_at: string; staff_id: string; staff: string; price_cents?: number };
type Found = { id: string; name: string; phone: string; email: string };

/**
 * Picks a free time. It asks the server for the open slots of the chosen day
 * and person, so a time that is already taken can never be chosen. It posts
 * `starts_at` and `staff_id` with the form it sits in.
 */
export function SlotPicker({ staff, serviceIds, exclude, date0, staff0 = "any", currency, onPick }: { staff: Staff[]; serviceIds: string[]; exclude?: string; date0: string; staff0?: string; currency?: string; onPick?: (slot: Slot | null) => void }) {
  const [date, setDate] = useState(date0);
  const [who, setWho] = useState(staff0);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [minutes, setMinutes] = useState(0);
  const [error, setError] = useState("");
  const [picked, setPickedState] = useState<Slot | null>(null);
  const setPicked = (s: Slot | null) => { setPickedState(s); onPick?.(s); };
  const key = serviceIds.join(",");

  useEffect(() => {
    setPicked(null);
    if (!key || !date) { setSlots(null); setError(""); return; }
    const stop = new AbortController();
    setSlots(null); setError("");
    fetch(`/business/calendar/lookup?${new URLSearchParams({ kind: "slots", date, services: key, staff: who, ...(exclude ? { exclude } : {}) })}`, { signal: stop.signal })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? "Could not load the free times."); setSlots(j.slots ?? []); setMinutes(j.duration_min ?? 0); })
      .catch((e) => { if (e.name !== "AbortError") setError(e.message); });
    return () => stop.abort();
  }, [key, date, who, exclude]);

  // With "anyone", the same time can be free with several people: keep each time once per person, earliest first.
  const byTime = useMemo(() => {
    const seen = new Set<string>(), out: Slot[] = [];
    for (const s of slots ?? []) { const k = who === "any" ? s.time : s.time + s.staff_id; if (!seen.has(k)) { seen.add(k); out.push(s); } }
    return out;
  }, [slots, who]);
  // Pricing rules can make one time dearer than another. Say so only when they do.
  const varies = currency !== undefined && new Set(byTime.map((s) => s.price_cents)).size > 1;

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="f2">
        <label className="fld"><span>Day</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
        <label className="fld"><span>With</span>
          <select value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="any">Anyone free</option>
            {staff.filter((s) => s.bookable !== false).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      </div>
      <div>
        <div className="slot-hd">Free times{minutes ? ` · ${dur(minutes)} needed` : ""}</div>
        {!key ? <div className="slot-note">Choose a service to see the free times.</div>
          : error ? <div className="slot-note" role="alert" style={{ color: "#9B2C2C" }}>{error}</div>
          : slots === null ? <div className="slot-note">Looking for free times…</div>
          : byTime.length === 0 ? <div className="slot-note">Nothing is free that day{who !== "any" ? " with this person" : ""}. Try another day{who !== "any" ? " or anyone free" : ""}.</div>
          : (
            <div className="slots" role="radiogroup" aria-label="Free times">
              {byTime.map((s) => {
                const on = picked?.starts_at === s.starts_at && picked.staff_id === s.staff_id;
                return (
                  <button type="button" key={s.starts_at + s.staff_id} role="radio" aria-checked={on} className={"slot" + (on ? " on" : "")} onClick={() => setPicked(s)}>
                    {s.time}{who === "any" ? <small>{firstName(s.staff)}</small> : null}{varies && s.price_cents !== undefined ? <small>{money(s.price_cents, currency)}</small> : null}
                  </button>
                );
              })}
            </div>
          )}
      </div>
      <input type="hidden" name="starts_at" value={picked?.starts_at ?? ""} />
      <input type="hidden" name="staff_id" value={picked?.staff_id ?? ""} />
      {/* A hidden required field stops the form until a time is chosen. */}
      <input className="sr" tabIndex={-1} aria-hidden="true" required value={picked ? "ok" : ""} onChange={() => {}} style={{ opacity: 0, height: 0, border: 0, padding: 0 }} />
    </div>
  );
}

/** The new booking form: who, what, then a free time. */
export function NewBookingForm({ action, back, services, staff, currency, date0, staff0, client0 }: {
  action: (fd: FormData) => void; back: string; services: Service[]; staff: Staff[]; currency: string; date0: string; staff0?: string;
  client0?: { id?: string; name?: string; phone?: string };
}) {
  const [chosen, setChosen] = useState<string[]>([]);
  const [client, setClient] = useState({ id: client0?.id ?? "", name: client0?.name ?? "", phone: client0?.phone ?? "" });
  const [found, setFound] = useState<Found[]>([]);
  const [slot, setSlot] = useState<Slot | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = (name: string) => {
    setClient({ id: "", name, phone: client.id ? "" : client.phone });
    clearTimeout(timer.current);
    if (name.trim().length < 2) { setFound([]); return; }
    timer.current = setTimeout(() => {
      fetch(`/business/calendar/lookup?${new URLSearchParams({ kind: "clients", q: name.trim() })}`).then((r) => r.json()).then((j) => setFound(j.clients ?? [])).catch(() => setFound([]));
    }, 220);
  };

  const groups = useMemo(() => {
    const m = new Map<string, Service[]>();
    for (const s of services) m.set(s.category || "Services", [...(m.get(s.category || "Services") ?? []), s]);
    return [...m.entries()];
  }, [services]);
  const picked = services.filter((s) => chosen.includes(s.id));
  const total = picked.reduce((a, s) => a + s.price_cents, 0);

  return (
    <form action={action}>
      <input type="hidden" name="back" value={back} />
      <input type="hidden" name="client_id" value={client.id} />
      <div className="f2">
        <label className="fld" style={{ position: "relative" }}><span>Client</span>
          <input name="client_name" value={client.name} onChange={(e) => search(e.target.value)} required autoComplete="off" placeholder="Name" />
          {found.length > 0 && !client.id ? (
            <div className="suggest">
              {found.map((c) => (
                <button type="button" key={c.id} onClick={() => { setClient({ id: c.id, name: c.name, phone: c.phone }); setFound([]); }}>
                  <b>{c.name}</b><small>{c.phone || c.email || "No contact saved"}</small>
                </button>
              ))}
            </div>
          ) : null}
        </label>
        <label className="fld"><span>Phone</span>
          <input name="client_phone" type="tel" value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} readOnly={!!client.id} placeholder="+1 615 555 0100" />
        </label>
      </div>
      {client.id ? <div className="slot-note">Booking for a client already in your book. <button type="button" className="linkb" onClick={() => setClient({ id: "", name: "", phone: "" })}>Change</button></div> : null}

      <div>
        <div className="slot-hd">Services</div>
        {services.length === 0 ? <div className="slot-note">Your menu is empty. Add a service first.</div> : (
          <div className="svc-pick">
            {groups.map(([cat, list]) => (
              <div key={cat}>
                <small>{cat}</small>
                {list.map((s) => (
                  <label key={s.id} className={"svc" + (chosen.includes(s.id) ? " on" : "")}>
                    <input type="checkbox" name="service_ids" value={s.id} checked={chosen.includes(s.id)} onChange={(e) => setChosen(e.target.checked ? [...chosen, s.id] : chosen.filter((x) => x !== s.id))} />
                    <span style={{ flex: 1, minWidth: 0 }}>{s.name}</span>
                    <span className="muted">{dur(s.duration_min)}</span>
                    <b>{money(s.price_cents, currency)}</b>
                  </label>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <SlotPicker staff={staff} serviceIds={chosen} date0={date0} staff0={staff0} currency={currency} onPick={setSlot} />

      <div className="f2">
        <label className="fld"><span>Booked by</span>
          <select name="source" defaultValue="phone">
            <option value="phone">Phone or message</option>
            <option value="walk_in">Walk-in</option>
            <option value="rebook">Rebooking</option>
          </select>
        </label>
        <label className="fld"><span>{slot?.price_cents !== undefined && slot.price_cents !== total ? "Total at this time" : "Total"}</span><input value={picked.length ? money(slot?.price_cents ?? total, currency) : ""} readOnly placeholder="Choose a service" tabIndex={-1} /></label>
      </div>
      <label className="fld"><span>Notes</span><textarea name="notes" maxLength={500} placeholder="Anything the stylist should know" /></label>
      <div className="sheet-ft"><button className="btn btn-ink">Book it</button></div>
    </form>
  );
}
