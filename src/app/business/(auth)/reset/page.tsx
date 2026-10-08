import Link from "next/link";
import { AuthCard, AuthField } from "@/components/auth-card";
import { merchantReset } from "../actions";

export const metadata = { title: "Choose a password" };

export default async function BusinessReset({ searchParams }: { searchParams: Promise<{ token?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  return (
    <AuthCard title="Choose a password" sub="At least 10 characters. You will use it to sign in to LogaLuxe for business." sp={sp}
      footer={<Link href="/business/signin" className="font-semibold text-wine">Back to sign in</Link>}>
      {sp.token ? (
        <form action={merchantReset} className="flex flex-col gap-4">
          <input type="hidden" name="token" value={sp.token} />
          <AuthField label="New password" name="password" type="password" required minLength={10} autoFocus autoComplete="new-password" />
          <AuthField label="Again" name="again" type="password" required minLength={10} autoComplete="new-password" />
          <button className="btn btn-ink mt-1 min-h-[50px] w-full">Save password</button>
        </form>
      ) : (
        <p className="text-[15px] text-muted">This link is missing its code. <Link href="/business/forgot" className="font-semibold text-wine">Ask for a new one</Link>.</p>
      )}
    </AuthCard>
  );
}
