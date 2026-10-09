import { MerchantHistoryPagination } from "@/components/merchant-history-pagination";
import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { ConfirmButton } from "@/components/merchant-client";
import { Empty, Flash, LoadError, NoAccess, Topbar } from "@/components/merchant-ui";
import { mLoad, qs, type Merchant, type Row } from "@/lib/merchant-api";
import { clock, dateMed, money, plural } from "@/lib/merchant-format";
import { careCounts } from "../care-counts";
import { saveShopPolicy, shopOrderAction } from "./actions";
import { ReturnsView } from "./returns";

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

/** Returns, delivery time and same-day pick-up: what a shopper reads beside this business’s products. */
function PolicyCard({ p, back }: { p: Row; back: string }) {
  const returns = p.returns_days === null || p.returns_days === undefined ? "none" : Number(p.returns_days) === 0 ? "no" : "days";
  const ships = p.ship_days_min !== null && p.ship_days_min !== undefined && p.ship_days_max !== null && p.ship_days_max !== undefined;
  const pickup = p.pickup_ready_mins !== null && p.pickup_ready_mins !== undefined;
  return (
    <div className="card pol" id="policy">
      <div>
        <h3>What shoppers are told</h3>
        <div className="hint">Shown beside every product you sell in the shop. Where you state nothing, shoppers are told nothing.</div>
      </div>
      <form action={saveShopPolicy} className="pform">
        <input type="hidden" name="back" value={back} />
        {((p.languages ?? []) as string[]).map((l) => <input key={l} type="hidden" name="languages" value={l} />)}

        <div className="grp" role="radiogroup" aria-labelledby="pol-ret">
          <div className="cap" id="pol-ret">Returns</div>
          <label className="chk"><input type="radio" name="returns_mode" value="none" defaultChecked={returns === "none"} />We do not state a returns policy</label>
          <label className="chk"><input type="radio" name="returns_mode" value="no" defaultChecked={returns === "no"} />No returns</label>
          <div className="opt">
            <label className="chk"><input type="radio" name="returns_mode" value="days" defaultChecked={returns === "days"} />Returns within</label>
            <input className="inp" type="number" name="returns_n" min={1} max={90} step={1} inputMode="numeric" defaultValue={returns === "days" ? p.returns_days : ""} aria-label="Days a shopper has to return an item, 1 to 90" />
            <span>days</span>
          </div>
          <div className="field"><label htmlFor="pol-note">Note, optional</label><input id="pol-note" type="text" name="returns_note" maxLength={300} defaultValue={p.returns_note ?? ""} placeholder="Unopened items only" /></div>
          <small className="hint">The note is shown with your returns line. Up to 300 characters.</small>
        </div>

        <div className="grp" role="radiogroup" aria-labelledby="pol-ship">
          <div className="cap" id="pol-ship">Delivery time</div>
          <label className="chk"><input type="radio" name="ship_mode" value="none" defaultChecked={!ships} />We do not state a delivery time</label>
          <div className="opt">
            <label className="chk"><input type="radio" name="ship_mode" value="days" defaultChecked={ships} />Arrives in</label>
            <input className="inp" type="number" name="ship_min" min={0} max={30} step={1} inputMode="numeric" defaultValue={ships ? p.ship_days_min : ""} aria-label="Shortest delivery time in business days, 0 to 30" />
            <span>to</span>
            <input className="inp" type="number" name="ship_max" min={0} max={30} step={1} inputMode="numeric" defaultValue={ships ? p.ship_days_max : ""} aria-label="Longest delivery time in business days, 0 to 30" />
            <span>business days</span>
          </div>
          <small className="hint">Shortest first. Use the same number twice for a fixed time.</small>
        </div>

        <div className="grp" role="radiogroup" aria-labelledby="pol-pick">
          <div className="cap" id="pol-pick">Pick up today</div>
          <label className="chk"><input type="radio" name="pickup_mode" value="none" defaultChecked={!pickup} />Not offered</label>
          <div className="opt">
            <label className="chk"><input type="radio" name="pickup_mode" value="mins" defaultChecked={pickup} />Ready</label>
            <input className="inp" type="number" name="pickup_n" min={0} max={480} step={1} inputMode="numeric" defaultValue={pickup ? p.pickup_ready_mins : ""} aria-label="Minutes until an order is ready to collect, 0 to 480" />
            <span>minutes after ordering</span>
          </div>
          <small className="hint">While you are open, shoppers see &quot;Pick up today&quot; with the time it will be ready.</small>
        </div>

        <div><button className="btn btn-ink btn-sm">Save what shoppers are told</button></div>
      </form>
    </div>
  );
}

