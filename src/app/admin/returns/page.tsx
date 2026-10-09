import { MerchantHistoryPagination } from "@/components/merchant-history-pagination";
import Link from "next/link";
import { ConfirmButton } from "@/components/merchant-client";
import { Btn, Content, Empty, Field, Flash, Hidden, Panel, Pill, ReadOnly, Tabs, Topbar, fmtDate, fmtMoney, inputCls } from "@/components/admin-ui";
import { can, getAdmin, load, qs, type Row } from "@/lib/admin-api";
import { decideBrandReturn } from "../actions-care";

// Returns of brand products: the ones LogaLuxe sells itself. A business answers returns of its own products.

const STATE: Record<string, ["ok" | "gold" | "wine" | "grey", string]> = { requested: ["gold", "Waiting for an answer"], approved: ["ok", "Approved"], refused: ["wine", "Refused"] };
const amount = (cents: number) => (Number(cents ?? 0) / 100).toFixed(2);
const stamp = (iso: string) => `${new Date(iso).toLocaleString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} UTC`;

export default async function Returns({ searchParams }: { searchParams: Promise<{ [key: string]: string | undefined; status?: string; answer?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const status = ["requested", "approved", "refused"].includes(sp.status ?? "") ? sp.status! : "";
  const [admin, res] = await Promise.all([getAdmin(), load(`/returns${qs({ ...sp, status })}`)]);
  const list: Row[] = res.data.returns ?? [], reasons: Record<string, string> = res.data.reasons ?? {};
  const boss = can(admin, "super_admin");
  const back = `/admin/returns${qs({ ...sp, answer: undefined, status })}`;
  const selected = res.data.selected_return as Row | undefined;
  const open = boss && sp.answer ? (selected?.id === sp.answer && selected.status === "requested" ? selected : list.find((r) => r.id === sp.answer && r.status === "requested")) : undefined;
  const itemsOf = (r: Row) => ((r.items ?? []) as Row[]).map((i) => `${i.qty} × ${i.name}${i.size ? ` (${i.size})` : ""}`);

  return (
    <>
      <Topbar title="Returns" sub="Brand products only: what LogaLuxe sells itself. Each business answers returns of its own products">
        <Tabs items={[["", "All"], ["requested", "Waiting"], ["approved", "Approved"], ["refused", "Refused"]]} current={status} href={(s) => `/admin/returns${qs({ status: s })}`} />
        <Link href="/admin/orders" className="inline-flex h-10 items-center rounded-full border border-line bg-white px-4 text-[13.5px] font-semibold text-ink hover:border-ink">Orders</Link>
      </Topbar>
      <Content>
        <Flash sp={sp} error={res.error} />
        {!boss && <ReadOnly need="super admin" />}
        {boss && sp.answer && !open && !sp.ok && <p role="alert" className="rounded-xl border border-bad/25 bg-bad-bg px-4 py-3 text-[14px] font-medium text-bad">That return has already been answered, or it was not found.</p>}

        {open && (
          <Panel title={`Answer the return from ${open.customer_name}`} sub={`${itemsOf(open).join(", ")} · ${reasons[open.reason] ?? open.reason}`} action={<Link href={back} className="text-[13px] font-semibold text-wine">Close</Link>}>
            <div className="grid gap-6 lg:grid-cols-2">
              <form action={decideBrandReturn} className="flex flex-col gap-3">
                <Hidden values={{ id: open.id, back }} />
                <h3 className="text-[14px] font-semibold">Approve and refund</h3>
                {open.note && <p className="rounded-xl bg-cream-2 px-3.5 py-2.5 text-[13.5px]">The customer wrote: &ldquo;{open.note}&rdquo;</p>}
                <Field label={`Refund amount, in ${open.currency}`}>
                  <input type="number" name="refund" required min="0.01" max={amount(Number(open.items_cents) + Number(open.shipping_cents))} step="0.01" defaultValue={amount(open.items_cents)} className={inputCls} />
                </Field>
                <p className="text-[12.5px] text-muted">The items came to {fmtMoney(open.items_cents, open.currency)}. The most you can refund is {fmtMoney(Number(open.items_cents) + Number(open.shipping_cents), open.currency)}{Number(open.shipping_cents) > 0 ? ", which includes the shipping" : ""}.</p>
                <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" name="restock" className="h-4 w-4 accent-ink" />Put the items back in stock</label>
                <Field label="Message to the customer, optional"><textarea name="reply" maxLength={1000} rows={3} className={`${inputCls} h-auto py-2`} /></Field>
                <p className="text-[12.5px] leading-relaxed text-muted">The money goes back to the customer&rsquo;s card where a card paid, otherwise as LogaLuxe store credit. LogaLuxe sold these items, so no business balance changes.</p>
                <div>
                  <ConfirmButton name="decision" value="approve" message={`Approve this return and refund ${open.customer_name}? This cannot be undone.`} className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-full bg-ink px-4 text-[13.5px] font-semibold text-cream transition hover:bg-ink-3">Approve and refund</ConfirmButton>
                </div>
              </form>
              <form action={decideBrandReturn} className="flex flex-col gap-3">
                <Hidden values={{ id: open.id, back }} />
                <h3 className="text-[14px] font-semibold">Refuse</h3>
                <Field label="Message to the customer"><textarea name="reply" required minLength={10} maxLength={1000} rows={3} className={`${inputCls} h-auto py-2`} /></Field>
                <p className="text-[12.5px] text-muted">Say why, in a sentence or more. At least 10 characters. Nothing is refunded.</p>
                <div><Btn kind="danger" name="decision" value="refuse">Refuse the return</Btn></div>
              </form>
            </div>
          </Panel>
        )}

        <MerchantHistoryPagination name="returns" label="Brand returns" pagination={res.data.returns_pagination} />
        <Panel flush>
          {list.length > 0 && (
            <table className="data min-w-[980px]">
              <thead><tr><th>Asked</th><th>Customer</th><th>Items</th><th>Reason</th><th>Paid</th><th>Status</th><th>Answer</th></tr></thead>
              <tbody>
                {list.map((r) => {
                  const [kind, label]: readonly ["ok" | "gold" | "wine" | "grey", string] = r.provider_refund_status === "pending" ? ["gold", "Provider refund pending"] as const : STATE[r.status] ?? ["grey", r.status];
                  const card = Math.max(0, Number(r.refund_cents ?? 0) - Number(r.credit_cents ?? 0));
                  return (
                    <tr key={r.id} className="align-top hover:bg-cream">
                      <td className="whitespace-nowrap">{fmtDate(r.created_at)}<span className="block text-[12px] uppercase text-muted">Order {String(r.order_id).slice(0, 8)}</span></td>
                      <td><b className="block font-semibold">{r.customer_name}</b><span className="block text-[12px] text-muted">{r.customer_email}</span><span className="block text-[12px] text-muted">{r.customer_phone}</span></td>
                      <td className="max-w-[260px]">{itemsOf(r).map((t, i) => <span key={i} className="block">{t}</span>)}<span className="block text-[12px] text-muted">Sold by {r.seller_name}</span></td>
                      <td className="max-w-[240px]"><b className="block font-semibold">{reasons[r.reason] ?? r.reason}</b>{r.note && <span className="block text-[12.5px] text-muted">&ldquo;{r.note}&rdquo;</span>}</td>
                      <td className="whitespace-nowrap"><b className="font-semibold">{fmtMoney(Number(r.items_cents) + Number(r.shipping_cents), r.currency)}</b><span className="block text-[12px] text-muted">Items {fmtMoney(r.items_cents, r.currency)}{Number(r.shipping_cents) > 0 ? `, shipping ${fmtMoney(r.shipping_cents, r.currency)}` : ""}</span></td>
                      <td><Pill kind={kind}>{label}</Pill></td>
                      <td className="max-w-[280px] text-[13px]">
                        {r.status === "requested" && (boss
                          ? <Link href={`${back}${back.includes("?") ? "&" : "?"}answer=${encodeURIComponent(r.id)}`} className="inline-flex h-8 items-center rounded-full bg-ink px-3 text-[12.5px] font-semibold text-cream hover:bg-ink-3">Answer</Link>
                          : <span className="text-muted">Waiting for a super admin</span>)}
                        {r.status === "approved" && (
                          <>
                            <b className="block font-semibold">{r.provider_refund_status === "pending" ? "Refund reserved" : "Refunded"} {fmtMoney(r.refund_cents, r.currency)}</b>
                            <span className="block text-muted">{card > 0 && r.credit_cents > 0 ? `${fmtMoney(card, r.currency)} to the card, ${fmtMoney(r.credit_cents, r.currency)} as store credit` : card > 0 ? "All of it to the card" : "All of it as LogaLuxe store credit"}</span>
                            <span className="block text-muted">{r.restocked ? "Items put back in stock" : "Items not put back in stock"}</span>
                          </>
                        )}
                        {r.status === "refused" && <b className="block font-semibold">Refused, nothing refunded</b>}
                        {r.status !== "requested" && r.reply && <span className="block">&ldquo;{r.reply}&rdquo;</span>}
                        {r.provider_refund_status === "pending" && <span className="block text-[12.5px] text-bad">{r.refund_problem ? `The provider has not accepted it yet: ${r.refund_problem}` : "Waiting for the provider to accept it. The worker asks again on its own."}</span>}
                        {r.decided_at && <span className="block text-[12px] text-muted">Answered by {r.decided_by || "staff"} · {stamp(r.decided_at)}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {list.length === 0 && !res.error && (
            <Empty>
              {status
                ? <>No returns of brand products have this status. <Link href="/admin/returns" className="font-semibold text-wine">Show all</Link></>
                : <>No one has asked to return a brand product. When a customer asks to send back something LogaLuxe sold, it shows here for a super admin to approve or refuse.</>}
            </Empty>
          )}
        </Panel>
      </Content>
    </>
  );
}
