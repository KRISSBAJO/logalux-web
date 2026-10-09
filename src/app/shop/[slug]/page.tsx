import "@/app/cx-css/product.css";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { CartLink } from "@/components/cart-ui";
import { ProductBuyBox } from "@/components/product-buy-box";
import { ProductGallery } from "@/components/product-gallery";
import { money } from "@/lib/api";
import { CustomerApiError, customerApi, getCustomer } from "@/lib/customer";
import { getFeatures } from "@/lib/features";
import { readMessage } from "@/lib/flash";
import { WalletNote } from "@/components/pay-bits";
import { categoryName, currencyOf, deliveryDays, payProvider, pickupTodayText, returnsText, shopHref, tagName, visitDay, type ProductExtras, type Size } from "@/lib/shop";
import { JsonLd, breadcrumbs } from "@/components/json-ld";
import { absoluteUrl, clip, isTestEntry } from "@/lib/site";
import { reviewProduct } from "./actions";

export const dynamic = "force-dynamic";

type Detail = {
  id: string; slug: string; name: string; seller_name: string; category: string; description: string | null; how_to_use: string | null;
  price_cents: number; compare_cents: number | null; stock: number; sizes: Size[] | null; tone: string; tags: string[] | null;
  rating: number; review_count: number; sold: number; pickup: boolean; shipping: boolean; shipping_cents: number;
  business_slug: string | null; business: string | null; seller_verified: boolean | null; business_currency: string | null; business_city: string | null;
  business_from_cents: number | null; used_in: { service_id: string; name: string }[] | null;
  /** What the product is priced in: its seller's currency, or dollars for a brand product. */
  currency?: string;
};
/** A product knows its own currency. Everything on its page is shown in it. */
const currencyFor = (p: Detail) => currencyOf(p.currency ?? p.business_currency);
type Payload = {
  product: Detail;
  photos: { id: string; alt: string }[] | null;
  related: { slug: string; name: string; seller_name: string; price_cents: number; tone: string; rating: number; photo_id: string | null }[] | null;
  reviews: { id: string; author_name: string; rating: number; body: string; verified: boolean; created_at: string }[] | null;
  can: { review: boolean; why: string };
  extras?: ProductExtras | null;
};

const load = (slug: string) => customerApi<Payload>(`/products/${encodeURIComponent(slug)}`);
const stars = (n: number) => "★".repeat(Math.max(0, Math.min(5, Math.round(n)))) + "☆".repeat(5 - Math.max(0, Math.min(5, Math.round(n))));
const day = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const part = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-US", { ...o, timeZone: "UTC" });
  return `${part({ day: "numeric" })} ${part({ month: "short" })} ${part({ year: "numeric" })}`;
};

/** What the product costs: one price, or the lowest and highest of its sizes. */
function priceOf(p: Detail) {
  const sizes = (p.sizes ?? []).map((x) => x.price_cents).filter((c) => c > 0);
  return sizes.length > 1 ? { low: Math.min(...sizes), high: Math.max(...sizes), count: sizes.length } : { low: sizes[0] ?? p.price_cents, high: sizes[0] ?? p.price_cents, count: 1 };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const { product: p, photos } = await load(slug);
    const price = priceOf(p), cur = currencyFor(p);
    const title = `${p.name} by ${p.seller_name}`;
    const facts = [price.count > 1 ? `From ${money(price.low, cur)}.` : `${money(price.low, cur)}.`, p.stock < 1 ? "Sold out." : "", `Sold by ${p.seller_name}${p.business_city ? `, ${p.business_city}` : ""}.`, p.pickup ? "Free pickup at the studio." : ""].filter(Boolean).join(" ");
    const description = clip([p.description ?? "", facts].filter(Boolean).join(" "), 220);
    const canonical = `/shop/${p.slug}`;
    const first = (photos ?? [])[0];
    const images = first ? [{ url: `/media/${first.id}`, alt: first.alt || p.name }] : undefined;
    return {
      title,
      description,
      alternates: { canonical },
      robots: isTestEntry(p.name, p.slug) ? { index: false, follow: false } : undefined,
      openGraph: { title, description, url: canonical, siteName: "LogaLuxe", type: "website", images },
      twitter: { card: images ? "summary_large_image" : "summary", title, description, images: images?.map((i) => i.url) },
    };
  } catch { return { title: "Product", robots: { index: false, follow: false } }; }
}

