import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { money } from "@/lib/api";
import { customerApi, getCustomer, type Customer } from "@/lib/customer";
import { BookingMover, CopyButton, HashTab, ReviewPhotos } from "./account-client";
import { cancelMyBooking, changeMyPassword, leaveReview, removeSaved, removeSavedProduct, resendConfirmation, saveDetails, sendMessage, cancelMyOrder } from "./actions";

export const metadata = { title: "Your account" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
type SP = { ok?: string; err?: string; to?: string; thread?: string; tab?: string; move?: string; day?: string; reviewed?: string };
/** A product the client saved in the shop. */
type SavedProduct = { slug: string; name: string; seller_name: string; price_cents: number; stock: number; tone: string; sizes?: { label: string; price_cents: number }[] | null; photo_id?: string | null };
/** Store credit and the invitation that earns it. `on` is false until LogaLuxe staff set an amount. */
type Referral = { on: boolean; credit_cents: number; currency: string; balance_cents: number; code?: string; link?: string; friends_joined: number; friends_paid: number; history?: { amount_cents: number; reason: string; created_at: string }[] | null };

const TABS: [string, string][] = [["bookings", "Bookings"], ["orders", "Orders"], ["saved", "Saved"], ["wallet", "Wallet"], ["messages", "Messages"], ["details", "Details and password"]];
const TAB_IDS = TABS.map(([id]) => id);

const bookingState: Record<string, [string, string]> = {
  requested: ["Requested", "pill-gold"], confirmed: ["Confirmed", "pill-ok"], checked_in: ["Checked in", "pill-ok"], in_progress: ["In progress", "pill-ok"],
  completed: ["Completed", "pill-grey"], paid: ["Completed", "pill-grey"], cancelled_client: ["Cancelled by you", "pill-grey"], cancelled_business: ["Cancelled by the business", "pill-wine"],
  no_show: ["Missed", "pill-wine"], rescheduled: ["Moved", "pill-info"],
};
const orderState: Record<string, [string, string]> = {
  pending: ["Waiting for payment", "pill-gold"], paid: ["Paid", "pill-ok"], ready: ["Ready", "pill-info"], shipped: ["On its way", "pill-info"],
  delivered: ["Finished", "pill-grey"], cancelled: ["Cancelled", "pill-grey"], refunded: ["Refunded", "pill-grey"],
};
const when = (iso: string, timeZone: string) => new Date(iso).toLocaleString("en-US", { timeZone, weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
const day = (iso: string, timeZone = "UTC") => new Date(iso).toLocaleDateString("en-US", { timeZone, day: "numeric", month: "long", year: "numeric" });
const cap = "text-[11px] font-semibold uppercase tracking-[.06em] text-muted";
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

/** How one seller's part of an order is getting on, in plain words. */
function progress(s: Row): string {
  const at = s.seller || "the seller";
  if (s.status === "cancelled") return `Cancelled by ${at}`;
  if (s.fulfilment === "pickup") {
    if (s.status === "ready") return `Ready to collect at ${at}`;
    if (s.status === "collected") return `Collected from ${at}`;
    return `Being prepared at ${at}. You collect it when it is ready.`;
  }
  const tracking = s.tracking ? ` · tracking ${s.tracking}` : "";
  if (s.status === "shipped") return `Shipped by ${at}${tracking}`;
  if (s.status === "delivered") return `Delivered by ${at}${tracking}`;
  if (s.status === "ready") return `Packed by ${at}, waiting for the courier`;
  return `Being packed by ${at}`;
}

function Booking({ b, past, sp }: { b: Row; past?: boolean; sp: SP }) {
  const [label, pill] = bookingState[b.status] ?? [b.status, "pill-grey"];
  const more = b.more as Row | undefined, pay = b.payment as Row | undefined;
  const moving = !past && sp.move === b.id && !!more;
  const freeUntil = more?.free_until ? when(more.free_until, b.timezone) : "";
  const depositDue = b.deposit_cents > 0 && !b.deposit_paid;
  return (
    <div id={`b-${b.id}`} className={`card flex scroll-mt-6 flex-wrap items-center gap-x-5 gap-y-3 rounded-[20px] p-5 ${past ? "opacity-90" : ""}`}>
      <span aria-hidden className="h-14 w-14 flex-none rounded-2xl" style={{ background: b.tone }} />
      <div className="min-w-0 flex-[1_1_260px]">
        <div className="flex flex-wrap items-center gap-2"><Link href={`/b/${b.slug}`} className="text-[17px] font-semibold hover:text-wine">{b.business}</Link><span className={`pill ${pill}`}>{label}</span></div>
        <div className="mt-0.5 text-[14.5px]">{when(b.starts_at, b.timezone)}</div>
        <div className="text-[13.5px] text-muted">{b.services} · with {b.staff}{b.address ? ` · ${b.address}, ${b.city}` : ""}</div>
      </div>
      <div className="text-right">
        <b className="block text-[17px] font-semibold">{money(b.total_cents, b.currency)}</b>
        {b.deposit_cents > 0 && (b.deposit_paid || !past) && <span className="text-[12.5px] text-muted">{money(b.deposit_cents, b.currency)} deposit {b.deposit_paid ? "paid" : "not paid yet"}</span>}
      </div>

      {!past && depositDue && pay?.url && (
        <div className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl bg-warn-bg px-4 py-3 text-[14px] text-gold-ink">
          <span>Pay the {money(pay.amount_cents ?? b.deposit_cents, pay.currency ?? b.currency)} deposit to keep this time{pay.expires_at ? `. It is held until ${when(pay.expires_at, b.timezone)}` : ""}. You pay on the payment provider&apos;s secure page; LogaLuxe never sees your card.</span>
          <a href={pay.url} className="btn btn-ink btn-sm">Pay deposit</a>
        </div>
      )}

      <div className="flex w-full flex-wrap items-center gap-2">
        {past
          ? <Link href={`/b/${b.slug}`} className="btn btn-ink btn-sm">Book again</Link>
          : <a href={`/api/bookings/${b.id}/calendar`} className="btn btn-out btn-sm">Add to calendar</a>}
        {!past && more?.can_reschedule && (moving
          ? <Link href="/account?tab=bookings" scroll={false} className="btn btn-out btn-sm">Close</Link>
          : <Link href={`/account?tab=bookings&move=${b.id}#b-${b.id}`} className="btn btn-out btn-sm">Move</Link>)}
        <Link href={`/account?tab=messages&to=${b.slug}`} className="btn btn-out btn-sm">Message</Link>
        {b.can_cancel && (
          <details className="group relative">
            <summary className="btn btn-sm cursor-pointer list-none border border-bad/30 bg-white text-bad hover:bg-bad-bg [&::-webkit-details-marker]:hidden">Cancel</summary>
            <form action={cancelMyBooking} className="mt-2 flex max-w-[420px] flex-col gap-2.5 rounded-2xl border border-line bg-cream p-4 text-[13.5px] leading-relaxed">
              <input type="hidden" name="id" value={b.id} />
              <input type="hidden" name="deposit_paid" value={b.deposit_paid ? "1" : ""} />
              <p>
                {!more ? "Cancel this booking and release the time?"
                  : more.can_reschedule
                    ? `Cancelling is free until ${freeUntil}.${b.deposit_paid ? " Your deposit is returned." : ""}`
                    : `Free cancellation ended ${freeUntil}.${b.deposit_paid ? (more.late_cancel_fee === "none" ? " Your deposit is still returned." : " The business keeps your deposit, as its policy says.") : " Nothing is charged."}`}
              </p>
              <div><button className="btn btn-sm border border-bad/30 bg-bad text-white hover:opacity-90">Cancel this booking</button></div>
            </form>
          </details>
        )}
      </div>

      {!past && more && !more.can_reschedule && b.can_cancel && (
        <p className="w-full text-[13.5px] text-muted">
          It is too late to move this booking here. Changes were free until {freeUntil} ({plural(more.cancel_hours, "hour")} before). <Link href={`/account?tab=messages&to=${b.slug}`} className="font-semibold text-wine">Message {b.business}</Link> to ask for another time.
        </p>
      )}

      {moving && (
        <div className="w-full border-t border-line-2 pt-4">
          <h3 className="mb-1 text-[15.5px] font-semibold">Move this booking</h3>
          <p className="mb-4 text-[13.5px] text-muted">Free to move until {freeUntil}. Times are shown as they are at {b.business}.</p>
          {(more!.service_ids ?? []).length > 0
            ? <BookingMover id={b.id} slug={b.slug} timezone={b.timezone} services={(more!.service_ids as string[]).join(",")} staffId={more!.staff_id} staff={b.staff} startsAt={b.starts_at} day={sp.day} />
            : <p className="text-[14.5px] text-muted">This booking cannot be moved online. <Link href={`/account?tab=messages&to=${b.slug}`} className="font-semibold text-wine">Message {b.business}</Link> instead.</p>}
        </div>
      )}

      {b.review_id && (
        <div className="flex w-full flex-col gap-3 border-t border-line-2 pt-3">
          <div>
            <h3 className="text-[14.5px] font-semibold">Your review</h3>
            <p className="text-[13.5px] text-muted">{sp.reviewed === b.id ? "Thank you. Your review is published. You can add up to three photos of the result." : `Photos you add are shown with your review on the page of ${b.business}.`}</p>
          </div>
          <ReviewPhotos reviewId={b.review_id} photos={Array.isArray(b.review_photos) ? b.review_photos : []} business={b.business} />
        </div>
      )}

      {b.can_review && !b.review_id && (
        <details className="w-full border-t border-line-2 pt-3">
          <summary className="cursor-pointer text-[14px] font-semibold text-wine">Leave a review</summary>
          <form action={leaveReview} className="mt-3 flex flex-col gap-3">
            <input type="hidden" name="id" value={b.id} />
            <label className="field max-w-[220px]"><span className={cap}>Stars</span>
              <select name="rating" defaultValue="5" required>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} {n === 1 ? "star" : "stars"}</option>)}</select>
            </label>
            <label className="field"><span className={cap}>How was it?</span><textarea name="body" required minLength={10} maxLength={1500} placeholder="What you had done, and how it went" /></label>
            <div><button className="btn btn-ink btn-sm">Publish review</button></div>
          </form>
        </details>
      )}
    </div>
  );
}

