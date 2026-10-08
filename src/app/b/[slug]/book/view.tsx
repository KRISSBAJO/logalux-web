import "@/app/cx-css/book.css";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { api, duration, money } from "@/lib/api";
import { customerApi, getCustomer } from "@/lib/customer";
import { BookFlow, GuestLine, type Pro } from "./flow";
import { RepeatCard } from "./repeat";
import { EmbedBridge } from "@/app/embed/[slug]/bridge";
import { clock, dayLabel, firstName, initialsOf, inZone, whenLabel, type Payload, type Slot } from "../shared";

// The booking flow and its confirmation. Shown as a full page at /b/<slug>/book, and without the
// site's header and footer at /embed/<slug>, inside a frame on the business's own website.

const SOURCES = ["search", "marketplace", "category", "app"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Booking = {
  id: string; status: string; starts_at: string; ends_at: string; client_name: string; total_cents: number; discount_cents: number; promo_code: string;
  deposit_cents: number; deposit_paid: boolean; business: string; business_slug: string; currency: string; timezone: string; staff: string;
  address?: string | null; city?: string | null; items: { name: string; price_cents: number; duration_min: number }[];
  payment?: { url: string; amount_cents: number; currency: string; expires_at?: string };
  /** Who is coming, when it is not the person who booked. */
  guest_name?: string;
};
export type BookSearch = { services?: string; src?: string; booking?: string };

/** The top of the embedded page: whose booking page this is. */
export function EmbedHead({ name, tone, logoId }: { name: string; tone: string; logoId?: string | null }) {
  return (
    <div className="ehead">
      {logoId
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={`/media/${logoId}`} alt="" width={44} height={44} className="logoimg" />
        : <span className="avatar" style={{ width: 44, height: 44, fontSize: 14, background: tone }} aria-hidden="true">{initialsOf(name)}</span>}
      <div style={{ minWidth: 0 }}><h1 className="serif">{name}</h1><div className="muted" style={{ fontSize: 12.5 }}>Book online</div></div>
    </div>
  );
}

export function EmbedFoot() {
  return <div className="efoot"><a href="/" target="_blank" rel="noopener">Powered by LogaLuxe</a><EmbedBridge /></div>;
}

const SHIELD = "M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z";

function Crumb({ slug, name, src }: { slug: string; name: string; src: string }) {
  return (
    <div className="crumb">
      <Link href={`/b/${slug}${src ? `?src=${src}` : ""}`} className="btn btn-out btn-sm">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>{name}
      </Link>
      <span className="secure muted">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={SHIELD} /></svg>
        Secure booking · card details never touch LogaLuxe
      </span>
    </div>
  );
}

export async function BookView({ slug, sp, embed = false }: { slug: string; sp: BookSearch; embed?: boolean }) {
  // A booking made on the business's own website is the business's own link, whatever the address says.
  const src = !embed && SOURCES.includes(sp.src ?? "") ? sp.src! : "";
  let data: Payload;
  try {
    // No `src` here: the business page has already counted this visit.
    data = await customerApi<Payload>(`/businesses/${encodeURIComponent(slug)}`, { auth: false });
  } catch {
    notFound();
  }
  const { business: b, locations, staff, services } = data;
  const display = data.display ?? {}, policy = data.policy ?? {};
  const tz = b.timezone || "UTC";
  const loc = locations.find((l) => l.is_primary) ?? locations[0];
  const me = await getCustomer();

  // ---------- after booking: what was booked ----------
  if (sp.booking) {
    let bk: Booking | null = null;
    if (UUID.test(sp.booking)) {
      try { bk = (await api.get<{ booking: Booking }>(`/v1/bookings/${sp.booking}`)).booking; } catch {}
    }
    if (!bk || bk.business_slug !== b.slug) notFound();
    // Only the person whose account holds the booking can make it repeat.
    // The account's copy also says who the booking is for, which the public copy does not.
    let mine = false;
    if (me) {
      try {
        const own = (await customerApi<{ booking: { id: string; guest_name?: string } }>(`/auth/bookings/${bk.id}`)).booking;
        mine = !!own;
        if (own?.guest_name) bk.guest_name = own.guest_name;
      } catch {}
    }
    return <Confirmation bk={bk} name={b.name} slug={b.slug} src={src} signedIn={!!me} mine={mine} embed={embed} logoId={b.logo_id ?? null} verified={b.verification_status === "verified"} place={loc?.name ?? ""} tone={b.tone} cancelHours={policy.cancel_hours ?? 24} />;
  }

  // ---------- the services being booked ----------
  let chosen = (sp.services ?? "").split(",").map((id) => services.find((s) => s.id === id)).filter((s): s is NonNullable<typeof s> => !!s);
  chosen = chosen.filter((s, i) => chosen.indexOf(s) === i);
  if (policy.multi_service === false) chosen = chosen.slice(0, 1);
  if (chosen.length === 0) redirect(embed ? `/embed/${b.slug}` : `/b/${b.slug}${src ? `?src=${src}` : ""}#services`);
  const ids = chosen.map((s) => s.id).join(",");

  // ---------- who can do them ----------
  // Only people who perform every chosen service are offered. Each is asked for their next free times,
  // which also gives the price they charge.
  const anyone = policy.anyone !== false;
  const hideStaff = display.show_staff === false && anyone;
  const able = staff.filter((s) => { const can = (s as { service_ids?: string[] }).service_ids; return !can || chosen.every((c) => can.includes(c.id)); });
  const probes = hideStaff ? [] : await Promise.all(able.map(async (s) => {
    try {
      return { s, slots: (await api.get<{ slots: Slot[] }>(`/v1/businesses/${encodeURIComponent(b.slug)}/openings?services=${ids}&staff=${s.id}&limit=6`)).slots ?? [] };
    } catch {
      return { s, slots: [] as Slot[] };
    }
  }));
  const withTimes = probes.filter((x) => x.slots.length > 0);
  // Nobody has a time in the next four weeks: show everyone rather than nobody, and let the calendar speak.
  const offered = withTimes.length > 0 ? withTimes : anyone ? [] : probes;
  const pros: Pro[] = offered.map(({ s, slots }) => {
    const prices = slots.map((x) => x.price_cents);
    const lo = prices.length ? Math.min(...prices) : 0, hi = prices.length ? Math.max(...prices) : 0;
    const role = s.role === "owner" ? "Owner" : s.level ? s.level[0].toUpperCase() + s.level.slice(1) : "";
    return {
      id: s.id, name: s.name, initials: s.initials || initialsOf(s.name), tone: s.tone,
      sub: [role, Number(s.rating) ? Number(s.rating).toFixed(1) : "", prices.length ? (lo === hi ? money(lo, b.currency) : `from ${money(lo, b.currency)}`) : ""].filter(Boolean).join(" · "),
    };
  });

  // The business's own questions: those for every booking, and those for a service being booked.
  const intake = (data.intake ?? []).filter((q) => !q.service_id || chosen.some((c) => c.id === q.service_id)).sort((x, y) => (x.sort ?? 0) - (y.sort ?? 0));

  return (
    <>
      {embed ? null : <SiteHeader active="book" />}
      <div className={`cx pg-book${embed ? " embed" : ""}`}>
        <main className="wrap">
          {embed ? <EmbedHead name={b.name} tone={b.tone} logoId={b.logo_id} /> : <Crumb slug={b.slug} name={b.name} src={src} />}
          <BookFlow
            intake={intake} embed={embed}
            slug={b.slug} src={src} name={b.name} tone={b.tone} logoId={b.logo_id ?? null} currency={b.currency} tz={tz} market={b.market}
            place={loc?.name ?? ""} verified={b.verification_status === "verified"} reviewCount={display.show_reviews === false ? 0 : Number(b.review_count) || 0}
            services={chosen} pros={pros} anyone={anyone || pros.length === 0} policy={policy} today={inZone(new Date(), tz).date}
            me={me ? { first: me.first_name ?? "", last: me.last_name ?? "", phone: me.phone ?? "", email: me.email ?? "" } : null}
          />
          {embed ? <EmbedFoot /> : null}
        </main>
      </div>
      {embed ? null : <SiteFooter />}
    </>
  );
}

function Confirmation({ bk, name, slug, src, signedIn, mine, embed, logoId, verified, place, tone, cancelHours }: { bk: Booking; name: string; slug: string; src: string; signedIn: boolean; mine: boolean; embed: boolean; logoId: string | null; verified: boolean; place: string; tone: string; cancelHours: number }) {
  // Inside a frame on another site, only the booking page itself may be shown: everything else opens in a new tab.
  const out = embed ? { target: "_blank", rel: "noopener" } : {};
  const guest = (bk.guest_name ?? "").trim();
  const here = `/b/${slug}/book?booking=${bk.id}`;
  const tz = bk.timezone || "UTC";
  const cur = bk.currency;
  const cancelled = bk.status.startsWith("cancel");
  const requested = bk.status === "requested";
  const unpaid = !cancelled && !!bk.payment?.url;
  const client = firstName(bk.client_name);
  const what = bk.items.map((i) => i.name).join(" + ") || "Appointment";
  // The booking's own end time includes the business's clean-up time after the visit, so the length comes from the services.
  const mins = bk.items.reduce((n, i) => n + (Number(i.duration_min) || 0), 0);
  const atVisit = Math.max(0, bk.total_cents - (bk.deposit_cents || 0));
  const start = inZone(bk.starts_at, tz);
  const messageTo = `/account?to=${slug}#messages`;
  const freeUntil = new Date(new Date(bk.starts_at).getTime() - cancelHours * 3600_000);
  const title = cancelled ? "This booking was cancelled" : unpaid ? `One step left${client ? `, ${client}` : ""}.` : `${requested ? "Request sent" : "You’re booked"}${client ? `, ${client}` : ""}.`;
  const where = [bk.address, bk.city].filter(Boolean).join(", ");
  return (
    <>
      {embed ? null : <SiteHeader active="book" />}
      <div className={`cx pg-book${embed ? " embed" : ""}`}>
        <main className="wrap">
          {embed ? <EmbedHead name={name} tone={tone} logoId={logoId} /> : <Crumb slug={slug} name={name} src={src} />}
          <div className="steps" aria-label="Booking steps">
            <span className="step done"><span className="n">1</span>Who and when</span><i />
            <span className="step done"><span className="n">2</span>Your details</span><i />
            <span className={`step ${unpaid ? "on" : "done"}`}><span className="n">3</span>{bk.deposit_cents > 0 ? "Confirm and pay" : "Confirm"}</span>
          </div>
          <div className="layout">
            <div className="left">
              <div className="card">
                <div className="done">
                  {!cancelled && !unpaid ? <span className="ck"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#1A1513" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg></span> : null}
                  <h2 className="serif" style={{ fontSize: 36 }}>{title}</h2>
                  <div className="muted" style={{ fontSize: 15 }}>{what} with {firstName(bk.staff)} · {whenLabel(bk.starts_at, tz, " · ")}.{where ? ` ${where}.` : ""}</div>
                  <GuestLine id={bk.id} name={guest} />
                  {requested && !unpaid ? <div className="muted" style={{ fontSize: 14 }}>{name} confirms each booking itself. The time is held for you until you hear back.</div> : null}
                  {unpaid ? <div className="muted" style={{ fontSize: 14 }}>Your {money(bk.payment!.amount_cents, bk.payment!.currency || cur)} deposit is not paid yet{bk.payment!.expires_at ? `. The time is held until ${whenLabel(bk.payment!.expires_at, tz)}` : ""}. You pay on the provider&apos;s secure page. LogaLuxe never sees your card.</div> : null}
                  {!cancelled && !unpaid && bk.discount_cents > 0 ? <div className="ok">{money(bk.discount_cents, cur)} off with {bk.promo_code}. The total is now {money(bk.total_cents, cur)}.</div> : null}
                  {!cancelled && !unpaid && cancelHours > 0 && freeUntil.getTime() > Date.now() ? <div className="muted" style={{ fontSize: 13.5 }}>Free to cancel until {whenLabel(freeUntil, tz)}.</div> : null}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                    {unpaid ? <a href={bk.payment!.url} target={embed ? "_top" : undefined} className="btn btn-ink">Pay {money(bk.payment!.amount_cents, bk.payment!.currency || cur)} deposit</a> : null}
                    {!cancelled && !unpaid ? <a href={`/api/bookings/${bk.id}/calendar`} {...out} className="btn btn-out">Add to calendar</a> : null}
                    <Link href={signedIn ? messageTo : `/signin?next=${encodeURIComponent(messageTo)}`} {...out} className="btn btn-out">Message {name}</Link>
                    {cancelled ? <Link href={embed ? `/embed/${slug}` : `/b/${slug}${src ? `?src=${src}` : ""}`} className="btn btn-ink">Book again</Link> : !unpaid ? <Link href="/account" {...out} className={`btn ${signedIn ? "btn-ink" : "btn-out"}`}>{signedIn ? "See your bookings" : "Sign in to your account"}</Link> : null}
                  </div>
                  <div className="muted" style={{ fontSize: 12.5 }}>Booking reference {bk.id.slice(0, 8).toUpperCase()}</div>
                </div>
              </div>
              {cancelled || unpaid ? null : mine ? (
                <div className="card">
                  <h2 className="serif">Make this a regular visit</h2>
                  <RepeatCard id={bk.id} startsAt={bk.starts_at} tz={tz} currency={cur} business={name} look="book" />
                </div>
              ) : !signedIn ? (
                <div className="muted" style={{ fontSize: 13.5, padding: "0 4px" }}>
                  Want this as a regular visit? <Link href={`/signin?next=${encodeURIComponent(here)}`} {...out} style={{ fontWeight: 600 }}>Sign in</Link> and you can repeat a booking every few weeks.
                </div>
              ) : null}
            </div>
            <aside className="side">
              <div className="sum">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className="avatar" style={{ width: 44, height: 44, fontSize: 14, background: tone }} aria-hidden="true">{initialsOf(name)}</span>
                  <div><b style={{ fontSize: 15 }}>{name}</b><div className="muted" style={{ fontSize: 12.5 }}>{[place, `with ${firstName(bk.staff)}`].filter(Boolean).join(" · ")}</div></div>
                </div>
                <div style={{ background: "#F4ECE2", borderRadius: 12, padding: "10px 12px", fontSize: 14 }}>
                  <b>{dayLabel(start.date)} · {clock(start.time)}</b>
                  <div className="muted" style={{ fontSize: 12.5 }}>{mins > 0 ? duration(mins) : ""}</div>
                </div>
                <GuestLine id={bk.id} name={guest} side />
                <div>
                  {bk.items.map((i, n) => <div className="line" key={n}><span>{i.name}</span><span>{money(i.price_cents, cur)}</span></div>)}
                  {bk.discount_cents > 0 ? <div className="line"><span className="muted">Promo {bk.promo_code}</span><span>−{money(bk.discount_cents, cur)}</span></div> : null}
                  {bk.deposit_cents > 0 ? <div className="line"><span className="muted">{bk.deposit_paid ? "Deposit paid" : "Deposit"}</span><span>{money(bk.deposit_cents, cur)}</span></div> : null}
                  <div className="line"><span className="muted">At the visit</span><span>{money(atVisit, cur)}</span></div>
                  <div className="line total"><span>Total</span><span>{money(bk.total_cents, cur)}</span></div>
                </div>
              </div>
              {verified ? <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.55, padding: "0 4px" }}><span className="pill pill-ok" style={{ marginRight: 6 }}>Verified</span>{name} has had its identity checked by LogaLuxe.</div> : null}
            </aside>
          </div>
          {embed ? <EmbedFoot /> : null}
        </main>
      </div>
      {embed ? null : <SiteFooter />}
    </>
  );
}
