import Link from "next/link";
import { LogoMark } from "@/components/logo-mark";
import { setNewPassword } from "../actions";

export const metadata = { title: "Choose a new console password", robots: { index: false }, referrer: "no-referrer" as const };

export default async function Reset({ searchParams }: { searchParams: Promise<{ token?: string; err?: string }> }) {
  const sp = await searchParams;
  const token = sp.token ?? "";
  return (
    <div className="hero-bg flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-[420px] rounded-[22px] bg-cream p-8 shadow-[0_30px_80px_rgba(0,0,0,.45)]">
        <div className="serif flex items-center gap-2.5 text-[28px]"><LogoMark className="h-[1.15em] w-auto flex-none text-wine" />LogaLuxe</div>
        <div className="mb-6 text-[10px] font-bold uppercase tracking-[.14em] text-rose">LogaXP console</div>
        {!/^[0-9a-f]{64}$/.test(token) ? (
          <>
            <h1 className="text-[18px] font-semibold">This link is not valid</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">Ask for a new reset link and use the newest email.</p>
            <Link href="/staff/forgot" className="btn btn-ink mt-5 w-full">Get a new link</Link>
          </>
        ) : (
          <form action={setNewPassword} className="flex flex-col gap-4">
            <h1 className="text-[18px] font-semibold">Choose a new password</h1>
            {sp.err && <div role="alert" className="rounded-xl border border-bad/25 bg-bad-bg px-3.5 py-2.5 text-[13.5px] font-medium text-bad">{sp.err}</div>}
            <input type="hidden" name="token" value={token} />
            <label className="field"><span className="text-[11px] font-semibold uppercase tracking-[.06em] text-muted">New password, 10 characters or more</span><input name="password" type="password" required minLength={10} autoFocus autoComplete="new-password" /></label>
            <label className="field"><span className="text-[11px] font-semibold uppercase tracking-[.06em] text-muted">New password again</span><input name="again" type="password" required minLength={10} autoComplete="new-password" /></label>
            <button className="btn btn-ink w-full">Save new password</button>
            <p className="text-[12.5px] leading-relaxed text-muted">This signs you out everywhere. If you use two-step sign-in, you will still need your code.</p>
          </form>
        )}
        <Link href="/admin" className="mt-6 inline-block text-[13px] font-semibold text-wine">Back to sign in</Link>
      </div>
    </div>
  );
}
