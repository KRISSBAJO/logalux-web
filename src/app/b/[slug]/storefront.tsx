"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { duration, money, type Service, type Staff } from "@/lib/api";
import { Pic } from "@/components/pic";
import type { Media } from "@/lib/media";
import { bookHref, clock, dayLabel, firstName, initialsOf, inZone, type Breakdown, type Policy, type Slot, type StoreProduct, type StoreReview } from "./shared";
import { useUrlState } from "./url-state";

type Props = {
  slug: string; src: string; name: string; ownerFirst: string; currency: string; tz: string;
  services: Service[]; staff: Staff[]; showDurations: boolean; showFrom: boolean; showReviews: boolean;
  reviews: StoreReview[]; breakdown: Breakdown; rating: number; reviewCount: number; summary: string;
  products: (StoreProduct & { img?: Media })[]; about: string; policy: Policy;
  /** The "Where" and "Good to know" cards, drawn on the server. */
  aside: ReactNode;
};

const TONES = ["#7A1F2B", "#2E2538", "#4A3426", "#1F2A33", "#3A3A2E", "#4A2A2A", "#5A4A3A"];
const toneFor = (name: string) => TONES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length];
const stars = (n: number) => "★★★★★☆☆☆☆☆".slice(5 - Math.round(n), 10 - Math.round(n));
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PER_PAGE = 10;

function reviewDate(at: string, tz: string) {
  const [y, m, d] = inZone(at, tz).date.split("-").map(Number);
  return `${d} ${MON[m - 1]}${y !== new Date().getFullYear() ? ` ${y}` : ""}`;
}

