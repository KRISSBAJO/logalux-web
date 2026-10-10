import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Icon } from "@/components/icons";
import { api, money } from "@/lib/api";
import { SearchBar } from "@/components/search-bar";
import { CategoryIcon } from "@/components/category-icons";
import { PlacePicker } from "@/components/place-picker";
import type { Found, Listing } from "@/lib/listings";
import { inCountry, shortName, whereLine } from "@/lib/place";
import { livePlaces, pickerWhere, whereAmI } from "@/lib/places";
import { Motion, MotionBoot } from "@/components/motion";
import { HeroShowcase, type HeroImage } from "@/components/hero-slides";
import { Pic } from "@/components/pic";
import { JournalHomeSection } from "@/components/journal-home";
import { firstByRef, siteMedia } from "@/lib/media";

const CATEGORIES: [string, string, string][] = [
  ["hair", "Hair", "Styling, colour, silk press"],
  ["braids", "Braids & locs", "Knotless, box, retwist"],
  ["barber", "Barber", "Fades, beard, line-up"],
  ["nails", "Nails", "Gel, acrylic, pedicure"],
  ["lashes", "Lashes & brows", "Extensions, lamination"],
  ["skin", "Skin", "Facials, peels, waxing"],
  ["makeup", "Makeup", "Bridal, event, lessons"],
  ["spa", "Spa & massage", "Body, relaxation"],
];

const PRO_FEATURES: [React.ReactNode, string, string][] = [
  [<Icon.Calendar key="c" />, "A calendar that fills itself", "Your booking link lives in your bio. Nothing double-books."],
  [<Icon.Shield key="s" />, "Protect your time", "Set deposits and cancellation rules before clients book."],
  [<Icon.Chat key="m" />, "Stay in touch", "Manage client messages and email reminders from one place."],
  [<Icon.Card key="p" />, "Know your money", "Track payments, tips and payouts in your business dashboard."],
];

