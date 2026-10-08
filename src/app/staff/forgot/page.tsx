import Link from "next/link";
import { LogoMark } from "@/components/logo-mark";
import { requestReset } from "../actions";

export const metadata = { title: "Reset your console password", robots: { index: false } };

export default async function Forgot({ searchParams }: { searchParams: Promise<{ sent?: string; err?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="hero-bg flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-[420px] rounded-[22px] bg-cream p-8 shadow-[0_30px_80px_rgba(0,0,0,.45)]">
        <div className="serif flex items-center gap-2.5 text-[28px]"><LogoMark className="h-[1.15em] w-auto flex-none text-wine" />LogaLuxe</div>
        <div className="mb-6 text-[10px] font-bold uppercase tracking-[.14em] text-rose">LogaXP console</div>
        {sp.sent ? (
          <>
            <h1 className="text-[18px] font-semibold">Check your email</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">If that address belongs to a console account, a reset link is on its way. It works once, for 30 minutes.</p>
          </>
        ) : (
          <form action={requestReset} className="flex flex-col gap-4">
            <h1 className="text-[18px] font-semibold">Forgot your password?</h1>
            <p className="-mt-2 text-[14px] leading-relaxed text-muted">Enter your work email and we will send you a link to choose a new one.</p>
            {sp.err && <div role="alert" className="rounded-xl border border-bad/25 bg-bad-bg px-3.5 py-2.5 text-[13.5px] font-medium text-bad">{sp.err}</div>}
            <label className="field"><span className="text-[11px] font-semibold uppercase tracking-[.06em] text-muted">Work email</span><input name="email" type="email" required autoFocus autoComplete="username" /></label>
            <button className="btn btn-ink w-full">Send reset link</button>
          </form>
        )}
        <Link href="/admin" className="mt-6 inline-block text-[13px] font-semibold text-wine">Back to sign in</Link>
      </div>
    </div>
  );
}
