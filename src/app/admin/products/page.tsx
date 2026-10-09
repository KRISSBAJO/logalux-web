import Link from "next/link";
import { AdminPagination } from "@/components/admin-pagination";
import { ExportLink } from "@/components/export-link";
import { Btn, Content, Empty, FilterSearch, Flash, Hidden, Panel, Pill, ReadOnly, Tabs, Topbar, fmtMoney } from "@/components/admin-ui";
import { can, getAdmin, load, qs, type Row } from "@/lib/admin-api";
import { setProductActive } from "../actions";

export default async function Products({ searchParams }: { searchParams: Promise<{ [key: string]: string | undefined; q?: string; show?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const show = sp.show === "off" || sp.show === "low" ? sp.show : "";
  const q = sp.q ?? "";
  const paging = { page: sp.page, per_page: sp.per_page, sort: sp.sort, direction: sp.direction };
  const [admin, res, media] = await Promise.all([getAdmin(), load(`/products${qs({ ...paging, q, show })}`), load("/media?slot=product")]);
  const photoCount = new Map<string, number>();
  for (const m of (media.data.media ?? []) as Row[]) photoCount.set(m.ref, (photoCount.get(m.ref) ?? 0) + 1);
  const list: Row[] = res.data.products ?? [];
  const total: number = res.data.total ?? list.length;
  const back = `/admin/products${qs({ ...paging, q, show })}`;
  const ops = can(admin, "ops");

  return (
    <>
      <Topbar title="Products" sub="A product taken off sale disappears from the shop at once. Prices are in the seller's currency">
        <Tabs items={[["", `All · ${total}`], ["low", "Low stock"], ["off", "Off sale"]]} current={show} href={(s) => `/admin/products${qs({ q, show: s })}`} />
        <ExportLink kind="products" />
        <Link href="/admin/products/new" className="inline-flex h-10 items-center rounded-full bg-ink px-4 text-[13.5px] font-semibold text-cream hover:bg-ink-3">Add a product</Link>
      </Topbar>
      <Content>
        <Flash sp={sp} error={res.error} />
        <FilterSearch action="/admin/products" q={q} placeholder="Product, seller or shop link" keep={{ show }} />
        {!ops && <ReadOnly need="ops" />}
        <Panel flush>
          <table className="data min-w-[780px]">
            <thead><tr><th>Product</th><th>Seller</th><th>Price</th><th>Stock</th><th>Sold</th><th>Rating</th><th>Shop</th><th>Photos</th>{ops && <th />}</tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="hover:bg-cream">
                  <td>
                    <div className="flex items-center gap-3">
                      <i className="block h-9 w-9 flex-none rounded-lg" style={{ background: p.tone }} />
                      <span><Link href={`/admin/products/${p.slug}`} className="block font-semibold hover:text-wine">{p.name}</Link><span className="text-[12px] capitalize text-muted">{p.category}</span></span>
                    </div>
                  </td>
                  <td>{p.seller_name}</td>
                  <td className="font-semibold">{fmtMoney(p.price_cents, p.currency)}</td>
                  <td>{p.stock <= 10 ? <Pill kind={p.stock === 0 ? "wine" : "gold"}>{p.stock} left</Pill> : p.stock}</td>
                  <td>{Number(p.sold).toLocaleString("en-US")}</td>
                  <td>{Number(p.rating).toFixed(1)} <span className="text-muted">({Number(p.review_count).toLocaleString("en-US")})</span></td>
                  <td>{p.active ? <Pill kind="ok">on sale</Pill> : <Pill kind="grey">off sale</Pill>}</td>
                  <td><Link href={`/admin/products/${p.slug}`} className="text-[13px] font-semibold text-wine">{photoCount.get(p.slug) ?? 0} · Manage</Link></td>
                  {ops && (
                    <td>
                      <form action={setProductActive}>
                        <Hidden values={{ id: p.id, active: p.active ? "0" : "1", back }} />
                        {p.active ? <Btn small kind="danger">Take off sale</Btn> : <Btn small kind="ok">Put on sale</Btn>}
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <Empty>No products here.</Empty>}
        </Panel>
        <AdminPagination pagination={res.data.pagination} columns={["created_at", "name", "seller_name", "category", "price_cents", "stock", "sold", "rating"]} />
      </Content>
    </>
  );
}
