"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { codeStep, type CodeState } from "@/app/account/actions";

const START: CodeState = { stage: "phone", phone: "", channel: "sms", code: "", sent: "", error: "", sends: 0 };
const cap = "text-[11px] font-semibold uppercase tracking-[.06em] text-muted";
const linkBtn = "text-[13.5px] font-semibold text-wine underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50";
const WAIT = 30;

/** Seconds left before a new code may be asked for. It starts again each time one is sent. */
export function useWait(sends: number, seconds = WAIT) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    setLeft(seconds);
    const t = window.setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    return () => window.clearInterval(t);
  }, [sends, seconds]);
  return left;
}

/** The 6-digit field: the phone offers the code from the message, and a pasted code may hold spaces. */
export function CodeField({ value, onChange, autoFocus = true }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const clean = (s: string) => s.replace(/\D/g, "").slice(0, 6);
  return (
    <label className="field">
      <span className={cap}>6-digit code</span>
      <input
        name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required autoFocus={autoFocus}
        // The field itself is put right as well: a space typed after three digits changes nothing we keep, so React would leave it there.
        value={value} onChange={(e) => { const d = clean(e.target.value); e.target.value = d; onChange(d); }}
        onPaste={(e) => { const d = clean(e.clipboardData.getData("text")); if (d) { e.preventDefault(); onChange(d); } }}
        className="!min-h-[52px] text-center !text-[22px] font-semibold tracking-[.35em]"
      />
    </label>
  );
}

export const CodeAlert = ({ text }: { text: string }) => (
  <div aria-live="polite">{text ? <div role="alert" className="rounded-xl border border-bad/25 bg-bad-bg px-3.5 py-2.5 text-[14px] font-medium text-bad">{text}</div> : null}</div>
);

/** What to say once a code has been asked for. */
export function sentLine(sent: string, phone: string, channel: string) {
  return sent === "logged"
    ? `We could not send a message to ${phone}, so no code is on its way. Use a different number, or your email and password.`
    : `We sent a 6-digit code to ${phone} ${channel === "whatsapp" ? "on WhatsApp" : "by text"}. It works for 10 minutes.`;
}

/**
 * Signing in, or making an account, with a code sent to a phone. One form for both: a number that is
 * new is asked for a name after the code; a number that has an account is signed in.
 */
