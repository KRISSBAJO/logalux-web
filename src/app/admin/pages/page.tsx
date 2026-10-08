import Link from "next/link";
import { Check } from "@/components/catalog-forms";
import { Markdown } from "@/components/markdown";
import { Btn, Content, Empty, Field, Flash, Hidden, Panel, Pill, ReadOnly, Topbar, ago, inputCls } from "@/components/admin-ui";
import { can, getAdmin, load, qs, type Row } from "@/lib/admin-api";
import { savePage } from "../actions-growth";

export default async function Pages({ searchParams }: { searchParams: Promise<{ slug?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const [admin, res] = await Promise.all([getAdmin(), load("/pages")]);
  const pages: Row[] = res.data.pages ?? [];
  const sel = pages.find((p) => p.slug === sp.slug) ?? pages[0];
  const boss = can(admin, "super_admin");
  const draft = sel && /^## Draft/m.test(sel.body);

  return (
    <>
      <Topbar title="Site pages" sub="The legal and help pages linked from the footer of the site" />
      <Content>
        <Flash sp={sp} error={res.error} />
        {!boss && <ReadOnly need="super admin" />}
        <div className="grid items-start gap-5 lg:grid-cols-[260px_1fr]">
          <Panel flush>
            {pages.map((p) => (
              <Link key={p.slug} href={`/admin/pages${qs({ slug: p.slug })}`} className={`block border-b border-line-2 px-4 py-3 last:border-0 ${sel?.slug === p.slug ? "bg-cream-3" : "hover:bg-cream"}`}>
                <div className="flex items-center gap-2"><b className="flex-1 text-[14.5px] font-semibold">{p.title}</b>{!p.published && <Pill kind="grey">hidden</Pill>}</div>
                <div className="text-[12px] text-muted">/legal/{p.slug} · {p.updated_by === "system" ? "starter text" : `${p.updated_by}, ${ago(p.updated_at)}`}</div>
              </Link>
            ))}
            {pages.length === 0 && <Empty>No pages.</Empty>}
          </Panel>

          {sel && (
            <div className="flex min-w-0 flex-col gap-5">
              {draft && <p className="rounded-xl bg-warn-bg px-4 py-3 text-[13.5px]">This page still holds starter text marked as a draft. Have a lawyer review it, then remove the draft heading.</p>}
              {boss ? (
                <Panel title={`Edit · ${sel.title}`} action={<Link href={`/legal/${sel.slug}`} className="text-[13px] font-semibold text-wine">View on the site</Link>}>
                  <form action={savePage} className="flex flex-col gap-3">
                    <Hidden values={{ slug: sel.slug, back: `/admin/pages${qs({ slug: sel.slug })}` }} />
                    <Field label="Title"><input name="title" required maxLength={120} defaultValue={sel.title} className={inputCls} /></Field>
                    <Field label="Text">
                      <textarea key={sel.slug} name="body" rows={20} defaultValue={sel.body} className="w-full rounded-xl border border-line bg-white px-3.5 py-3 font-mono text-[13.5px] leading-relaxed outline-none focus:border-ink" />
                    </Field>
                    <p className="text-[12.5px] text-muted">Leave an empty line between paragraphs. Start a line with ## for a heading or - for a bullet. Use **bold** and [link text](https://example.com).</p>
                    <div className="flex flex-wrap items-center gap-4"><Btn kind="ink">Save page</Btn><Check name="published" label="Shown on the site" defaultChecked={sel.published} /></div>
                  </form>
                </Panel>
              ) : null}
              <Panel title="How it reads" sub="The saved version"><Markdown source={sel.body} /></Panel>
            </div>
          )}
        </div>
      </Content>
    </>
  );
}
