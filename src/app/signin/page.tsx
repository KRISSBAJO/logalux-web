import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard, AuthField } from "@/components/auth-card";
import { getCustomer, safeNext } from "@/lib/customer";
import { signIn } from "../account/actions";

export const metadata = { title: "Sign in" };

export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getCustomer()) redirect(next);
  return (
    <AuthCard title="Welcome back" sub="Sign in to see your bookings and rebook in a tap." sp={sp}
      footer={<>New to LogaLuxe? <Link href={`/signup?next=${encodeURIComponent(next)}`} className="font-semibold text-wine">Create an account</Link></>}>
      <form action={signIn} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <AuthField label="Email" name="email" type="email" required autoFocus autoComplete="username" />
        <AuthField label="Password" name="password" type="password" required autoComplete="current-password" />
        <button className="btn btn-ink mt-1 min-h-[50px] w-full">Sign in</button>
        <Link href="/forgot" className="text-center text-[13.5px] font-semibold text-wine">Forgot your password?</Link>
      </form>
    </AuthCard>
  );
}
