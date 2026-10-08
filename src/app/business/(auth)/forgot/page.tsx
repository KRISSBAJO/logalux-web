import Link from "next/link";
import { AuthCard, AuthField } from "@/components/auth-card";
import { merchantForgot } from "../actions";

export const metadata = { title: "Forgot password" };

export default async function BusinessForgot({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  return (
    <AuthCard title="Forgot your password?" sub="Enter the email you use for your business. We will send a link to choose a new one." sp={sp}
      footer={<Link href="/business/signin" className="font-semibold text-wine">Back to sign in</Link>}>
      <form action={merchantForgot} className="flex flex-col gap-4">
        <AuthField label="Email" name="email" type="email" required autoFocus autoComplete="username" />
        <button className="btn btn-ink mt-1 min-h-[50px] w-full">Send the link</button>
      </form>
    </AuthCard>
  );
}
