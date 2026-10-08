import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { getMe } from "@/lib/merchant-api";
import { SignInForm } from "./signin-form";

export const metadata = { title: "Business sign in" };

export default async function BusinessSignIn({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  if (await getMe()) redirect("/business");
  return (
    <AuthCard title="LogaLuxe for business" sub="Sign in to your calendar, clients and payouts." sp={sp}
      footer={<>New here? <Link href="/business/signup" className="font-semibold text-wine">List your business free</Link><span className="mx-2 text-line">·</span><Link href="/signin" className="font-semibold text-wine">I am a client</Link></>}>
      <SignInForm />
    </AuthCard>
  );
}
