import "@/app/cx-css/shop.css";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { AddToCart, CartLink } from "@/components/cart-ui";
import { money } from "@/lib/api";
import { customerApi } from "@/lib/customer";
import { categoryName, isValueTag, tagName, type ShopList, type ShopProduct } from "@/lib/shop";

export const metadata = { title: "Shop", description: "Beauty products from the professionals you book, and the brands they trust." };
export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;

const SORTS: [string, string][] = [["recommended", "recommended"], ["price_asc", "price, low to high"], ["price_desc", "price, high to low"], ["rating", "top rated"], ["new", "newest"]];
// Price bands in cents, as the API's min and max.
const BANDS: { key: string; label: string; min: number; max: number }[] = [
  { key: "under-15", label: "Under $15", min: 0, max: 1499 },
  { key: "15-30", label: "$15 to $30", min: 1500, max: 3000 },
  { key: "over-30", label: "Over $30", min: 3001, max: 0 },
];
const inBand = (cents: number, b: (typeof BANDS)[number]) => cents >= b.min && (b.max === 0 || cents <= b.max);
const KEYS = ["q", "category", "seller", "tag", "delivery", "price", "sort", "page", "per"] as const;
type Key = (typeof KEYS)[number];

/** The lowest price a customer can pay for it, and whether there is a choice of sizes to make first. */
function priceOf(p: ShopProduct) {
  const sizes = p.sizes ?? [];
  const several = sizes.length > 1;
  const from = several ? Math.min(...sizes.map((s) => s.price_cents)) : sizes[0]?.price_cents ?? p.price_cents;
  return { several, from, size: several ? "" : sizes[0]?.label ?? "" };
}

function Tile({ p }: { p: ShopProduct }) {
  // eslint-disable-next-line @next/next/no-img-element
  return p.photo_id ? <img src={`/media/${p.photo_id}`} alt={p.name} loading="lazy" decoding="async" className="pic" /> : <span className="cap" aria-hidden>{p.name}</span>;
}

