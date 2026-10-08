import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard, AuthField } from "@/components/auth-card";
import { getCustomer, safeNext } from "@/lib/customer";
import { signUp } from "../account/actions";

export const metadata = { title: "Create an account" };

export default async function SignUp({ searchParams }: { searchParams: Promise<{ next?: string; err?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getCustomer()) redirect(next);
  return (
    <AuthCard title="Create your account" sub="Keep every booking and order in one place. You can still book as a guest." sp={sp}
      footer={<>Already have an account? <Link href={`/signin?next=${encodeURIComponent(next)}`} className="font-semibold text-wine">Sign in</Link></>}>
      <form action={signUp} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <div className="grid grid-cols-2 gap-3">
          <AuthField label="First name" name="first_name" required maxLength={60} autoFocus autoComplete="given-name" />
          <AuthField label="Last name" name="last_name" maxLength={60} autoComplete="family-name" />
        </div>
        <AuthField label="Email" name="email" type="email" required autoComplete="email" />
        <AuthField label="Mobile, for reminders (optional)" name="phone" type="tel" autoComplete="tel" placeholder="+1 615 555 0100" />
        <AuthField label="Password, 8 characters or more" name="password" type="password" required minLength={8} autoComplete="new-password" />
        <AuthField label="Password again" name="again" type="password" required minLength={8} autoComplete="new-password" />
        <button className="btn btn-ink mt-1 min-h-[50px] w-full">Create account</button>
        <p className="text-center text-[12.5px] leading-relaxed text-muted">By creating an account you agree to our <Link href="/legal/terms" className="font-semibold text-wine">terms</Link> and <Link href="/legal/privacy" className="font-semibold text-wine">privacy policy</Link>.</p>
      </form>
    </AuthCard>
  );
}
