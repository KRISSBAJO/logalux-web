import { Btn, Content, Empty, Field, Flash, Hidden, Panel, Pill, ReadOnly, Topbar, fmtDate, fmtMoney, inputCls } from "@/components/admin-ui";
import { can, getAdmin, load, type Row } from "@/lib/admin-api";
import { createPromo, deletePromo, togglePromo } from "../actions-growth";

const where: Record<string, string> = { both: "Bookings and shop", bookings: "Bookings only", orders: "Shop only" };

function state(p: Row) {
  if (!p.active) return <Pill kind="grey">off</Pill>;
  if (p.usable) return <Pill kind="ok">working</Pill>;
  if (p.max_uses != null && p.used >= p.max_uses) return <Pill kind="gold">used up</Pill>;
  if (p.starts_at && new Date(p.starts_at) > new Date()) return <Pill kind="info">not started</Pill>;
  return <Pill kind="gold">expired</Pill>;
}

export default async function Promos({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const [admin, res] = await Promise.all([getAdmin(), load("/promos")]);
  const promos: Row[] = res.data.promos ?? [];
  const ops = can(admin, "ops");
  const back = "/admin/promos";

  return (
    <>
      <Topbar title="Promo codes" sub="Codes clients type at checkout or when booking. LogaLuxe pays for the discount." />
      <Content>
        <Flash sp={sp} error={res.error} />
        {!ops && <ReadOnly need="ops" />}
        <Panel flush>
          <table className="data min-w-[900px]">
            <thead><tr><th>Code</th><th>Takes off</th><th>Works on</th><th>Minimum spend</th><th>Used</th><th>Dates</th><th>State</th>{ops && <th />}</tr></thead>
            <tbody>
              {promos.map((p) => (
                <tr key={p.id}>
                  <td><b className="font-mono text-[14px] font-semibold tracking-wide">{p.code}</b>{p.description && <span className="block text-[12px] text-muted">{p.description}</span>}</td>
                  <td className="font-semibold">{p.kind === "percent" ? `${p.value}%` : fmtMoney(p.value, p.currency)}</td>
                  <td>{where[p.applies_to]}</td>
                  <td>{p.min_cents ? fmtMoney(p.min_cents, p.currency) : "None"}</td>
                  <td>{p.used}{p.max_uses != null ? ` of ${p.max_uses}` : ""}</td>
                  <td className="text-[13px] text-muted">{p.starts_at || p.ends_at ? `${p.starts_at ? fmtDate(p.starts_at) : "now"} to ${p.ends_at ? fmtDate(p.ends_at) : "no end"}` : "Always"}</td>
                  <td>{state(p)}</td>
                  {ops && (
                    <td>
                      <div className="flex gap-1.5">
                        <form action={togglePromo}><Hidden values={{ id: p.id, active: p.active ? "0" : "1", back }} />{p.active ? <Btn small>Switch off</Btn> : <Btn small kind="ok">Switch on</Btn>}</form>
                        {p.used === 0 && <form action={deletePromo}><Hidden values={{ id: p.id, back }} /><Btn small kind="danger">Delete</Btn></form>}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {promos.length === 0 && <Empty>No promo codes yet.</Empty>}
        </Panel>

        {ops && (
          <Panel title="New promo code">
            <form action={createPromo} className="flex flex-col gap-4">
              <Hidden values={{ back }} />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Code"><input name="code" required pattern="[A-Za-z0-9][A-Za-z0-9\-]{2,23}" placeholder="WELCOME10" className={`${inputCls} font-mono uppercase`} /></Field>
                <Field label="Type"><select name="kind" className={inputCls}><option value="percent">Percentage off</option><option value="fixed">Fixed amount off</option></select></Field>
                <Field label="Value: a percent, or an amount"><input name="value" type="number" min="0.01" step="0.01" required className={inputCls} /></Field>
                <Field label="Currency, for a fixed amount"><select name="currency" className={inputCls}><option value="USD">USD</option><option value="NGN">NGN</option></select></Field>
                <Field label="Works on"><select name="applies_to" className={inputCls}><option value="both">Bookings and shop</option><option value="bookings">Bookings only</option><option value="orders">Shop only</option></select></Field>
                <Field label="Minimum spend, optional"><input name="min" type="number" min="0" step="0.01" className={inputCls} /></Field>
                <Field label="Total uses allowed, optional"><input name="max_uses" type="number" min="1" step="1" className={inputCls} /></Field>
                <Field label="What it is for"><input name="description" placeholder="Launch week" className={inputCls} /></Field>
                <Field label="Starts, optional"><input name="starts_at" type="date" className={inputCls} /></Field>
                <Field label="Ends, optional"><input name="ends_at" type="date" className={inputCls} /></Field>
              </div>
              <div><Btn kind="ink">Create code</Btn></div>
            </form>
          </Panel>
        )}
      </Content>
    </>
  );
}
