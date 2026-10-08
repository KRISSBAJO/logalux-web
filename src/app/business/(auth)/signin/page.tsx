import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard, AuthField } from "@/components/auth-card";
import { getMe } from "@/lib/merchant-api";
import { merchantSignIn } from "../actions";

export const metadata = { title: "Business sign in" };

export default async function BusinessSignIn({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  if (await getMe()) redirect("/business");
  return (
    <AuthCard title="LogaLuxe for business" sub="Sign in to your calendar, clients and payouts." sp={sp}
      footer={<>New here? <Link href="/business/signup" className="font-semibold text-wine">List your business free</Link><span className="mx-2 text-line">·</span><Link href="/signin" className="font-semibold text-wine">I am a client</Link></>}>
      <form action={merchantSignIn} className="flex flex-col gap-4">
        <AuthField label="Email" name="email" type="email" required autoFocus autoComplete="username" />
        <AuthField label="Password" name="password" type="password" required autoComplete="current-password" />
        <button className="btn btn-ink mt-1 min-h-[50px] w-full">Sign in</button>
        <Link href="/business/forgot" className="text-center text-[13.5px] font-semibold text-wine">Forgot your password?</Link>
      </form>
    </AuthCard>
  );
}
