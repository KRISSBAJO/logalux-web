import Link from "next/link";
import { customerApi, type Customer } from "@/lib/customer";
import { deleteMyAccount, revokeDevice } from "./actions";
import { ConfirmSubmit } from "./account-client";

type Device = { id: string; current: boolean; device_name: string; last_seen_at: string; expires_at: string };
export async function Privacy({ user }: { user: Customer }) {
  let devices: Device[] = [], failed = false;
  try { devices = (await customerApi<{ sessions: Device[] }>("/auth/sessions")).sessions; } catch { failed = true; }
  return <div className="mt-6 grid gap-5 md:grid-cols-2">
    <section className="card rounded-[20px] p-6">
      <h3 className="text-lg font-semibold">Signed-in devices</h3>
      <p className="mt-2 text-sm text-muted">Browser labels are approximate. This list shows active sign-ins, not exact physical devices.</p>
      {failed ? <p role="alert" className="mt-4 text-bad">We couldn’t load your devices. <Link href="/account?tab=details" className="underline">Retry</Link></p> : <ul className="mt-3 divide-y divide-line">
        {devices.map(d => <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
          <div><b>{d.device_name || "Browser or app"}</b>{d.current && <span className="ml-2 pill pill-ok">This sign-in</span>}<p className="mt-1 text-muted">Last active {new Date(d.last_seen_at).toLocaleString("en-US", { timeZone: "UTC", timeZoneName: "short" })}</p></div>
          {!d.current && <form action={revokeDevice}><input type="hidden" name="id" value={d.id}/><ConfirmSubmit className="btn btn-out btn-sm" message="Sign this device out?">Sign out</ConfirmSubmit></form>}
        </li>)}
      </ul>}
      <form action={revokeDevice} className="mt-4"><input type="hidden" name="id" value="others"/><ConfirmSubmit className="btn btn-out btn-sm" message="Sign out every other browser and app? This sign-in stays active.">Sign out other devices</ConfirmSubmit></form>
    </section>
    <section className="card rounded-[20px] p-6">
      <h3 className="text-lg font-semibold">Your data</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">Download your profile, bookings, orders, messages, reviews, saved lists and store-credit history. Keep the download private.</p>
      <a href="/account/export" className="btn btn-out mt-4">Download my data</a>
      <details className="mt-6 border-t border-line pt-4">
        <summary className="cursor-pointer font-semibold text-bad">Delete my account</summary>
        <p className="mt-3 text-sm leading-relaxed">This removes your profile and signs out all devices. Transaction, merchant and dispute records are retained where required. Resolve upcoming visits, open orders, unused plans and credit first. <Link href="/help" className="underline">Get help</Link>.</p>
        <form action={deleteMyAccount} className="mt-4 flex flex-col gap-3">
          {user.has_password ? <label className="field"><span>Current password</span><input type="password" name="password" required autoComplete="current-password"/></label> : <p className="text-sm text-muted">Sign in again with a phone code immediately before deleting.</p>}
          <label className="field"><span>Type DELETE to confirm</span><input name="confirm" required pattern="DELETE" autoComplete="off"/></label>
          <ConfirmSubmit className="btn btn-out text-bad" message="Permanently remove your LogaLuxe profile and sign out all devices?">Delete account</ConfirmSubmit>
        </form>
      </details>
    </section>
  </div>;
}
