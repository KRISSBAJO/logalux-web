import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "./logo-mark";

/** The shared frame for sign in, sign up and password reset. */
export function AuthCard({ title, sub, children, footer, sp = {} }: { title: string; sub?: string; children: ReactNode; footer?: ReactNode; sp?: { ok?: string; err?: string } }) {
  return (
    <div className="hero-glow flex min-h-screen flex-col items-center justify-center px-5 py-12">
      <Link href="/" aria-label="LogaLuxe home" className="serif mb-8 inline-flex items-center gap-[.42em] text-[30px] leading-none text-[#F4ECE3]">
        <LogoMark className="h-[1.2em] w-auto text-gold" />LogaLuxe
      </Link>
      <div className="w-full max-w-[440px] rounded-[26px] bg-cream p-8 shadow-[0_30px_80px_rgba(0,0,0,.45)] md:p-10">
        <h1 className="serif text-[34px] leading-[1.05]">{title}</h1>
        {sub && <p className="mt-2 text-[15px] leading-relaxed text-muted">{sub}</p>}
        {sp.err && <div role="alert" className="mt-5 rounded-xl border border-bad/25 bg-bad-bg px-3.5 py-2.5 text-[14px] font-medium text-bad">{sp.err}</div>}
        {sp.ok && !sp.err && <div role="status" className="mt-5 rounded-xl border border-ok/25 bg-ok-bg px-3.5 py-2.5 text-[14px] font-medium text-ok">{sp.ok}</div>}
        <div className="mt-6">{children}</div>
        {footer && <div className="mt-6 border-t border-line-2 pt-5 text-[14px] text-muted">{footer}</div>}
      </div>
    </div>
  );
}

export function AuthField({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="field">
      <span className="text-[11px] font-semibold uppercase tracking-[.06em] text-muted">{label}</span>
      <input {...props} />
    </label>
  );
}

/** The choice between a password and a code sent to the phone. Shown only while signing in by code is switched on. */
export function AuthWays({ label, current, passwordHref, codeHref }: { label: string; current: "password" | "code"; passwordHref: string; codeHref: string }) {
  const chip = (on: boolean) => `flex min-h-[42px] flex-1 items-center justify-center whitespace-nowrap rounded-full border px-3 text-[13.5px] font-semibold transition ${on ? "border-ink bg-ink text-cream" : "border-line bg-white hover:border-ink"}`;
  return (
    <nav aria-label={label} className="mb-5 flex gap-2">
      <Link href={passwordHref} replace aria-current={current === "password" ? "true" : undefined} className={chip(current === "password")}>Email and password</Link>
      <Link href={codeHref} replace aria-current={current === "code" ? "true" : undefined} className={chip(current === "code")}>Text me a code</Link>
    </nav>
  );
}
