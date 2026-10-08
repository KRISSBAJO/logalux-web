import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard, AuthField, AuthWays } from "@/components/auth-card";
import { CodeSignIn } from "@/components/code-signin";
import { getCustomer, safeNext } from "@/lib/customer";
import { getFeatures } from "@/lib/features";
import { signIn } from "../account/actions";

export const metadata = { title: "Sign in" };

export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string; ok?: string; err?: string; how?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getCustomer()) redirect(next);
  // Signing in with a code is offered only while LogaLuxe staff have it switched on.
  const features = await getFeatures();
  const byCode = features.sms_login && sp.how === "code";
  const q = `next=${encodeURIComponent(next)}`;
  return (
    <AuthCard title="Welcome back" sub={byCode ? "We send a 6-digit code to your phone. No password needed." : "Sign in to see your bookings and rebook in a tap."} sp={sp}
      footer={<>New to LogaLuxe? <Link href={`/signup?${byCode ? "how=code&" : ""}${q}`} className="font-semibold text-wine">Create an account</Link></>}>
      {features.sms_login ? <AuthWays label="How to sign in" current={byCode ? "code" : "password"} passwordHref={`/signin?${q}`} codeHref={`/signin?how=code&${q}`} /> : null}
      {byCode ? <CodeSignIn mode="signin" next={next} whatsapp={features.whatsapp} /> : (
        <form action={signIn} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          <AuthField label="Email" name="email" type="email" required autoFocus autoComplete="username" />
          <AuthField label="Password" name="password" type="password" required autoComplete="current-password" />
          <button className="btn btn-ink mt-1 min-h-[50px] w-full">Sign in</button>
          <Link href="/forgot" className="text-center text-[13.5px] font-semibold text-wine">Forgot your password?</Link>
        </form>
      )}
    </AuthCard>
  );
}