function ReviewRow({ r, tz, ownerFirst }: { r: StoreReview; tz: string; ownerFirst: string }) {
  return (
    <div className="rev">
      <span className="avatar" style={{ background: toneFor(r.author_name) }} aria-hidden="true">{initialsOf(r.author_name)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><b>{r.author_name}</b><span className="muted" style={{ fontSize: 12.5, textAlign: "right" }}>{[reviewDate(r.created_at, tz), r.service_name].filter(Boolean).join(" · ")}</span></div>
        <div className="stars" style={{ fontSize: 12 }} role="img" aria-label={`${r.rating} out of 5`}>{stars(r.rating)}</div>
        <p>{r.body}</p>
        {r.reply ? <div className="reply"><b>{ownerFirst || "The business"} replied:</b> {r.reply}</div> : null}
      </div>
    </div>
  );
}

export function Storefront(p: Props) {
  const { slug, src, currency, tz, services, policy } = p;
  const [sp, setUrl] = useUrlState();
  const multi = policy.multi_service !== false;

  // ----- chosen services: in the address, so a reload or a shared link keeps them -----
  const raw = sp.get("services");
  const picked = useMemo(() => {
    if (raw === null) return services[0] ? [services[0].id] : [];
    const ids = raw.split(",").filter((id) => services.some((s) => s.id === id));
    return multi ? ids : ids.slice(0, 1);
  }, [raw, services, multi]);
  const chosen = services.filter((s) => picked.includes(s.id));
  const key = picked.join(",");
  const toggle = (id: string) => {
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : multi ? [...picked, id] : [id];
    setUrl({ services: next.length ? next.join(",") : "none" });
  };
  const menuTotal = chosen.reduce((a, s) => a + s.price_cents, 0);
  const deposit = Math.min(menuTotal, chosen.reduce((a, s) => a + s.deposit_cents, 0));
  const mins = chosen.reduce((a, s) => a + s.duration_min + s.processing_min, 0);

  // ----- the next free times for what is chosen -----
  const [openings, setOpenings] = useState<{ key: string; slots: Slot[]; failed?: boolean } | null>(null);
  useEffect(() => {
    if (!key) return;
    let live = true;
    fetch(`/api/businesses/${slug}/openings?services=${key}&staff=any&limit=6`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => { if (live) setOpenings({ key, slots: j.slots ?? [] }); })
      .catch(() => { if (live) setOpenings({ key, slots: [], failed: true }); });
    return () => { live = false; };
  }, [slug, key]);
  const ready = !!key && openings?.key === key;
  const slots = ready ? openings!.slots : [];
  const oneStaff = slots.length > 0 && slots.every((s) => s.staff_id === slots[0].staff_id);
  const lowest = slots.length ? Math.min(...slots.map((s) => s.price_cents)) : menuTotal;
  const total = p.showFrom && slots.length && lowest < menuTotal ? `from ${money(lowest, currency)}` : money(menuTotal, currency);
  const slotHref = (s: Slot) => bookHref(slug, { services: picked, staff: s.staff_id, date: inZone(s.starts_at, tz).date, time: s.time, src });
  const allHref = bookHref(slug, { services: picked, src });
  const first = slots[0];
  const cta = !chosen.length ? "Choose a service" : first ? `Book ${dayLabel(inZone(first.starts_at, tz).date)} at ${clock(first.time)}` : "Book a time";
  const ctaHref = first ? slotHref(first) : allHref;
  const count = `${chosen.length} service${chosen.length === 1 ? "" : "s"}`;

  // ----- tabs: each one takes the visitor to its part of the page -----
  const tabs = [
    ["services", "Services", true], ["team", "Team", p.staff.length > 0], ["reviews", "Reviews", p.showReviews],
    ["shop", "Shop", p.products.length > 0], ["about", "About", !!p.about],
  ].filter((t) => t[2]) as [string, string, boolean][];
  const [tab, setTab] = useState("services");
  const jumping = useRef(0);
  useEffect(() => {
    const ids = ["services", "team", "reviews", "shop", "about"];
    const h = window.location.hash.slice(1);
    if (ids.includes(h)) setTab(h);
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (Date.now() < jumping.current) return;
      const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (seen) setTab(seen.target.id);
    }, { rootMargin: "-15% 0px -70% 0px" });
    ids.forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);
  const go = (id: string) => {
    setTab(id);
    jumping.current = Date.now() + 900;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setUrl({}, { hash: `#${id}` });
  };

  // ----- reviews: three to start with, then every one, a page at a time, with a star filter -----
  const all = sp.get("reviews") === "all";
  const page = Math.max(1, Number(sp.get("rpage")) || 1);
  const starFilter = [1, 2, 3, 4, 5].includes(Number(sp.get("stars"))) ? Number(sp.get("stars")) : 0;
  const rkey = `${page}:${starFilter}`;
  const [paged, setPaged] = useState<{ key: string; reviews: StoreReview[]; total: number; failed?: boolean } | null>(null);
  useEffect(() => {
    if (!all) return;
    let live = true;
    fetch(`/api/businesses/${slug}/reviews?page=${page}${starFilter ? `&stars=${starFilter}` : ""}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => { if (live) setPaged({ key: rkey, reviews: j.reviews ?? [], total: Number(j.total) || 0 }); })
      .catch(() => { if (live) setPaged({ key: rkey, reviews: [], total: 0, failed: true }); });
    return () => { live = false; };
  }, [all, slug, page, starFilter, rkey]);
  const bd = p.breakdown;
  const totalReviews = Number(bd.all ?? p.reviewCount) || 0;
  const pagedReady = all && paged?.key === rkey;
  const pages = pagedReady ? Math.max(1, Math.ceil(paged!.total / PER_PAGE)) : 1;
  const showReviews = (changes: Record<string, string | null>) => {
    setUrl({ reviews: "all", ...changes });
    jumping.current = Date.now() + 900;
    document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const anyDeposit = services.some((s) => s.deposit_cents > 0);

  return (
    <>
      <div className="layout">
        <div className="left">
          <div className="tabs" role="navigation" aria-label="Sections of this page">
            {tabs.map(([id, label]) => <button key={id} type="button" className={tab === id ? "on" : ""} aria-current={tab === id ? "true" : undefined} onClick={() => go(id)}>{label}</button>)}
          </div>

          <section className="sec" id="services">
            <h2 className="serif">Services</h2>
            <div className="muted" style={{ fontSize: 13.5, marginBottom: 6 }}>
              {multi ? "Tap to add." : "Tap to choose one. This business takes one service per booking."} Prices are what you pay{anyDeposit ? "; where a deposit is asked, it holds your slot and comes off the total." : "."}
            </div>
            {services.length === 0 ? <p className="muted" style={{ fontSize: 14 }}>This business has not put its services online yet.</p> : null}
            {[...new Set(services.map((s) => s.category))].map((g) => (
              <div key={g}>
                <div className="muted" style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", margin: "16px 0 4px" }}>{g}</div>
                {services.filter((s) => s.category === g).map((s) => {
                  const on = picked.includes(s.id);
                  const sub = [p.showDurations ? duration(s.duration_min + s.processing_min) : "", s.description, s.deposit_cents > 0 ? `${money(s.deposit_cents, currency)} deposit` : ""].filter(Boolean).join(" · ");
                  return (
                    <div className="svc" key={s.id}>
                      <div style={{ flex: 1, minWidth: 0 }}><b>{s.name}</b><span>{sub}</span></div>
                      <span className="p">{money(s.price_cents, currency)}</span>
                      <button type="button" className={`sel${on ? " on" : ""}`} onClick={() => toggle(s.id)} aria-pressed={on} aria-label={`${on ? "Remove" : "Add"} ${s.name}`}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={on ? "M20 6 9 17l-5-5" : "M12 5v14M5 12h14"} /></svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </section>

          {p.staff.length > 0 ? (
            <section className="sec" id="team">
              <h2 className="serif">Team</h2>
              <div className="team">
                {p.staff.map((s) => (
                  <div className="tm" key={s.id}>
                    <span className="avatar" style={{ width: 48, height: 48, fontSize: 15, background: s.tone }} aria-hidden="true">{s.initials}</span>
                    <b>{s.name}</b>
                    <span>{[s.role === "owner" ? "Owner" : "", s.level ? (s.role === "owner" ? s.level : s.level[0].toUpperCase() + s.level.slice(1)) : "", Number(s.rating) ? Number(s.rating).toFixed(1) : ""].filter(Boolean).join(" · ")}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {p.showReviews ? (
            <section className="sec" id="reviews">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <h2 className="serif">{totalReviews ? `${p.rating.toFixed(1)} · ${totalReviews} review${totalReviews === 1 ? "" : "s"}` : "Reviews"}</h2>
                <span className="muted" style={{ fontSize: 13 }}>Only clients with a completed, paid booking can review</span>
              </div>
              {totalReviews > 0 ? (
                <div className="bd" aria-label="Reviews by star rating">
                  {[5, 4, 3, 2, 1].map((n) => {
                    const c = Number(bd[`s${n}` as keyof Breakdown]) || 0;
                    return (
                      <button type="button" key={n} className={all && starFilter === n ? "on" : ""} disabled={!c} onClick={() => showReviews({ stars: String(n), rpage: null })} aria-label={`${c} review${c === 1 ? "" : "s"} with ${n} star${n === 1 ? "" : "s"}. Show them.`}>
                        <span>{n} ★</span><i><em style={{ width: `${Math.round((c / totalReviews) * 100)}%` }} /></i><span>{c}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {p.summary ? <div style={{ background: "#F4ECE2", borderRadius: 14, padding: "12px 14px", fontSize: 14, lineHeight: 1.55, marginBottom: 6 }}><b>What people say:</b> {p.summary}</div> : null}
              {totalReviews === 0 ? <p className="muted" style={{ fontSize: 14, margin: 0 }}>No reviews yet.</p> : null}

              {!all ? (
                <>
                  {p.reviews.slice(0, 3).map((r) => <ReviewRow key={r.id} r={r} tz={tz} ownerFirst={p.ownerFirst} />)}
                  {totalReviews > 3 ? <button type="button" className="btn btn-out" style={{ alignSelf: "flex-start", marginTop: 8 }} onClick={() => setUrl({ reviews: "all", rpage: null, stars: null })}>Read all {totalReviews}</button> : null}
                </>
              ) : (
                <>
                  <div className="chips" style={{ margin: "10px 0 2px" }} role="group" aria-label="Filter reviews by stars">
                    <button type="button" className={`chip${starFilter === 0 ? " on" : ""}`} aria-pressed={starFilter === 0} onClick={() => setUrl({ stars: null, rpage: null })}>All {totalReviews}</button>
                    {[5, 4, 3, 2, 1].filter((n) => Number(bd[`s${n}` as keyof Breakdown]) > 0).map((n) => (
                      <button type="button" key={n} className={`chip${starFilter === n ? " on" : ""}`} aria-pressed={starFilter === n} onClick={() => setUrl({ stars: String(n), rpage: null })}>{n} ★ · {Number(bd[`s${n}` as keyof Breakdown])}</button>
                    ))}
                  </div>
                  <div aria-live="polite">
                    {!pagedReady ? <p className="muted" style={{ fontSize: 14 }}>Loading reviews…</p> : null}
                    {pagedReady && paged!.failed ? <p className="muted" style={{ fontSize: 14 }}>We could not load the reviews. Try again in a moment.</p> : null}
                    {pagedReady && !paged!.failed && paged!.reviews.length === 0 ? <p className="muted" style={{ fontSize: 14 }}>No reviews match.</p> : null}
                    {pagedReady ? paged!.reviews.map((r) => <ReviewRow key={r.id} r={r} tz={tz} ownerFirst={p.ownerFirst} />) : null}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
                    {pages > 1 ? (
                      <>
                        <button type="button" className="btn btn-out btn-sm" disabled={page <= 1} onClick={() => showReviews({ rpage: page - 1 > 1 ? String(page - 1) : null })}>Previous</button>
                        <span className="muted" style={{ fontSize: 13 }}>Page {page} of {pages}</span>
                        <button type="button" className="btn btn-out btn-sm" disabled={page >= pages} onClick={() => showReviews({ rpage: String(page + 1) })}>Next</button>
                      </>
                    ) : null}
                    <button type="button" className="btn btn-out btn-sm" style={{ marginLeft: "auto" }} onClick={() => setUrl({ reviews: null, rpage: null, stars: null })}>Show fewer</button>
                  </div>
                </>
              )}
            </section>
          ) : null}

          {p.products.length > 0 ? (
            <section className="sec" id="shop">
              <h2 className="serif">Shop the studio</h2>
              <div className="prod">
                {p.products.map((x) => (
                  <Link href={`/shop/${x.slug}`} className="pr" key={x.slug}>
                    <div className="ph" style={{ background: x.tone }}><Pic img={x.img} /></div>
                    <div><b>{x.name}</b><span>{money(x.price_cents, "USD")}{Number(x.review_count) > 0 ? ` · ${Number(x.rating).toFixed(1)} ★ (${x.review_count})` : ""}</span></div>
                  </Link>
                ))}
                <Link href={`/shop?seller=${slug}`} className="pr">
                  <div className="ph" style={{ background: "#1A1513" }} />
                  <div><b>All products</b><span>Everything {p.name} sells</span></div>
                </Link>
              </div>
            </section>
          ) : null}

          {p.about ? (
            <section className="sec" id="about">
              <h2 className="serif">About</h2>
              <p className="about" style={{ margin: 0 }}>{p.about}</p>
            </section>
          ) : null}
        </div>

        <aside className="side">
          <div className="stick">
            <div className="book">
              <div className="tot"><div><small>{count}</small><b>{total}</b></div><span className="muted" style={{ fontSize: 13 }}>{p.showDurations ? duration(mins) : ""}</span></div>
              <div className="muted" style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase" }}>Next openings{oneStaff ? ` with ${firstName(slots[0].staff)}` : ""}</div>
              <div aria-live="polite">
                {!key ? <div className="muted" style={{ fontSize: 13 }}>Choose a service to see free times.</div> : null}
                {key && !ready ? <div className="muted" style={{ fontSize: 13 }}>Checking the calendar…</div> : null}
                {ready && openings!.failed ? <div className="muted" style={{ fontSize: 13 }}>We could not check the calendar. See all times to try again.</div> : null}
                {ready && !openings!.failed && slots.length === 0 ? <div className="muted" style={{ fontSize: 13 }}>Nothing free in the next four weeks for {chosen.length > 1 ? "these services together" : "this service"}. See all times to look further ahead{policy.waitlist !== false ? " or join the waitlist" : ""}.</div> : null}
                {slots.length > 0 ? (
                  <div className="slots">
                    {slots.slice(0, 5).map((s) => {
                      const day = dayLabel(inZone(s.starts_at, tz).date);
                      return <Link key={s.starts_at + s.staff_id} href={slotHref(s)} className="slot" aria-label={`Book ${day} at ${clock(s.time)} with ${s.staff}`}><b>{clock(s.time)}</b><span>{day}</span></Link>;
                    })}
                    <Link href={allHref} className="slot"><b>More</b><span>all times</span></Link>
                  </div>
                ) : null}
              </div>
              {chosen.length ? <Link href={ctaHref} className="btn btn-ink" style={{ minHeight: 50 }}>{cta}</Link> : <button type="button" className="btn btn-ink" style={{ minHeight: 50 }} disabled>{cta}</button>}
              {chosen.length ? <Link href={allHref} className="btn btn-out btn-sm">See all times</Link> : null}
              <div className="pol">
                {[policy.instant === false ? "The business confirms each request" : "Instant confirmation", chosen.length ? (deposit > 0 ? `${money(deposit, currency)} deposit` : "no deposit") : "", (policy.cancel_hours ?? 24) > 0 ? `free cancellation until ${policy.cancel_hours ?? 24} h before` : "free cancellation"].filter(Boolean).join(" · ")}
              </div>
            </div>
          </div>
          {p.aside}
        </aside>
      </div>

      {/* On a phone the summary card sits far below the menu, so the total and the way forward stay in reach. */}
      {chosen.length ? (
        <div className="bar">
          <div><small>{count}{p.showDurations && mins ? ` · ${duration(mins)}` : ""}</small><b>{total}</b></div>
          <Link href={ctaHref} className="btn btn-ink">{first ? `Book ${clock(first.time)}, ${dayLabel(inZone(first.starts_at, tz).date)}` : "Book a time"}</Link>
        </div>
      ) : null}
    </>
  );
}
