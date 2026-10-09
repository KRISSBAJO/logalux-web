import { AdminPagination } from "@/components/admin-pagination";
import Link from "next/link";
import { ExportLink } from "@/components/export-link";
import { Btn, Content, Empty, Field, Flash, Panel, Topbar, inputCls } from "@/components/admin-ui";
import { load, qs, type Row } from "@/lib/admin-api";

const show = (v: unknown) => (v === null || v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v));

export default async function Audit({ searchParams }: { searchParams: Promise<{ q?: string; actor?: string; action?: string }> }) {
  const sp = await searchParams;
  const pageParams = sp as Record<string,string|undefined>;
  const paging = {page:pageParams.page,per_page:pageParams.per_page,sort:pageParams.sort,direction:pageParams.direction};
  const { q = "", actor = "", action = "" } = sp;
  const res = await load(`/audit${qs({ ...paging, q, actor, action })}`);
  const events: Row[] = res.data.events ?? [];
  const actors: Row[] = res.data.actors ?? [];

  return (
    <>
      <Topbar title="Audit log" sub="Every admin action, newest first. Entries cannot be edited or deleted.">
        <ExportLink kind="audit" filters={{ q, actor, action }} need="super_admin" />
      </Topbar>
      <Content>
        <Flash sp={{}} error={res.error} />
        <form action="/admin/audit" className="flex flex-wrap items-end gap-3">
          <Field label="Contains" className="w-full sm:w-[240px]"><input name="q" defaultValue={q} placeholder="Target or detail" className={inputCls} /></Field>
          <Field label="Who" className="w-full sm:w-[240px]">
            <select name="actor" defaultValue={actor} className={inputCls}><option value="">Everyone</option>{actors.map((a) => <option key={a.actor} value={a.actor}>{a.actor} ({a.n})</option>)}</select>
          </Field>
          <Field label="Action starts with" className="w-full sm:w-[200px]"><input name="action" defaultValue={action} placeholder="fee, payout, booking…" className={inputCls} /></Field>
          <Btn kind="ink">Filter</Btn>
          {(q || actor || action) && <Link href="/admin/audit" className="pb-2.5 text-[13px] font-semibold text-wine">Clear</Link>}
        </form>
        <Panel flush>
          <table className="data min-w-[900px]">
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Target</th><th>Before</th><th>After</th></tr></thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="align-top">
                  <td className="whitespace-nowrap text-muted">{new Date(e.created_at).toLocaleString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} UTC</td>
                  <td>{e.actor}</td>
                  <td><b className="font-semibold">{e.action}</b></td>
                  <td className="max-w-[180px] break-all font-mono text-[12px] text-muted">{e.target}</td>
                  <td className="max-w-[220px] break-words font-mono text-[12px] text-muted">{show(e.before)}</td>
                  <td className="max-w-[260px] break-words font-mono text-[12px]">{show(e.after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {events.length === 0 && <Empty>No entries match.</Empty>}
        </Panel>
      <AdminPagination pagination={res.data.pagination} columns={["created_at","actor","action","target"]} />
      </Content>
    </>
  );
}
