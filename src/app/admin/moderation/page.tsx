import Link from "next/link";
import { Btn, Content, Empty, Flash, Hidden, Panel, ReadOnly, Tabs, Topbar, ago, inputCls, statusPill } from "@/components/admin-ui";
import { Stars } from "@/components/icons";
import { can, getAdmin, load, qs, type Row } from "@/lib/admin-api";
import { decideModeration } from "../actions";

export default async function Moderation({ searchParams }: { searchParams: Promise<{ status?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const status = sp.status ?? "flagged";
  const [admin, res] = await Promise.all([getAdmin(), load(`/moderation${qs({ status })}`)]);
  const reviews: Row[] = res.data.reviews ?? [];
  const back = `/admin/moderation${qs({ status })}`;
  const ops = can(admin, "ops");

  return (
    <>
      <Topbar title="Moderation" sub="Only published reviews count towards a business's rating">
        <Tabs items={[["flagged", "Flagged"], ["published", "Published"], ["hidden", "Hidden"], ["removed", "Removed"]]} current={status} href={(s) => `/admin/moderation${qs({ status: s })}`} />
      </Topbar>
      <Content>
        <Flash sp={sp} error={res.error} />
        {!ops && <ReadOnly need="ops" />}
        {reviews.length === 0 && <Panel><Empty>No reviews with this status.</Empty></Panel>}
        {reviews.map((r) => (
          <Panel key={r.id}>
            <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
              <div className="min-w-0 flex-[1_1_420px]">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Stars rating={r.rating} />
                  <b className="text-[14px] font-semibold">{r.author_name}</b>
                  <span className="text-[13px] text-muted">on <Link href={`/b/${r.slug}`} className="font-medium text-ink underline decoration-line underline-offset-2">{r.business}</Link> · {r.service_name} · {ago(r.created_at)}</span>
                  {statusPill(r.status)}
                </div>
                <p className="mt-3 text-[15px] leading-relaxed">{r.body}</p>
                {r.reply && <p className="mt-3 rounded-xl bg-cream-2 px-3.5 py-2.5 text-[13.5px]"><b className="font-semibold">Business reply:</b> {r.reply}</p>}
                {r.flag_reason && <p className="mt-3 text-[13px] text-bad"><b className="font-semibold">Flagged:</b> {r.flag_reason}</p>}
                <p className="mt-2 text-[12.5px] text-muted">{r.business} is rated {Number(r.business_rating).toFixed(1)} from {r.review_count} reviews · {r.market}</p>
              </div>
              {ops && (
                <form action={decideModeration} className="flex w-full flex-col gap-2.5 sm:w-[300px]">
                  <Hidden values={{ id: r.id, back }} />
                  <input name="note" placeholder="Reason, kept on record" aria-label="Reason" className={inputCls} />
                  <div className="flex flex-wrap gap-2">
                    {r.status !== "published" && <Btn kind="ok" small name="decision" value="publish">Publish</Btn>}
                    {r.status !== "hidden" && <Btn small name="decision" value="hide">Hide</Btn>}
                    {r.status !== "removed" && <Btn kind="danger" small name="decision" value="remove">Remove</Btn>}
                  </div>
                </form>
              )}
            </div>
          </Panel>
        ))}
      </Content>
    </>
  );
}
