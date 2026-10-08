import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { ConfirmButton, Sheet } from "@/components/merchant-client";
import { Avatar, Empty, Flash, Fld, Ic, LoadError, NoAccess, Topbar, TopSearch } from "@/components/merchant-ui";
import { api } from "@/lib/api";
import { getMe, mLoad, qs, type Row } from "@/lib/merchant-api";
import { clock, dateMed, dateOnly, initials, money, pct, plural, ymd } from "@/lib/merchant-format";
import { orderAction, orderCreate, orderSuggest, productCreate, productDetails, productPhoto, productPhotoRemove, productSave, productStock, productTransfer, productUses, stockCount, supplierCreate, supplierDelete } from "./actions";
import { OnlineOrders } from "./online-orders";
import "../../css/inventory.css";

export const metadata = { title: "Inventory" };

type SP = { ok?: string; err?: string; q?: string; filter?: string; sel?: string; product?: string; new?: string; location?: string; tab?: string; status?: string; view?: string; answer?: string };

const KIND: Record<string, string> = { retail: "Retail", backbar: "Back-bar", both: "Retail and back-bar" };
const CATEGORY: Record<string, string> = { hair: "Hair", styling: "Styling", tools: "Tools", skin: "Skin", nails: "Nails", gift: "Gifts" };
const FILTERS: [string, string][] = [["", "All"], ["retail", "Retail"], ["backbar", "Back-bar"], ["low", "Low stock"], ["online", "Sold online"], ["off", "Not sold online"]];
const REASON: Record<string, string> = { restock: "Delivery", adjust: "Correction", backbar: "Used in services", count: "Count", transfer: "Moved", return: "Returned", sale: "Sold", order: "Online order", refund: "Refund" };
const PO: Record<string, [string, string]> = { draft: ["Draft", "pill-gold"], ordered: ["Ordered", "pill-ok"], received: ["Received", "pill-grey"], cancelled: ["Cancelled", "pill-grey"] };

const major = (cents: number | null | undefined) => (cents ? String(cents / 100) : "");
const isLow = (p: Row) => p.reorder_at > 0 && p.stock <= p.reorder_at;
const sells = (p: Row) => p.kind !== "backbar";

