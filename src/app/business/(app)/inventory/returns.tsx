import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { ConfirmButton, Sheet } from "@/components/merchant-client";
import { Empty, Fld } from "@/components/merchant-ui";
import { qs, type Row } from "@/lib/merchant-api";
import { clock, dateMed, money } from "@/lib/merchant-format";
import { answerReturn } from "./actions";

// Returns: customers asking to send back what they bought from this business in the shop.
// The business approves (and refunds) or refuses, once.

const STATE: Record<string, [string, string]> = { requested: ["Waiting for you", "pill-gold"], approved: ["Approved", "pill-ok"], refused: ["Refused", "pill-wine"] };
let cur = "USD"; // set from the orders being shown: a business sells in its own currency
const amount = (cents: number) => (Number(cents ?? 0) / 100).toFixed(2);

/** Where the refund went: the card, store credit, or some of each. */
export function refundSplit(refund: number, credit: number): string {
  const card = Math.max(0, Number(refund ?? 0) - Number(credit ?? 0));
  if (card > 0 && credit > 0) return `${money(card, cur)} to the card, ${money(credit, cur)} as store credit`;
  return card > 0 ? "All of it to the card" : "All of it as LogaLuxe store credit";
}

export function ReturnsView({ rows, reasons, tz, answer }: { rows: Row[]; reasons: Record<string, string>; tz: string; answer?: string }) {
  const here = "/business/inventory" + qs({ tab: "orders", view: "returns" });
  cur = String(rows[0]?.currency ?? "USD"); // this component renders in one go, so the value cannot leak between businesses
  const open = answer ? rows.find((r) => r.id === answer && r.status === "requested") : undefined;

  if (!rows.length) {
    return (
      <Empty title="No return requests">
        When a customer asks to send back something they bought from you in the shop, it shows here for you to answer. Customers can only ask while your returns policy allows it. You set that under <Link href="/business/inventory?tab=orders#policy">What shoppers are told</Link>.
      </Empty>
    );
  }

  return (
    <>
      <div className="tablebox oo">
        <DataTable id="shop-returns" search="Search returns" filters={["Reason", "Status"]} pageSize={25} noun="return">
          <table>
            <thead><tr><th>Asked</th><th>Customer</th><th>Items</th><th>Reason</th><th>Paid to you</th><th>Status</th><th data-nosort>Answer</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const [label, cls] = STATE[r.status] ?? [r.status, "pill-grey"];
                const items = (r.items ?? []) as Row[], reason = reasons[r.reason] ?? r.reason;
                const paid = Number(r.items_cents ?? 0) + Number(r.shipping_cents ?? 0);
                const by = r.decided_at ? `${r.decided_by || "Someone on your team"} · ${dateMed(r.decided_at, tz)} ${clock(r.decided_at, tz)}` : "";
                return (
                  <tr key={r.id}>
                    <td data-sort={r.created_at}>{dateMed(r.created_at, tz)}<small className="sub">{clock(r.created_at, tz)}</small></td>
                    <td>
                      <b>{r.customer_name}</b>
                      {r.customer_phone ? <small className="sub"><a href={`tel:${r.customer_phone}`}>{r.customer_phone}</a></small> : null}
                      {r.customer_email ? <small className="sub">{r.customer_email}</small> : null}
                    </td>
                    <td className="wrapc">
                      {items.map((i, k) => <div key={k}>{i.qty} × {i.name}{i.size ? <span className="muted"> · {i.size}</span> : null}</div>)}
                      {r.received_at ? <small className="sub">{r.fulfilment === "ship" ? "Shipped order" : "Collected"}, finished {dateMed(r.received_at, tz)}</small> : null}
                    </td>
                    <td className="wrapc" data-filter={reason} data-sort={reason}>
                      <b>{reason}</b>
                      {r.note ? <small className="sub note">&ldquo;{r.note}&rdquo;</small> : <small className="sub">No note from the customer</small>}
                    </td>
                    <td data-sort={paid}>
                      <b>{money(paid, cur)}</b>
                      <small className="sub">Items {money(r.items_cents, cur)}{Number(r.shipping_cents) > 0 ? `, shipping ${money(r.shipping_cents, cur)}` : ""}</small>
                    </td>
                    <td data-filter={label} data-sort={label}><span className={"pill " + cls}>{label}</span></td>
                    <td className="wrapc">
                      {r.status === "requested" && <Link href={here + "&answer=" + encodeURIComponent(r.id)} className="btn btn-ink btn-sm">Answer</Link>}
                      {r.status === "approved" && (
                        <>
                          <b>Refunded {money(r.refund_cents, cur)}</b>
                          <small className="sub">{refundSplit(r.refund_cents, r.credit_cents)}</small>
                          <small className="sub">{r.restocked ? "Items put back in stock" : "Items not put back in stock"}</small>
                        </>
                      )}
                      {r.status === "refused" && <b>Refused, nothing refunded</b>}
                      {r.status !== "requested" && r.reply ? <small className="sub note">You said: &ldquo;{r.reply}&rdquo;</small> : null}
                      {by ? <small className="sub">Answered by {by}</small> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataTable>
      </div>
      <div className="muted" style={{ fontSize: 12.5 }}>You answer each request once. The customer is emailed your answer. The last 300 are shown.</div>

      {answer && !open ? <div role="alert" className="flash flash-err">That return has already been answered, or it is not one of yours.</div> : null}
      {open ? (() => {
        const items = (open.items ?? []) as Row[], most = Number(open.items_cents ?? 0) + Number(open.shipping_cents ?? 0);
        const back = here, hidden = <><input type="hidden" name="back" value={back} /><input type="hidden" name="id" value={open.id} /></>;
        return (
          <Sheet title="Answer this return" sub={`${open.customer_name} · asked ${dateMed(open.created_at, tz)}`} open closeHref={here}>
            <div className="kv">
              <div><span>Items</span><b>{items.map((i) => `${i.qty} × ${i.name}${i.size ? ` (${i.size})` : ""}`).join(", ")}</b></div>
              <div><span>Reason</span><b>{reasons[open.reason] ?? open.reason}</b></div>
              {open.note ? <div><span>Their note</span><b style={{ whiteSpace: "pre-wrap" }}>{open.note}</b></div> : null}
              <div><span>Items total</span><b>{money(open.items_cents, cur)}</b></div>
              <div><span>Shipping they paid you</span><b>{Number(open.shipping_cents) > 0 ? money(open.shipping_cents, cur) : "None"}</b></div>
            </div>

            <form action={answerReturn}>
              {hidden}
              <h3 style={{ margin: 0, fontSize: 16 }}>Approve and refund</h3>
              <Fld label={`Refund amount, in ${cur === "NGN" ? "naira" : "US dollars"}`} hint={`The items came to ${money(open.items_cents, cur)}. The most you can refund is ${money(most, cur)}${Number(open.shipping_cents) > 0 ? ", which includes the shipping" : ""}.`}>
                <input type="number" name="refund" required min={0.01} max={amount(most)} step={0.01} inputMode="decimal" defaultValue={amount(open.items_cents)} />
              </Fld>
              <label className="chk"><input type="checkbox" name="restock" />Put the items back in stock</label>
              <Fld label="Message to the customer, optional"><textarea name="reply" maxLength={1000} rows={3} /></Fld>
              <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
                The money goes back to the customer&rsquo;s card where a card paid, otherwise as LogaLuxe store credit. It comes out of your balance, and LogaLuxe returns its marketplace fee on the refunded items.
              </div>
              <div className="sheet-ft">
                <ConfirmButton className="btn btn-ink" name="decision" value="approve" message={`Approve this return and refund ${open.customer_name}? This cannot be undone.`}>Approve and refund</ConfirmButton>
              </div>
            </form>

            <form action={answerReturn} style={{ borderTop: "1px solid #E6DCD2", paddingTop: 16 }}>
              {hidden}
              <h3 style={{ margin: 0, fontSize: 16 }}>Refuse</h3>
              <Fld label="Message to the customer" hint="Say why, in a sentence or more. At least 10 characters. Nothing is refunded.">
                <textarea name="reply" required minLength={10} maxLength={1000} rows={3} />
              </Fld>
              <div className="sheet-ft"><button className="btn btn-danger" name="decision" value="refuse">Refuse the return</button></div>
            </form>
          </Sheet>
        );
      })() : null}
    </>
  );
}
