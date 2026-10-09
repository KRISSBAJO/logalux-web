import Link from "next/link";
import { Btn, Content, Empty, Flash, Hidden, Panel, Pill, ReadOnly, Topbar, ago, fmtMoney } from "@/components/admin-ui";
import { can, getAdmin, load, type Row } from "@/lib/admin-api";
import { retryRefund } from "../actions-care";

// Work the system could not finish on its own. Nothing here fixes itself by waiting: a refund the provider keeps
// refusing needs a person to look at the payment, and a stalled campaign needs a person to decide what to resend.

const stamp = (iso: string | null | undefined) => (iso ? `${new Date(iso).toLocaleString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} UTC` : "None");

export default async function Attention({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const [admin, res] = await Promise.all([getAdmin(), load("/attention")]);
  const jobs: Row[] = res.data.refund_jobs ?? [];
  const campaigns: Row[] = res.data.stalled_campaigns ?? [];
  const boss = can(admin, "super_admin");
  const back = "/admin/attention";

  if (!can(admin, "ops")) {
    return (
      <>
        <Topbar title="Needs a human" />
        <Content><Panel><Empty>This page is for the ops and super admin roles.</Empty></Panel></Content>
      </>
    );
  }

  return (
    <>
      <Topbar title="Needs a human" sub="Refunds the payment provider has not accepted, and campaigns that stopped with unknown outcomes">
        <Link href="/admin" className="inline-flex h-10 items-center rounded-full border border-line bg-white px-4 text-[13.5px] font-semibold text-ink hover:border-ink">Overview</Link>
      </Topbar>
      <Content>
        <Flash sp={sp} error={res.error} />
        {!boss && <ReadOnly need="super admin" />}

        <Panel title={`Refunds waiting on the provider · ${jobs.length}`} sub="Reserved in the books but not yet accepted by Stripe or Paystack. The worker asks again every few minutes and keeps only the last answer; retries are not counted." flush>
          {jobs.length > 0 ? (
            <table className="data min-w-[900px]">
              <thead><tr><th>Reserved</th><th>What</th><th>Business</th><th>Amount</th><th>Problem</th>{boss && <th />}</tr></thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="align-top hover:bg-cream">
                    <td className="whitespace-nowrap">{stamp(j.created_at)}<span className="block text-[12px] text-muted">{ago(j.created_at)}</span></td>
                    <td>
                      <b className="block font-semibold">{j.kind === "sale" ? "Sale refund" : "Return refund"}</b>
                      <span className="block text-[12px] text-muted">{j.customer || "Walk-in"}</span>
                      {j.order_id && <Link href={`/admin/orders?q=${encodeURIComponent(String(j.order_id).slice(0, 8))}`} className="text-[12px] font-semibold text-wine">Order {String(j.order_id).slice(0, 8).toUpperCase()}</Link>}
                      {j.kind === "return" && <Link href="/admin/returns" className="ml-2 text-[12px] font-semibold text-wine">Returns</Link>}
                    </td>
                    <td>{j.business_id ? <Link href={`/admin/businesses/${j.business_id}`} className="font-semibold hover:text-wine">{j.business}</Link> : j.business}</td>
                    <td className="whitespace-nowrap font-semibold">{fmtMoney(j.amount_cents, j.currency)}</td>
                    <td className="max-w-[360px]">{j.problem ? <span className="block text-[13px]">{j.problem}</span> : <span className="text-muted">Not tried yet</span>}<span className="block text-[12px] text-muted">Last tried {ago(j.updated_at)}</span></td>
                    {boss && (
                      <td>
                        <form action={retryRefund}>
                          <Hidden values={{ id: j.id, back }} />
                          <Btn small>Retry now</Btn>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>No refund is waiting on a provider.</Empty>
          )}
        </Panel>

        <div id="campaigns" className="scroll-mt-24" />
        <Panel title={`Stalled campaigns · ${campaigns.length}`} sub="Some messages have an unknown outcome, so the campaign will not be resent on its own. The business sees the same note in its Marketing screen." flush>
          {campaigns.length > 0 ? (
            <table className="data min-w-[900px]">
              <thead><tr><th>Created</th><th>Campaign</th><th>Business</th><th>Channel</th><th>Unknown</th><th>Why it stopped</th></tr></thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="align-top hover:bg-cream">
                    <td className="whitespace-nowrap">{stamp(c.created_at)}<span className="block text-[12px] text-muted">{ago(c.created_at)}</span></td>
                    <td><b className="block font-semibold">{c.name}</b><span className="block text-[12px] uppercase text-muted">{String(c.id).slice(0, 8)}</span></td>
                    <td><Link href={`/admin/businesses/${c.business_id}`} className="font-semibold hover:text-wine">{c.business}</Link></td>
                    <td><Pill kind="grey">{c.channel === "sms" ? "texts" : c.channel}</Pill></td>
                    <td>{c.uncertain ?? 0} of {c.recipients ?? 0}</td>
                    <td className="max-w-[360px] text-[13px]">{c.stalled_reason || "None"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>No campaign is stalled.</Empty>
          )}
        </Panel>
      </Content>
    </>
  );
}