/** The fields of a product: the same for a new one and for one being changed. */
function ProductFields({ p, suppliers, cur, id }: { p?: Row; suppliers: Row[]; cur: string; id: string }) {
  return (
    <>
      <div className="field"><label htmlFor={id + "n"}>Name</label><input id={id + "n"} name="name" type="text" required minLength={2} maxLength={100} defaultValue={p?.name ?? ""} /></div>
      <div className="two">
        {p
          ? <div className="field"><label htmlFor={id + "st"}>In stock</label><input id={id + "st"} type="text" value={p.stock} disabled readOnly /></div>
          : <div className="field"><label htmlFor={id + "st"}>In stock now</label><input id={id + "st"} name="stock" type="number" min={0} step={1} defaultValue={0} /></div>}
        <div className="field"><label htmlFor={id + "ro"}>Reorder at</label><input id={id + "ro"} name="reorder_at" type="number" min={0} step={1} defaultValue={p?.reorder_at ?? 0} /></div>
        <div className="field"><label htmlFor={id + "par"}>Full shelf</label><input id={id + "par"} name="par_level" type="number" min={0} step={1} defaultValue={p?.par_level ?? ""} placeholder="Not set" /></div>
        <div className="field"><label htmlFor={id + "sku"}>SKU</label><input id={id + "sku"} name="sku" type="text" maxLength={40} defaultValue={p?.sku ?? ""} /></div>
        <div className="field"><label htmlFor={id + "co"}>Cost ({cur})</label><input id={id + "co"} name="cost" type="number" min={0} step="0.01" inputMode="decimal" defaultValue={major(p?.cost_cents)} /></div>
        <div className="field"><label htmlFor={id + "pr"}>Retail price ({cur})</label><input id={id + "pr"} name="price" type="number" min={0} step="0.01" inputMode="decimal" defaultValue={p && sells(p) ? major(p.price_cents) : ""} /></div>
      </div>
      <div className="field">
        <label htmlFor={id + "ty"}>Type</label>
        <select id={id + "ty"} name="kind" defaultValue={p?.kind ?? "retail"}>
          <option value="retail">Retail: sold to clients</option>
          <option value="backbar">Back-bar: used in services, not sold</option>
          <option value="both">Retail and back-bar</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor={id + "cat"}>Category</label>
        <select id={id + "cat"} name="category" defaultValue={p?.category ?? "hair"}>{Object.entries(CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      <div className="field">
        <label htmlFor={id + "su"}>Supplier</label>
        <select id={id + "su"} name="supplier_id" defaultValue={p?.supplier_id ?? ""}>
          <option value="">No supplier</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="field"><label htmlFor={id + "de"}>Description</label><textarea id={id + "de"} name="description" maxLength={2000} defaultValue={p?.description ?? ""} /></div>
      <label className="chk"><input type="checkbox" name="online" defaultChecked={p ? !!p.active && sells(p) : true} />Sell online: in the shop and on the booking page</label>
      <small className="hint">Stock is changed with Adjust stock, so every change is on record. The reorder level is when it shows as low: 0 switches that off. Full shelf is how many you hold when fully stocked, and sets the scale of the stock meter. A back-bar product has no price and is never sold online.</small>
    </>
  );
}

export default async function Inventory({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const me = (await getMe())!;
  const { merchant: m } = me;
  if (sp.tab === "orders") return <OnlineOrders sp={sp} m={m} />;
  const q = (sp.q ?? "").trim(), filter = FILTERS.some(([id]) => id && id === sp.filter) ? sp.filter! : "";
  const narrowed = !!(q || filter);
  const [res, whole, hist] = await Promise.all([
    mLoad("/inventory" + qs({ q, filter, location: /^[0-9a-f-]{36}$/i.test(sp.location ?? "") ? sp.location : "" })),
    narrowed ? mLoad("/inventory") : null,
    sp.product ? mLoad(`/products/${encodeURIComponent(sp.product)}/history`) : null,
  ]);
  if (res.status === 403) return <div className="main pg-inventory"><NoAccess title="Inventory" need="manager" /></div>;
  if (res.error) return <div className="main pg-inventory"><LoadError title="Inventory" error={res.error} /></div>;

  const d = res.data, tz = m.timezone, cur = m.currency, today = ymd(new Date(), tz);
  const k = d.kpis as Row, rows = (d.products ?? []) as Row[], suppliers = (d.suppliers ?? []) as Row[], orders = (d.orders ?? []) as Row[];
  const all = ((whole && !whole.error ? whole.data.products : d.products) ?? []) as Row[];
  const count: Record<string, number> = { "": all.length, retail: all.filter((p) => p.kind !== "backbar").length, backbar: all.filter((p) => p.kind !== "retail").length, low: all.filter(isLow).length, online: all.filter((p) => p.active && p.kind !== "backbar").length, off: all.filter((p) => !p.active).length };
  const low = all.filter(isLow);
  const onOrder = new Set(orders.filter((o) => o.status === "ordered").flatMap((o) => ((o.items ?? []) as Row[]).map((i) => i.product_id as string)));
  const draft = orders.find((o) => o.status === "draft");
  const sel = all.find((p) => p.id === (sp.sel ?? sp.product)) ?? rows[0];
  const shown = all.find((p) => p.id === sp.product);
  // The stock list does not carry a product’s ingredients and directions. The shop’s own product page does,
  // and only for a product that is on sale there, so that is where the saved text is read from.
  const listed = !!sel && sells(sel) && !!sel.active && !!sel.slug;
  const pub: Row | null = sel ? ((await mLoad(`/products/${encodeURIComponent(sel.id)}/details`)).data as Row) : null;
  void listed;
  // Stock per location only shows when there is more than one location. With one, nothing here changes.
  const locations = (d.locations ?? []) as Row[], multi = locations.length > 1;
  const loc = multi ? locations.find((l) => l.id === sp.location) : undefined, at = loc?.id as string | undefined;
  const main = locations.find((l) => l.is_primary) ?? locations[0];
  const shelf = (p: Row, id: string | undefined) => Number((((p.by_location ?? []) as Row[]).find((x) => x.location_id === id)?.qty) ?? 0);
  const href = (extra: Record<string, string | undefined> = {}) => "/business/inventory" + qs({ q, filter, location: at, sel: sp.sel, ...extra });
  const back = href({ sel: sel?.id });
  const top = Math.max(1, ...all.map((p) => p.stock as number));
  // The meter fills to a full shelf when one is set; otherwise to three times the reorder level, or the fullest product.
  const meter = (p: Row) => Math.min(100, pct(p.stock, p.par_level > 0 ? p.par_level : p.reorder_at > 0 ? Math.max(p.reorder_at * 3, 1) : top));
  const services = (d.services ?? []) as Row[], storage = d.storage !== false;
  const status = (p: Row): [string, string] => (p.stock <= 0 ? ["Out of stock", "pill-wine"] : isLow(p) ? ["Low", "pill-wine"] : onOrder.has(p.id) ? ["On order", "pill-gold"] : ["OK", "pill-ok"]);
  const margin = (p: Row) => (sells(p) && p.price_cents > 0 ? `${pct(p.price_cents - p.cost_cents, p.price_cents)}%` : "Not sold");
  const month = String(d.month_label ?? "this month");
  const history = (hist && !hist.error ? hist.data.history ?? [] : []) as Row[];

  return (
    <div className="main pg-inventory">
      <Topbar title="Inventory">
        <TopSearch action="/business/inventory" value={q} placeholder="Product or SKU" hidden={{ filter, location: at }} />
        <span style={{ flex: 1 }} />
        <Link href="/business/inventory?tab=orders" className="btn btn-out">Online orders</Link>
        {all.length > 0 && (
          <Sheet trigger="Stock count" title={multi ? `Stock count at ${(loc ?? main).name}` : "Stock count"} sub={multi ? `Type what is on the shelf at ${(loc ?? main).name}. Only the numbers you change are saved. To count another location, choose it at the top of the screen first.` : "Type what is on the shelf. Only the numbers you change are saved."} wide>
            <form action={stockCount}>
              <input type="hidden" name="back" value={back} />
              {multi && <input type="hidden" name="location_id" value={(loc ?? main).id} />}
              <DataTable id="stock-count" search="Search products" pageSize={25} noun="product">
                <table className="tbl">
                  <thead><tr><th>Product</th><th className="num">On record</th><th className="num" data-nosort>Counted</th></tr></thead>
                  <tbody>
                    {all.map((p) => (
                      <tr key={p.id}>
                        <td><b>{p.name}</b>{p.sku ? <small className="muted" style={{ display: "block" }}>{p.sku}</small> : null}</td>
                        <td className="num">{multi ? shelf(p, (loc ?? main).id) : p.stock}</td>
                        <td className="num"><input type="hidden" name={`was_${p.id}`} value={multi ? shelf(p, (loc ?? main).id) : p.stock} /><input className="inp" style={{ width: 96, textAlign: "right" }} type="number" min={0} step={1} name={`count_${p.id}`} defaultValue={multi ? shelf(p, (loc ?? main).id) : p.stock} aria-label={`Counted: ${p.name}`} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTable>
              <Fld label="Note" hint="Saved with each correction in the stock history."><input type="text" name="note" maxLength={120} placeholder="Stock count" /></Fld>
              <div className="sheet-ft"><button className="btn btn-ink">Save count</button></div>
            </form>
          </Sheet>
        )}
        <Sheet trigger="Suppliers" title="Suppliers" sub="Who you buy stock from.">
          {suppliers.length ? suppliers.map((s) => (
            <div key={s.id} className="order" style={{ padding: 0, border: 0 }}>
              <Avatar name={s.name} tone="#4A3426" />
              <div style={{ flex: 1, minWidth: 0 }}><b>{s.name}</b><span>{[s.contact, s.phone, s.email].filter(Boolean).join(" · ") || "No contact details"} · {plural(s.products, "product")}</span></div>
              <form action={supplierDelete}>
                <input type="hidden" name="back" value={back} />
                <input type="hidden" name="id" value={s.id} />
                <ConfirmButton className="btn btn-ghost btn-sm" message={`Remove ${s.name}? Its products and past orders are kept, without a supplier.`}>Remove</ConfirmButton>
              </form>
            </div>
          )) : <Empty title="No suppliers yet">Add one so products and orders can name it.</Empty>}
          <hr className="divide" />
          <form action={supplierCreate}>
            <input type="hidden" name="back" value={back} />
            <Fld label="Supplier name"><input type="text" name="name" required maxLength={100} /></Fld>
            <Fld label="Contact person"><input type="text" name="contact" maxLength={100} /></Fld>
            <div className="f2">
              <Fld label="Phone"><input type="tel" name="phone" /></Fld>
              <Fld label="Email"><input type="email" name="email" /></Fld>
            </div>
            <div className="sheet-ft"><button className="btn btn-ink">Add supplier</button></div>
          </form>
        </Sheet>
        <Sheet trigger={<><Ic name="plus" size={16} stroke={2.4} />Add product</>} triggerClass="btn btn-ink" title="New product" open={sp.new === "1"} closeHref={back}>
          <form action={productCreate}>
            <input type="hidden" name="back" value={back} />
            <ProductFields suppliers={suppliers} cur={cur} id="new-" />
            <div className="sheet-ft"><button className="btn btn-ink">Add product</button></div>
          </form>
        </Sheet>
      </Topbar>

      <div className="content">
        <Flash sp={sp} />
        <div className="kpis">
          <div className="kpi"><small>Retail revenue · {month}</small><b>{money(k.retail_cents, cur)}</b><span>{k.sales > 0 ? `in ${pct(k.sales_with_retail, k.sales)}% of ${plural(k.sales, "sale")}` : "no sales yet this month"}</span></div>
          <div className="kpi"><small>Retail margin</small><b>{k.retail_cents > 0 ? `${pct(k.profit_cents, k.retail_cents)}%` : "0%"}</b><span>{k.retail_cents > 0 ? `${money(k.profit_cents, cur)} profit` : "nothing sold yet this month"}</span></div>
          <div className="kpi"><small>Stock value</small><b>{money(k.stock_value_cents, cur)}</b><span>at cost · {multi ? plural(locations.length, "location") : plural(k.products, "product")}</span></div>
          <div className="kpi"><small>Low stock</small><b>{k.low}</b><span>{k.low > 0 ? "at or below reorder level" : "nothing to reorder"}</span></div>
          <div className="kpi"><small>Back-bar used · {month}</small><b>{money(k.backbar_cents, cur)}</b><span>{k.sales > 0 && k.backbar_cents > 0 ? `${money(Math.round(k.backbar_cents / k.sales), cur, { exact: true })} per sale` : "at cost"}</span></div>
        </div>

        {all.length > 0 && (
          <div className="ai">
            <Ic name="spark" size={22} color="#D4AF5A" />
            <div style={{ flex: 1, fontSize: 14, lineHeight: 1.45, minWidth: 200 }}>
              {low.length ? (
                <>
                  <b>{plural(low.length, "product")}</b> {low.length === 1 ? "is" : "are"} at or below {low.length === 1 ? "its" : "their"} reorder level: {low.slice(0, 3).map((p) => `${p.name} (${p.stock} left)`).join(", ")}{low.length > 3 ? ` and ${low.length - 3} more` : ""}.{" "}
                  {draft ? `Draft ${draft.ref} for ${money(draft.total_cents, cur)} is waiting under Purchase orders.` : "A draft order can cover about four weeks at the pace of the last 30 days."}
                </>
              ) : "Nothing is at its reorder level. Stock is in hand."}
            </div>
            {low.length > 0 && (draft
              ? <a href="#orders" className="btn btn-sm" style={{ background: "#D4AF5A", color: "#1A1513" }}>Review order</a>
              : (
                <form action={orderSuggest}>
                  <input type="hidden" name="back" value={back} />
                  <button className="btn btn-sm" style={{ background: "#D4AF5A", color: "#1A1513" }}>Draft order</button>
                </form>
              ))}
          </div>
        )}

        {multi && (
          <div className="locs">
            <nav className="seg" aria-label="Location">
              <Link href={"/business/inventory" + qs({ q, filter, sel: sp.sel })} className={at ? "" : "on"} aria-current={at ? undefined : "true"}>All locations</Link>
              {locations.map((l) => <Link key={l.id} href={"/business/inventory" + qs({ q, filter, sel: sp.sel, location: l.id })} className={at === l.id ? "on" : ""} aria-current={at === l.id ? "true" : undefined}>{l.name}</Link>)}
            </nav>
            <div className="locsum">
              {locations.map((l) => <span key={l.id}><b>{l.name}</b>{l.is_primary ? " (main)" : ""}: {plural(l.units, "unit")} · {money(l.value_cents, cur)} at cost</span>)}
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {FILTERS.map(([id, name]) => <Link key={id} href={"/business/inventory" + qs({ q, filter: id, location: at })} className={"chip" + (filter === id ? " on" : "")} aria-current={filter === id ? "true" : undefined}>{name} <small>{count[id]}</small></Link>)}
          {q && <Link href={"/business/inventory" + qs({ filter, location: at })} className="chip">Clear search</Link>}
        </div>

        <div className="wrap">
          {rows.length ? (
            <div className="tablebox">
              <DataTable id="products" search="Search this list" filters={["Type", "Supplier", "Status"]} pageSize={25} noun="product"><table>
                <thead><tr><th>Product</th><th>Type</th><th>Stock</th><th>Reorder at</th><th>Cost</th><th>Price</th><th>Sold 30d</th><th>Supplier</th><th>Status</th></tr></thead>
                <tbody>
                  {rows.map((r) => {
                    const [label, cls] = status(r);
                    return (
                      <tr key={r.id} className={"row" + (sel?.id === r.id ? " on" : "")}>
                        <td><Link href={href({ sel: r.id })} className="name">{r.photo_id
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img className="ph" src={`/media/${r.photo_id}`} alt="" loading="lazy" />
                          : <span className="ph" style={{ background: r.tone || undefined }} />}<div>{r.name}<small>{[r.sku, CATEGORY[r.category] ?? r.category].filter(Boolean).join(" · ")}</small></div></Link></td>
                        <td>{KIND[r.kind] ?? r.kind}</td>
                        <td data-sort={at ? shelf(r, at) : r.stock}><div className="stock"><div className="m"><i className={isLow(r) ? "low" : ""} style={{ width: `${meter(r)}%` }} /></div><b>{at ? shelf(r, at) : r.stock}</b>{at ? <small className="muted">of {r.stock}</small> : null}</div></td>
                        <td data-sort={r.reorder_at}>{r.reorder_at > 0 ? r.reorder_at : <span className="muted">Off</span>}</td>
                        <td data-sort={r.cost_cents}>{money(r.cost_cents, cur)}</td>
                        <td data-sort={sells(r) ? r.price_cents : 0}>{sells(r) ? <b>{money(r.price_cents, cur)}</b> : <span className="muted">Not sold</span>}</td>
                        <td>{r.sold_30d}</td>
                        <td className="muted">{r.supplier ?? "None"}</td>
                        <td data-filter={label} data-sort={label}><span className={"pill " + cls}>{label}</span>{sells(r) && !r.active ? <span className="pill pill-grey" style={{ marginLeft: 6 }}>Offline</span> : null}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></DataTable>
            </div>
          ) : (
            <div style={{ flex: "999 1 560px", minWidth: 0 }}>
              {narrowed
                ? <Empty title="No products match">Try another word or <Link href="/business/inventory">show everything</Link>.</Empty>
                : <Empty title="No products yet">Add what you sell and what you use in services. Stock, low levels and orders follow from there.</Empty>}
            </div>
          )}

          <aside className="panel">
            {sel && (
              <div className="card">
                {sel.photo_id
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img className="ph-big photo" src={`/media/${sel.photo_id}`} alt={`Photo of ${sel.name}`} />
                  : <div className="ph-big" style={{ background: sel.tone || undefined }}>{[CATEGORY[sel.category] ?? sel.category, sel.sku].filter(Boolean).join(" · ")}</div>}
                {storage ? (
                  <div className="photo-row">
                    <form action={productPhoto} className="rowx" style={{ flex: 1, minWidth: 0 }}>
                      <input type="hidden" name="back" value={back} />
                      <input type="hidden" name="id" value={sel.id} />
                      <input type="hidden" name="alt" value={sel.name} />
                      <input type="file" name="file" required accept="image/jpeg,image/png,image/webp" aria-label={`Product photo for ${sel.name}: JPEG, PNG or WebP, up to 8 MB`} />
                      <button className="btn btn-out btn-sm">{sel.photo_id ? "Replace photo" : "Add photo"}</button>
                    </form>
                    {sel.photo_id && (
                      <form action={productPhotoRemove}>
                        <input type="hidden" name="back" value={back} />
                        <input type="hidden" name="id" value={sel.id} />
                        <ConfirmButton className="btn btn-ghost btn-sm" message={`Remove the photo of ${sel.name}?`}>Remove</ConfirmButton>
                      </form>
                    )}
                    <small className="hint">JPEG, PNG or WebP, up to 8 MB. Shown here, in the shop and on the booking page.</small>
                  </div>
                ) : <small className="hint">Photo uploads are not set up on this server yet. Contact LogaLuxe support.</small>}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div className="serif" style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.1 }}>{sel.name}</div>
                  <span className={"pill " + status(sel)[1]} style={{ whiteSpace: "nowrap" }}>{status(sel)[0]}</span>
                </div>
                <form action={productSave} key={sel.id} className="pform">
                  <input type="hidden" name="back" value={back} />
                  <input type="hidden" name="id" value={sel.id} />
                  <ProductFields p={sel} suppliers={suppliers} cur={cur} id="ed-" />
                  <div className="kv">
                    <div><span>Sold last 30 days</span><b>{sel.sold_30d}</b></div>
                    <div><span>Margin</span><b>{margin(sel)}</b></div>
                    <div><span>Stock value at cost</span><b>{money(sel.stock * sel.cost_cents, cur)}</b></div>
                    <div><span>Used in services</span><b>{((sel.used_in ?? []) as Row[]).length ? ((sel.used_in ?? []) as Row[]).map((u) => u.name).join(", ") : "None"}</b></div>
                    <div><span>Sold online</span><b>{sells(sel) && sel.active ? "Yes" : "No"}</b></div>
                    <div><span>Supplier</span><b>{sel.supplier ?? "None"}</b></div>
                  </div>
                  {multi && (
                    <div>
                      <div className="cap">Where it is</div>
                      <div className="kv">
                        {locations.map((l) => <div key={l.id}><span>{l.name}{l.is_primary ? " (main)" : ""}</span><b>{shelf(sel, l.id)}</b></div>)}
                        <div><span>In all</span><b>{sel.stock}</b></div>
                      </div>
                    </div>
                  )}
                  <button className="btn btn-ink btn-sm">Save</button>
                </form>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Sheet trigger="Adjust stock" triggerClass="btn btn-out btn-sm" title="Adjust stock" sub={`${sel.name} · ${sel.stock} in stock`}>
                    <form action={productStock} key={sel.id}>
                      <input type="hidden" name="back" value={back} />
                      <input type="hidden" name="id" value={sel.id} />
                      {multi && (
                        <Fld label="At which location" hint="A delivery, a use, a correction or a count applies to this shelf only. A count is the count of this shelf.">
                          <select name="location_id" defaultValue={(loc ?? main).id}>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}: {shelf(sel, l.id)} there now</option>)}</select>
                        </Fld>
                      )}
                      <Fld label="What happened">
                        <select name="reason" defaultValue="restock">
                          <option value="restock">A delivery arrived: add to stock</option>
                          <option value="backbar">Used in services: take from stock</option>
                          <option value="count">I counted: set stock to this number</option>
                          <option value="adjust">Correction: add, or take away with a minus</option>
                        </select>
                      </Fld>
                      <Fld label="Quantity" hint="For a correction, type -2 to take two away (broken, lost, given away)."><input type="number" name="qty" step={1} required /></Fld>
                      <Fld label="Note"><input type="text" name="note" maxLength={120} placeholder="Optional" /></Fld>
                      <div className="sheet-ft"><button className="btn btn-ink">Save</button></div>
                    </form>
                  </Sheet>
                  <Sheet trigger="Reorder" triggerClass="btn btn-out btn-sm" title="Reorder" sub={`${sel.name} · ${sel.stock} in stock, reorder at ${sel.reorder_at}`}>
                    <form action={orderCreate} key={sel.id}>
                      <input type="hidden" name="back" value={back} />
                      <input type="hidden" name="supplier_id" value={sel.supplier_id ?? ""} />
                      <Fld label="How many" hint={`Costs ${money(sel.cost_cents, cur)} each at the last price.`}><input type="number" name={`qty_${sel.id}`} min={1} step={1} required defaultValue={Math.max(1, sel.reorder_at * 2 - sel.stock)} /></Fld>
                      <Fld label="Expected on" hint="Leave empty if you do not know yet."><input type="date" name="expected_on" min={today} /></Fld>
                      <div className="muted" style={{ fontSize: 12.5 }}>This saves a draft order{sel.supplier ? ` to ${sel.supplier}` : " without a supplier"}. LogaLuxe does not send it: place it with the supplier yourself, then mark it as ordered.</div>
                      <div className="sheet-ft"><button className="btn btn-ink">Save draft order</button></div>
                    </form>
                  </Sheet>
                  {multi && (
                    <Sheet trigger="Move stock" triggerClass="btn btn-out btn-sm" title="Move stock" sub={`${sel.name} · ${sel.stock} in all`}>
                      <form action={productTransfer} key={sel.id}>
                        <input type="hidden" name="back" value={back} />
                        <input type="hidden" name="id" value={sel.id} />
                        <div className="f2">
                          <Fld label="From"><select name="from_location_id" defaultValue={(loc && shelf(sel, loc.id) > 0 ? loc : locations.find((l) => shelf(sel, l.id) > 0) ?? main).id}>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}: {shelf(sel, l.id)}</option>)}</select></Fld>
                          <Fld label="To"><select name="to_location_id" defaultValue={(locations.find((l) => l.id !== (loc && shelf(sel, loc.id) > 0 ? loc : locations.find((x) => shelf(sel, x.id) > 0) ?? main).id) ?? main).id}>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}: {shelf(sel, l.id)}</option>)}</select></Fld>
                        </div>
                        <Fld label="How many"><input type="number" name="qty" min={1} step={1} required /></Fld>
                        <Fld label="Note"><input type="text" name="note" maxLength={120} placeholder="Optional" /></Fld>
                        <div className="muted" style={{ fontSize: 12.5 }}>Moving stock changes where it sits, not how much you have. It is refused when the first location does not hold that many.</div>
                        <div className="sheet-ft"><button className="btn btn-ink">Move</button></div>
                      </form>
                    </Sheet>
                  )}
                  <Link href={href({ sel: sel.id, product: sel.id })} className="btn btn-out btn-sm">History</Link>
                </div>
              </div>
            )}

            {sel && (
              <div className="card" id="details">
                <h3>Ingredients and directions</h3>
                {pub ? (
                  <form action={productDetails} key={sel.id} className="pform">
                    <input type="hidden" name="back" value={back} />
                    <input type="hidden" name="id" value={sel.id} />
                    <div className="field"><label htmlFor="dt-ing">Ingredients</label><textarea id="dt-ing" name="ingredients" maxLength={3000} defaultValue={String(pub.extras?.ingredients ?? "")} placeholder="As listed on the label" /></div>
                    <div className="field"><label htmlFor="dt-how">How to use</label><textarea id="dt-how" name="how_to_use" maxLength={3000} defaultValue={String(pub.product?.how_to_use ?? "")} placeholder="How much, how often, and what to avoid" /></div>
                    <small className="hint">Shown on this product&apos;s page in the shop. Up to 3,000 characters each. Leave a box empty to show nothing.</small>
                    <button className="btn btn-out btn-sm">Save ingredients and directions</button>
                  </form>
                ) : (
                  <div className="muted" style={{ fontSize: 13, lineHeight: 1.45 }}>
                    {!sells(sel) ? "A back-bar product is not sold, so it has no page in the shop to show these on."
                      : !sel.active ? "Shoppers read these on the product’s page in the shop. Tick Sell online above and save, then add them here."
                        : "These could not be loaded just now. Reload the page to try again."}
                  </div>
                )}
              </div>
            )}

            {sel && (
              <div className="card">
                <h3>Used in services</h3>
                <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.45 }}>
                  Say how much of one unit each service uses, for example 0.1 for a tenth of a bottle. Checkout takes it off the shelf as each service is paid for. Part-used units are remembered, so the count drops by one when a whole unit is gone.
                  {sel.backbar_open > 0 ? ` ${Number(sel.backbar_open).toFixed(2).replace(/\.?0+$/, "")} of the open unit is used so far.` : ""}
                </div>
                {services.length ? (
                  <form action={productUses} key={sel.id} className="pform">
                    <input type="hidden" name="back" value={back} />
                    <input type="hidden" name="id" value={sel.id} />
                    <div className="uses">
                      {services.map((sv) => {
                        const u = ((sel.used_in ?? []) as Row[]).find((x) => x.service_id === sv.id);
                        return (
                          <label key={sv.id}>
                            <span>{sv.name}<small>{sv.category}</small></span>
                            <input type="number" name={`use_${sv.id}`} min={0} max={100} step="0.01" inputMode="decimal" defaultValue={u ? u.qty : ""} placeholder="0" aria-label={`Units of ${sel.name} used by ${sv.name}`} />
                          </label>
                        );
                      })}
                    </div>
                    <button className="btn btn-out btn-sm">Save what it is used in</button>
                  </form>
                ) : <div className="muted" style={{ fontSize: 13 }}>No services on the menu yet. <Link href="/business/services">Add services</Link></div>}
              </div>
            )}

            <div className="card" id="orders">
              <div className="hd">
                <h3>Purchase orders</h3>
                {all.length > 0 && (
                  <Sheet trigger="New order" triggerClass="btn btn-out btn-sm" title="New purchase order" sub="Saved as a draft. Nothing is sent to the supplier." wide>
                    <form action={orderCreate}>
                      <input type="hidden" name="back" value={back} />
                      <div className="f2">
                        <Fld label="Supplier"><select name="supplier_id" defaultValue=""><option value="">No supplier</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Fld>
                        <Fld label="Expected on"><input type="date" name="expected_on" min={today} /></Fld>
                      </div>
                      <DataTable id="new-order" search="Search products" filters={["Supplier"]} pageSize={25} noun="product">
                        <table className="tbl">
                          <thead><tr><th>Product</th><th>Supplier</th><th className="num">In stock</th><th className="num">Cost</th><th className="num" data-nosort>Order</th></tr></thead>
                          <tbody>
                            {all.map((p) => (
                              <tr key={p.id}>
                                <td><b>{p.name}</b>{isLow(p) ? <small className="muted" style={{ display: "block" }}>low</small> : null}</td>
                                <td>{p.supplier ?? "None"}</td>
                                <td className="num">{p.stock}</td>
                                <td className="num" data-sort={p.cost_cents}>{money(p.cost_cents, cur)}</td>
                                <td className="num"><input className="inp" style={{ width: 88, textAlign: "right" }} type="number" min={0} step={1} name={`qty_${p.id}`} placeholder="0" aria-label={`Quantity: ${p.name}`} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </DataTable>
                      <div className="sheet-ft"><button className="btn btn-ink">Save draft order</button></div>
                    </form>
                  </Sheet>
                )}
              </div>
              {orders.length ? orders.map((o) => {
                const items = (o.items ?? []) as Row[], [label, cls] = PO[o.status] ?? [o.status, "pill-grey"];
                const whenText = o.status === "received" && o.received_at ? `received ${dateMed(o.received_at, tz)}`
                  : o.status === "ordered" && o.expected_on ? `expected ${dateOnly(o.expected_on)}`
                    : `made ${dateMed(o.created_at, tz)}`;
                return (
                  <div key={o.id} className="po">
                    <div className="order">
                      <Avatar text={o.supplier ? initials(o.supplier) : "PO"} tone={o.status === "draft" ? "#D4AF5A" : o.status === "ordered" ? "#1F2A33" : "#4A3426"} style={o.status === "draft" ? { color: "#1A1513" } : undefined} />
                      <div style={{ flex: 1, minWidth: 0 }}><b>{o.supplier ?? "No supplier"} · {o.ref}</b><span>{plural(items.length, "item")} · {money(o.total_cents, cur)} · {whenText}</span></div>
                      <span className={"pill " + cls}>{label}</span>
                    </div>
                    <details>
                      <summary>{o.status === "draft" || o.status === "ordered" ? "Lines and actions" : "Lines"}</summary>
                      <ul>{items.map((i, n) => <li key={n}><span>{i.name}</span><b>{i.qty} × {money(i.cost_cents, cur)}</b></li>)}</ul>
                      {(o.status === "draft" || o.status === "ordered") && (
                        <form action={orderAction} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <input type="hidden" name="back" value={back} />
                          <input type="hidden" name="id" value={o.id} />
                          {o.status === "draft" && <button className="btn btn-ink btn-sm" name="action" value="order">Mark as ordered</button>}
                          <ConfirmButton className={"btn btn-sm " + (o.status === "ordered" ? "btn-ink" : "btn-out")} name="action" value="receive" message={multi ? `Receive ${o.ref}? Every line is added to stock at ${main.name}, your main location. Use Move stock afterwards for anything that belongs elsewhere.` : `Receive ${o.ref}? Every line is added to stock.`}>Receive into stock</ConfirmButton>
                          <ConfirmButton className="btn btn-ghost btn-sm" name="action" value="cancel" message={`Cancel ${o.ref}?`}>Cancel order</ConfirmButton>
                        </form>
                      )}
                    </details>
                  </div>
                );
              }) : <Empty title="No orders yet">{all.length ? "Draft one from low stock, or start a new order." : "Add products first, then order them here."}</Empty>}
              <div className="muted" style={{ fontSize: 12 }}>Orders are your own record. LogaLuxe does not send them to suppliers or pay for them. The last 12 are shown.</div>
            </div>
          </aside>
        </div>

        {sp.product && (
          <Sheet title="Stock history" sub={shown ? `${shown.name} · ${shown.stock} in stock` : undefined} open closeHref={href({ sel: sp.sel ?? shown?.id })} wide>
            {hist?.error ? <div role="alert" className="flash flash-err">{hist.error}</div> : !shown ? <Empty title="Product not found">It may have been removed.</Empty> : history.length ? (
              <DataTable id="stock-history" search="Search history" filters={multi ? ["Why", "Location", "By"] : ["Why", "By"]} pageSize={10} noun="change">
                <table className="tbl">
                  <thead><tr><th>When</th><th className="num">Change</th><th>Why</th>{multi && <th>Location</th>}<th>Note</th><th>By</th></tr></thead>
                  <tbody>
                    {history.map((h, i) => (
                      <tr key={i}>
                        <td style={{ whiteSpace: "nowrap" }} data-sort={h.created_at}>{dateMed(h.created_at, tz)} · {clock(h.created_at, tz)}</td>
                        <td className="num" data-sort={h.delta}><b style={{ color: h.delta < 0 ? "#9B2C2C" : "#1F6B3A" }}>{h.delta > 0 ? `+${h.delta}` : `−${Math.abs(h.delta)}`}</b></td>
                        <td>{REASON[h.reason] ?? h.reason}</td>
                        {multi && <td>{h.location ?? (main?.name ?? "")}</td>}
                        <td>{h.note || <span className="muted">None</span>}</td>
                        <td className="muted">{h.actor || "System"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTable>
            ) : <Empty title="No stock changes yet">Deliveries, counts, corrections and back-bar use are listed here as they happen.</Empty>}
            <div className="muted" style={{ fontSize: 12.5 }}>The last 40 changes are shown, newest first.</div>
          </Sheet>
        )}
      </div>
    </div>
  );
}
