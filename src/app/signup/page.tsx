import { PlacePicker } from "@/components/place-picker";
import { pickerWhere } from "@/lib/places";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard, AuthField, AuthWays } from "@/components/auth-card";
import { CodeSignIn } from "@/components/code-signin";
import { getCustomer, safeNext } from "@/lib/customer";
import { getFeatures } from "@/lib/features";
import { signUp } from "../account/actions";

export const metadata = { title: "Create an account" };

export default async function SignUp({ searchParams }: { searchParams: Promise<{ next?: string; err?: string; ref?: string; how?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getCustomer()) redirect(next);
  // An invitation link carries the friend's code: letters and digits only, twelve at most. Anything else is dropped.
  const ref = typeof sp.ref === "string" && /^[A-Za-z0-9]{1,12}$/.test(sp.ref) ? sp.ref : "";
  // Making an account with a code is offered only while LogaLuxe staff have it switched on.
  const features = await getFeatures();
  const where = await pickerWhere();
  const byCode = features.sms_login && sp.how === "code";
  const q = `next=${encodeURIComponent(next)}${ref ? `&ref=${ref}` : ""}`;
  const invited = ref ? <p className="rounded-xl bg-cream-2 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-muted">You were invited by a friend. You each get credit after your first purchase.</p> : null;
  return (
    <AuthCard title="Create your account" sub="Keep every booking and order in one place. You can still book as a guest." sp={sp}
      footer={<>Already have an account? <Link href={`/signin?${byCode ? "how=code&" : ""}next=${encodeURIComponent(next)}`} className="font-semibold text-wine">Sign in</Link></>}>
      <div className="mb-5 rounded-xl border border-line-2 bg-white px-3 py-3"><span className="block text-[12px] text-muted mb-2">Browsing near you · change anytime</span><PlacePicker where={where} look="pill" /><p className="text-[12px] text-muted mt-2">Country and city help find nearby beauty services. A street address is only needed for delivery.</p></div>
      {features.sms_login ? <AuthWays label="How to create your account" current={byCode ? "code" : "password"} passwordHref={`/signup?${q}`} codeHref={`/signup?how=code&${q}`} /> : null}
      {byCode ? (
        <div className="flex flex-col gap-4">
          {invited}
          <CodeSignIn mode="signup" next={next} invite={ref} whatsapp={features.whatsapp} />
        </div>
      ) : (
        <form action={signUp} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          {ref ? <input type="hidden" name="ref" value={ref} /> : null}
          {invited}
          <div className="grid grid-cols-2 gap-3">
            <AuthField label="First name" name="first_name" required maxLength={60} autoFocus autoComplete="given-name" />
            <AuthField label="Last name" name="last_name" maxLength={60} autoComplete="family-name" />
          </div>
          <AuthField label="Email" name="email" type="email" required autoComplete="email" />
          <AuthField label="Mobile, for reminders (optional)" name="phone" type="tel" autoComplete="tel" placeholder={where.scope === "NG" ? "+234 800 000 0000" : "+1 615 555 0100"} />
          <AuthField label="Password, 8 characters or more" name="password" type="password" required minLength={8} autoComplete="new-password" />
          <AuthField label="Password again" name="again" type="password" required minLength={8} autoComplete="new-password" />
          <button className="btn btn-ink mt-1 min-h-[50px] w-full">Create account</button>
          <p className="text-center text-[12.5px] leading-relaxed text-muted">By creating an account you agree to our <Link href="/legal/terms" className="font-semibold text-wine">terms</Link> and <Link href="/legal/privacy" className="font-semibold text-wine">privacy policy</Link>.</p>
        </form>
      )}
    </AuthCard>
  );
}
