import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { readMessage } from "@/lib/flash";
import { sendToSupport } from "./actions";

const DESCRIPTION = "Get help with a booking, an order, or your business on LogaLuxe. Answers to common questions, and a form to write to a person.";
export const metadata: Metadata = {
  title: "Help",
  description: DESCRIPTION,
  alternates: { canonical: "/help" },
  openGraph: { title: "Help", description: DESCRIPTION, url: "/help", siteName: "LogaLuxe", type: "website" },
};

const link = "font-semibold text-wine";
const FAQ: [string, ReactNode][] = [
  ["How do I move or cancel a booking?", <>Sign in and open <Link href="/account?tab=bookings" className={link}>Bookings in your account</Link>. Each upcoming visit has a Move button and a Cancel button. Inside the free cancellation window nothing is charged and a paid deposit comes back in full. After it, the business&apos;s own policy applies; it is shown before you book.</>],
  ["I was charged a deposit. Is that extra?", "No. The deposit holds your slot and comes off the total you pay at the visit."],
  ["Something went wrong at my visit.", <>Open the visit in <Link href="/account?tab=bookings" className={link}>your bookings</Link> and choose Report a problem, or write to us below with the business name and the date. We ask the business for its side and decide within a few days.</>],
  ["How do I list my business?", <>Go to <Link href="/business/signup" className={link}>List your business</Link> and create a business account. You set up your page, services and hours yourself; LogaLuxe verifies your details before the Verified mark shows.</>],
];

/** A support reference looks like SP-1234. Anything else in the address is ignored. */
const refOf = (raw: string | undefined) => (raw && /^SP-\d{1,12}$/.test(raw) ? raw : "");

export default async function Help({ searchParams }: { searchParams: Promise<{ sent?: string; err?: string }> }) {
  const sp = await searchParams;
  const sent = refOf(sp.sent);
  const err = await readMessage(sp.err);
  return (
    <>
      <SiteHeader />
      <main className="container-x grid gap-12 py-14 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <div className="eyebrow !text-wine">Help</div>
          <h1 className="serif mt-3 text-[44px] font-medium leading-[1.05] md:text-[56px]">How can we help?</h1>
          <p className="mt-4 max-w-[480px] text-[17px] leading-relaxed text-muted">Most answers are below. If yours is not, write to us and a person will reply.</p>
          <div className="mt-8 divide-y divide-line border-y border-line">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16.5px] font-semibold [&::-webkit-details-marker]:hidden">{q}<span className="text-[22px] font-normal text-muted transition group-open:rotate-45">+</span></summary>
                <p className="mt-2 text-[15.5px] leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </div>
          <p className="mt-6 text-[14px] text-muted">See also the <Link href="/legal/cancellation" className={link}>cancellation policy</Link> and <Link href="/legal/terms" className={link}>terms</Link>.</p>
        </div>

        <div className="card rounded-[24px] p-7 md:p-9">
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gold"><Icon.Check width={30} height={30} strokeWidth={2.6} /></span>
              <h2 className="serif text-[32px] font-medium leading-none">We have your message</h2>
              <p className="max-w-[360px] text-[15px] leading-relaxed text-muted">Your reference is <b className="text-ink">{sent}</b>. We reply within one working day, to the email or phone number you gave.</p>
              <Link href="/" className="btn btn-out mt-2">Back to the home page</Link>
            </div>
          ) : (
            <form action={sendToSupport} className="flex flex-col gap-4">
              <h2 className="serif text-[28px] font-medium leading-none">Write to us</h2>
              {err && <div role="alert" className="rounded-xl border border-bad/25 bg-bad-bg px-3.5 py-2.5 text-[14px] font-medium text-bad">{err}</div>}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="field"><span className="text-[11px] font-semibold uppercase tracking-[.06em] text-muted">Your name</span><input name="name" required maxLength={80} autoComplete="name" /></label>
                <label className="field"><span className="text-[11px] font-semibold uppercase tracking-[.06em] text-muted">I am</span><select name="role" defaultValue="client"><option value="client">A client</option><option value="business">I run a business</option><option value="other">Someone else</option></select></label>
                <label className="field"><span className="text-[11px] font-semibold uppercase tracking-[.06em] text-muted">Email</span><input name="email" type="email" autoComplete="email" /></label>
                <label className="field"><span className="text-[11px] font-semibold uppercase tracking-[.06em] text-muted">Or phone</span><input name="phone" type="tel" maxLength={24} autoComplete="tel" placeholder="+1 615 555 0100" /></label>
              </div>
              <label className="field"><span className="text-[11px] font-semibold uppercase tracking-[.06em] text-muted">Subject</span><input name="subject" required minLength={3} maxLength={140} /></label>
              <label className="field"><span className="text-[11px] font-semibold uppercase tracking-[.06em] text-muted">What happened?</span><textarea name="message" required minLength={10} maxLength={4000} rows={6} style={{ minHeight: 140, resize: "vertical" }} placeholder="Include the business name and the date if it is about a booking." /></label>
              {/* Hidden from people; catches form-filling bots. */}
              <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
              <button className="btn btn-ink min-h-[52px]">Send message</button>
              <p className="text-[12.5px] leading-relaxed text-muted">Give an email or a phone number so we can reply. We use it only to answer you. See our <Link href="/legal/privacy" className={link}>privacy policy</Link>.</p>
            </form>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
