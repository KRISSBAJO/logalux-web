import Link from "next/link";
import { Check } from "@/components/catalog-forms";
import { Btn, Content, Empty, Field, FilterSearch, Flash, Hidden, Panel, Pill, ReadOnly, Topbar, ago, fmtDate, fmtMoney, inputCls, inputSm, statusPill } from "@/components/admin-ui";
import { can, getAdmin, load, qs, type Row } from "@/lib/admin-api";
import { issueGiftCard, voidGiftCard } from "../actions-growth";

export default async function GiftCards({ searchParams }: { searchParams: Promise<{ q?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const [admin, res] = await Promise.all([getAdmin(), load(`/gift-cards${qs({ q })}`)]);
  const cards: Row[] = res.data.cards ?? [];
  const ops = can(admin, "ops");
  const back = `/admin/gift-cards${qs({ q })}`;
  const emailOn = res.data.mail_mode && res.data.mail_mode !== "log";

  return (
    <>
      <Topbar title="Gift cards" sub="Prepaid balance a client spends in the shop. A refund puts the money back on the card.">
        {ops && <a href="/admin/export/gift-cards" className="inline-flex h-10 items-center rounded-full border border-line bg-white px-4 text-[13.5px] font-semibold hover:border-ink">Export CSV</a>}
      </Topbar>
      <Content>
        <Flash sp={sp} error={res.error} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(res.data.totals ?? []).map((t: Row) => (
            <div key={t.currency} className="card p-4">
              <small className="block text-[11px] font-semibold uppercase tracking-[.08em] text-muted">{t.currency} · still to be spent</small>
              <b className="mt-1.5 block text-[26px] font-semibold leading-none tracking-tight">{fmtMoney(t.outstanding_cents, t.currency)}</b>
              <span className="mt-1.5 block text-[12px] text-muted">{t.n} cards, {fmtMoney(t.issued_cents, t.currency)} issued</span>
            </div>
          ))}
        </div>
        {!ops && <ReadOnly need="ops" />}

        {ops && (
          <Panel title="Issue a gift card" sub={emailOn ? "The recipient can be emailed their code." : "Email is not set up, so you will need to give the code to the recipient yourself."}>
            <form action={issueGiftCard} className="flex flex-col gap-4">
              <Hidden values={{ back }} />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Amount"><input name="amount" type="number" min="1" step="0.01" required className={inputCls} /></Field>
                <Field label="Currency"><select name="currency" className={inputCls}><option value="USD">USD</option><option value="NGN">NGN</option></select></Field>
                <Field label="Recipient name"><input name="recipient_name" className={inputCls} /></Field>
                <Field label="Recipient email"><input name="recipient_email" type="email" className={inputCls} /></Field>
                <Field label="Note to the recipient" className="sm:col-span-2"><input name="note" maxLength={200} className={inputCls} /></Field>
                <Field label="Expires, optional"><input name="expires_on" type="date" className={inputCls} /></Field>
                <div className="flex items-end pb-2.5"><Check name="send_email" label="Email the code to them" defaultChecked={emailOn} /></div>
              </div>
              <div className="flex flex-wrap items-center gap-3"><Btn kind="ink">Issue card</Btn><span className="text-[13px] text-muted">Cards above $500 or ₦750,000 need a super admin.</span></div>
            </form>
          </Panel>
        )}

        <FilterSearch action="/admin/gift-cards" q={q} placeholder="Code, name or email" />
        <Panel title="Cards" flush>
          <table className="data min-w-[900px]">
            <thead><tr><th>Code</th><th>Recipient</th><th>Balance</th><th>Issued</th><th>Expires</th><th>Status</th>{ops && <th>Cancel</th>}</tr></thead>
            <tbody>
              {cards.map((c) => (
                <tr key={c.id}>
                  <td><b className="font-mono text-[13.5px] font-semibold tracking-wide">{ops ? c.code : `…${String(c.code).slice(-4)}`}</b><span className="block text-[12px] text-muted">{c.uses} use{c.uses === 1 ? "" : "s"}</span></td>
                  <td>{c.recipient_name || "—"}<span className="block text-[12px] text-muted">{c.recipient_email}</span></td>
                  <td><b className="font-semibold">{fmtMoney(c.balance_cents, c.currency)}</b><span className="text-muted"> of {fmtMoney(c.initial_cents, c.currency)}</span></td>
                  <td className="text-[13px]">{ago(c.created_at)}<span className="block text-[12px] text-muted">{c.issued_by}</span></td>
                  <td>{c.expires_on ? fmtDate(c.expires_on) : "Never"}</td>
                  <td>{c.status === "void" ? <Pill kind="grey">cancelled</Pill> : c.balance_cents === 0 ? <Pill kind="grey">spent</Pill> : statusPill("active")}</td>
                  {ops && (
                    <td>
                      {c.status === "active" && c.balance_cents > 0 && (
                        <form action={voidGiftCard} className="flex items-center gap-1.5">
                          <Hidden values={{ id: c.id, back }} />
                          <input name="note" required placeholder="Reason" aria-label="Reason" className={`${inputSm} w-[130px]`} />
                          <Btn small kind="danger">Cancel card</Btn>
                        </form>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {cards.length === 0 && <Empty>No gift cards{q ? " match" : " yet"}.</Empty>}
        </Panel>

        <Panel title="Ledger" sub="The latest 40 changes to any card's balance" flush>
          <table className="data min-w-[640px]">
            <thead><tr><th>When</th><th>Card</th><th>Change</th><th>What happened</th><th>By</th></tr></thead>
            <tbody>
              {(res.data.txns ?? []).map((t: Row) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap">{ago(t.created_at)}</td>
                  <td className="font-mono text-[12.5px]">…{String(t.code).slice(-4)}</td>
                  <td className={`font-semibold ${t.amount_cents < 0 ? "text-bad" : "text-ok"}`}>{t.amount_cents < 0 ? "−" : "+"}{fmtMoney(Math.abs(t.amount_cents), t.currency)}</td>
                  <td>{t.note}{t.order_id && <> · <Link href={`/admin/orders?q=${String(t.order_id).slice(0, 8)}`} className="font-medium text-wine">order</Link></>}</td>
                  <td className="text-muted">{t.actor}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(res.data.txns ?? []).length === 0 && <Empty>Nothing yet.</Empty>}
        </Panel>
      </Content>
    </>
  );
}
