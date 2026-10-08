import "@/app/cx-css/product.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { CartLink } from "@/components/cart-ui";
import { ProductBuyBox } from "@/components/product-buy-box";
import { ProductGallery } from "@/components/product-gallery";
import { money } from "@/lib/api";
import { CustomerApiError, customerApi, getCustomer } from "@/lib/customer";
import { categoryName, tagName, type Size } from "@/lib/shop";
import { reviewProduct } from "./actions";

export const dynamic = "force-dynamic";

type Detail = {
  id: string; slug: string; name: string; seller_name: string; category: string; description: string | null; how_to_use: string | null;
  price_cents: number; compare_cents: number | null; stock: number; sizes: Size[] | null; tone: string; tags: string[] | null;
  rating: number; review_count: number; sold: number; pickup: boolean; shipping: boolean; shipping_cents: number;
  business_slug: string | null; business: string | null; seller_verified: boolean | null; business_currency: string | null; business_city: string | null;
  business_from_cents: number | null; used_in: { service_id: string; name: string }[] | null;
};
type Payload = {
  product: Detail;
  photos: { id: string; alt: string }[] | null;
  related: { slug: string; name: string; seller_name: string; price_cents: number; tone: string; rating: number; photo_id: string | null }[] | null;
  reviews: { id: string; author_name: string; rating: number; body: string; verified: boolean; created_at: string }[] | null;
  can: { review: boolean; why: string };
};

const load = (slug: string) => customerApi<Payload>(`/products/${encodeURIComponent(slug)}`);
const stars = (n: number) => "★".repeat(Math.max(0, Math.min(5, Math.round(n)))) + "☆".repeat(5 - Math.max(0, Math.min(5, Math.round(n))));
const day = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const part = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-US", { ...o, timeZone: "UTC" });
  return `${part({ day: "numeric" })} ${part({ month: "short" })} ${part({ year: "numeric" })}`;
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const { product } = await load(slug);
    return { title: `${product.name} by ${product.seller_name}`, description: product.description ?? undefined };
  } catch { return { title: "Product" }; }
}

export default async function ProductPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string; ok?: string; err?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
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

  const tabs: [string, string][] = [["details", "Details"], ...(p.how_to_use ? [["how", "How to use"] as [string, string]] : []), ["reviews", reviews.length ? `Reviews · ${p.review_count || reviews.length}` : "Reviews"], ["delivery", "Delivery"]];
  const tab = tabs.some(([k]) => k === sp.tab) ? sp.tab! : "details";

  const badge = usedIn.length > 0 && studio ? `Used in the chair at ${studio}` : tags.includes("bestseller") ? "Bestseller" : "";
  const facts = [
    sizes.length > 1 ? `Sizes: ${sizes.map((s) => (s.label.replace(/s/g, "") === money(s.price_cents) ? s.label : `${s.label} (${money(s.price_cents)})`)).join(", ")}` : sizes[0]?.label ? `Size: ${sizes[0].label}` : "",
    `Sold by ${p.seller_name}${p.business_city ? `, ${p.business_city}` : ""}`,
    tags.filter((t) => t !== "bestseller" && t !== p.category).length ? `Good to know: ${tags.filter((t) => t !== "bestseller" && t !== p.category).map(tagName).join(", ")}` : "",
  ].filter(Boolean);
  const trust: [string, string][] = [
    ...(p.pickup ? [["Free pickup", `Collect it at ${studio || p.seller_name}, nothing to pay for shipping`] as [string, string]] : []),
    ...(p.shipping ? [[p.shipping_cents > 0 ? `Ships for ${money(p.shipping_cents)}` : "Ships free", `One charge per order from ${p.seller_name}`] as [string, string]] : []),
    ["Pay securely", "On Stripe's page. LogaLuxe never sees your card"],
  ];

  return (
    <>
      <SiteHeader active="shop" />
      <div className="cx pg-product">
        <main className="wrap">
          <div className="top">
            <nav className="crumbs" aria-label="Breadcrumb"><Link href="/shop">Shop</Link><span aria-hidden>›</span><Link href={`/shop?category=${encodeURIComponent(p.category)}`}>{categoryName(p.category)}</Link><span aria-hidden>›</span><span aria-current="page">{p.name}</span></nav>
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

              <ProductBuyBox product={{ slug: p.slug, name: p.name, seller_name: p.seller_name, tone: p.tone, description: p.description ?? "", price_cents: p.price_cents, compare_cents: p.compare_cents, stock: p.stock, sizes, pickup: p.pickup, shipping: p.shipping, shipping_cents: p.shipping_cents, business: p.business, business_city: p.business_city }} />

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
              {tab === "how" && <div className="body">{p.how_to_use}</div>}
              {tab === "reviews" && (
                <div id="reviews">
                  {sp.ok && <p className="flash good" role="status">{sp.ok}</p>}
                  {sp.err && <p className="flash bad" role="alert">{sp.err}</p>}
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
                    {p.pickup && <li>Pick up is free. Collect your order at {studio}{p.business_city ? ` in ${p.business_city}` : ""}. Choose pick up in your cart and the studio tells you when it is ready.</li>}
                    {p.shipping && <li>{p.shipping_cents > 0 ? `Shipping is ${money(p.shipping_cents)}, charged once for everything you order from ${p.seller_name} in the same order.` : `${p.seller_name} ships this free.`}</li>}
                    {!p.shipping && <li>{p.seller_name} does not ship this product{p.pickup ? ", so it is pick up only" : ""}.</li>}
                    {!p.pickup && p.business_slug && <li>It cannot be collected at the studio.</li>}
                    {!p.pickup && !p.shipping && <li>It cannot be ordered online right now.</li>}
                    <li>You pay on Stripe&apos;s secure page when you place the order. LogaLuxe never sees your card.</li>
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
                  <div className="txt"><b>{p.pickup ? `Book ${studio} and pick this up at your visit` : `Book ${studio}`}</b>{p.business_from_cents != null && <span>Services from {money(p.business_from_cents, p.business_currency ?? "USD")}{p.business_city ? ` · ${p.business_city}` : ""}</span>}</div>
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
                    <div><b>{r.name}</b><span>{money(r.price_cents)} · {r.seller_name}</span></div>
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
