"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { addReviewPhoto, moveMyBooking, removeReviewPhoto, type PhotoState } from "./actions";

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
