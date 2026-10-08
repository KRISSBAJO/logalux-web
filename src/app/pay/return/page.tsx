import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { api, money } from "@/lib/api";

export const metadata = { title: "Payment", robots: { index: false } };
export const dynamic = "force-dynamic";

type Payment = {
  reference: string; purpose: "deposit" | "order" | "sale"; status: "pending" | "paid" | "failed" | "expired" | "refunded";
  amount_cents: number; currency: string; description: string; business: string | null; business_slug: string | null; url: string; problem: string;
};

// Where Stripe and Paystack send the client after their payment page. The
// reference in the address is long and random; the API checks with the
// provider what really happened, so this page cannot be faked into "paid".
export default async function PayReturn({ searchParams }: { searchParams: Promise<{ ref?: string; reference?: string; cancelled?: string }> }) {
  const sp = await searchParams;
  const ref = sp.ref || sp.reference || "";
  let p: Payment | null = null;
  if (/^lx[a-f0-9]{24}$/.test(ref)) {
    try {
      p = (await api.post<{ payment: Payment }>(`/v1/payments/${ref}/confirm`, {})).payment;
    } catch {}
  }
  const amount = p ? money(p.amount_cents, p.currency) : "";
  const back = p?.business_slug ? `/b/${p.business_slug}` : "/";
  const what = p?.purpose === "deposit" ? "deposit" : p?.purpose === "order" ? "order" : "payment";

  if (!p) {
    return (
      <AuthCard title="We could not find that payment" sub="The link may be incomplete. If you paid, your bank statement will show it and the business can see it on their side.">
        <Link href="/" className="btn btn-ink min-h-[50px] w-full">Back to LogaLuxe</Link>
      </AuthCard>
    );
  }
  if (p.status === "paid") {
    return (
      <AuthCard title={p.purpose === "deposit" ? "You're booked" : "Payment received"}
        sub={p.purpose === "deposit" ? `Your ${amount} deposit is paid and your time at ${p.business ?? "the business"} is held. It comes off the total on the day.` : p.purpose === "order" ? `We have your ${amount} payment. Your order is being prepared.` : `Thank you. ${p.business ?? "The business"} has your ${amount} payment.`}>
        <div className="flex flex-col gap-3">
          {p.purpose === "order" ? <Link href="/account#orders" className="btn btn-ink min-h-[50px] w-full">See your orders</Link> : <Link href="/account" className="btn btn-ink min-h-[50px] w-full">See your bookings</Link>}
          <Link href={back} className="btn btn-out min-h-[50px] w-full">{p.business ? `Back to ${p.business}` : "Back to LogaLuxe"}</Link>
          <p className="text-center text-[12.5px] text-muted">Reference {p.reference.slice(0, 10).toUpperCase()}</p>
        </div>
      </AuthCard>
    );
  }
  if (p.status === "refunded") {
    return (
      <AuthCard title="This payment was refunded" sub={`${amount} has been sent back to the card or bank account you paid with. It can take a few days to show.`}>
        <Link href={back} className="btn btn-ink min-h-[50px] w-full">{p.business ? `Back to ${p.business}` : "Back to LogaLuxe"}</Link>
      </AuthCard>
    );
  }
  if (p.status === "pending") {
    return (
      <AuthCard title={sp.cancelled ? "The payment is not finished" : "We are still waiting for the payment"}
        sub={sp.cancelled ? `Your ${what} of ${amount} has not been paid. ${p.purpose === "deposit" ? "Your time is held for a little longer." : ""}` : `Your bank has not confirmed the ${amount} yet. This page checks again each time you open it.`}>
        <div className="flex flex-col gap-3">
          <a href={p.url} className="btn btn-ink min-h-[50px] w-full">{sp.cancelled ? `Pay ${amount} now` : "Go back to the payment page"}</a>
          <Link href={`/pay/return?ref=${p.reference}`} className="btn btn-out min-h-[50px] w-full">Check again</Link>
        </div>
      </AuthCard>
    );
  }
  return (
    <AuthCard title={p.status === "expired" ? "The time to pay ran out" : "The payment did not go through"}
      sub={p.purpose === "deposit" ? "Nothing was taken, and the time has been released. You can book again and choose a new time." : "Nothing was taken. You can try again."}>
      <Link href={back} className="btn btn-ink min-h-[50px] w-full">{p.purpose === "deposit" ? "Book again" : "Try again"}</Link>
    </AuthCard>
  );
}
