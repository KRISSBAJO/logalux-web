import Link from "next/link";
import { AuthCard, AuthField } from "@/components/auth-card";
import { chooseNewPassword } from "../account/actions";

export const metadata = { title: "Choose a new password", robots: { index: false }, referrer: "no-referrer" as const };

export default async function Reset({ searchParams }: { searchParams: Promise<{ token?: string; err?: string }> }) {
  const sp = await searchParams;
  const token = sp.token ?? "";
  if (!/^[0-9a-f]{64}$/.test(token)) {
    return (
      <AuthCard title="This link is not valid" sub="Ask for a new reset link and use the newest email.">
        <Link href="/forgot" className="btn btn-ink min-h-[50px] w-full">Get a new link</Link>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Choose a new password" sp={sp} footer={<Link href="/signin" className="font-semibold text-wine">Back to sign in</Link>}>
      <form action={chooseNewPassword} className="flex flex-col gap-4">
        <input type="hidden" name="token" value={token} />
        <AuthField label="New password, 8 characters or more" name="password" type="password" required minLength={8} autoFocus autoComplete="new-password" />
        <AuthField label="New password again" name="again" type="password" required minLength={8} autoComplete="new-password" />
        <button className="btn btn-ink min-h-[50px] w-full">Save new password</button>
      </form>
    </AuthCard>
  );
}
