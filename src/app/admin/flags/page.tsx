import { Btn, Content, Empty, Field, Flash, Hidden, Panel, Pill, ReadOnly, Topbar, ago, inputCls, inputSm } from "@/components/admin-ui";
import { can, getAdmin, load, type Row } from "@/lib/admin-api";
import { createFlag, deleteFlag, updateFlag } from "../actions";

export default async function Flags({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const [admin, res] = await Promise.all([getAdmin(), load("/flags")]);
  const flags: Row[] = res.data.flags ?? [];
  const boss = can(admin, "super_admin");
  const back = "/admin/flags";

  return (
    <>
      <Topbar title="Feature flags" sub="Switch a feature on for a market, a plan, or a share of businesses" />
      <Content>
        <Flash sp={sp} error={res.error} />
        {!boss && <ReadOnly need="super admin" />}
        <Panel flush>
          {flags.map((f) => (
            <div key={f.key} className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-line-2 px-5 py-4 last:border-0">
              <div className="min-w-0 flex-[1_1_300px]">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-[15px] font-semibold">{f.name}</b>
                  {f.enabled ? <Pill kind="ok">on · {f.rollout_pct}%</Pill> : <Pill kind="grey">off</Pill>}
                  <Pill kind="info">{f.market || "all markets"}</Pill>
                  <Pill kind="info">{f.plan ? `${f.plan} plan` : "all plans"}</Pill>
                </div>
                <p className="mt-1 text-[13.5px] text-muted">{f.description}</p>
                <p className="mt-0.5 font-mono text-[12px] text-muted-2">{f.key} · changed {ago(f.updated_at)}</p>
              </div>
              {boss && (
                <div className="flex flex-wrap items-center gap-2">
                  <form action={updateFlag} className="flex items-center gap-1.5">
                    <Hidden values={{ key: f.key, back }} />
                    <input type="number" name="rollout_pct" min="0" max="100" defaultValue={f.rollout_pct} aria-label={`Rollout percent for ${f.name}`} className={`${inputSm} w-[72px]`} />
                    <Btn small>Set %</Btn>
                  </form>
                  <form action={updateFlag}>
                    <Hidden values={{ key: f.key, enabled: f.enabled ? "0" : "1", back }} />
                    {f.enabled ? <Btn small kind="danger">Turn off</Btn> : <Btn small kind="ok">Turn on</Btn>}
                  </form>
                  {!f.enabled && <form action={deleteFlag}><Hidden values={{ key: f.key, back }} /><Btn small title="Only a flag that is off can be deleted">Delete</Btn></form>}
                </div>
              )}
            </div>
          ))}
          {flags.length === 0 && <Empty>No flags yet.</Empty>}
        </Panel>

        {boss && (
          <Panel title="New flag" sub="It starts switched off at 0%.">
            <form action={createFlag} className="flex flex-col gap-4">
              <Hidden values={{ back }} />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Key, lower case with underscores"><input name="key" required pattern="[a-z][a-z0-9_]*" placeholder="group_bookings" className={inputCls} /></Field>
                <Field label="Name"><input name="name" required className={inputCls} /></Field>
                <Field label="Market"><select name="market" className={inputCls}><option value="">All markets</option><option value="US">United States</option><option value="NG">Nigeria</option></select></Field>
                <Field label="Plan"><select name="plan" className={inputCls}><option value="">All plans</option><option value="free">Free</option><option value="pro">Pro</option></select></Field>
                <Field label="What it does" className="sm:col-span-2 lg:col-span-4"><input name="description" className={inputCls} /></Field>
              </div>
              <div><Btn kind="ink">Create flag</Btn></div>
            </form>
          </Panel>
        )}
      </Content>
    </>
  );
}