export async function OnlineOrders({ sp, m }: { sp: { [key: string]: string | undefined; ok?: string; err?: string; status?: string; view?: string; answer?: string }; m: Merchant }) {
  const returnsView = sp.view === "returns";
  const status = TABS.some(([id]) => id === sp.status) ? sp.status! : "open";
  // The Returns view needs the orders only for the counts on the chips.
  const [res, policy, rts, care] = await Promise.all([
    mLoad("/orders" + qs({ ...sp, status: returnsView ? "new" : status === "all" ? "" : status })),
    returnsView ? null : mLoad("/shop-policy"),
    returnsView ? mLoad("/returns" + qs({ ...sp, status: undefined })) : null,
    careCounts(),
  ]);
  if (res.status === 403) return <div className="main pg-inventory"><NoAccess title="Online orders" need="manager" /></div>;
  if (res.error) return <div className="main pg-inventory"><LoadError title="Online orders" error={res.error} /></div>;

  const tz = m.timezone, cur = String(m.currency ?? "USD"); // a business sells in its own currency
  const orders = (res.data.orders ?? []) as Row[], c = (res.data.counts ?? {}) as Record<string, number>;
  const n = (k: string) => Number(c[k] ?? 0);
  const count: Record<string, number> = { open: n("new") + n("ready") + n("shipped"), new: n("new"), ready: n("ready"), shipped: n("shipped"), done: Math.max(n("done"), n("all") - n("new") - n("ready") - n("shipped")), all: n("all") }; // done includes cancelled, as the list does
  const fee = Number(res.data.marketplace_pct ?? 0);
  const back = "/business/inventory" + qs({ tab: "orders", status: status === "open" ? "" : status });
  const returnsHref = "/business/inventory" + qs({ tab: "orders", view: "returns" });
  const returns = (rts?.data.returns ?? []) as Row[];
  const waiting = returnsView && !rts?.error ? Number(rts?.data.counts?.requested ?? 0) : care.returns;

  return (
    <div className="main pg-inventory">
      <Topbar title="Online orders" eyebrow="Inventory">
        <span style={{ flex: 1 }} />
        {returnsView ? <Link href="/business/inventory?tab=orders#policy" className="btn btn-out">What shoppers are told</Link> : <a href="#policy" className="btn btn-out">What shoppers are told</a>}
        <Link href="/business/inventory" className="btn btn-out">Products and stock</Link>
      </Topbar>

      <div className="content">
        <Flash sp={sp} />
        {returnsView ? (
          <div className="oo-note">
            A customer can ask to send back what they bought from you while your returns policy allows it. You approve and refund, or refuse and say why.
            A refund comes out of your balance in Money, and LogaLuxe returns its marketplace fee on the refunded items.
          </div>
        ) : (
        <div className="oo-note">
          {fee > 0
            ? <>LogaLuxe keeps {fee}% of items sold through the shop; shipping you charge is yours.</>
            : <>LogaLuxe keeps no fee on items sold through the shop on your plan; shipping you charge is yours.</>}
          {" "}What you receive is added to your balance in Money once the order is paid.
        </div>
        )}
        {!returnsView && waiting > 0 ? (
          <div className="oo-note oo-wait" role="status">
            <span className="pill pill-gold">Returns</span> {waiting === 1 ? "1 return request is" : `${plural(waiting, "return request")} are`} waiting for your answer. <Link href={returnsHref}>Answer in Returns</Link>
          </div>
        ) : null}

        <nav style={{ display: "flex", gap: 8, flexWrap: "wrap" }} aria-label="Order status">
          {TABS.map(([id, name]) => (
            <Link key={id} href={"/business/inventory" + qs({ tab: "orders", status: id === "open" ? "" : id })} className={"chip" + (!returnsView && status === id ? " on" : "")} aria-current={!returnsView && status === id ? "true" : undefined}>{name} <small>{count[id]}</small></Link>
          ))}
          <Link href={returnsHref} className={"chip" + (returnsView ? " on" : "")} aria-current={returnsView ? "true" : undefined} title="Return requests waiting for your answer">Returns <small>{waiting}</small></Link>
        </nav>

        {returnsView ? (
          rts?.error ? <div role="alert" className="flash flash-err">{rts.status === 403 ? "Only a manager or the owner can answer returns." : `Returns could not be loaded: ${rts.error}`}</div>
            : <ReturnsView sp={sp} pagination={rts?.data.returns_pagination} selected={rts?.data.selected_return} rows={returns} reasons={(rts?.data.reasons ?? {}) as Record<string, string>} tz={tz} cur={m.currency} answer={sp.answer} />
        ) : (<>

        {orders.length ? (
          <div className="tablebox oo">
            <MerchantHistoryPagination name="orders" label="Online orders" pagination={res.data.orders_pagination} />
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
                          {o.note ? <small className="sub note">{o.note}</small> : null}
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

        {!policy || policy.error
          ? <div className="card pol" id="policy"><h3>What shoppers are told</h3><div role="alert" className="flash flash-err">{policy?.status === 403 ? "Only a manager or the owner can change this." : `This could not be loaded: ${policy?.error ?? ""}`}</div></div>
          : <PolicyCard p={policy.data} back={back + "#policy"} />}
        </>)}
      </div>
    </div>
  );
}