export default async function Account({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  if (!(await getCustomer())) redirect("/signin?next=/account");
  let data: { user: Customer; bookings: Row[]; orders: Row[] };
  try {
    data = await customerApi("/auth/me");
  } catch {
    redirect("/signin?next=/account");
  }
  const { user } = data;
  const bookings = data.bookings ?? [], orders = data.orders ?? [];
  // A link to a conversation opens Messages, whatever else it says.
  const tab = TAB_IDS.includes(sp.tab ?? "") ? sp.tab! : sp.to || sp.thread ? "messages" : "bookings";

  // Messages with businesses. A failure here should not hide the rest of the account.
  let threads: Row[] = [], open: { thread: Row; messages: Row[] } | null = null, toBiz: Row | null = null;
  try { threads = (await customerApi<{ threads: Row[] }>("/auth/threads")).threads ?? []; } catch {}
  if (tab === "messages") {
    if (sp.thread) { try { open = await customerApi(`/auth/threads/${encodeURIComponent(sp.thread)}`); } catch {} }
    if (!open && sp.to) {
      const had = threads.find((t) => t.slug === sp.to);
      if (had) { try { open = await customerApi(`/auth/threads/${encodeURIComponent(had.id)}`); } catch {} }
      else { try { toBiz = (await customerApi<{ business: Row }>(`/businesses/${encodeURIComponent(sp.to)}`, { auth: false })).business; } catch {} }
    }
  }
  const unread = threads.reduce((n, t) => n + (Number(t.unread_client) || 0), 0);
  const stamp = (iso: string) => new Date(iso).toLocaleString("en-US", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" });

  const now = Date.now();
  const active = (b: Row) => ["requested", "confirmed", "checked_in", "in_progress"].includes(b.status) && new Date(b.ends_at).getTime() > now;
  const upcoming = bookings.filter(active).reverse();
  const past = bookings.filter((b) => !active(b));

  // What each section needs beyond the account itself. Each is loaded only when its section is open.
  let saved: Row[] = [], wallet: Row[] = [], sectionError = "";
  let savedProducts: SavedProduct[] = [], productsError = false, referral: Referral | null = null, creditCents = 0;
  if (tab === "bookings") {
    // What may still be done to each upcoming booking, and where to pay a deposit that is still owed.
    await Promise.all(upcoming.slice(0, 20).map(async (b) => {
      const [more, pub] = await Promise.all([
        customerApi<{ booking: Row }>(`/auth/bookings/${b.id}`).catch(() => null),
        b.deposit_cents > 0 && !b.deposit_paid ? customerApi<{ booking: Row }>(`/bookings/${b.id}`, { auth: false }).catch(() => null) : null,
      ]);
      b.more = more?.booking;
      b.payment = pub?.booking?.payment;
    }));
  } else if (tab === "orders") {
    // The lines of each order, grouped by who sells them.
    await Promise.all(orders.slice(0, 30).map(async (o) => {
      const full = (await customerApi<{ order: Row }>(`/orders/${o.id}`, { auth: false }).catch(() => null))?.order;
      o.lines = full?.items; o.shipping_cents = full?.shipping_cents ?? 0; o.tax_cents = full?.tax_cents ?? 0;
    }));
  } else if (tab === "saved") {
    const [biz, prods] = await Promise.all([
      customerApi<{ favourites: Row[] }>("/auth/favourites").catch((e) => { sectionError = (e as Error).message; return null; }),
      customerApi<{ products: SavedProduct[] }>("/auth/favourite-products").catch(() => { productsError = true; return null; }),
    ]);
    saved = biz?.favourites ?? [];
    savedProducts = prods?.products ?? [];
  } else if (tab === "wallet") {
    const [w, r] = await Promise.all([
      customerApi<{ wallet: Row[]; credit_cents?: number }>("/auth/wallet").catch((e) => { sectionError = (e as Error).message; return null; }),
      // The invitation is an extra: if it cannot be read, the wallet still shows.
      customerApi<Referral>("/auth/referral").catch(() => null),
    ]);
    wallet = w?.wallet ?? [];
    referral = r;
    creditCents = Number(w?.credit_cents ?? r?.balance_cents) || 0;
  }
  const creditHistory = referral?.history ?? [];
  const inviting = !!referral?.on && !!referral.link && !!referral.code && referral.credit_cents > 0;

  const count: Record<string, number> = { bookings: upcoming.length, messages: unread };
  const h2 = "serif mb-4 text-[28px]";

  return (
    <>
      <SiteHeader />
      <HashTab current={tab} tabs={TAB_IDS.join(",")} />
      <main className="container-x max-w-[1040px] py-12 pb-20">
        <div className="eyebrow !text-wine">Your account</div>
        <h1 className="serif mt-3 text-[44px] leading-[1.05] md:text-[56px]">Hello, {user.first_name}.</h1>

        <nav aria-label="Sections of your account" className="-mx-4 mt-8 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
          {TABS.map(([id, label]) => (
            <Link key={id} href={id === "bookings" ? "/account" : `/account?tab=${id}`} aria-current={tab === id ? "page" : undefined}
              className={`flex flex-none items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-[14px] font-semibold transition ${tab === id ? "border-ink bg-ink text-cream" : "border-line bg-white hover:border-ink"}`}>
              {label}{count[id] > 0 && <span className={`rounded-full px-1.5 py-0.5 text-[11px] leading-none ${tab === id ? "bg-cream/20 text-cream" : id === "messages" ? "bg-bad-bg text-wine" : "bg-cream-2 text-muted"}`}>{count[id]}<span className="sr-only">{id === "messages" ? " unread" : " upcoming"}</span></span>}
            </Link>
          ))}
        </nav>

        {user.email_verified === false && (
          <form action={resendConfirmation} className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-warn-bg px-4 py-3 text-[14.5px] text-gold-ink">
            <input type="hidden" name="tab" value={tab} />
            <span className="min-w-0 [overflow-wrap:anywhere]">Please confirm your email. We sent a link to <b>{user.email}</b>. You need it to leave reviews.</span>
            <button className="btn btn-sm border border-line bg-white">Send the link again</button>
          </form>
        )}
        {sp.err && <div role="alert" className="mt-6 rounded-xl border border-bad/25 bg-bad-bg px-4 py-3 text-[14.5px] font-medium text-bad">{sp.err}</div>}
        {sp.ok && !sp.err && <div role="status" className="mt-6 rounded-xl border border-ok/25 bg-ok-bg px-4 py-3 text-[14.5px] font-medium text-ok">{sp.ok}</div>}
        {sectionError && <div role="alert" className="mt-6 rounded-xl border border-bad/25 bg-bad-bg px-4 py-3 text-[14.5px] font-medium text-bad">We could not load this just now. Try again in a moment.</div>}

        {tab === "bookings" && (
          <>
            <section className="mt-8 scroll-mt-6" id="bookings">
              <h2 className={h2}>Upcoming</h2>
              <div className="flex flex-col gap-3">
                {upcoming.map((b) => <Booking key={b.id} b={b} sp={sp} />)}
                {upcoming.length === 0 && (
                  <div className="card flex flex-wrap items-center justify-between gap-4 rounded-[20px] p-6">
                    <p className="text-[15.5px] text-muted">Nothing booked yet. Bookings you make while signed in appear here.</p>
                    <Link href="/search" className="btn btn-ink">Find a professional</Link>
                  </div>
                )}
              </div>
            </section>
            {past.length > 0 && (
              <section className="mt-12">
                <h2 className={h2}>Past visits</h2>
                <div className="flex flex-col gap-3">{past.map((b) => <Booking key={b.id} b={b} past sp={sp} />)}</div>
              </section>
            )}
          </>
        )}

        {tab === "orders" && (
          <section className="mt-8 scroll-mt-6" id="orders">
            <h2 className={h2}>Orders</h2>
            <div className="flex flex-col gap-3">
              {orders.map((o) => {
                const [label, pill] = orderState[o.status] ?? [o.status, "pill-grey"];
                const lines = (o.lines ?? []) as Row[], shipments = (o.shipments ?? []) as Row[];
                const live = !["pending", "cancelled", "refunded"].includes(o.status);
                const reviewable = live && shipments.some((s) => ["delivered", "collected"].includes(s.status));
                return (
                  <div key={o.id} className="card flex flex-col gap-3 rounded-[20px] p-5">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2"><b className="text-[15px] font-semibold uppercase tracking-wide">Order {String(o.id).slice(0, 8)}</b><span className={`pill ${pill}`}>{label}</span></div>
                        <div className="text-[13px] text-muted">Placed {day(o.created_at)}</div>
                      </div>
                      <b className="text-[17px] font-semibold">{money(o.total_cents)}</b>
                    </div>

                    {lines.length > 0 ? (
                      <ul className="border-t border-line-2 text-[14.5px]">
                        {lines.map((l, i) => (
                          <li key={i} className="flex items-baseline justify-between gap-3 border-b border-line-2 py-2 last:border-0">
                            <span className="min-w-0">{l.qty} × {l.name}{l.size_label ? <span className="text-muted"> · {l.size_label}</span> : null}<span className="block text-[12.5px] text-muted">Sold by {l.seller_name}{reviewable && l.product_slug ? <> · <Link href={`/shop/${l.product_slug}?tab=reviews`} className="font-semibold text-wine">Write a review</Link></> : null}</span></span>
                            <b className="flex-none font-semibold">{money(l.unit_cents * l.qty)}</b>
                          </li>
                        ))}
                      </ul>
                    ) : o.items ? <div className="border-t border-line-2 pt-3 text-[14.5px]">{o.items}</div> : null}
                    {(o.shipping_cents > 0 || o.tax_cents > 0 || o.discount_cents > 0 || o.gift_cents > 0) && (
                      <div className="text-[13px] text-muted">{[o.shipping_cents > 0 ? `${money(o.shipping_cents)} shipping` : "", o.tax_cents > 0 ? `${money(o.tax_cents)} tax` : "", o.discount_cents > 0 ? `${money(o.discount_cents)} discount` : "", o.gift_cents > 0 ? `${money(o.gift_cents)} paid by gift card` : ""].filter(Boolean).join(" · ")}</div>
                    )}

                    {o.status === "pending" && (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-warn-bg px-4 py-3 text-[14px] text-gold-ink">
                        <span>{o.pay_url ? "This order is not paid yet. Nothing is sent or set aside until it is. You pay on the payment provider's secure page." : "This order is waiting for payment."}</span>
                        <span className="flex flex-wrap items-center gap-2">
                          <form action={cancelMyOrder}><input type="hidden" name="id" value={o.id} /><button className="btn btn-sm border border-line bg-white">Cancel order</button></form>
                          {o.pay_url && <a href={o.pay_url} className="btn btn-ink btn-sm">Pay now</a>}
                        </span>
                      </div>
                    )}
                    {live && shipments.length > 0 && (
                      <ul className="flex flex-col gap-1.5 text-[14px]">
                        {shipments.map((s, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <i aria-hidden className={`mt-[7px] block h-2 w-2 flex-none rounded-full ${["delivered", "collected"].includes(s.status) ? "bg-muted-2" : s.status === "cancelled" ? "bg-bad" : s.status === "new" ? "bg-gold" : "bg-ok"}`} />
                            <span className="min-w-0 [overflow-wrap:anywhere]">{progress(s)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
              {orders.length === 0 && <div className="card flex flex-wrap items-center justify-between gap-4 rounded-[20px] p-6"><p className="text-[15.5px] text-muted">No orders yet.</p><Link href="/shop" className="btn btn-out">Visit the shop</Link></div>}
            </div>
          </section>
        )}

        {tab === "saved" && (
          <section className="mt-8 scroll-mt-6" id="saved">
            <h2 className={h2}>Saved</h2>
            <h3 className="mb-3 text-[16px] font-semibold">Businesses</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {saved.map((f) => (
                <div key={f.slug} className="card flex flex-col overflow-hidden rounded-[20px]">
                  <Link href={`/b/${f.slug}`} aria-hidden tabIndex={-1} className="flex h-[92px] items-center justify-center" style={{ background: `linear-gradient(150deg, ${f.tone}, #120e0d 140%)` }}>
                    <span className="serif text-[44px] leading-none text-white/85">{String(f.name).slice(0, 1)}</span>
                  </Link>
                  <div className="flex flex-1 flex-col gap-1 p-4">
                    <Link href={`/b/${f.slug}`} className="serif text-[21px] leading-tight hover:text-wine">{f.name}</Link>
                    <div className="text-[13px] text-muted">{[f.area, f.city && f.city !== f.area ? f.city : ""].filter(Boolean).join(", ") || "Location not listed"}</div>
                    <div className="text-[13.5px]">
                      {f.review_count > 0 ? <><b className="font-semibold">{Number(f.rating).toFixed(1)}</b> <span className="text-muted">from {plural(f.review_count, "review")}</span></> : <span className="text-muted">No reviews yet</span>}
                      {f.from_cents ? <> · from <b className="font-semibold">{money(f.from_cents, f.currency)}</b></> : null}
                    </div>
                    <div className="mt-auto flex flex-wrap gap-2 pt-3">
                      <Link href={`/b/${f.slug}`} className="btn btn-ink btn-sm">Book</Link>
                      <form action={removeSaved}><input type="hidden" name="slug" value={f.slug} /><button className="btn btn-out btn-sm" aria-label={`Remove ${f.name} from saved`}>Remove</button></form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {saved.length === 0 && !sectionError && (
              <div className="card flex flex-wrap items-center justify-between gap-4 rounded-[20px] p-6">
                <p className="text-[15.5px] text-muted">No businesses saved yet. Use Save on a business page to keep it here.</p>
                <Link href="/search" className="btn btn-ink">Find a professional</Link>
              </div>
            )}

            <h3 className="mb-3 mt-10 text-[16px] font-semibold">Products</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {savedProducts.map((p) => {
                const lowest = Math.min(p.price_cents, ...(p.sizes ?? []).map((s) => Number(s.price_cents)).filter((n) => Number.isFinite(n) && n > 0));
                return (
                  <div key={p.slug} className="card flex flex-col overflow-hidden rounded-[20px]">
                    <Link href={`/shop/${p.slug}`} aria-hidden tabIndex={-1} className="relative block h-[150px]" style={{ background: p.tone || "#3B1D22" }}>
                      {p.photo_id ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/media/${p.photo_id}`} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                      ) : null}
                    </Link>
                    <div className="flex flex-1 flex-col gap-1 p-4">
                      <Link href={`/shop/${p.slug}`} className="text-[16px] font-semibold leading-snug hover:text-wine">{p.name}</Link>
                      <div className="text-[13px] text-muted">Sold by {p.seller_name}</div>
                      <div className="text-[14.5px]">
                        <b className="font-semibold">{lowest < p.price_cents ? `From ${money(lowest)}` : money(p.price_cents)}</b>
                        {p.stock <= 0 ? <span className="text-muted"> · out of stock</span> : null}
                      </div>
                      <div className="mt-auto flex flex-wrap gap-2 pt-3">
                        <Link href={`/shop/${p.slug}`} className="btn btn-ink btn-sm">View</Link>
                        <form action={removeSavedProduct}><input type="hidden" name="slug" value={p.slug} /><button className="btn btn-out btn-sm" aria-label={`Remove ${p.name} from saved`}>Remove</button></form>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {productsError && <div role="alert" className="card rounded-[20px] p-6 text-[15px] text-bad">We could not load your saved products just now. Try again in a moment.</div>}
            {savedProducts.length === 0 && !productsError && (
              <div className="card flex flex-wrap items-center justify-between gap-4 rounded-[20px] p-6">
                <p className="text-[15.5px] text-muted">No products saved yet. Use the heart on a product in the shop to keep it here.</p>
                <Link href="/shop" className="btn btn-out">Visit the shop</Link>
              </div>
            )}
          </section>
        )}

        {tab === "wallet" && (
          <section className="mt-8 scroll-mt-6" id="wallet">
            <h2 className={h2}>Wallet</h2>
            {(creditCents !== 0 || creditHistory.length > 0 || inviting) && (
              <div className="mb-8 grid items-start gap-4 md:grid-cols-2">
                <div className="card flex flex-col gap-3 rounded-[20px] p-5">
                  <div>
                    <div className={cap}>Store credit</div>
                    <b className="mt-1 block text-[30px] font-semibold leading-none">{money(creditCents, "USD")}</b>
                  </div>
                  <p className="text-[13.5px] text-muted">Credit is in US dollars. It comes off your next shop order by itself, after any promo code or gift card.</p>
                  {creditHistory.length > 0 && (
                    <ul className="border-t border-line-2 text-[14px]">
                      {creditHistory.map((c, i) => (
                        <li key={i} className="flex items-baseline justify-between gap-3 border-b border-line-2 py-2 last:border-0">
                          <span className="min-w-0">{c.reason}<span className="block text-[12.5px] text-muted">{day(c.created_at)}</span></span>
                          <b className={`flex-none font-semibold ${c.amount_cents < 0 ? "text-muted" : "text-ok"}`}>{c.amount_cents < 0 ? `-${money(-c.amount_cents, "USD")}` : `+${money(c.amount_cents, "USD")}`}</b>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {inviting && referral && (
                  <div className="card flex flex-col gap-3 rounded-[20px] p-5">
                    <div>
                      <div className={cap}>Invite a friend</div>
                      <b className="mt-1 block text-[20px] font-semibold leading-tight">You each get {money(referral.credit_cents, "USD")} of credit</b>
                    </div>
                    <p className="text-[13.5px] leading-relaxed text-muted">A friend joins with your link, confirms their email, and pays for a first visit or has a first order delivered. Then you each get the credit. Credit is in US dollars and is spent on shop orders.</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="min-w-0 flex-[1_1_220px]"><span className="sr-only">Your invitation link</span><input readOnly value={referral.link} className="min-h-[38px] w-full rounded-xl border border-line bg-cream px-3 text-[13.5px]" /></label>
                      <CopyButton text={referral.link!} label="Copy link" />
                    </div>
                    <div className="text-[13.5px]">Your code: <b className="font-semibold tracking-[.08em]">{referral.code}</b></div>
                    <div className="border-t border-line-2 pt-3 text-[13.5px] text-muted">
                      {referral.friends_joined > 0
                        ? <>{plural(referral.friends_joined, "friend has", "friends have")} joined · {referral.friends_paid} {referral.friends_paid === 1 ? "has" : "have"} made a first purchase</>
                        : "No friends have joined with your link yet."}
                    </div>
                  </div>
                )}
              </div>
            )}
            <p className="-mt-2 mb-5 max-w-[640px] text-[14.5px] text-muted">Packages, memberships and points belong to the business you got them from. They are used there when you pay: tell them at the desk.</p>
            <div className="flex flex-col gap-4">
              {wallet.map((w) => {
                const plans = (w.plans ?? []) as Row[];
                return (
                  <div key={w.slug} className="card flex flex-col gap-4 rounded-[20px] p-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <span aria-hidden className="h-11 w-11 flex-none rounded-xl" style={{ background: w.tone }} />
                      <Link href={`/b/${w.slug}`} className="min-w-0 flex-1 text-[17px] font-semibold hover:text-wine">{w.business}</Link>
                      <Link href={`/b/${w.slug}`} className="btn btn-out btn-sm">Book</Link>
                    </div>
                    {plans.map((p) => {
                      const credits = (p.credits ?? []) as Row[], member = p.kind === "membership";
                      const benefits = [p.service_discount_pct > 0 ? `${p.service_discount_pct}% off services` : "", p.retail_discount_pct > 0 ? `${p.retail_discount_pct}% off products` : ""].filter(Boolean);
                      return (
                        <div key={p.id} className="border-t border-line-2 pt-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <b className="text-[15.5px] font-semibold">{p.name}</b>
                            <span className="pill pill-grey">{member ? "Membership" : "Package"}</span>
                            {p.status === "past_due" && <span className="pill pill-wine">Payment overdue</span>}
                          </div>
                          {member && (
                            <div className="mt-1 text-[13.5px] text-muted">
                              {benefits.length ? benefits.join(" · ") : "No discount with this membership"}
                              {p.renews_on ? ` · renews ${day(String(p.renews_on).slice(0, 10) + "T12:00:00Z")}${p.price_cents > 0 ? ` for ${money(p.price_cents, w.currency)}` : ""}` : ""}
                              {" · "}{p.card_on_file ? "paid from the card on file" : "no card on file: you pay at the business"}
                            </div>
                          )}
                          {p.status === "past_due" && <p className="mt-2 rounded-xl bg-bad-bg px-3 py-2 text-[13.5px] text-bad">The last payment did not go through{p.charge_problem ? `: ${p.charge_problem}` : ""}. Speak to {w.business} to keep this membership.</p>}
                          {!member && p.expires_at && <div className="mt-1 text-[13.5px] text-muted">Use by {day(p.expires_at)}</div>}
                          {credits.length > 0 && (
                            <ul className="mt-2 text-[14.5px]">
                              {credits.map((c) => (
                                <li key={c.id} className="flex items-baseline justify-between gap-3 border-b border-line-2 py-1.5 last:border-0">
                                  <span className="min-w-0">{c.service}{c.expires_at ? <span className="ml-2 text-[12.5px] text-muted">use by {day(c.expires_at)}</span> : null}{!c.usable && c.left > 0 ? <span className="ml-2 text-[12.5px] text-bad">cannot be used now</span> : null}</span>
                                  <b className="flex-none font-semibold">{c.left} of {c.total} left</b>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                    {w.points > 0 && (
                      <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-line-2 pt-4 text-[14.5px]">
                        <span><b className="font-semibold">{plural(w.points, "point")}</b>{w.points_value_cents > 0 ? <> · worth {money(w.points_value_cents, w.currency)}</> : null}</span>
                        {w.min_redeem > 0 && <span className="text-[13px] text-muted">{w.points >= w.min_redeem ? "Ready to use on your next visit" : `Can be used from ${plural(w.min_redeem, "point")}`}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
              {wallet.length === 0 && !sectionError && (
                <div className="card rounded-[20px] p-6 text-[15.5px] text-muted">Nothing here yet. A package or membership you buy from a business, and points you earn there, appear here.</div>
              )}
            </div>
          </section>
        )}

        {tab === "messages" && (
          <section className="mt-8 scroll-mt-6" id="messages">
            <h2 className={h2}>Messages</h2>
            <div className="grid items-start gap-5 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
              <div className="card flex flex-col rounded-[20px] p-2">
                {threads.map((t) => (
                  <Link key={t.id} href={`/account?tab=messages&thread=${t.id}`} scroll={false} aria-current={open?.thread.id === t.id ? "true" : undefined} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${open?.thread.id === t.id ? "bg-cream-2" : "hover:bg-cream-2"}`}>
                    <span aria-hidden className="h-9 w-9 flex-none rounded-xl" style={{ background: t.tone }} />
                    <span className="min-w-0 flex-1"><b className="block truncate text-[14.5px] font-semibold">{t.business}</b><span className="block truncate text-[13px] text-muted">{t.last_preview}</span></span>
                    {t.unread_client > 0 && <span className="pill pill-wine">{t.unread_client}<span className="sr-only"> unread</span></span>}
                  </Link>
                ))}
                {threads.length === 0 && <p className="px-3 py-4 text-[14.5px] text-muted">No messages yet. Use the Message button on a business or a booking to ask a question.</p>}
              </div>
              {open || toBiz ? (
                <div className="card flex flex-col gap-4 rounded-[20px] p-5">
                  <div className="flex items-center justify-between gap-3"><b className="text-[16px] font-semibold">{open ? open.thread.business : toBiz!.name}</b><Link href={`/b/${open ? open.thread.slug : toBiz!.slug}`} className="text-[13.5px] font-semibold text-wine">View business</Link></div>
                  {open && (
                    <div className="flex max-h-[380px] flex-col gap-2 overflow-y-auto">
                      {open.messages.map((msg) => (
                        <div key={msg.id} className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[14.5px] leading-relaxed ${msg.from_business ? "self-start bg-cream-2" : "self-end bg-ink text-cream"}`}>
                          {msg.body}
                          <span className={`mt-1 block text-[11.5px] ${msg.from_business ? "text-muted" : "text-[#C9BCB0]"}`}>{msg.from_business ? msg.author + " · " : ""}{stamp(msg.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <form action={sendMessage} className="flex flex-col gap-3">
                    <input type="hidden" name="slug" value={open ? open.thread.slug : toBiz!.slug} />
                    <input type="hidden" name="thread" value={open?.thread.id ?? ""} />
                    <label className="field"><span className={cap}>{open ? "Reply" : `Message to ${toBiz!.name}`}</span><textarea name="body" required maxLength={2000} placeholder="Ask about a service, a time, or your booking" /></label>
                    <div><button className="btn btn-ink">Send</button></div>
                  </form>
                </div>
              ) : (
                <div className="card rounded-[20px] p-6 text-[15px] text-muted">{sp.to ? "We could not find that business." : threads.length ? "Choose a conversation to read it." : "Replies from businesses appear here."}</div>
              )}
            </div>
          </section>
        )}

        {tab === "details" && (
          <section className="mt-8 scroll-mt-6" id="details">
            <h2 className={h2}>Details and password</h2>
            <div className="grid items-start gap-5 md:grid-cols-2">
              <form action={saveDetails} className="card flex flex-col gap-4 rounded-[20px] p-6">
                <div className="grid grid-cols-2 gap-3">
                  <label className="field"><span className={cap}>First name</span><input name="first_name" required maxLength={60} defaultValue={user.first_name} autoComplete="given-name" /></label>
                  <label className="field"><span className={cap}>Last name</span><input name="last_name" maxLength={60} defaultValue={user.last_name} autoComplete="family-name" /></label>
                </div>
                <label className="field"><span className={cap}>Email</span><input value={user.email} disabled readOnly className="!bg-cream-2 !text-muted" /></label>
                <label className="field"><span className={cap}>Mobile, for reminders</span><input name="phone" type="tel" defaultValue={user.phone} autoComplete="tel" placeholder="+1 615 555 0100" /></label>
                <div><button className="btn btn-ink">Save details</button></div>
                <p className="text-[12.5px] text-muted">To change your email, <Link href="/help" className="font-semibold text-wine">write to us</Link>.</p>
              </form>
              <form action={changeMyPassword} className="card flex flex-col gap-4 rounded-[20px] p-6">
                <label className="field"><span className={cap}>Current password</span><input name="current" type="password" required autoComplete="current-password" /></label>
                <label className="field"><span className={cap}>New password, 8 characters or more</span><input name="new" type="password" required minLength={8} autoComplete="new-password" /></label>
                <label className="field"><span className={cap}>New password again</span><input name="again" type="password" required minLength={8} autoComplete="new-password" /></label>
                <div><button className="btn btn-out">Change password</button></div>
              </form>
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