export default async function Shop({ searchParams }: { searchParams: Promise<Params> }) {
  const raw = await searchParams;
  const sp = Object.fromEntries(KEYS.map((k) => [k, String((Array.isArray(raw[k]) ? raw[k]?.[0] : raw[k]) ?? "").trim()])) as Record<Key, string>;
  const band = BANDS.find((b) => b.key === sp.price);
  const sort = SORTS.some(([k]) => k === sp.sort) ? sp.sort : "recommended";
  const page = Math.max(1, Number.parseInt(sp.page, 10) || 1);
  const delivery = sp.delivery === "pickup" || sp.delivery === "ship" ? sp.delivery : "";

  const qs = new URLSearchParams();
  if (sp.q) qs.set("q", sp.q);
  if (sp.category) qs.set("category", sp.category);
  if (sp.seller) qs.set("seller", sp.seller);
  if (sp.tag) qs.set("tag", sp.tag);
  if (delivery) qs.set("delivery", delivery);
  if (band?.min) qs.set("min", String(band.min));
  if (band?.max) qs.set("max", String(band.max));
  if (sort !== "recommended") qs.set("sort", sort);
  if (page > 1) qs.set("page", String(page));
  if (Number.parseInt(sp.per, 10) > 0) qs.set("per", sp.per);

  // The list being looked at, and the shop's bestsellers for the pictures in the hero.
  let data: ShopList | null = null, top: ShopProduct[] = [], error = "";
  try {
    const [list, best] = await Promise.all([customerApi<ShopList>(`/products?${qs}`), customerApi<ShopList>("/products?per=60").catch(() => null)]);
    data = list;
    top = best?.products ?? [];
  } catch (e) {
    error = (e as Error).message;
  }
  const products = data?.products ?? [], total = data?.total ?? 0, per = data?.per_page ?? 24;
  const categories = data?.categories ?? [], sellers = data?.sellers ?? [], tags = data?.tags ?? [], booked = data?.booked ?? [];
  const pages = Math.max(1, Math.ceil(total / per));

  /** A link to this page with some of the state changed. Changing a filter goes back to the first page. */
  const href = (change: Partial<Record<Key, string>>, hash = "") => {
    const next = { ...sp, sort: sort === "recommended" ? "" : sort, delivery, price: band?.key ?? "", page: "", ...change };
    const out = new URLSearchParams();
    for (const k of KEYS) if (next[k]) out.set(k, next[k]);
    const s = out.toString();
    return `/shop${s ? `?${s}` : ""}${hash}`;
  };

  // Only what the shop really has is offered as a filter.
  const studios = sellers.filter((s) => s.business_slug);
  const brandCount = sellers.filter((s) => !s.business_slug).reduce((a, s) => a + Number(s.n), 0);
  const bookedStudios = studios.filter((s) => booked.includes(s.business_slug!));
  const featured = bookedStudios[0] ?? studios[0];
  const sellerOptions: { value: string; label: string; n?: number }[] = [
    ...(bookedStudios.length ? [{ value: "booked", label: "Professionals I've booked", n: bookedStudios.reduce((a, s) => a + Number(s.n), 0) }] : []),
    ...studios.map((s) => ({ value: s.business_slug!, label: s.seller_name, n: Number(s.n) })),
    ...(brandCount ? [{ value: "brands", label: "Brands", n: brandCount }] : []),
  ];
  if (sp.seller && !sellerOptions.some((o) => o.value === sp.seller)) sellerOptions.push({ value: sp.seller, label: sp.seller === "booked" ? "Professionals I've booked" : sp.seller === "brands" ? "Brands" : sp.seller, n: Number(sellers.find((s) => s.seller_name === sp.seller)?.n) || undefined });
  const categoryKeys = new Set(categories.map((c) => c.category));
  const shownTags = tags.filter((t) => !categoryKeys.has(t.tag) && t.tag !== "bestseller");
  const goodFor = shownTags.filter((t) => !isValueTag(t.tag)), values = shownTags.filter((t) => isValueTag(t.tag));
  const canCollect = top.some((p) => p.pickup), shippers = top.filter((p) => p.shipping);
  const shipFrom = shippers.length ? Math.min(...shippers.map((p) => p.shipping_cents)) : 0;
  const bands = BANDS.filter((b) => b === band || top.length >= 60 || top.some((p) => inBand(p.price_cents, b)));

  const sellerLabel = sellerOptions.find((o) => o.value === sp.seller)?.label;
  const narrowed = [sp.q ? `"${sp.q}"` : "", sellerLabel ?? "", sp.tag ? tagName(sp.tag) : "", delivery === "pickup" ? "Pick up" : delivery === "ship" ? "Shipped" : "", band?.label ?? ""].filter(Boolean);
  const filtered = narrowed.length > 0 || !!sp.category;

  const check = (on: boolean, to: string, label: string, n?: number) => (
    <Link key={label} href={to} scroll={false} className={`fl ${on ? "on" : ""}`} aria-current={on ? "true" : undefined}>
      <span className="box" aria-hidden />
      <span>{label}</span>
      {n !== undefined && <small>{n}</small>}
    </Link>
  );

  return (
    <>
      <SiteHeader active="shop" />
      <div className="cx pg-shop">
        <section className="hero">
          <div className="wrap">
            <div>
              <div className="eyebrow"><i />The LogaLuxe shop</div>
              <h1 className="serif">What your stylist <em>actually uses.</em></h1>
              <p>Products sold by the professionals you book, and the brands they trust. {canCollect ? "Pick up at your next visit for free, or get it shipped." : "Shipped to your door."}</p>
              <div className="herobtns">
                <a href="#grid" className="btn btn-gold">Shop bestsellers</a>
                {featured && <Link href={href({ q: "", category: "", tag: "", delivery: "", price: "", seller: featured.business_slug! }, "#grid")} className="btn btn-ghost">From {featured.seller_name}</Link>}
                <CartLink />
              </div>
            </div>
            {top.length > 0 && (
              <div className="herogrid">
                {top.slice(0, 6).map((p) => (
                  <Link key={p.slug} href={`/shop/${p.slug}`} style={{ background: p.tone }} aria-label={p.name}><Tile p={p} /></Link>
                ))}
              </div>
            )}
          </div>
        </section>

        <main className="wrap">
          <nav className="cats" aria-label="Categories">
            <Link href={href({ category: "" })} scroll={false} className={`chip ${sp.category ? "" : "on"}`} aria-current={sp.category ? undefined : "true"}>All</Link>
            {categories.map((c) => (
              <Link key={c.category} href={href({ category: c.category })} scroll={false} className={`chip ${sp.category === c.category ? "on" : ""}`} aria-current={sp.category === c.category ? "true" : undefined}>{categoryName(c.category)}</Link>
            ))}
          </nav>

          <div className="layout" id="grid">
            <aside className="filters" aria-label="Filters">
              {(canCollect || shippers.length > 0) && (
                <div className="fgrp"><b>Delivery</b>
                  {canCollect && check(delivery === "pickup", href({ delivery: delivery === "pickup" ? "" : "pickup" }), "Pick up at my next visit · free")}
                  {shippers.length > 0 && check(delivery === "ship", href({ delivery: delivery === "ship" ? "" : "ship" }), shipFrom > 0 ? `Ship to me · from ${money(shipFrom)}` : "Ship to me · free")}
                </div>
              )}
              {sellerOptions.length > 0 && (
                <div className="fgrp"><b>Seller</b>
                  {sellerOptions.map((o) => check(sp.seller === o.value, href({ seller: sp.seller === o.value ? "" : o.value }), o.label, o.n))}
                </div>
              )}
              {goodFor.length > 0 && (
                <div className="fgrp"><b>Good for</b>
                  {goodFor.map((t) => check(sp.tag === t.tag, href({ tag: sp.tag === t.tag ? "" : t.tag }), tagName(t.tag), Number(t.n)))}
                </div>
              )}
              {values.length > 0 && (
                <div className="fgrp"><b>Values</b>
                  {values.map((t) => check(sp.tag === t.tag, href({ tag: sp.tag === t.tag ? "" : t.tag }), tagName(t.tag), Number(t.n)))}
                </div>
              )}
              {bands.length > 0 && (
                <div className="fgrp"><b>Price</b>
                  {bands.map((b) => check(band === b, href({ price: band === b ? "" : b.key }), b.label))}
                </div>
              )}
            </aside>

            <div className="results">
              <div className="bar">
                <span className="muted count">
                  <b>{total} {total === 1 ? "product" : "products"}</b> · {sp.category ? categoryName(sp.category) : "All"}{narrowed.map((n) => ` · ${n}`).join("")}
                  {filtered && <> · <Link href={href({ q: "", category: "", seller: "", tag: "", delivery: "", price: "" })} scroll={false}>Clear filters</Link></>}
                </span>
                <div className="tools">
                  <form action="/shop" method="get" role="search" className="search">
                    {(["category", "seller", "tag", "delivery", "price", "sort", "per"] as const).map((k) => {
                      const v = k === "sort" ? (sort === "recommended" ? "" : sort) : k === "price" ? band?.key ?? "" : k === "delivery" ? delivery : sp[k];
                      return v ? <input key={k} type="hidden" name={k} value={v} /> : null;
                    })}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                    <label className="sr" htmlFor="shop-q">Search products</label>
                    <input id="shop-q" type="search" name="q" defaultValue={sp.q} key={sp.q} placeholder="Search products or sellers" />
                    <button type="submit" className="sr">Search</button>
                  </form>
                  <details className="sort" key={`${sort}|${qs}`}>
                    <summary className="btn btn-out btn-sm">Sort: {SORTS.find(([k]) => k === sort)?.[1]}</summary>
                    <div className="menu">
                      {SORTS.map(([k, label]) => (
                        <Link key={k} href={href({ sort: k === "recommended" ? "" : k })} scroll={false} className={k === sort ? "on" : ""} aria-current={k === sort ? "true" : undefined}>{label[0].toUpperCase() + label.slice(1)}</Link>
                      ))}
                    </div>
                  </details>
                </div>
              </div>

              {error && <p className="note" role="alert">The shop could not be loaded. {error}</p>}
              {!error && products.length === 0 && (
                <p className="note">Nothing matches that. <Link href="/shop">See every product</Link>.</p>
              )}

              <div className="grid">
                {products.map((p) => {
                  const { several, from, size } = priceOf(p);
                  const was = !several && p.compare_cents && p.compare_cents > from ? p.compare_cents : 0;
                  const sizes = p.sizes ?? [];
                  const facts = [p.review_count > 0 ? `${Number(p.rating).toFixed(1)} · ${p.review_count} ${p.review_count === 1 ? "review" : "reviews"}` : "", several ? `${sizes.length} sizes` : size].filter(Boolean);
                  const tag = p.stock < 1 ? ["pill-grey", "Sold out"] : was ? ["pill-ok", `Save ${money(was - from)}`] : (p.tags ?? []).includes("bestseller") ? ["pill-wine", "Bestseller"] : null;
                  return (
                    <div key={p.slug} className="pc">
                      <Link href={`/shop/${p.slug}`} className="ph" style={{ background: p.tone }} aria-label={p.name}>
                        {tag && <span className={`pill ${tag[0]} tag`}>{tag[1]}</span>}
                        <Tile p={p} />
                      </Link>
                      <div className="b">
                        <div className="by"><span className="av" style={{ background: p.tone }} />{p.seller_name}</div>
                        <Link href={`/shop/${p.slug}`} className="name"><h3>{p.name}</h3></Link>
                        {facts.length > 0 && <div className="rt">{p.review_count > 0 && <i aria-hidden>★</i>}{facts.join(" · ")}</div>}
                        <div className="foot">
                          <span className="price">{several ? `From ${money(from)}` : money(from)}{was > 0 && <s>{money(was)}</s>}</span>
                          {several ? <Link href={`/shop/${p.slug}`} className="add">Choose size</Link> : <AddToCart product={{ slug: p.slug, name: p.name, seller_name: p.seller_name, tone: p.tone, stock: p.stock }} size={size} unitCents={from} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {pages > 1 && (
                <nav className="pager" aria-label="Pages">
                  {page > 1 ? <Link href={href({ page: page > 2 ? String(page - 1) : "" }, "#grid")} className="btn btn-out btn-sm">Previous</Link> : <span className="btn btn-out btn-sm off" aria-disabled="true">Previous</span>}
                  <span className="muted">Page {Math.min(page, pages)} of {pages}</span>
                  {page < pages ? <Link href={href({ page: String(page + 1) }, "#grid")} className="btn btn-out btn-sm">Next</Link> : <span className="btn btn-out btn-sm off" aria-disabled="true">Next</span>}
                </nav>
              )}

              {canCollect && (
                <div className="band">
                  <div className="txt"><h2 className="serif">Pick up at your visit, pay nothing to ship</h2><p>Choose pick up in your cart and your order waits for you at the studio. No shipping charge, and no box.</p></div>
                  {featured && <Link href={`/b/${featured.business_slug}`} className="btn btn-ink">Visit {featured.seller_name}</Link>}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
      <SiteFooter />
    </>
  );
}
