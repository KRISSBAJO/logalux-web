import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { ConfirmButton } from "@/components/merchant-client";
import { Empty, Flash, LoadError, NoAccess, Topbar } from "@/components/merchant-ui";
import { mLoad, qs, type Merchant, type Row } from "@/lib/merchant-api";
import { clock, dateMed, money } from "@/lib/merchant-format";
import { shopOrderAction } from "./actions";

// Online orders: this business's part of each order placed in the LogaLuxe shop.
// A pickup goes new → ready → collected. A shipment goes new → (packed) → shipped → delivered.

const TABS: [string, string][] = [["open", "To do"], ["new", "New"], ["ready", "Ready"], ["shipped", "Shipped"], ["done", "Done"], ["all", "All"]];
const STATE: Record<string, [string, string]> = {
  new: ["New", "pill-gold"], ready: ["Ready", "pill-ok"], shipped: ["Shipped", "pill-ok"],
  delivered: ["Delivered", "pill-grey"], collected: ["Collected", "pill-grey"], cancelled: ["Cancelled", "pill-wine"],
};

/** The address a customer typed at checkout, on one line. */
function addressLine(a: unknown): string {
  if (!a) return "";
  if (typeof a === "string") return a;
  const o = a as Record<string, unknown>;
  return ["line1", "line2", "city", "region", "postcode", "postal_code", "zip", "country"].map((k) => (o[k] ? String(o[k]).trim() : "")).filter(Boolean).join(", ");
}