export default async function Landing() {
  let featured: Listing[] = [];
  let found: Found | null = null;
  // Hero pictures are uploaded in the admin console under Site images.
  const [heroImages, categoryMedia, businessMedia]: [HeroImage[], Awaited<ReturnType<typeof siteMedia>>, Awaited<ReturnType<typeof siteMedia>>] = await Promise.all([siteMedia("hero"), siteMedia("category"), siteMedia("business")]);
  const categoryPic = firstByRef(categoryMedia);
  const cover = firstByRef(businessMedia);
  // Where this visitor is looking: the place they chose, or our first guess. Only their country is shown.
  const [where, picker, { places, countries }] = await Promise.all([whereAmI(), pickerWhere(), livePlaces()]);
  const place = where.place;
  const device = where.source === "device";
  try {
    // Four cards, always: the nearest, then the best of the country, then the best anywhere, then an invitation.
    const q = new URLSearchParams({ limit: "4", fill: "4" });
    if (where.scope) q.set("scope", where.scope);
    // Around a city or the visitor's own position, looking further out when little is close; else the best of the state or country.
    if (place && place.kind !== "state" && place.kind !== "country" && (place.lat || place.lng)) { q.set("lat", String(place.lat)); q.set("lng", String(place.lng)); if (!device) q.set("sort", "top"); }
    else if (place?.slug) q.set("place", place.slug);
    found = await api.get<Found>(`/v1/businesses?${q}`);
    featured = found.businesses;
  } catch {
    featured = [];
  }
  const served = countries.filter((c) => c.businesses > 0);
  const inScope = places.filter((p) => !where.scope || p.country === where.scope);
  const nearName = place ? (place.kind === "country" ? inCountry(place.country) : shortName(place)) : "";
  const elsewhere = served.filter((c) => c.code !== where.scope);

  return (
    <>
      <MotionBoot />
      <Motion />
      <div className="hero-glow text-[#F4ECE3]">
        <SiteHeader transparent />
        <section className="landing-hero container-x grid items-center gap-14 pb-24 pt-12 lg:grid-cols-[1.25fr_1fr] lg:gap-16 lg:pb-28 lg:pt-20" id="top">
          <div className="landing-copy min-w-0">
            <div className="eyebrow rise hidden md:flex" style={{ "--i": 0 } as React.CSSProperties}>{served.length > 0 ? served.map((c) => c.name).join(" · ") : "Beauty, booked"}</div>
            <h1 style={{ "--i": 1 } as React.CSSProperties} className="rise serif mt-7 text-[58px] leading-[.95] md:text-[104px]">
              Beauty you<br />can <em className="text-gold-2">trust.</em>
            </h1>
            <p style={{ "--i": 2 } as React.CSSProperties} className="rise mb-10 mt-7 max-w-[440px] text-[19px] leading-relaxed text-[#C9BCB0]">
              See who is verified, pick a free time, and book online.
            </p>
            <div className="rise hidden max-w-[600px] md:block" style={{ "--i": 3 } as React.CSSProperties}><SearchBar where={picker} /></div>
          </div>

          <div className="landing-portrait rise relative mx-auto w-full max-w-[440px]" style={{ "--i": 2 } as React.CSSProperties}>
            <HeroShowcase images={heroImages} />
          </div>
          {/* On a phone the pill sits on the photo's bottom edge, so it comes after the photo. Hidden from md up. */}
            <Link href="/search" className="mobile-professional-search flex items-center justify-between rounded-full bg-cream px-5 text-ink md:hidden"><span>Find a professional</span><Icon.Search /></Link>
        </section>
      </div>

      <div className="marquee border-y border-white/10 bg-ink-2 py-5 text-[#F4ECE3]" aria-hidden>
        <div className="marquee-track">
          {[0, 1].map((k) => (
            <div key={k} className="flex flex-none items-center">
              {["Knotless braids", "Silk press", "Skin fade", "Gel manicure", "Lash extensions", "Bridal makeup", "Loc retwist", "Deep tissue massage", "Brow lamination", "Hydrafacial"].map((t) => (
                <span key={t} className="serif flex items-center whitespace-nowrap text-[26px] italic text-[#E9DED3]/80">
                  {t}<i className="mx-8 block h-1.5 w-1.5 rounded-full bg-gold" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <section className="py-24 pb-16" id="categories">
        <div className="container-x">
          <div data-reveal className="mb-10 flex flex-wrap items-end justify-between gap-8">
            <div>
              <div className="eyebrow !text-wine">Browse by service</div>
              <h2 className="serif mt-3 text-[40px] font-medium leading-[1.05] tracking-tight md:text-[52px]">Every chair, one place.</h2>
            </div>
            <p className="max-w-[520px] text-[17px] leading-relaxed text-muted">Verified professionals are marked. The price you see is the price you pay.</p>
          </div>
          <div data-stagger className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
            {CATEGORIES.map(([id, name, sub]) => (
              <Link key={id} href={`/search?category=${id}`} className="card lift flex min-h-[124px] flex-col justify-between gap-3 p-5 hover:border-ink">
                {/* The uploaded photo for the category when there is one (Site images in the console); its drawing until then. */}
                {categoryPic.get(id)
                  ? <span className="photo zoom h-11 w-11 flex-none rounded-full !bg-cream-2 !p-0"><Pic img={categoryPic.get(id)} /></span>
                  : <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-cream-2 text-wine"><CategoryIcon id={id} /></span>}
                <span><b className="block text-[15px] font-semibold leading-tight">{name}</b><small className="text-[12px] text-muted">{sub}</small></span>
              </Link>
            ))}
          </div>
          {inScope.length > 0 && (
            <p className="mt-6 text-[14.5px] leading-relaxed text-muted">
              Browse by city:{" "}
              {inScope.slice(0, 6).map((p, i) => <span key={p.slug}>{i > 0 && " · "}<Link href={`/${p.slug}`} className="font-semibold text-wine hover:underline">{p.label}</Link></span>)}
              {" · "}<Link href="/places" className="font-semibold text-wine hover:underline">All places</Link>
            </p>
          )}
        </div>
      </section>

      <section className="bg-cream-2 py-24" id="near">
        <div className="container-x">
          <div data-reveal className="mb-10 flex flex-wrap items-end justify-between gap-8">
            <div>
              <div className="eyebrow !text-wine">Recommended</div>
              <h2 className="serif mt-3 text-[36px] font-medium leading-[1.08] tracking-tight md:text-[44px]">Your next <em className="text-wine">beauty favourite.</em></h2>
              {/* One calm line: where, and how we came by it (a guess is called a guess), with the way to change it. */}
              {place && (
                <div className="mt-3 flex flex-wrap items-center gap-x-2 text-[16px] text-muted">
                  <Icon.Pin width={15} height={15} className="flex-none text-wine" />
                  <span>{where.elsewhere ? `We do not serve ${where.elsewhere} yet. Showing ${place.label}` : whereLine(picker, place.kind, place.country)}</span>
                  <span aria-hidden className="text-muted-2">·</span>
                  <PlacePicker look="change" where={picker} />
                </div>
              )}
              {found?.geo && (found.geo.fill_notice || found.geo.notice) && featured.length > 0 && <p role="status" className="mt-2 max-w-[560px] text-[15px] font-semibold text-ink">{found.geo.fill_notice || found.geo.notice}</p>}
            </div>
            {/* Looking somewhere else on purpose: a gift for someone there, or a visit. */}
            {elsewhere.length > 0 && (
              <div className="flex flex-col items-start gap-1.5 text-[14px] text-muted">
                {elsewhere.map((c) => <Link key={c.code} href={`/search?place=${c.name.toLowerCase().replace(/[^a-z]+/g, "-")}`} className="font-semibold text-wine hover:underline">Booking for someone in {inCountry(c.code)}?</Link>)}
              </div>
            )}
          </div>
          <div data-stagger className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {featured.map((b) => (
              <Link key={b.slug} href={`/b/${b.slug}?src=search`} className="card lift flex flex-col overflow-hidden rounded-[22px]">
                <div className="h-[220px] overflow-hidden">
                <div className="photo zoom h-full" style={{ background: b.tone }}>
                  <Pic img={cover.get(b.slug)} />
                  <span className="absolute left-3.5 top-3.5 flex items-center gap-1.5 rounded-xl bg-cream px-2.5 py-2 text-[13px] font-bold text-ink"><Icon.Star width={14} height={14} className="text-gold" />{Number(b.rating).toFixed(1)} <small className="font-medium text-muted">({b.review_count})</small></span>
                </div>
                </div>
                <div className="flex flex-1 flex-col gap-2.5 p-4.5 p-[18px]">
                  {b.tier && b.tier !== "near" && <span className="self-start rounded-full bg-cream-2 px-2.5 py-1 text-[11.5px] font-semibold uppercase tracking-wide text-wine">{b.tier === "country" ? `Elsewhere in ${inCountry(b.country ?? "")}` : "Elsewhere on LogaLuxe"}</span>}
                  <div className="text-[13px] text-muted"><b className="text-ink">{b.category}</b> · {(b.tier && b.tier !== "near" ? [b.city, b.region] : [b.area, b.city && b.city !== b.area ? b.city : ""]).filter(Boolean).join(", ")}{b.distance_text && (device || found?.geo?.widened || (b.tier && b.tier !== "near")) ? ` · ${b.distance_text}${device ? " away" : ""}` : ""}</div>
                  <h3 className="text-[19px] font-semibold leading-tight">{b.name}</h3>
                  <div className="mt-auto flex items-center justify-between border-t border-line-2 pt-2.5">
                    <span className="text-[14px] text-muted">{b.from_cents ? <>From <b className="block text-[17px] text-ink">{money(b.from_cents, b.currency)}</b></> : <b className="block text-[14px] text-ink">Price on booking</b>}</span>
                    <span className="btn btn-ink btn-sm">Book</span>
                  </div>
                </div>
              </Link>
            ))}
            {/* Fewer professionals on LogaLuxe than cards: the rest of the row invites the next one. */}
            {Array.from({ length: found?.geo?.fill?.short ?? 0 }).map((_, i) => (
              <Link key={`open-${i}`} href="/business/signup" className="card lift flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-[22px] border-dashed p-8 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-cream-2 text-wine"><Icon.Spark width={24} height={24} /></span>
                <b className="text-[18px] leading-tight">This chair is open</b>
                <span className="text-[14.5px] text-muted">Be the first professional {nearName ? `in ${nearName}` : "here"} on LogaLuxe.</span>
                <span className="btn btn-out btn-sm mt-2">List your business</span>
              </Link>
            ))}
            {featured.length === 0 && (
              <div className="card col-span-full rounded-[22px] p-8 text-center">
                {found ? (
                  <>
                    <p className="text-[17px] font-semibold">No professional is listed {nearName ? `near ${nearName}` : "here"} yet.</p>
                    {(found.geo?.nearest_places ?? []).length > 0 && (
                      <p className="mt-2 text-[15px] text-muted">The nearest places that have someone:{" "}
                        {found.geo!.nearest_places.map((p, i) => <span key={p.slug}>{i > 0 && " · "}<Link href={`/${p.slug}`} className="font-semibold text-wine hover:underline">{p.label}{p.distance_text ? `, ${p.distance_text}` : ""}</Link></span>)}
                      </p>
                    )}
                    <p className="mt-4"><Link href="/business/signup" className="btn btn-ink">List your business here</Link></p>
                  </>
                ) : <p className="text-muted">We could not load professionals just now. Try again in a moment.</p>}
              </div>
            )}
          </div>
          {featured.length > 0 && <div className="mt-10 flex justify-center"><Link href="/search" className="btn btn-out">See all {device ? "near you" : place?.kind === "state" || place?.kind === "country" ? `in ${nearName}` : `near ${nearName}`}</Link></div>}
        </div>
      </section>

      {/* Articles from the Journal, for the country being browsed. Nothing shows until something is published. */}
      <JournalHomeSection scope={where.scope} />

      <section className="py-24" id="how">
        <div className="container-x">
          <div data-reveal className="mb-10 flex flex-wrap items-end justify-between gap-8">
            <div>
              <div className="eyebrow !text-wine">How it works</div>
              <h2 className="serif mt-3 text-[40px] font-medium leading-[1.05] tracking-tight md:text-[52px]">Three steps to a booking.</h2>
            </div>
            <p className="max-w-[520px] text-[17px] leading-relaxed text-muted">No messages back and forth. You see what is free, you pick it, it is yours.</p>
          </div>
          <div data-stagger className="grid gap-8 md:grid-cols-3">
            {[
              ["01", "Find someone you trust", "Search by service or browse near you. Portfolios, verified reviews with photos, prices, and policies are all on the profile before you commit."],
              ["02", "Pick a real opening", "The calendar shows only slots that are actually free. Choose your professional or “anyone available”, add services, and confirm with a card or a small deposit."],
              ["03", "Keep every visit together", "See your appointment and payment status in your account. Message your professional, manage your booking and rebook when you are ready."],
            ].map(([n, t, d]) => (
              <div key={n} className="card lift flex min-h-[300px] flex-col gap-4 rounded-[24px] p-9">
                <div className="serif text-[56px] leading-none text-gold">{n}</div>
                <h3 className="text-[24px] font-semibold tracking-tight">{t}</h3>
                <p className="text-[16px] leading-relaxed text-muted">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pros-bg relative overflow-hidden py-28 text-[#F4ECE3]" id="pros">
        <div className="container-x">
          <div data-reveal className="mx-auto max-w-[820px] text-center">
            <div className="eyebrow eyebrow-center">For professionals and salons</div>
            <h2 className="serif mt-5 text-[44px] leading-[1] md:text-[72px]">Your chair. Your clients. <em className="text-gold-2">Your money.</em></h2>
            <p className="mx-auto mt-6 max-w-[520px] text-[18px] leading-relaxed text-[#C9BCB0]">Run the whole business from your phone. Free for solo professionals.</p>
          </div>

          <div className="mt-16 grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr] lg:gap-10">
            <div data-stagger className="flex flex-col gap-6 max-lg:order-2">
              {PRO_FEATURES.slice(0, 2).map(([icon, t, d]) => (
                <div key={t} className="glass rounded-[26px] p-7">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/40 text-gold">{icon}</span>
                  <h3 className="serif mt-5 text-[26px] leading-tight">{t}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-[#B9ADA2]">{d}</p>
                </div>
              ))}
            </div>

            <div data-reveal className="mx-auto max-lg:order-1">
              {/* A drawing of the business dashboard: the layout only. Names, amounts and counts are left blank on purpose. */}
              <div className="phone float-slow w-full max-w-[310px]" role="img" aria-label="A drawing of the business dashboard: today's takings, and the day's appointments one under the other.">
                <div className="relative flex h-[620px] flex-col overflow-hidden rounded-[39px] bg-cream text-ink">
                  <i aria-hidden className="absolute left-1/2 top-2.5 z-10 block h-[22px] w-[92px] -translate-x-1/2 rounded-full bg-ink-2" />
                  <div className="px-5 pb-4 pt-12">
                    <div className="text-[11px] font-semibold uppercase tracking-[.12em] text-muted">Business dashboard</div>
                    <div className="serif mt-1 text-[30px] leading-none">Good morning</div>
                  </div>
                  <div className="mx-4 flex items-end justify-between rounded-[20px] bg-ink-2 p-4 text-[#F4ECE3]">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[.1em] text-[#B9ADA2]">Booked today</div>
                      <i aria-hidden className="mt-2 block h-8 w-28 rounded-lg bg-white/15" />
                      <i aria-hidden className="mt-2.5 block h-2.5 w-20 rounded-full bg-gold-2/50" />
                    </div>
                    <div aria-hidden className="flex h-[52px] items-end gap-1.5">
                      {[38, 62, 46, 80, 58, 100].map((h, n) => <i key={n} className={`block w-2 rounded-full ${n === 5 ? "bg-gold" : "bg-white/20"}`} style={{ height: `${h}%` }} />)}
                    </div>
                  </div>
                  <div data-stagger className="flex flex-1 flex-col gap-2 px-4 pt-4">
                    {([["09:00", "#1F2A33", "pill-ok"], ["10:00", "#7A1F2B", "pill-gold"], ["13:30", "", ""], ["14:30", "#4A3426", "pill-grey"], ["16:00", "#2E2538", "pill-ok"]] as const).map(([time, tone, pill]) =>
                      tone ? (
                        <div key={time} className="flex items-center gap-3 rounded-[16px] bg-white py-2.5 pl-2.5 pr-3 shadow-[0_1px_0_rgba(26,21,19,.04)]">
                          <span aria-hidden className="block h-9 w-9 flex-none rounded-full" style={{ background: tone }} />
                          <div className="min-w-0 flex-1">
                            <i aria-hidden className="block h-3 w-24 rounded-full bg-cream-3" />
                            <span className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-muted"><time>{time}</time><i aria-hidden className="block h-2 w-20 rounded-full bg-cream-3" /></span>
                          </div>
                          <span aria-hidden className={`pill ${pill} h-5 w-12`} />
                        </div>
                      ) : (
                        <div key={time} className="flex items-center gap-3 rounded-[16px] border border-dashed border-muted-2/70 px-3 py-2.5 text-[12.5px] text-muted">
                          <time className="font-semibold">{time}</time><span className="flex-1">Open slot</span><span className="font-semibold text-wine">Fill it</span>
                        </div>
                      ),
                    )}
                  </div>
                  <div aria-hidden className="mt-3 flex items-center justify-around border-t border-line bg-white px-6 pb-5 pt-3 text-muted-2">
                    <Icon.Calendar className="text-ink" /><Icon.Users /><Icon.Chat /><Icon.Card />
                  </div>
                </div>
              </div>
            </div>

            <div data-stagger className="flex flex-col gap-6 max-lg:order-3">
              {PRO_FEATURES.slice(2).map(([icon, t, d]) => (
                <div key={t} className="glass rounded-[26px] p-7">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/40 text-gold">{icon}</span>
                  <h3 className="serif mt-5 text-[26px] leading-tight">{t}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-[#B9ADA2]">{d}</p>
                </div>
              ))}
            </div>
          </div>

          <div data-reveal className="mt-14 flex flex-wrap items-center justify-center gap-3.5">
            <Link href="/business/signup" className="btn btn-gold min-h-[52px] px-7">List your business free</Link>
            <Link href="#how" className="btn btn-ghost min-h-[52px] px-7">See how booking works</Link>
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="container-x">
          <div data-reveal className="mb-10">
            <div className="eyebrow !text-wine">Why LogaLuxe</div>
            <h2 className="serif mt-3 text-[40px] font-medium leading-[1.05] tracking-tight md:text-[52px]">What you can count on.</h2>
          </div>
          <div data-stagger className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Verified professionals are marked", "A professional who has verified their identity with LogaLuxe carries the Verified mark. Licences are checked where the law requires one."],
              ["Reviews only from real visits", "You can only review a booking you completed and paid for. One review per visit. No rings, no copy-paste."],
              ["Secure payment pages", "Online card payments are handled by Stripe or Paystack. LogaLuxe does not store your full card number."],
              ["Know before you book", "Check the location, services and cancellation policy on each professional’s page. Contact them if you need more details."],
            ].map(([t, d]) => (
              <div key={t} className="card lift flex flex-col gap-3 rounded-[20px] p-7">
                <Icon.Shield className="text-wine" width={28} height={28} />
                <b className="text-[18px] font-semibold">{t}</b>
                <span className="text-[15px] leading-relaxed text-muted">{d}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-24">
        <div className="container-x">
          <div data-reveal className="grid items-center gap-12 rounded-[32px] bg-wine p-10 text-[#F4ECE3] md:grid-cols-[1fr_auto] md:p-16">
            <div>
              <div className="eyebrow !text-gold-2">The LogaLuxe app</div>
              <h2 className="serif mt-3 text-[34px] font-medium leading-[1.05] md:text-[48px]">Your next appointment, one tap away.</h2>
              <p className="mt-3 max-w-[520px] text-[17px] leading-relaxed text-[#F1D9DC]">Rebook your favourite in a tap, get reminders where you actually read them, and keep every receipt and photo in one place.</p>
            </div>
            <div className="flex flex-wrap gap-3.5">
              <Link href="/search" className="btn bg-cream text-ink">Book on the web</Link>
            </div>
          </div>
        </div>
      </section>
      <SiteFooter />
    </>
  );
}
