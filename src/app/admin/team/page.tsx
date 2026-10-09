import { PasswordInput } from "@/components/password-input";
import { headers } from "next/headers";
import { CopyButton } from "@/components/merchant-client";
import { Btn, Content, Empty, Field, Flash, Hidden, Panel, Pill, Topbar, ago, inputCls, statusPill, inputSm } from "@/components/admin-ui";
import { can, getAdmin, load, type Row } from "@/lib/admin-api";
import { inviteAdmin, updateAdmin } from "../actions";
import { resetMerchantTwoStep, resetTwoStepFor } from "../actions-account";

const roles: [string, string, string][] = [
  ["support", "Support", "Reads everything. Adds notes. Cancels, completes and moves bookings."],
  ["ops", "Operations", "Everything support can do, plus verification, moderation, disputes, payouts, credits, orders and blocking."],
  ["super_admin", "Super admin", "Everything, plus fees, feature flags and this team page."],
];

export default async function Team({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  // The team list is loaded alongside the sign-in check; the API refuses it to anyone below super admin anyway.
  const [sp, admin, res] = await Promise.all([searchParams, getAdmin(), load("/team")]);
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || `${h.get("x-forwarded-proto") || "http"}://${h.get("x-forwarded-host") || h.get("host") || "localhost:3100"}`;
  const loginUrl = new URL("/admin", origin).toString();
  const back = "/admin/team";

  if (!can(admin, "super_admin")) {
    return (
      <>
        <Topbar title="Team" />
        <Content><Panel><Empty>Only a super admin can see and manage the team.</Empty></Panel></Content>
      </>
    );
  }
  const team: Row[] = res.data.team ?? [];

  return (
    <>
      <Topbar title="Team" sub="Who can sign in to this console, and what each person may do" />
      <Content>
        <Flash sp={sp} error={res.error} />
        <Panel title="Admin sign-in link" sub="Share this address with authorised colleagues. Each person uses their own account."><a href={loginUrl} className="text-wine underline underline-offset-4">{loginUrl}</a><div className="mt-3"><CopyButton text={loginUrl}>Copy admin sign-in link</CopyButton></div></Panel>
        <Panel flush>
          <table className="data min-w-[1040px]">
            <thead><tr><th>Person</th><th>Status</th><th>Two-step</th><th>Last sign-in</th><th>Role</th><th>Access</th><th>New password</th></tr></thead>
            <tbody>
              {team.map((t) => {
                const me = t.id === admin?.id;
                return (
                  <tr key={t.id}>
                    <td><b className="block font-semibold">{t.name}{me && <span className="ml-2 text-[12px] font-normal text-muted">you</span>}</b><span className="text-[12px] text-muted">{t.email}</span></td>
                    <td><div className="flex flex-wrap gap-1">{statusPill(t.active ? "active" : "disabled")}{t.locked && <Pill kind="wine">locked</Pill>}</div></td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        {t.two_step ? <Pill kind="ok">on</Pill> : <Pill kind="grey">off</Pill>}
                        {t.two_step && !me && <form action={resetTwoStepFor}><Hidden values={{ id: t.id, back }} /><Btn small title="For someone who lost their phone. Signs them out and turns two-step off.">Reset</Btn></form>}
                      </div>
                    </td>
                    <td>{ago(t.last_login_at)}</td>
                    <td>
                      <form action={updateAdmin} className="flex items-center gap-1.5">
                        <Hidden values={{ id: t.id, back }} />
                        <select name="role" defaultValue={t.role} disabled={me} aria-label={`Role for ${t.name}`} className={`${inputSm} w-[140px] disabled:opacity-60`}>{roles.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                        {!me && <Btn small>Save</Btn>}
                      </form>
                    </td>
                    <td>
                      {me ? <span className="text-[12.5px] text-muted">None</span> : (
                        <form action={updateAdmin}>
                          <Hidden values={{ id: t.id, active: t.active ? "0" : "1", back }} />
                          {t.active ? <Btn small kind="danger">Disable</Btn> : <Btn small kind="ok">Enable</Btn>}
                        </form>
                      )}
                    </td>
                    <td>
                      <form action={updateAdmin} className="flex items-center gap-1.5">
                        <Hidden values={{ id: t.id, back }} />
                        <PasswordInput  name="password" required minLength={10} autoComplete="new-password" placeholder="10 characters or more" aria-label={`New password for ${t.name}`} className={`${inputSm} w-[170px]`} />
                        <Btn small>Reset</Btn>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>

        <div className="grid items-start gap-5 lg:grid-cols-2">
          <Panel title="Add an admin" sub="Give them the password yourself. They can set their own with Forgot your password on the sign-in page.">
            <form action={inviteAdmin} className="flex flex-col gap-3">
              <Hidden values={{ back }} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name"><input name="name" required className={inputCls} /></Field>
                <Field label="Work email"><input type="email" name="email" required autoComplete="off" className={inputCls} /></Field>
                <Field label="Role"><select name="role" defaultValue="support" className={inputCls}>{roles.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
                <Field label="First password"><PasswordInput  name="password" required minLength={10} autoComplete="new-password" className={inputCls} /></Field>
              </div>
              <div><Btn kind="ink">Add admin</Btn></div>
            </form>
          </Panel>
          <Panel title="Reset a business owner's two-step sign-in" sub="For someone who runs a business and has lost their phone and their recovery codes. Check who they are first: call the number on the business, or ask for the date and amount of their last payout.">
            <form action={resetMerchantTwoStep} className="flex flex-wrap items-end gap-3">
              <Hidden values={{ back }} />
              <Field label="The email they sign in with" className="min-w-[240px] flex-1"><input type="email" name="email" required autoComplete="off" className={inputCls} /></Field>
              <Btn kind="danger">Reset</Btn>
            </form>
          </Panel>
          <Panel title="What each role can do">
            <div className="flex flex-col gap-3">
              {roles.map(([v, l, d]) => <div key={v}><b className="text-[14px] font-semibold">{l}</b><p className="text-[13.5px] text-muted">{d}</p></div>)}
            </div>
          </Panel>
        </div>
      </Content>
    </>
  );
}
