import "./journal-admin.css";
import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { Content, Flash, Panel, ReadOnly, Tabs, Topbar, ago, statusPill } from "@/components/admin-ui";
import { Icon } from "@/components/icons";
import { can, getAdmin, load, qs, type Row } from "@/lib/admin-api";
import { journalCategoryLabel } from "@/lib/journal";

const TABS: [string, string][] = [["", "All"], ["draft", "Drafts"], ["scheduled", "Scheduled"], ["published", "Published"], ["archived", "Archived"]];

const when = (iso: string | null | undefined, zone = "UTC") =>
  iso ? new Date(iso).toLocaleString("en-GB", { timeZone: zone, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";

export default async function JournalList({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const status = TABS.some(([v]) => v === sp.status) ? sp.status! : "";
  const [admin, res] = await Promise.all([getAdmin(), load(`/journal${qs({ status, q: sp.q })}`)]);
  const list: Row[] = res.data.articles ?? [];
  const ops = can(admin, "ops");
  const counts = (s: string) => list.filter((a) => a.status === s).length;
  const live = counts("published");

  return (
    <>
      <Topbar title="Journal" sub={res.error ? "Articles about beauty, on the home screens and at /journal" : `${list.length} ${status ? status : ""} ${list.length === 1 ? "article" : "articles"}${status ? "" : ` · ${live} live`}`}>
        <Tabs items={TABS} current={status} href={(s) => `/admin/journal${qs({ status: s })}`} />
        <Link href="/journal" className="inline-flex h-10 items-center rounded-full border border-line bg-white px-4 text-[13.5px] font-semibold hover:border-ink">View the Journal</Link>
        {ops && <Link href="/admin/journal/new" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-[13.5px] font-semibold text-cream hover:bg-ink-3"><Icon.Plus width={15} height={15} />Write an article</Link>}
      </Topbar>
      <Content>
        <Flash sp={sp} error={res.error} />
        {!ops && <ReadOnly need="ops" />}
        <div className="jn-admin">
          <Panel flush>
            <DataTable id="journal" search="Search titles, authors and tags" filters={["Category", "Country"]} pageSize={25} noun="article" empty={status ? `No ${status} articles.` : "No articles yet. Write the first one."}>
              <table className="data min-w-[980px]">
                <thead>
                  <tr><th>Title</th><th>Category</th><th>Country</th><th>Status</th><th data-col="Featured">Featured</th><th>Reads</th><th>Published</th><th>Updated</th></tr>
                </thead>
                <tbody>
                  {list.map((a) => (
                    <tr key={a.id} className="hover:bg-cream">
                      <td>
                        <Link href={`/admin/journal/${a.id}`} className="block min-w-0 max-w-[460px]">
                          <b className="block truncate text-[14px] font-semibold">{a.title}</b>
                          <span className="block truncate text-[12px] text-muted">{a.dek || `/journal/${a.slug}`}{a.author_name ? ` · ${a.author_name}` : ""}{(a.tags ?? []).length ? ` · ${(a.tags as string[]).join(", ")}` : ""}</span>
                        </Link>
                      </td>
                      <td data-filter={a.category_label || journalCategoryLabel(a.category)}>{a.category_label || journalCategoryLabel(a.category)}</td>
                      <td data-filter={a.country || "Both"}>{a.country || "Both"}</td>
                      <td data-filter={a.status}>{statusPill(a.status)}</td>
                      <td data-sort={a.featured ? "1" : "0"} data-filter={a.featured ? "Yes" : "No"}>{a.featured ? <Icon.Star width={15} height={15} className="text-gold" /> : <span className="text-muted-2">None</span>}</td>
                      <td data-sort={String(a.view_count ?? 0)} className="font-semibold">{Number(a.view_count ?? 0).toLocaleString("en-US")}</td>
                      <td data-sort={a.published_at ?? ""} className="text-[13px] text-muted">{a.published_at ? when(a.published_at) + (a.status === "scheduled" ? " (scheduled)" : "") : "None"}</td>
                      <td data-sort={a.updated_at ?? ""} className="text-[13px] text-muted">{ago(a.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
          </Panel>
        </div>
        <p className="text-[12.5px] text-muted">Reads are counted by the public page, once per visit. Times are in UTC. Published articles go live at their time by themselves.</p>
      </Content>
    </>
  );
}
