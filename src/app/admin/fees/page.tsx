import { Btn, Content, Empty, Field, Flash, Hidden, Panel, Pill, ReadOnly, Topbar, fmtDate, fmtMoney, inputCls, statusPill } from "@/components/admin-ui";
import { can, getAdmin, load, type Row } from "@/lib/admin-api";
import { decideFee, proposeFee } from "../actions";

const cur = (market: string) => (market === "NG" ? "NGN" : "USD");
const day = (iso: string) => String(iso).slice(0, 10);

function txn(f: Row) {
  const c = cur(f.market);
  return `${f.transaction_pct}%${f.transaction_fixed_cents ? ` + ${fmtMoney(f.transaction_fixed_cents, c)}` : ""}${f.transaction_cap_cents ? `, capped at ${fmtMoney(f.transaction_cap_cents, c)}` : ""}`;
}

export default async function Fees({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const [admin, res] = await Promise.all([getAdmin(), load("/fees")]);
  const fees: Row[] = res.data.fees ?? [];
  const pending = fees.filter((f) => f.status === "pending");
  const current = fees.filter((f) => f.in_effect);
  const rest = fees.filter((f) => f.status !== "pending" && !f.in_effect);
  const boss = can(admin, "super_admin");
  const back = "/admin/fees";

  const Table = ({ rows, decide }: { rows: Row[]; decide?: boolean }) => (
    <table className="data min-w-[980px]">
      <thead><tr><th>Market · plan</th><th>From</th><th>Plan price</th><th>Transaction</th><th>New client</th><th>Marketplace</th><th>Instant payout</th><th>Chargeback</th><th>Status</th>{decide && <th />}</tr></thead>
      <tbody>
        {rows.map((f) => {
          const c = cur(f.market);
          return (
            <tr key={`${f.market}${f.plan}${f.effective_from}`}>
              <td><b className="font-semibold">{f.market}</b> · <span className="capitalize">{f.plan}</span>{f.note && <span className="block max-w-[200px] text-[12px] text-muted">{f.note}</span>}</td>
              <td className="whitespace-nowrap">{fmtDate(f.effective_from)}</td>
              <td>{f.plan_price_cents ? `${fmtMoney(f.plan_price_cents, c)} / mo` : "Free"}</td>
              <td>{txn(f)}</td>
              <td>{f.new_client_pct}%</td>
              <td>{f.marketplace_pct}%</td>
              <td>{f.instant_payout_pct}%</td>
              <td>{fmtMoney(f.chargeback_cents, c)}</td>
              <td>
                <div className="flex flex-col items-start gap-1">{f.in_effect ? <Pill kind="ok">in effect</Pill> : statusPill(f.status)}
                  <span className="text-[11.5px] text-muted">{f.proposed_by ? `by ${f.proposed_by}` : ""}{f.approved_by ? ` · approved by ${f.approved_by}` : ""}</span>
                </div>
              </td>
              {decide && (
                <td>
                  {f.proposed_by === admin?.email ? <span className="text-[12.5px] text-muted">Waiting for another super admin</span> : (
                    <form action={decideFee} className="flex gap-1.5">
                      <Hidden values={{ market: f.market, plan: f.plan, effective_from: day(f.effective_from), back }} />
                      <Btn small kind="ok" name="decision" value="approve">Approve</Btn>
                      <Btn small kind="danger" name="decision" value="reject">Reject</Btn>
                    </form>
                  )}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <>
      <Topbar title="Fees and plans" sub="A change needs two super admins: one proposes, a different one approves" />
      <Content>
        <Flash sp={sp} error={res.error} />
        {!boss && <ReadOnly need="super admin" />}

        {pending.length > 0 && <Panel title={`Waiting for approval · ${pending.length}`} flush><Table rows={pending} decide={boss} /></Panel>}

        <Panel title="In effect today" flush>
          <Table rows={current} />
          {current.length === 0 && <Empty>No fee schedule is in effect.</Empty>}
        </Panel>

        {rest.length > 0 && <Panel title="Scheduled, replaced and rejected" flush><Table rows={rest} /></Panel>}

        {boss && (
          <Panel title="Propose a change" sub="Amounts are in the market's own currency. Nothing changes until someone else approves it.">
            <form action={proposeFee} className="flex flex-col gap-4">
              <Hidden values={{ back }} />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Market"><select name="market" className={inputCls}><option value="US">United States (USD)</option><option value="NG">Nigeria (NGN)</option></select></Field>
                <Field label="Plan"><select name="plan" className={inputCls}><option value="free">Free</option><option value="pro">Pro</option></select></Field>
                <Field label="Starts on"><input type="date" name="effective_from" required className={inputCls} /></Field>
                <Field label="Plan price per month"><input type="number" name="plan_price" min="0" step="0.01" defaultValue="0" className={inputCls} /></Field>
                <Field label="Transaction %"><input type="number" name="transaction_pct" min="0" max="100" step="0.01" required className={inputCls} /></Field>
                <Field label="Transaction fixed fee"><input type="number" name="transaction_fixed" min="0" step="0.01" defaultValue="0" className={inputCls} /></Field>
                <Field label="Transaction cap (optional)"><input type="number" name="transaction_cap" min="0" step="0.01" className={inputCls} /></Field>
                <Field label="New client %"><input type="number" name="new_client_pct" min="0" max="100" step="0.01" defaultValue="0" className={inputCls} /></Field>
                <Field label="Marketplace %"><input type="number" name="marketplace_pct" min="0" max="100" step="0.01" defaultValue="0" className={inputCls} /></Field>
                <Field label="Instant payout %"><input type="number" name="instant_payout_pct" min="0" max="100" step="0.01" defaultValue="0" className={inputCls} /></Field>
                <Field label="Chargeback fee"><input type="number" name="chargeback" min="0" step="0.01" defaultValue="0" className={inputCls} /></Field>
                <Field label="Why"><input name="note" required className={inputCls} /></Field>
              </div>
              <div><Btn kind="ink">Propose change</Btn></div>
            </form>
          </Panel>
        )}
      </Content>
    </>
  );
}
