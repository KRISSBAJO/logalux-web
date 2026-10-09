import { Btn, Content, Empty, Field, Flash, Hidden, Panel, Pill, ReadOnly, Topbar, ago, inputCls, statusPill } from "@/components/admin-ui";
import { can, getAdmin, load, type Row } from "@/lib/admin-api";
import { deleteBroadcast, draftBroadcast, sendBroadcast } from "../actions-growth";

const channelName: Record<string, string> = { email: "Email", whatsapp: "WhatsApp", sms: "SMS" };

function who(b: Row) {
  const parts = [b.audience === "businesses" ? "Businesses" : "Clients", b.market === "US" ? "United States" : b.market === "NG" ? "Nigeria" : "all markets"];
  if (b.plan) parts.push(`${b.plan} plan`);
  return parts.join(" · ");
}

export default async function Messages({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const [admin, res] = await Promise.all([getAdmin(), load("/broadcasts")]);
  const list: Row[] = res.data.broadcasts ?? [];
  const modes: Row = res.data.modes ?? {};
  const ops = can(admin, "ops");
  const boss = can(admin, "super_admin");
  const back = "/admin/messages";
  const live = (ch: string) => modes[ch] && modes[ch] !== "log";

  return (
    <>
      <Topbar title="Messages" sub="One message to many businesses or clients. Operations write the draft; a super admin sends it." />
      <Content>
        <Flash sp={sp} error={res.error} />
        <div className="grid gap-3 sm:grid-cols-3">
          {["email", "whatsapp", "sms"].map((ch) => (
            <div key={ch} className="card flex items-center gap-3 p-4">
              <i className={`block h-2.5 w-2.5 flex-none rounded-full ${live(ch) ? "bg-ok" : "bg-gold"}`} />
              <span><b className="block text-[14.5px] font-semibold">{channelName[ch]}</b><span className="text-[12.5px] text-muted">{live(ch) ? "Connected. Delivery is handled by the provider." : "Not connected. A send is recorded but nobody receives it."}</span></span>
            </div>
          ))}
        </div>
        {!ops && <ReadOnly need="ops" />}

        {ops && (
          <Panel title="Write a message" sub="Saving makes a draft and tells you how many people it would reach. Nothing is sent yet.">
            <form action={draftBroadcast} className="flex flex-col gap-4">
              <Hidden values={{ back }} />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Send to"><select name="audience" className={inputCls}><option value="businesses">Businesses</option><option value="clients">Clients</option></select></Field>
                <Field label="Market"><select name="market" className={inputCls}><option value="">All markets</option><option value="US">United States</option><option value="NG">Nigeria</option></select></Field>
                <Field label="Plan, businesses only"><select name="plan" className={inputCls}><option value="">All plans</option><option value="free">Free</option><option value="pro">Pro</option></select></Field>
                <Field label="Channel"><select name="channel" className={inputCls}><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option></select></Field>
                <Field label="Subject, for email" className="sm:col-span-2 lg:col-span-4"><input name="subject" maxLength={140} className={inputCls} /></Field>
                <Field label="Message. Write {{name}} where the person's name should go." className="sm:col-span-2 lg:col-span-4">
                  <textarea name="body" required rows={6} minLength={10} maxLength={4000} placeholder={"Hello {{name}},\n\n"} className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[14.5px] leading-relaxed outline-none focus:border-ink" />
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-3"><Btn kind="ink">Save draft</Btn><span className="text-[13px] text-muted">Clients have a phone number but no email, so reach them by WhatsApp or SMS. Blocked numbers are left out.</span></div>
            </form>
          </Panel>
        )}

        <Panel title="Drafts and sent messages" flush>
          {list.map((b) => (
            <div key={b.id} className="flex flex-wrap items-start gap-x-6 gap-y-3 border-b border-line-2 px-5 py-4 last:border-0">
              <div className="min-w-0 flex-[1_1_420px]">
                <div className="flex flex-wrap items-center gap-2">
                  {b.status === "draft" ? <Pill kind="gold">draft</Pill> : statusPill(b.status === "sending" ? "processing" : "sent")}
                  <Pill kind="info">{channelName[b.channel]}</Pill>
                  <span className="text-[13px] text-muted">{who(b)} · {b.recipients} {b.recipients === 1 ? "person" : "people"}</span>
                </div>
                {b.subject && <b className="mt-2 block text-[15px] font-semibold">{b.subject}</b>}
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[14px] leading-relaxed text-muted">{b.body}</p>
                <p className="mt-2 text-[12px] text-muted-2">
                  Written by {b.created_by}, {ago(b.created_at)}
                  {b.status !== "draft" && <> · sent by {b.sent_by}, {ago(b.sent_at)} · {b.delivered} delivered, {b.queued ?? 0} queued, {b.logged} recorded only, {b.skipped} with no contact, {b.failed} failed</>}
                </p>
              </div>
              {b.status === "draft" && (
                <div className="flex flex-wrap items-center gap-2">
                  {boss ? <form action={sendBroadcast}><Hidden values={{ id: b.id, back }} /><Btn kind="ink" small title="This cannot be undone">Send to {b.recipients}</Btn></form> : <span className="text-[12.5px] text-muted">Waiting for a super admin</span>}
                  {ops && <form action={deleteBroadcast}><Hidden values={{ id: b.id, back }} /><Btn small kind="danger">Delete draft</Btn></form>}
                </div>
              )}
            </div>
          ))}
          {list.length === 0 && <Empty>No messages yet.</Empty>}
        </Panel>
      </Content>
    </>
  );
}
