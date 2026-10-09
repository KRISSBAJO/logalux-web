import Link from "next/link";
import { LogoMark } from "@/components/logo-mark";
import { Icon } from "@/components/icons";
import { Suspense } from "react";
import { AdminNav, SignInError, type NavGroup } from "@/components/admin-nav";
import { can, getAdmin, load } from "@/lib/admin-api";
import { login, logout } from "./actions";

export const metadata = { title: "LogaXP console" };
export const dynamic = "force-dynamic";

const roleName = { support: "Support", ops: "Operations", super_admin: "Super admin" };

function SignIn() {
  return (
    <div className="hero-bg flex min-h-screen items-center justify-center p-6">
      <form action={login} className="w-full max-w-[400px] rounded-[22px] bg-cream p-8 shadow-[0_30px_80px_rgba(0,0,0,.45)]">
        <div className="serif flex items-center gap-2.5 text-[28px]"><LogoMark className="h-[1.15em] w-auto flex-none text-wine" />LogaLuxe</div>
        <div className="mb-7 text-[10px] font-bold uppercase tracking-[.14em] text-rose">LogaXP console</div>
        <Suspense><SignInError /></Suspense>
        <div className="flex flex-col gap-4">
          <label className="field"><span className="text-[11px] font-semibold uppercase tracking-[.06em] text-muted">Work email</span><input name="email" type="email" autoComplete="username" required autoFocus /></label>
          <label className="field"><span className="text-[11px] font-semibold uppercase tracking-[.06em] text-muted">Password</span><input name="password" type="password" autoComplete="current-password" required /></label>
          <label className="field"><span className="text-[11px] font-semibold uppercase tracking-[.06em] text-muted">6-digit code, if you use two-step sign-in</span><input name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="Leave empty if you do not" /></label>
        </div>
        <button className="btn btn-ink mt-6 w-full">Sign in</button>
        <Link href="/staff/forgot" className="mt-4 inline-block text-[13px] font-semibold text-wine">Forgot your password?</Link>
        <p className="mt-5 text-[12px] leading-relaxed text-muted">Staff only. Five wrong passwords lock the account for 15 minutes. Every action is recorded with your name.</p>
      </form>
    </div>
  );
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) return <SignIn />;

  const overview = await load("/overview");
  const k = overview.data.kpis ?? {};
  const attention = (k.pending_refunds ?? 0) + (k.stalled_campaigns ?? 0);
  const groups: NavGroup[] = [
    { title: "Home", items: [{ href: "/admin", label: "Overview", icon: <Icon.Grid /> }] },
    {
      title: "Queues",
      items: [
        { href: "/admin/verification", label: "Verification", icon: <Icon.Shield />, count: k.verification_queue },
        { href: "/admin/moderation", label: "Moderation", icon: <Icon.Star />, count: k.moderation_queue },
        { href: "/admin/disputes", label: "Disputes", icon: <Icon.Warn />, count: k.open_disputes },
        { href: "/admin/support", label: "Support", icon: <Icon.Chat />, count: k.open_tickets },
        ...(can(admin, "ops") ? [{ href: "/admin/attention", label: "Needs a human", icon: <Icon.Warn />, count: attention }] : []),
      ],
    },
    {
      title: "Marketplace",
      items: [
        { href: "/admin/businesses", label: "Businesses", icon: <Icon.Building /> },
        { href: "/admin/bookings", label: "Bookings", icon: <Icon.Calendar /> },
        { href: "/admin/clients", label: "Clients", icon: <Icon.Users /> },
        { href: "/admin/orders", label: "Orders", icon: <Icon.Cart /> },
        { href: "/admin/returns", label: "Returns", icon: <Icon.Back />, count: k.brand_returns_requested },
        { href: "/admin/products", label: "Products", icon: <Icon.Pin /> },
      ],
    },
    {
      title: "Money",
      collapsible: true,
      items: [
        { href: "/admin/payouts", label: "Payouts", icon: <Icon.Card />, count: k.payout_failures },
        { href: "/admin/leads", label: "Leads", icon: <Icon.Users />, count: k.lead_disputes },
        { href: "/admin/fees", label: "Fees and plans", icon: <Icon.List /> },
        { href: "/admin/promos", label: "Promo codes", icon: <Icon.Spark /> },
        { href: "/admin/gift-cards", label: "Gift cards", icon: <Icon.Heart /> },
      ],
    },
    {
      title: "Platform",
      collapsible: true,
      items: [
        { href: "/admin/messages", label: "Messages", icon: <Icon.Arrow /> },
        { href: "/admin/journal", label: "Journal", icon: <Icon.Book /> },
        { href: "/admin/site", label: "Site images", icon: <Icon.Camera /> },
        { href: "/admin/pages", label: "Site pages", icon: <Icon.Doc /> },
        { href: "/admin/features", label: "Features", icon: <Icon.Check /> },
        { href: "/admin/flags", label: "Feature flags", icon: <Icon.Flag /> },
        ...(can(admin, "super_admin") ? [{ href: "/admin/team", label: "Team", icon: <Icon.Users /> }] : []),
        { href: "/admin/audit", label: "Audit log", icon: <Icon.Clock /> },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-cream-2 md:flex">
      <aside className="flex flex-col gap-3 bg-ink p-4 text-[#C9BCB0] md:sticky md:top-0 md:h-screen md:w-[244px] md:flex-none md:overflow-y-auto">
        <div className="px-2.5 pt-1.5">
          <div className="serif flex items-center gap-2.5 text-[22px] text-[#F4ECE3]"><LogoMark className="h-[1.15em] w-auto flex-none text-gold" />LogaLuxe</div>
          <div className="text-[10px] font-bold uppercase tracking-[.14em] text-rose">LogaXP console</div>
        </div>
        <AdminNav groups={groups} />
        <div className="mt-auto flex items-center gap-3 border-t border-white/10 px-2 pt-3">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white/10 text-[13px] font-semibold uppercase text-[#F4ECE3]">{admin.name.slice(0, 2)}</span>
          <Link href="/admin/account" title="Your account: password and two-step sign-in" className="min-w-0 flex-1 rounded-lg hover:text-white">
            <b className="block truncate text-[13px] font-semibold text-[#F4ECE3]">{admin.name}</b>
            <span className="block truncate text-[11.5px]">{roleName[admin.role]} · Account</span>
          </Link>
          <form action={logout}><button className="rounded-lg px-2 py-1.5 text-[12.5px] font-medium text-[#C9BCB0] hover:bg-white/10 hover:text-white">Sign out</button></form>
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