/** The product as schema.org structured data, from what the shop really holds. */
function productJsonLd(p: Detail, photos: { id: string; alt: string }[]) {
  const url = absoluteUrl(`/shop/${p.slug}`);
  const price = priceOf(p);
  const availability = `https://schema.org/${p.stock > 0 ? "InStock" : "OutOfStock"}`;
  const seller = { "@type": "Organization", name: p.seller_name, ...(p.business_slug ? { url: absoluteUrl(`/b/${p.business_slug}`) } : {}) };
  const amount = (cents: number) => (cents / 100).toFixed(2);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: p.name,
    url,
    ...(p.description ? { description: p.description } : {}),
    ...(photos.length ? { image: photos.map((ph) => absoluteUrl(`/media/${ph.id}`)) } : {}),
    category: categoryName(p.category),
    brand: { "@type": "Brand", name: p.seller_name },
    offers: price.count > 1
      ? { "@type": "AggregateOffer", lowPrice: amount(price.low), highPrice: amount(price.high), offerCount: price.count, priceCurrency: currencyFor(p), availability, url, seller }
      : { "@type": "Offer", price: amount(price.low), priceCurrency: currencyFor(p), availability, url, seller },
    ...(p.review_count > 0 && Number(p.rating) > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(Number(p.rating).toFixed(2)), reviewCount: p.review_count, bestRating: 5, worstRating: 1 } } : {}),
  };
}

