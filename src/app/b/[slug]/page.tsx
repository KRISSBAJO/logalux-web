import "@/app/cx-css/storefront.css";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { getCustomer, customerApi } from "@/lib/customer";
import { Pic } from "@/components/pic";
import { JsonLd } from "@/components/json-ld";
import { firstByRef, siteMedia } from "@/lib/media";
import { isTestEntry } from "@/lib/site";
import { businessDescription, businessJsonLd, businessTitle } from "./seo";
import { SaveButton, ShareButton } from "./head-actions";
import { PinMap } from "./pin-map";
import { Storefront } from "./storefront";
import { clock, firstName, inZone, lateRule, type Breakdown, type Loc, type Payload } from "./shared";

export const dynamic = "force-dynamic";

const SOURCES = ["search", "marketplace", "category", "app"];
const DAYS: [string, string, string][] = [["mon", "Mon", "Monday"], ["tue", "Tue", "Tuesday"], ["wed", "Wed", "Wednesday"], ["thu", "Thu", "Thursday"], ["fri", "Fri", "Friday"], ["sat", "Sat", "Saturday"], ["sun", "Sun", "Sunday"]];
const TILE_TONES = ["#4A2A2A", "#2E2538", "#4A3426", "#1F2A33"];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const [data, photos] = await Promise.all([customerApi<Payload>(`/businesses/${encodeURIComponent(slug)}`, { auth: false }), siteMedia("business", slug)]);
    const b = data.business;
    const title = businessTitle(data), description = businessDescription(data);
    const canonical = `/b/${b.slug}`;
    // The first photo the business uploaded, when it has one. No photo, no picture: a stand-in would not be theirs.
    const images = photos[0] ? [{ url: `/media/${photos[0].id}`, alt: photos[0].alt || b.name }] : undefined;
    // Only a business that is open to the public belongs in a search engine.
    const hidden = (b.status ?? "live") !== "live" || isTestEntry(b.name, b.slug);
    return {
      title,
      description,
      alternates: { canonical },
      robots: hidden ? { index: false, follow: false } : undefined,
      openGraph: { title, description, url: canonical, siteName: "LogaLuxe", type: "website", images },
      twitter: { card: images ? "summary_large_image" : "summary", title, description, images: images?.map((i) => i.url) },
    };
  } catch {
    return { title: "Business", robots: { index: false, follow: false } };
  }
}

/** "Open now · until 18:00" or "Closed · opens Tue 9:00", by the business's own clock. */
function openBadge(loc: Loc | undefined, tz: string): { open: boolean; text: string } | null {
  const hours = loc?.hours;
  if (!hours) return null;
  const now = inZone(new Date(), tz);
  const at = DAYS.findIndex((d) => d[0] === now.weekday.slice(0, 3));
  if (at < 0) return null;
  const today = hours[DAYS[at][0]];
  if (today && now.time >= today[0] && now.time < today[1]) return { open: true, text: `Open now · until ${clock(today[1])}` };
  if (today && now.time < today[0]) return { open: false, text: `Closed · opens ${clock(today[0])}` };
  for (let i = 1; i <= 7; i++) {
    const d = DAYS[(at + i) % 7], h = hours[d[0]];
    if (h) return { open: false, text: `Closed · opens ${i === 1 ? "tomorrow" : d[1]} ${clock(h[0])}` };
  }
  return null;
}

/** The week's hours, with days that keep the same hours on one line. */
function hourRows(hours: Loc["hours"] | undefined): [string, string][] {
  if (!hours) return [];
  const groups: { key: string; days: number[] }[] = [];
  DAYS.forEach(([k], i) => {
    const h = hours[k];
    const key = h ? `${clock(h[0])} to ${clock(h[1])}` : "Closed";
    const g = groups.find((x) => x.key === key);
    if (g) g.days.push(i);
    else groups.push({ key, days: [i] });
  });
  const label = (d: number[]) => {
    if (d.length === 1) return DAYS[d[0]][2];
    const run = d.every((x, i) => i === 0 || x === d[i - 1] + 1);
    return run && d.length > 2 ? `${DAYS[d[0]][1]} to ${DAYS[d[d.length - 1]][1]}` : d.map((x) => DAYS[x][1]).join(", ");
  };
  // Open days first, in week order; the closed days close the list.
  return [...groups.filter((g) => g.key !== "Closed"), ...groups.filter((g) => g.key === "Closed")].map((g) => [label(g.days), g.key]);
}

