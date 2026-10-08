import Link from "next/link";
import { AuthCard, AuthField } from "@/components/auth-card";
import { askForReset } from "../account/actions";

export const metadata = { title: "Reset your password", robots: { index: false } };

export default async function Forgot({ searchParams }: { searchParams: Promise<{ sent?: string; err?: string }> }) {
  const sp = await searchParams;
  const back = <Link href="/signin" className="font-semibold text-wine">Back to sign in</Link>;
  if (sp.sent) {
    return <AuthCard title="Check your email" sub="If that address has a LogaLuxe account, a reset link is on its way. It works once, for 30 minutes." footer={back}>{null}</AuthCard>;
  }
  return (
    <AuthCard title="Forgot your password?" sub="Enter your email and we will send you a link to choose a new one." sp={sp} footer={back}>
      <form action={askForReset} className="flex flex-col gap-4">
        <AuthField label="Email" name="email" type="email" required autoFocus autoComplete="username" />
        <button className="btn btn-ink min-h-[50px] w-full">Send reset link</button>
      </form>
    </AuthCard>
  );
}
