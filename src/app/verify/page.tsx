import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { confirmEmail } from "../account/actions";

export const metadata = { title: "Confirm your email", robots: { index: false } };

// The link in the confirmation email lands here. Confirming takes one press of a button, so that
// a mail scanner that opens every link in a message cannot confirm an address on its own.
export default async function Verify({ searchParams }: { searchParams: Promise<{ token?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const token = (sp.token ?? "").trim();
  const done = !!sp.ok && !sp.err;
  return (
    <AuthCard title={done ? "Email confirmed" : "Confirm your email"} sub={done ? undefined : "One step and your LogaLuxe account is fully set up."} sp={sp}
      footer={<Link href="/account" className="font-semibold text-wine">Go to your account</Link>}>
      {done ? (
        <Link href="/search" className="btn btn-ink min-h-[50px] w-full">Find a professional</Link>
      ) : token ? (
        <form action={confirmEmail} className="flex flex-col gap-4">
          <input type="hidden" name="token" value={token} />
          <button className="btn btn-ink min-h-[50px] w-full">Confirm my email</button>
          <p className="text-[13px] leading-relaxed text-muted">If you did not make a LogaLuxe account, close this page and nothing happens.</p>
        </form>
      ) : (
        <p className="text-[15px] leading-relaxed text-muted">This page needs the link from your confirmation email. Open the email again, or ask for a new one from your account.</p>
      )}
    </AuthCard>
  );
}