export async function OnlineOrders({ sp, m }: { sp: { ok?: string; err?: string; status?: string }; m: Merchant }) {
  const status = TABS.some(([id]) => id === sp.status) ? sp.status! : "open";
  const res = await mLoad("/orders" + qs({ status: status === "all" ? "" : status }));
  if (res.status === 403) return <div className="main pg-inventory"><NoAccess title="Online orders" need="manager" /></div>;
  if (res.error) return <div className="main pg-inventory"><LoadError title="Online orders" error={res.error} /></div>;

  const tz = m.timezone, cur = "USD"; // the shop sells in US dollars
  const orders = (res.data.orders ?? []) as Row[], c = (res.data.counts ?? {}) as Record<string, number>;
  const n = (k: string) => Number(c[k] ?? 0);
  const count: Record<string, number> = { open: n("new") + n("ready") + n("shipped"), new: n("new"), ready: n("ready"), shipped: n("shipped"), done: Math.max(n("done"), n("all") - n("new") - n("ready") - n("shipped")), all: n("all") }; // done includes cancelled, as the list does
  const fee = Number(res.data.marketplace_pct ?? 0);
  const back = "/business/inventory" + qs({ tab: "orders", status: status === "open" ? "" : status });

  return (
    <div className="main pg-inventory">
      <Topbar title="Online orders" eyebrow="Inventory">
        <span style={{ flex: 1 }} />
        <Link href="/business/inventory" className="btn btn-out">Products and stock</Link>
      </Topbar>

      <div className="content">
        <Flash sp={sp} />
        <div className="oo-note">
          {fee > 0
            ? <>LogaLuxe keeps {fee}% of items sold through the shop; shipping you charge is yours.</>
            : <>LogaLuxe keeps no fee on items sold through the shop on your plan; shipping you charge is yours.</>}
          {" "}What you receive is added to your balance in Money once the order is paid.
        </div>

        <nav style={{ display: "flex", gap: 8, flexWrap: "wrap" }} aria-label="Order status">
          {TABS.map(([id, name]) => (
            <Link key={id} href={"/business/inventory" + qs({ tab: "orders", status: id === "open" ? "" : id })} className={"chip" + (status === id ? " on" : "")} aria-current={status === id ? "true" : undefined}>{name} <small>{count[id]}</small></Link>
          ))}
        </nav>

        {orders.length ? (
          <div className="tablebox oo">
            <DataTable id="online-orders" search="Search orders" filters={["How", "Status"]} pageSize={25} noun="order">
              <table>
                <thead><tr><th>When</th><th>Customer</th><th>Items</th><th>How</th><th>Items total</th><th>You receive</th><th>Status</th><th data-nosort>Next step</th></tr></thead>
                <tbody>
                  {orders.map((o) => {
                    const [label, cls] = STATE[o.status] ?? [o.status, "pill-grey"];
                    const items = (o.items ?? []) as Row[], ship = o.fulfilment === "ship", where = addressLine(o.address);
                    const hidden = <><input type="hidden" name="back" value={back} /><input type="hidden" name="id" value={o.id} /></>;
                    return (
                      <tr key={o.id}>
                        <td data-sort={o.created_at}>{dateMed(o.created_at, tz)}<small className="sub">{clock(o.created_at, tz)}</small></td>
                        <td>
                          <b>{o.customer_name}</b>
                          {o.customer_phone ? <small className="sub"><a href={`tel:${o.customer_phone}`}>{o.customer_phone}</a></small> : null}
                          {o.customer_email ? <small className="sub">{o.customer_email}</small> : null}
                        </td>
                        <td className="wrapc">{items.map((i, k) => <div key={k}>{i.qty} × {i.name}{i.size ? <span className="muted"> · {i.size}</span> : null}</div>)}</td>
                        <td className="wrapc" data-filter={ship ? "Ship" : "Collect"} data-sort={ship ? "Ship" : "Collect"}>
                          <b>{ship ? "Ship" : "Collect"}</b>
                          <small className="sub">{ship ? (where || "No address given") : "Picked up from you"}</small>
                          {ship && o.shipping_cents > 0 ? <small className="sub">Shipping charged: {money(o.shipping_cents, cur)}</small> : null}
                          {o.tracking ? <small className="sub">Tracking {o.tracking}</small> : null}
                        </td>
                        <td data-sort={o.items_cents}>{money(o.items_cents, cur)}</td>
                        <td data-sort={o.net_cents}>{o.status === "cancelled" && !o.net_cents ? <span className="muted">Nothing</span> : <b>{money(o.net_cents, cur)}</b>}</td>
                        <td data-filter={label} data-sort={label}><span className={"pill " + cls}>{label}</span></td>
                        <td>
                          {!ship && o.status === "new" && <form action={shopOrderAction}>{hidden}<button className="btn btn-ink btn-sm" name="step" value="ready">Ready to collect</button></form>}
                          {!ship && o.status === "ready" && <form action={shopOrderAction}>{hidden}<ConfirmButton className="btn btn-ink btn-sm" name="step" value="collected" message={`Mark the order for ${o.customer_name} as collected? This finishes it.`}>Mark collected</ConfirmButton></form>}
                          {ship && (o.status === "new" || o.status === "ready") && (
                            <div className="acts">
                              <form action={shopOrderAction} className="shipf">
                                {hidden}
                                <input className="inp" type="text" name="tracking" maxLength={80} placeholder="Tracking, optional" aria-label={`Tracking reference for the order for ${o.customer_name}`} />
                                <button className="btn btn-ink btn-sm" name="step" value="shipped">Mark shipped</button>
                              </form>
                              {o.status === "new" && <form action={shopOrderAction}>{hidden}<button className="btn btn-out btn-sm" name="step" value="ready">Packed</button></form>}
                            </div>
                          )}
                          {ship && o.status === "shipped" && <form action={shopOrderAction}>{hidden}<ConfirmButton className="btn btn-ink btn-sm" name="step" value="delivered" message={`Mark the order for ${o.customer_name} as delivered? This finishes it.`}>Mark delivered</ConfirmButton></form>}
                          {["delivered", "collected", "cancelled"].includes(o.status) && <span className="muted">Nothing to do</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </DataTable>
          </div>
        ) : (
          <Empty title={status === "all" ? "No online orders yet" : status === "open" ? "Nothing to do" : "No orders here"}>
            {count.all === 0
              ? <>Orders arrive here when someone buys one of your products in the LogaLuxe shop. Switch on Sell online for a product in <Link href="/business/inventory">Inventory</Link> to list it.</>
              : status === "open" ? "Every online order is finished." : <>Nothing has this status. <Link href={"/business/inventory" + qs({ tab: "orders", status: "all" })}>Show all orders</Link>.</>}
          </Empty>
        )}
        <div className="muted" style={{ fontSize: 12.5 }}>An order appears here once the customer has paid. The customer sees each step in their account. The last 300 are shown.</div>
      </div>
    </div>
  );
}
