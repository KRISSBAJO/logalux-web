import Link from "next/link";
import { Btn, Content, Facts, Flash, Hidden, Panel, Pill, ReadOnly, Topbar, fmtMoney } from "@/components/admin-ui";
import { ProductFields } from "@/components/catalog-forms";
import { MediaManager } from "@/components/media-manager";
import { can, getAdmin, load, type Row } from "@/lib/admin-api";
import { saveProduct } from "../../actions-catalog";

export default async function ProductPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const [admin, products, media] = await Promise.all([getAdmin(), load("/products"), load(`/media?slot=product&ref=${encodeURIComponent(slug)}`)]);
  const p: Row | undefined = (products.data.products ?? []).find((x: Row) => x.slug === slug);
  const ops = can(admin, "ops");
  const back = `/admin/products/${slug}`;

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
              <ProductFields p={p} />
              <div><Btn kind="ink">Save product</Btn></div>
            </form>
          </Panel>
        )}
      </Content>
    </>
  );
}