export function CodeSignIn({ mode, next, invite = "", whatsapp }: { mode: "signin" | "signup"; next: string; /** The code of the friend who invited them. */ invite?: string; /** WhatsApp is switched on, so the code can go there. */ whatsapp: boolean }) {
  const [state, step, pending] = useActionState(codeStep, START);
  const [channel, setChannel] = useState<"sms" | "whatsapp">("sms");
  const [code, setCode] = useState("");
  // A code the server refused is cleared; one it only found too short is kept.
  useEffect(() => { setCode(state.stage === "code" ? state.code : ""); }, [state]);
  const left = useWait(state.sends);
  const emailHref = `/signin?next=${encodeURIComponent(next)}`;
  const chip = (on: boolean) => `flex min-h-[42px] flex-1 cursor-pointer items-center justify-center rounded-full border px-3.5 text-[14px] font-semibold transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold ${on ? "border-ink bg-ink text-cream" : "border-line bg-white hover:border-ink"}`;

  if (state.stage === "phone") {
    return (
      <form action={step} className="flex flex-col gap-4">
        <input type="hidden" name="intent" value="send" />
        <input type="hidden" name="next" value={next} />
        <label className="field">
          <span className={cap}>Mobile number, with the country code</span>
          <input name="phone" type="tel" required autoFocus autoComplete="tel" inputMode="tel" placeholder="+1 615 555 0100" defaultValue={state.phone} />
        </label>
        {whatsapp ? (
          <fieldset className="flex flex-wrap gap-2">
            <legend className={`${cap} mb-1.5`}>Send the code</legend>
            <label className={chip(channel === "sms")}><input type="radio" name="channel" value="sms" className="sr-only" checked={channel === "sms"} onChange={() => setChannel("sms")} />By text</label>
            <label className={chip(channel === "whatsapp")}><input type="radio" name="channel" value="whatsapp" className="sr-only" checked={channel === "whatsapp"} onChange={() => setChannel("whatsapp")} />On WhatsApp</label>
          </fieldset>
        ) : <input type="hidden" name="channel" value="sms" />}
        <CodeAlert text={state.error} />
        <button className="btn btn-ink mt-1 min-h-[50px] w-full disabled:cursor-not-allowed disabled:opacity-60" disabled={pending}>{pending ? "Sending…" : channel === "whatsapp" ? "Send me a code on WhatsApp" : "Text me a code"}</button>
        <p className="text-center text-[12.5px] leading-relaxed text-muted">
          {mode === "signin" ? "If the number is new to LogaLuxe, the code starts an account for it." : "If the number already has an account, the code signs you in."}
        </p>
      </form>
    );
  }

  if (state.stage === "password") {
    return (
      <div className="flex flex-col gap-4">
        <CodeAlert text={state.error} />
        <Link href={emailHref} className="btn btn-ink min-h-[50px] w-full">Sign in with email and password</Link>
        <form action={step} className="text-center">
          <input type="hidden" name="intent" value="restart" />
          <button className={linkBtn} disabled={pending}>Use a different number</button>
        </form>
      </div>
    );
  }

  if (state.stage === "name") {
    return (
      <form action={step} className="flex flex-col gap-4">
        <input type="hidden" name="intent" value="finish" />
        <input type="hidden" name="next" value={next} />
        {invite ? <input type="hidden" name="ref" value={invite} /> : null}
        <p className="rounded-xl bg-cream-2 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-muted">The code is right, and {state.phone} is new to LogaLuxe. Tell us your name to finish.</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="field"><span className={cap}>First name</span><input name="first_name" required maxLength={60} autoFocus autoComplete="given-name" /></label>
          <label className="field"><span className={cap}>Last name (optional)</span><input name="last_name" maxLength={60} autoComplete="family-name" /></label>
        </div>
        <label className="field"><span className={cap}>Email, for receipts (optional)</span><input name="email" type="email" autoComplete="email" /></label>
        <CodeAlert text={state.error} />
        <button className="btn btn-ink mt-1 min-h-[50px] w-full disabled:cursor-not-allowed disabled:opacity-60" disabled={pending}>{pending ? "Creating your account…" : "Create account"}</button>
        <p className="text-center text-[12.5px] leading-relaxed text-muted">By creating an account you agree to our <Link href="/legal/terms" className="font-semibold text-wine">terms</Link> and <Link href="/legal/privacy" className="font-semibold text-wine">privacy policy</Link>.</p>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p role="status" className={`rounded-xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ${state.sent === "logged" ? "bg-warn-bg text-gold-ink" : "bg-cream-2 text-muted"}`}>{sentLine(state.sent, state.phone, state.channel)}</p>
      <form action={step} className="flex flex-col gap-4">
        <input type="hidden" name="intent" value="check" />
        <input type="hidden" name="next" value={next} />
        <CodeField value={code} onChange={setCode} />
        <CodeAlert text={state.error} />
        <button className="btn btn-ink mt-1 min-h-[50px] w-full disabled:cursor-not-allowed disabled:opacity-60" disabled={pending || code.length !== 6}>{pending ? "Checking…" : mode === "signin" ? "Sign in" : "Continue"}</button>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <form action={step}>
          <input type="hidden" name="intent" value="send" />
          <input type="hidden" name="channel" value={state.channel} />
          {left > 0
            ? <span className="text-[13.5px] text-muted">Send a new code in {left} {left === 1 ? "second" : "seconds"}</span>
            : <button className={linkBtn} disabled={pending}>Send a new code</button>}
        </form>
        <form action={step}>
          <input type="hidden" name="intent" value="restart" />
          <button className={linkBtn} disabled={pending}>Use a different number</button>
        </form>
      </div>
    </div>
  );
}
