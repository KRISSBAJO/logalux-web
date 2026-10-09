import { PasswordInput } from "@/components/password-input";
import { toDataURL } from "qrcode";
import { Btn, Content, Field, Flash, Hidden, Panel, Pill, Topbar, ago, inputCls } from "@/components/admin-ui";
import { load } from "@/lib/admin-api";
import { readFlash } from "@/lib/action-helpers";
import { cancelTwoStepSetup, changePassword, dismissRecoveryCodes, finishTwoStep, startTwoStep, stopTwoStep } from "../actions-account";

const roleName: Record<string, string> = { support: "Support", ops: "Operations", super_admin: "Super admin" };

export default async function Account({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const [res, flash] = await Promise.all([load("/account"), readFlash<{ setup?: { secret: string; uri: string }; recovery?: string[] }>()]);
  const a = res.data.admin ?? {};
  const twoStep: boolean = !!res.data.two_step;
  const setup = !twoStep ? flash?.setup : undefined;
  const recovery = twoStep ? flash?.recovery : undefined;
  const qr = setup ? await toDataURL(setup.uri, { margin: 1, width: 220, color: { dark: "#1A1513", light: "#FFFFFF" } }) : "";
  const back = "/admin/account";

  return (
    <>
      <Topbar title="Your account" sub={`${a.email ?? ""} · ${roleName[a.role] ?? ""}`} />
      <Content>
        <Flash sp={sp} error={res.error} />

        {recovery && (
          <Panel title="Save your recovery codes" sub="Each code signs you in once if you lose your phone. They are shown only now.">
            <div className="grid max-w-[520px] grid-cols-2 gap-2 font-mono text-[15px]">
              {recovery.map((c) => <span key={c} className="rounded-lg bg-cream-2 px-3 py-2 text-center tracking-wider">{c}</span>)}
            </div>
            <form action={dismissRecoveryCodes} className="mt-4"><Hidden values={{ back }} /><Btn kind="ink">I have saved them</Btn></form>
          </Panel>
        )}

        <div className="grid items-start gap-5 lg:grid-cols-2">
          <Panel title="Password" sub={res.data.password_changed_at ? `Last changed ${ago(res.data.password_changed_at)}` : "Never changed since the account was made"}>
            <form action={changePassword} className="flex flex-col gap-3">
              <Hidden values={{ back }} />
              <Field label="Current password"><PasswordInput  name="current" required autoComplete="current-password" className={inputCls} /></Field>
              <Field label="New password, 10 characters or more"><PasswordInput  name="new" required minLength={10} autoComplete="new-password" className={inputCls} /></Field>
              <Field label="New password again"><PasswordInput  name="again" required minLength={10} autoComplete="new-password" className={inputCls} /></Field>
              <div><Btn kind="ink">Change password</Btn></div>
              <p className="text-[12.5px] text-muted">Changing it signs you out on every other device.</p>
            </form>
          </Panel>

          <Panel title="Two-step sign-in" action={twoStep ? <Pill kind="ok">on</Pill> : <Pill kind="grey">off</Pill>}>
            {twoStep ? (
              <div className="flex flex-col gap-4">
                <p className="text-[14px] leading-relaxed">Signing in needs your password and a 6-digit code from your authenticator app. You have <b>{res.data.recovery_left}</b> recovery {res.data.recovery_left === 1 ? "code" : "codes"} left.</p>
                <form action={stopTwoStep} className="flex flex-col gap-3 border-t border-line-2 pt-4">
                  <Hidden values={{ back }} />
                  <Field label="Your password, to turn it off"><PasswordInput  name="password" required autoComplete="current-password" className={inputCls} /></Field>
                  <div><Btn kind="danger">Turn off two-step sign-in</Btn></div>
                </form>
              </div>
            ) : setup ? (
              <div className="flex flex-col gap-4">
                <ol className="list-decimal space-y-1 pl-5 text-[14px] leading-relaxed">
                  <li>Open an authenticator app, such as Google Authenticator, Authy or 1Password.</li>
                  <li>Scan this code, or type the key in by hand.</li>
                  <li>Enter the 6-digit code the app shows.</li>
                </ol>
                <div className="flex flex-wrap items-center gap-5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr} alt="QR code for your authenticator app" width={176} height={176} className="rounded-xl border border-line" />
                  <div className="min-w-0">
                    <small className="block text-[11px] font-semibold uppercase tracking-[.06em] text-muted">Key</small>
                    <code className="block break-all font-mono text-[14px] tracking-wider">{setup.secret.replace(/(.{4})/g, "$1 ").trim()}</code>
                  </div>
                </div>
                <form action={finishTwoStep} className="flex items-end gap-2">
                  <Hidden values={{ back }} />
                  <Field label="6-digit code" className="w-[160px]"><input name="code" required inputMode="numeric" pattern="[0-9 ]{6,7}" autoComplete="one-time-code" autoFocus className={`${inputCls} text-center font-mono text-[18px] tracking-[.3em]`} /></Field>
                  <Btn kind="ink">Turn on</Btn>
                </form>
                <form action={cancelTwoStepSetup}><Hidden values={{ back }} /><button className="text-[13px] font-semibold text-muted hover:text-ink">Cancel setup</button></form>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-[14px] leading-relaxed">Adds a 6-digit code from your phone to every sign-in. A stolen password alone can no longer get into the console.</p>
                <form action={startTwoStep}><Hidden values={{ back }} /><Btn kind="ink">Set up two-step sign-in</Btn></form>
              </div>
            )}
          </Panel>
        </div>
      </Content>
    </>
  );
}