export default async function ProductPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string; ok?: string; err?: string }> }) {
  const { slug } = await params;
  // A gift card is bought on its own page, where the amount and the person it is for are chosen. It does not go in the cart.
  if (slug === "gift-card") redirect("/gift-cards");
  const sp = await searchParams;
  // The address carries a code for a message after a review, never the words.
  const [okMessage, errMessage] = await Promise.all([readMessage(sp.ok), readMessage(sp.err)]);
  let data: Payload;
  try { data = await load(slug); } catch (e) {
    if ((e as CustomerApiError).status === 404) notFound();
    throw e;
  }
  const p = data.product;
  const photos = data.photos ?? [], related = data.related ?? [], reviews = data.reviews ?? [], usedIn = p.used_in ?? [], sizes = p.sizes ?? [], tags = p.tags ?? [];
  const me = await getCustomer();
  const studio = p.business_slug ? p.business ?? p.seller_name : "";
  const here = `/shop/${p.slug}`;
  // The shop this product belongs to: a naira product leads back to the naira shop.
  const cur = currencyFor(p), shop = shopHref(cur), provider = payProvider(cur);
  // Apple Pay and Google Pay are named only while they are switched on, and only for payments that go to Stripe.
  const wallets = provider === "Stripe" && (await getFeatures()).wallets;
  const categoryHref = `${shop}${shop.includes("?") ? "&" : "?"}category=${encodeURIComponent(p.category)}`;

  // What the seller states about delivery, returns and pick-up. Anything it does not state is left unsaid.
  const extras = data.extras ?? {};
  const ingredients = (extras.ingredients ?? "").trim();
  const delivery = p.shipping ? extras.delivery : undefined, returns = extras.returns;
  const today = p.pickup ? extras.pickup_today : undefined, visit = p.pickup ? extras.next_visit : undefined;
  const visitOn = visit ? visitDay(visit) : "";
  const deliveryTab = p.pickup ? (returns ? "Pickup & returns" : "Pickup & delivery") : returns ? "Delivery & returns" : "Delivery";

  const tabs: [string, string][] = [
    ["details", "Details"],
    ...(ingredients ? [["ingredients", "Ingredients"] as [string, string]] : []),
    ...(p.how_to_use ? [["how", "How to use"] as [string, string]] : []),
    ["reviews", reviews.length ? `Reviews · ${p.review_count || reviews.length}` : "Reviews"],
    ["delivery", deliveryTab],
  ];
  const tab = tabs.some(([k]) => k === sp.tab) ? sp.tab! : "details";

  const badge = usedIn.length > 0 && studio ? `Used in the chair at ${studio}` : tags.includes("bestseller") ? "Bestseller" : "";
  const facts = [
    sizes.length > 1 ? `Sizes: ${sizes.map((s) => (s.label.replace(/s/g, "") === money(s.price_cents, cur) ? s.label : `${s.label} (${money(s.price_cents, cur)})`)).join(", ")}` : sizes[0]?.label ? `Size: ${sizes[0].label}` : "",
    `Sold by ${p.seller_name}${p.business_city ? `, ${p.business_city}` : ""}`,
    tags.filter((t) => t !== "bestseller" && t !== p.category).length ? `Good to know: ${tags.filter((t) => t !== "bestseller" && t !== p.category).map(tagName).join(", ")}` : "",
  ].filter(Boolean);
  const returnsNote = (returns?.note ?? "").trim().replace(/[.!?]$/, "");
  const trust = ([
    ...(p.pickup ? [["Free pickup", visitOn ? `Waiting at your visit on ${visitOn}, no shipping` : today ? `Today, ${pickupTodayText(today)}` : `Collect it at ${studio || p.seller_name}, nothing to pay for shipping`]] : []),
    ...(p.shipping ? [[p.shipping_cents > 0 ? `Ships for ${money(p.shipping_cents, cur)}` : "Ships free", delivery ? `Arrives in ${deliveryDays(delivery)}` : `One charge per order from ${p.seller_name}`]] : []),
    ...(returns ? [[returns.days > 0 ? `Returns within ${returns.days} ${returns.days === 1 ? "day" : "days"}` : "No returns", returnsNote || (returns.days > 0 ? `Stated by ${p.seller_name}` : "This seller does not take returns")]] : []),
    ["Pay securely", wallets ? `On ${provider}'s page, by card, Apple Pay or Google Pay. LogaLuxe never sees your card` : `On ${provider}'s page. LogaLuxe never sees your card`],
  ] as [string, string][]).slice(0, 3);

  return (
    <>
      {!isTestEntry(p.name, p.slug) && (
        <>
          <JsonLd data={productJsonLd(p, photos)} />
          <JsonLd data={breadcrumbs([["Shop", absoluteUrl(shop)], [categoryName(p.category), absoluteUrl(categoryHref)], [p.name, absoluteUrl(`/shop/${p.slug}`)]])} />
        </>
      )}
      <SiteHeader active="shop" />
      <div className="cx pg-product">
        <main className="wrap">
          <div className="top">
            <nav className="crumbs" aria-label="Breadcrumb"><Link href={shop}>{cur === "NGN" ? "Shop Nigeria" : "Shop"}</Link><span aria-hidden>›</span><Link href={categoryHref}>{categoryName(p.category)}</Link><span aria-hidden>›</span><span aria-current="page">{p.name}</span></nav>
            <CartLink tone="out" />
          </div>

          <div className="layout">
            <ProductGallery images={photos} tone={p.tone} name={p.name} badge={badge ? <span className="pill pill-gold tag">{badge}</span> : undefined} />

            <div className="info">
              {p.business_slug ? (
                <Link href={`/b/${p.business_slug}`} className="by"><span className="av" style={{ background: p.tone }} /><span>Sold by <b>{p.seller_name}</b></span>{p.seller_verified === true && <span className="pill pill-ok">Verified seller</span>}</Link>
              ) : (
                <div className="by"><span className="av" style={{ background: p.tone }} /><span>Sold by <Link href={`/shop?seller=${encodeURIComponent(p.seller_name)}`}><b>{p.seller_name}</b></Link></span></div>
              )}
              <h1 className="serif">{p.name}</h1>
              {(p.review_count > 0 || p.sold > 0) && (
                <div className="rt">
                  {p.review_count > 0 && <><i role="img" aria-label={`${Number(p.rating).toFixed(1)} out of 5`}>{stars(Number(p.rating))}</i><b>{Number(p.rating).toFixed(1)}</b><Link href={`${here}?tab=reviews#tabs`} scroll={false} className="muted">{p.review_count} {p.review_count === 1 ? "review" : "reviews"}</Link></>}
                  {p.sold > 0 && <span className="muted">{p.review_count > 0 ? "· " : ""}{p.sold.toLocaleString("en-US")} sold</span>}
                </div>
              )}

              <ProductBuyBox product={{ slug: p.slug, name: p.name, seller_name: p.seller_name, tone: p.tone, description: p.description ?? "", price_cents: p.price_cents, compare_cents: p.compare_cents, stock: p.stock, sizes, pickup: p.pickup, shipping: p.shipping, shipping_cents: p.shipping_cents, business: p.business, business_city: p.business_city, currency: cur }} extras={{ delivery, pickup_today: today, next_visit: visit, saved: extras.saved === true }} signedIn={!!me} />

              <div className={`trust n${trust.length}`}>
                {trust.map(([t, d]) => <div key={t}><b>{t}</b>{d}</div>)}
              </div>

              <nav className="tabs" id="tabs" aria-label="About this product">
                {tabs.map(([k, label]) => <Link key={k} href={`${here}${k === "details" ? "" : `?tab=${k}`}`} scroll={false} aria-current={k === tab ? "page" : undefined} className={k === tab ? "on" : ""}>{label}</Link>)}
              </nav>

              {tab === "details" && (
                <div className="body">
                  {p.description}
                  {facts.length > 0 && <ul>{facts.map((f) => <li key={f}>{f}</li>)}</ul>}
                </div>
              )}
              {tab === "ingredients" && <div className="body">{ingredients}</div>}
              {tab === "how" && <div className="body">{p.how_to_use}</div>}
              {tab === "reviews" && (
                <div id="reviews">
                  {okMessage && <p className="flash good" role="status">{okMessage}</p>}
                  {errMessage && <p className="flash bad" role="alert">{errMessage}</p>}
                  {reviews.length === 0 && <p className="body muted">No reviews yet.</p>}
                  {reviews.map((r) => (
                    <div key={r.id} className="rev">
                      <b>{r.author_name}</b> <span className="muted meta">· <i role="img" aria-label={`${r.rating} out of 5`}>{stars(r.rating)}</i>{r.verified ? " · verified purchase" : ""}{day(r.created_at) ? ` · ${day(r.created_at)}` : ""}</span>
                      <p>{r.body}</p>
                    </div>
                  ))}
                  {data.can.review ? (
                    <form action={reviewProduct} className="write">
                      <input type="hidden" name="slug" value={p.slug} />
                      <fieldset>
                        <legend>Your rating</legend>
                        <div className="rate">
                          {[1, 2, 3, 4, 5].map((n) => <label key={n}><input type="radio" name="rating" value={n} defaultChecked={n === 5} required /><span>{n} ★</span></label>)}
                        </div>
                      </fieldset>
                      <label htmlFor="review-body">Your review</label>
                      <textarea id="review-body" name="body" required minLength={10} maxLength={1500} rows={4} placeholder="What was it like to use?" />
                      <button type="submit" className="btn btn-ink">Publish review</button>
                    </form>
                  ) : (
                    <p className="why muted">
                      {data.can.why}
                      {!me && <> <Link href={`/signin?next=${encodeURIComponent(`${here}?tab=reviews`)}`}>Sign in</Link></>}
                    </p>
                  )}
                </div>
              )}
              {tab === "delivery" && (
                <div className="body">
                  <ul className="plain">
                    {p.pickup && <li>Pick up is free. Choose pick up in your cart and collect your order at {studio}{p.business_city ? ` in ${p.business_city}` : ""}.</li>}
                    {visitOn && <li>You have a visit booked on {visitOn}. Choose pick up and {studio} is told to have it ready for you then.</li>}
                    {today && <li>Pick up today: {pickupTodayText(today)}.{today.open_now ? "" : " The studio is not open yet."}</li>}
                    {p.shipping && <li>{p.shipping_cents > 0 ? `Shipping is ${money(p.shipping_cents, cur)}, charged once for everything you order from ${p.seller_name} in the same order.` : `${p.seller_name} ships this free.`}{delivery ? ` Arrives in ${deliveryDays(delivery)}.` : ""}</li>}
                    {returns && <li>{returnsText(returns)}</li>}
                    {!p.shipping && <li>{p.seller_name} does not ship this product{p.pickup ? ", so it is pick up only" : ""}.</li>}
                    {!p.pickup && p.business_slug && <li>It cannot be collected at the studio.</li>}
                    {!p.pickup && !p.shipping && <li>It cannot be ordered online right now.</li>}
                    <li>You pay on {provider}&apos;s secure page when you place the order. LogaLuxe never sees your card.{wallets ? <WalletNote /> : null}</li>
                    {p.business_slug && <li>A question about an order goes to the seller. <Link href={`/b/${p.business_slug}`}>See {studio}</Link>.</li>}
                  </ul>
                </div>
              )}

              {usedIn.length > 0 && p.business_slug && (
                <div className="opts">
                  <span className="lbl">Used in</span>
                  <div className="chips">{usedIn.map((s) => <Link key={s.service_id} href={`/b/${p.business_slug}`} className="chip">{s.name}</Link>)}</div>
                </div>
              )}

              {p.business_slug && (
                <div className="pro">
                  <span className="av" aria-hidden />
                  {/* The starting price is named only when the API says what money the business charges in. */}
                  <div className="txt"><b>{p.pickup ? `Book ${studio} and pick this up at your visit` : `Book ${studio}`}</b>{p.business_from_cents != null && p.business_currency ? <span>Services from {money(p.business_from_cents, p.business_currency)}{p.business_city ? ` · ${p.business_city}` : ""}</span> : p.business_city ? <span>{p.business_city}</span> : null}</div>
                  <Link href={`/b/${p.business_slug}`} className="btn btn-gold btn-sm">Book</Link>
                </div>
              )}
            </div>
          </div>

          {related.length > 0 && (
            <section className="more">
              <h2 className="serif">Goes well with</h2>
              <div className="row">
                {related.map((r) => (
                  <Link key={r.slug} href={`/shop/${r.slug}`} className="pc">
                    <div className="ph" style={{ background: r.tone }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {r.photo_id && <img src={`/media/${r.photo_id}`} alt="" loading="lazy" decoding="async" />}
                    </div>
                    <div><b>{r.name}</b><span>{money(r.price_cents, cur)} · {r.seller_name}</span></div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
      <SiteFooter />
    </>
  );
}
