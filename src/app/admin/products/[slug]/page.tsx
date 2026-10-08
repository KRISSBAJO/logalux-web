import Link from "next/link";
import { Btn, Content, Facts, Field, Flash, Hidden, Panel, Pill, ReadOnly, Topbar, fmtMoney, inputCls } from "@/components/admin-ui";
import { ProductFields } from "@/components/catalog-forms";
import { MediaManager } from "@/components/media-manager";
import { can, getAdmin, load, type Row } from "@/lib/admin-api";
import { api } from "@/lib/api";
import { saveProduct, saveProductDetails } from "../../actions-catalog";

const area = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-ink";
const small = "h-10 w-[84px] min-w-0 rounded-xl border border-line bg-white px-3 text-[14px] text-ink outline-none focus:border-ink";
const pick = "flex cursor-pointer items-center gap-2.5 text-[14px]";
const dot = "h-4 w-4 accent-[#1A1513]";

export default async function ProductPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const [admin, products, media] = await Promise.all([getAdmin(), load("/products"), load(`/media?slot=product&ref=${encodeURIComponent(slug)}`)]);
  const p: Row | undefined = (products.data.products ?? []).find((x: Row) => x.slug === slug);
  const ops = can(admin, "ops");
  const back = `/admin/products/${slug}`;
  // The admin list has no ingredients, delivery time or returns. The shop’s own product page does, for a product on sale.
  const pub: Row | null = p ? ((await load(`/products/${encodeURIComponent(p.id)}/details`)).data as Row) : null;
  const ex: Row = pub?.extras ?? {}, brand = !p?.business_slug;
  const ships = !!ex.delivery, returns = !ex.returns ? "none" : Number(ex.returns.days) === 0 ? "no" : "days";

  if (!p) {
    return (
      <>
        <Topbar title="Product" />
        <Content><Flash sp={sp} error={products.error || "Product not found."} /><Link href="/admin/products" className="text-[14px] font-semibold text-wine">Back to products</Link></Content>
      </>
    );
  }
  return (
    <>
      <Topbar title={p.name} sub={`Sold by ${p.seller_name} · /shop/${p.slug}`}>
        <Link href="/admin/products" className="text-[13px] font-semibold text-muted hover:text-ink">All products</Link>
        <Link href={`/shop/${p.slug}`} className="inline-flex h-10 items-center rounded-full border border-line bg-white px-4 text-[13.5px] font-semibold hover:border-ink">View in the shop</Link>
      </Topbar>
      <Content>
        <Flash sp={sp} error={media.error} />
        <Panel>
          <Facts items={[["Price", fmtMoney(p.price_cents)], ["Stock", `${p.stock} left`], ["Sold", Number(p.sold).toLocaleString("en-US")], ["Category", p.category], ["Rating", `${Number(p.rating).toFixed(1)} from ${p.review_count}`], ["Shop", p.active ? <Pill key="a" kind="ok">on sale</Pill> : <Pill key="b" kind="grey">off sale</Pill>]]} />
        </Panel>
        {!ops && <ReadOnly need="ops" />}
        <Panel title="Photos" sub="Up to 6 show. The first is the picture in the shop grid; shoppers can flick through the rest.">
          <MediaManager slot="product" refKey={p.slug} items={media.data.media ?? []} back={back} canEdit={ops} max={6} aspect="aspect-square" hint="A square photo on a plain background works best, at least 800 pixels wide." />
        </Panel>
        {ops && (
          <Panel title="Details" sub="The shop link never changes, so old links and photos keep working.">
            <form action={saveProduct} className="flex flex-col gap-4">
              <Hidden values={{ id: p.id, back }} />
              <ProductFields p={p} howToApart />
              <div><Btn kind="ink">Save product</Btn></div>
            </form>
          </Panel>
        )}
        {ops && (
          <div id="details" className="scroll-mt-24">
            <Panel title="Ingredients, directions and delivery" sub="What a shopper reads on the product page before buying.">
              {pub ? (
                <form action={saveProductDetails} className="flex flex-col gap-4">
                  <Hidden values={{ id: p.id, back: back + "#details" }} />
                  <div className="grid gap-3 lg:grid-cols-2">
                    <Field label="Ingredients"><textarea name="ingredients" rows={5} maxLength={3000} defaultValue={ex.ingredients ?? ""} placeholder="As listed on the label" className={area} /></Field>
                    <Field label="How to use"><textarea name="how_to_use" rows={5} maxLength={3000} defaultValue={pub.product?.how_to_use ?? p.how_to_use ?? ""} className={area} /></Field>
                  </div>
                  {brand ? (
                    <div className="grid gap-5 lg:grid-cols-2">
                      <div className="flex flex-col gap-2.5" role="radiogroup" aria-labelledby="d-ship">
                        <span id="d-ship" className="text-[11px] font-semibold uppercase tracking-[.06em] text-muted">Delivery time</span>
                        <label className={pick}><input type="radio" name="ship_mode" value="none" defaultChecked={!ships} className={dot} />Not stated</label>
                        <div className="flex flex-wrap items-center gap-2 text-[14px]">
                          <label className={pick}><input type="radio" name="ship_mode" value="days" defaultChecked={ships} className={dot} />Arrives in</label>
                          <input name="ship_min" type="number" min="0" max="30" step="1" defaultValue={ships ? ex.delivery.days_min : ""} aria-label="Shortest delivery time in business days, 0 to 30" className={small} />
                          <span>to</span>
                          <input name="ship_max" type="number" min="0" max="30" step="1" defaultValue={ships ? ex.delivery.days_max : ""} aria-label="Longest delivery time in business days, 0 to 30" className={small} />
                          <span>business days</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2.5" role="radiogroup" aria-labelledby="d-ret">
                        <span id="d-ret" className="text-[11px] font-semibold uppercase tracking-[.06em] text-muted">Returns</span>
                        <label className={pick}><input type="radio" name="returns_mode" value="none" defaultChecked={returns === "none"} className={dot} />Not stated</label>
                        <label className={pick}><input type="radio" name="returns_mode" value="no" defaultChecked={returns === "no"} className={dot} />No returns</label>
                        <div className="flex flex-wrap items-center gap-2 text-[14px]">
                          <label className={pick}><input type="radio" name="returns_mode" value="days" defaultChecked={returns === "days"} className={dot} />Returns within</label>
                          <input name="returns_n" type="number" min="1" max="90" step="1" defaultValue={returns === "days" ? ex.returns.days : ""} aria-label="Days a shopper has to return the product, 1 to 90" className={small} />
                          <span>days</span>
                        </div>
                      </div>
                      <p className="text-[13px] text-muted lg:col-span-2">Delivery time and returns set here apply because no business sells this product. A business&apos;s own shop policy covers the products it sells.</p>
                    </div>
                  ) : (
                    <p className="text-[13px] text-muted">Delivery time and returns for this product come from the shop policy of the business that sells it ({p.business_slug}). The business sets that policy in its own Online orders screen.</p>
                  )}
                  <div><Btn kind="ink">Save details</Btn></div>
                </form>
              ) : (
                <p className="text-[14px] text-muted">{p.active ? "These details could not be loaded just now. Reload the page to try again." : "This product is off sale, so it has no page in the shop to read these from. Put it back on sale in the product list, then edit them here."}</p>
              )}
            </Panel>
          </div>
        )}
      </Content>
    </>
  );
}
