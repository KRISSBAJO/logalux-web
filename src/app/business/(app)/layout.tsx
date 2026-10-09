import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/logo-mark";
import { MNavLink } from "@/components/merchant-client";
import { Avatar, Ic } from "@/components/merchant-ui";
import { getMe, mCan } from "@/lib/merchant-api";
import { signOutMerchant, switchBusiness } from "./actions";
import { careCounts } from "./care-counts";
import "../css/shell.css";
import "../css/extra.css";

export const metadata = { title: { default: "LogaLuxe for business", template: "%s · LogaLuxe for business" }, robots: { index: false } };

const ROLE: Record<string, string> = { owner: "Owner", manager: "Manager", staff: "Team member" };

export default async function MerchantLayout({ children }: { children: ReactNode }) {
  const me = await getMe();
  if (!me) redirect("/business/signin");
  const { merchant: m, businesses, badges } = me;
  const manager = mCan(me, "manager"), owner = mCan(me, "owner");
  // Return requests and reported problems waiting for an answer: managers and the owner only.
  const care = await careCounts();
  const where = [badges.area, badges.locations > 1 ? `${badges.locations} locations` : ""].filter(Boolean).join(" · ") || (m.market === "NG" ? "Nigeria" : "United States");

  return (
    <div className="mx">
      <div className="shell">
        <aside className="side">
          <Link href="/business" className="brand serif"><LogoMark /><span>LogaLuxe</span></Link>

          <details className="switch">
            <summary className="loc">
              <Avatar text={m.business[0]?.toUpperCase()} size={32} style={{ background: "#D4AF5A", color: "#1A1513" }} />
              <span style={{ flex: 1, minWidth: 0 }}><b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.business}</b><span>{where}</span></span>
              <Ic name="updown" size={16} />
            </summary>
            <div className="switch-menu">
              {businesses.map((b) => (
                <form key={b.id} action={switchBusiness}>
                  <input type="hidden" name="business_id" value={b.id} />
                  <button className={b.id === m.business_id ? "cur" : ""} disabled={b.id === m.business_id}>
                    <span style={{ flex: 1, minWidth: 0 }}>{b.name}<small>{[b.area, ROLE[b.role]].filter(Boolean).join(" · ")}</small></span>
                    {b.id === m.business_id ? <Ic name="check" size={15} color="#D4AF5A" /> : null}
                  </button>
                </form>
              ))}
              <hr />
              <a href={`/b/${m.slug}`} target="_blank" rel="noreferrer"><Ic name="external" size={15} />See my booking page</a>
              <form action={signOutMerchant}><button>Sign out</button></form>
            </div>
          </details>

          <MNavLink href="/business" exact><Ic name="home" />Home</MNavLink>
          <MNavLink href="/business/my-day"><Ic name="clock" />My day</MNavLink>
          {manager && m.status !== "live" && <MNavLink href="/business/setup"><Ic name="check" />Setup</MNavLink>}
          <MNavLink href="/business/calendar"><Ic name="calendar" />Calendar</MNavLink>
          <MNavLink href="/business/clients"><Ic name="clients" />Clients</MNavLink>
          <MNavLink href="/business/checkout" count={badges.checkout}><Ic name="checkout" />Checkout</MNavLink>
          {owner && <MNavLink href="/business/money"><Ic name="money" />Money</MNavLink>}
          <MNavLink href="/business/inbox" count={badges.inbox + care.problems}><Ic name="inbox" />Inbox</MNavLink>
          {manager && <MNavLink href="/business/marketing"><Ic name="marketing" />Marketing</MNavLink>}
          {(manager || m.permissions?.see_reports) && <MNavLink href="/business/reports"><Ic name="reports" />Reports</MNavLink>}
          <div className="sep" style={{ height: 1, background: "rgba(255,255,255,.08)", margin: "8px 12px" }} />
          <MNavLink href="/business/services"><Ic name="services" />Services</MNavLink>
          {manager && <MNavLink href="/business/storefront"><Ic name="storefront" />Storefront</MNavLink>}
          {manager && <MNavLink href="/business/inventory" count={care.returns}><Ic name="inventory" />Inventory</MNavLink>}
          <MNavLink href="/business/staff" count={manager ? badges.time_off : 0}><Ic name="staff" />Staff &amp; rosters</MNavLink>
          <MNavLink href="/business/settings"><Ic name="settings" />Settings</MNavLink>
          <a href="/help" className="nav" target="_blank" rel="noreferrer" style={{ marginTop: "auto" }}><Ic name="help" />Help and support</a>

          <div className="foot" style={{ marginTop: 0 }}>
            <Avatar name={m.name} size={32} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <b style={{ display: "block", fontSize: 13, color: "#F4ECE3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</b>
              <span style={{ fontSize: 11 }}>{ROLE[m.role]}</span>
            </span>
            <span className="pill pill-gold">{m.plan === "pro" ? "Pro" : "Free"}</span>
          </div>
        </aside>
        <div key={m.business_id} style={{ display: "contents" }}>{children}</div>
      </div>
    </div>
  );
}
