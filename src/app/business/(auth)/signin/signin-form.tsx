"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { AuthField } from "@/components/auth-card";
import { merchantSignInStep, type SignInState } from "../actions";

/** Email and password, then a code box when the account has two-step sign-in on. What was typed is kept between the steps. */
export function SignInForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(merchantSignInStep, { needCode: false, error: "" });
  const [email, setEmail] = useState(""), [password, setPassword] = useState("");
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && <div role="alert" className="rounded-xl border border-bad/25 bg-bad-bg px-3.5 py-2.5 text-[14px] font-medium text-bad">{state.error}</div>}
      <AuthField label="Email" name="email" type="email" required autoFocus={!state.needCode} autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
      <AuthField label="Password" name="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {state.needCode && (
        <>
          <AuthField label="6-digit code from your authenticator app" name="code" required autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={14} />
          <p className="-mt-2 text-[13px] leading-relaxed text-muted">Lost your phone? Type one of your recovery codes instead.</p>
        </>
      )}
      <button className="btn btn-ink mt-1 min-h-[50px] w-full" disabled={pending}>{pending ? "Signing in…" : state.needCode ? "Sign in with code" : "Sign in"}</button>
      <Link href="/business/forgot" className="text-center text-[13.5px] font-semibold text-wine">Forgot your password?</Link>
    </form>
  );
}