export default async function BusinessPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ src?: string; photos?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  // How the visitor got here. Someone who found the business on LogaLuxe is a lead; someone who followed the business's own link is not.
  const src = SOURCES.includes(sp.src ?? "") ? sp.src! : "";
  let data: Payload;
  try {
    // The visitor's token goes along when there is one, so the page knows whether they have saved this business.
    data = await customerApi<Payload>(`/businesses/${encodeURIComponent(slug)}${src ? `?src=${src}` : ""}`);
  } catch {
    notFound();
  }
  const { business: b, locations, staff, services, reviews, products } = data;
  const display = data.display ?? {}, policy = data.policy ?? {};
  const tz = b.timezone || "UTC";
  const [photos, productMedia, me, reviewPage] = await Promise.all([
    siteMedia("business", slug),
    products.length ? siteMedia("product") : Promise.resolve([]),
    getCustomer(),
    display.show_reviews === false ? Promise.resolve(null) : customerApi<{ breakdown?: Breakdown }>(`/businesses/${encodeURIComponent(slug)}/reviews?page=1`, { auth: false }).catch(() => null),
  ]);
  const productPic = firstByRef(productMedia);
  const loc = locations.find((l) => l.is_primary) ?? locations[0];
  const others = locations.filter((l) => l !== loc);
  const badge = display.open_badge === false ? null : openBadge(loc, tz);
  const cancelHours = policy.cancel_hours ?? 24;
  const hasDeposit = services.some((s) => s.deposit_cents > 0);
  const late = lateRule(policy.late_cancel_fee, hasDeposit);
  const showAddress = display.show_address !== false;
  const site = b.website ? (/^https?:\/\//.test(b.website) ? b.website : `https://${b.website}`) : "";
  const handle = (v?: string) => (v ?? "").replace(/^@/, "").trim();
  const rating = Number(b.rating) || 0;
  const breakdown = reviewPage?.breakdown ?? {};
  const reviewCount = Number(breakdown.all ?? b.review_count) || 0;
  const here = `/b/${b.slug}${src ? `?src=${src}` : ""}`;
  const messageTo = `/account?to=${b.slug}#messages`;
  const signIn = (next: string) => `/signin?next=${encodeURIComponent(next)}`;
  const place = [loc?.name, loc?.city && !loc?.name?.includes(loc.city) ? loc.city : ""].filter(Boolean).join(" · ");
  const hasPin = showAddress && typeof loc?.lat === "number" && typeof loc?.lng === "number";

  // Every photo, on its own view: /b/<slug>?photos=1
  if (sp.photos && photos.length > 0) {
    return (
      <>
        <SiteHeader active="book" />
        <div className="cx pg-storefront">
          <main className="wrap" style={{ paddingBottom: 56 }}>
            <div className="head" style={{ alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <h1 className="serif">{b.name}</h1>
                <div className="muted" style={{ marginTop: 8, fontSize: 15 }}>{photos.length} photo{photos.length === 1 ? "" : "s"}</div>
              </div>
              <Link href={here} className="btn btn-out">Back to {b.name}</Link>
            </div>
            <div className="shots">
              {photos.map((ph, i) => (
                <figure key={ph.id} id={`photo-${i + 1}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/media/${ph.id}`} alt={ph.alt || `${b.name}, photo ${i + 1}`} loading={i < 2 ? "eager" : "lazy"} decoding="async" />
                  {ph.caption ? <figcaption className="muted">{ph.caption}</figcaption> : null}
                </figure>
              ))}
            </div>
          </main>
        </div>
        <SiteFooter />
      </>
    );
  }

  const aside = (
    <>
      <div className="card">
        <h3>Where</h3>
        {hasPin ? <div className="map"><PinMap lat={loc!.lat as number} lng={loc!.lng as number} label={firstName(b.name)} name={b.name} /></div> : null}
        <div style={{ fontSize: 13.5 }}>
          {showAddress
            ? [loc?.address, [loc?.city, loc?.region === loc?.city ? "" : loc?.region].filter(Boolean).join(" ")].filter(Boolean).join(", ") || loc?.name
            : <>{[loc?.city, loc?.region].filter(Boolean).join(" ")} <span className="muted">· the exact address is sent when you book</span></>}
        </div>
        {showAddress && loc?.arrival_notes ? <div className="muted" style={{ fontSize: 12.5 }}>{loc.arrival_notes}</div> : null}
        {hasPin ? <a href={`https://www.openstreetmap.org/?mlat=${loc!.lat}&mlon=${loc!.lng}#map=17/${loc!.lat}/${loc!.lng}`} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600 }}>Open in maps</a> : null}
        <div className="kv">
          {hourRows(loc?.hours).map(([d, h]) => <div key={d}><span>{d}</span><b>{h}</b></div>)}
        </div>
        {others.length > 0 ? (
          <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
            Also at {others.map((o) => [o.name, showAddress ? o.address : "", o.city].filter(Boolean).join(", ")).join("; ")}.
          </div>
        ) : null}
      </div>
      <div className="card">
        <h3>Good to know</h3>
        <div className="kv">
          {b.verification_status === "verified" ? <div><span>Verified</span><b>Identity checked by LogaLuxe</b></div> : null}
          <div><span>Booking</span><b>{policy.instant === false ? "The business confirms each request" : "Confirmed at once"}</b></div>
          <div><span>Cancelling</span><b>{cancelHours > 0 ? `Free until ${cancelHours} h before${late ? `; after that ${late}` : ""}` : "Free at any time"}</b></div>
          {policy.payments_live === false ? <div><span>Pays with</span><b>Paid at the visit</b></div> : <div><span>Pays with</span><b>{b.market === "NG" ? "Card, transfer or USSD, on Paystack" : "Card, on Stripe's secure page"}</b></div>}
          {(policy.new_client_deposit_pct ?? 0) > 0 ? <div><span>First visit</span><b>{policy.new_client_deposit_pct}% deposit when you book</b></div> : null}
          {b.phone ? <div><span>Phone</span><b><a href={`tel:${b.phone.replace(/[^\d+]/g, "")}`}>{b.phone}</a></b></div> : null}
          {handle(b.instagram) ? <div><span>Instagram</span><b><a href={`https://instagram.com/${handle(b.instagram)}`} target="_blank" rel="noreferrer">@{handle(b.instagram)}</a></b></div> : null}
          {handle(b.tiktok) ? <div><span>TikTok</span><b><a href={`https://tiktok.com/@${handle(b.tiktok)}`} target="_blank" rel="noreferrer">@{handle(b.tiktok)}</a></b></div> : null}
          {site ? <div><span>Website</span><b><a href={site} target="_blank" rel="noreferrer">{site.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a></b></div> : null}
        </div>
      </div>
    </>
  );

  return (
    <>
      {(b.status ?? "live") === "live" && !isTestEntry(b.name, b.slug) ? businessJsonLd(data, { rating, reviewCount, photoId: photos[0]?.id }).map((d, i) => <JsonLd key={i} data={d} />) : null}
      <SiteHeader active="book" />
      <div className="cx pg-storefront">
        <main className="wrap">
          {display.notice ? <div role="status" className="notice">{display.notice}</div> : null}

          <div className="gallery">
            {[photos[0], photos[1], photos[2], photos[3], photos[4]].map((ph, i) => {
              const cls = `g${i === 0 ? " big" : ""}${i > 2 ? " extra" : ""}`;
              const tone = i === 0 ? b.tone : TILE_TONES[i - 1];
              return ph
                ? <Link key={i} href={`/b/${b.slug}?photos=1${src ? `&src=${src}` : ""}#photo-${i + 1}`} className={cls} style={{ background: tone }} aria-label={`Photo ${i + 1} of ${photos.length}. See all photos.`}><Pic img={ph} eager={i === 0} /></Link>
                : <div key={i} className={cls} style={{ background: tone }} />;
            })}
            {photos.length > 0 ? <Link href={`/b/${b.slug}?photos=1${src ? `&src=${src}` : ""}`} className="btn btn-out btn-sm all">All {photos.length} photo{photos.length === 1 ? "" : "s"}</Link> : null}
          </div>

          <div className="head">
            <div style={{ flex: 1, minWidth: 280 }}>
              <div className="title">
                {b.logo_id ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/media/${b.logo_id}`} alt={`${b.name} logo`} width={64} height={64} className="logoimg" />
                ) : null}
                <h1 className="serif">{b.name}</h1>
              </div>
              <div className="facts">
                {reviewCount > 0 && display.show_reviews !== false ? (
                  <>
                    <span className="stars" role="img" aria-label={`${rating.toFixed(1)} out of 5`}>{"★★★★★☆☆☆☆☆".slice(5 - Math.round(rating), 10 - Math.round(rating))}</span>
                    <b>{rating.toFixed(1)}</b>
                    <a href="#reviews" className="muted">{reviewCount} review{reviewCount === 1 ? "" : "s"}</a>
                  </>
                ) : null}
                {b.verification_status === "verified" ? <span className="pill pill-ok">Verified</span> : null}
                {badge ? <span className={`pill ${badge.open ? "pill-gold" : "pill-grey"}`}>{badge.text}</span> : null}
                {place ? <span className="muted">{place}</span> : null}
              </div>
              {b.tagline ? <div className="muted" style={{ marginTop: 8, fontSize: 15 }}>{b.tagline}</div> : null}
              {b.highlights?.length ? <div className="chips" style={{ marginTop: 12 }}>{b.highlights.map((h) => <span className="chip" key={h}>{h}</span>)}</div> : null}
            </div>
            <div className="acts">
              <SaveButton slug={b.slug} name={b.name} saved={!!data.saved} signedIn={!!me} signInHref={signIn(here)} />
              <ShareButton name={b.name} path={`/b/${b.slug}`} />
              <Link href={me ? messageTo : signIn(messageTo)} className="btn btn-out">Message</Link>
            </div>
          </div>

          <Storefront
            slug={b.slug} src={src} name={b.name} ownerFirst={firstName(b.owner_name)} currency={b.currency} tz={tz}
            services={services} staff={display.show_staff === false ? [] : staff}
            showDurations={display.show_durations !== false} showFrom={display.show_from !== false} showReviews={display.show_reviews !== false}
            reviews={reviews} breakdown={breakdown} rating={rating} reviewCount={reviewCount} summary={(b.review_summary ?? "").trim()}
            products={products.map((p) => ({ ...p, img: productPic.get(p.slug) }))} about={(b.about ?? "").trim()} policy={policy} aside={aside}
          />
        </main>
      </div>
      <SiteFooter />
    </>
  );
}
