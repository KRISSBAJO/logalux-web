import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { initials } from "@/lib/merchant-format";

// Building blocks shared by the merchant screens. The class names come from
// the design (see app/business/css), so the markup here matches it one to one.

/** The bar at the top of every screen: a title, an optional line above it, and the actions on the right. */
export function Topbar({ title, eyebrow, children }: { title: ReactNode; eyebrow?: ReactNode; children?: ReactNode }) {
  return (
    <header className="topbar">
      <div>
        {eyebrow ? <div className="muted" style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase" }}>{eyebrow}</div> : null}
        <h1 className="serif">{title}</h1>
      </div>
      {children}
    </header>
  );
}

/** The search box in the top bar. It is a plain GET form, so it works without scripts. */
export function TopSearch({ action, name = "q", value = "", placeholder, hidden = {} }: { action: string; name?: string; value?: string; placeholder: string; hidden?: Record<string, string | undefined> }) {
  return (
    <form action={action} className="search" role="search">
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <span className="sr">Search</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input type="search" name={name} defaultValue={value} placeholder={placeholder} aria-label={placeholder} />
    </form>
  );
}

/** The message a page shows after an action: ?ok= or ?err= in the address. */
export function Flash({ sp }: { sp: { ok?: string; err?: string } }) {
  if (sp.err) return <div role="alert" className="flash flash-err">{sp.err}</div>;
  if (sp.ok) return <div role="status" className="flash flash-ok">{sp.ok}</div>;
  return null;
}

export function Avatar({ name, text, tone, size = 36, style }: { name?: string; text?: string; tone?: string | null; size?: number; style?: CSSProperties }) {
  return (
    <span className="avatar" style={{ ...(tone ? { background: tone } : {}), ...(size !== 36 ? { width: size, height: size, fontSize: size <= 28 ? 10 : size <= 32 ? 11 : 12 } : {}), ...style }}>
      {text ?? initials(name ?? "")}
    </span>
  );
}

export type PillTone = "ok" | "gold" | "wine" | "grey" | "new";
export function Pill({ tone = "grey", children }: { tone?: PillTone; children: ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

const STATUS_TONE: Record<string, PillTone> = {
  requested: "new", confirmed: "grey", checked_in: "gold", in_progress: "gold", completed: "gold", paid: "ok",
  cancelled_client: "wine", cancelled_business: "wine", no_show: "wine", rescheduled: "grey",
};
export const statusTone = (status: string): PillTone => STATUS_TONE[status] ?? "grey";

/** Shown in place of a screen the signed-in person may not open. */
export function NoAccess({ title, need }: { title: string; need: "manager" | "owner" }) {
  return (
    <>
      <Topbar title={title} />
      <div className="content">
        <div className="card" style={{ maxWidth: 560 }}>
          <h3>This screen is for {need === "owner" ? "the owner" : "managers and the owner"}</h3>
          <div className="sub">Your sign-in does not include it. Ask the owner of the business if you need access.</div>
          <div><Link href="/business" className="btn btn-out btn-sm">Back to Home</Link></div>
        </div>
      </div>
    </>
  );
}

/** A page that could not load its data. */
export function LoadError({ title, error }: { title: string; error: string }) {
  return (
    <>
      <Topbar title={title} />
      <div className="content"><div role="alert" className="flash flash-err">{error}</div></div>
    </>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {children ? <span>{children}</span> : null}
    </div>
  );
}

/** A labelled form field. Put an input, select or textarea inside. */
export function Fld({ label, hint, children, style }: { label: string; hint?: ReactNode; children: ReactNode; style?: CSSProperties }) {
  return (
    <label className="fld" style={style}>
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

/** An on/off switch that posts as "on", like a checkbox. */
export function Switch({ name, on, label, sub }: { name: string; on?: boolean; label: ReactNode; sub?: ReactNode }) {
  return (
    <label className="sw">
      <span style={{ flex: 1, minWidth: 0 }}>
        <b>{label}</b>
        {sub ? <small>{sub}</small> : null}
      </span>
      <input type="checkbox" name={name} defaultChecked={on} />
      <i aria-hidden="true" />
    </label>
  );
}

// The icons of the side menu and the "needs you" list, from the design.
const P: Record<string, ReactNode> = {
  home: <path d="m3 11 9-8 9 8v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z" />,
  calendar: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></>,
  clients: <><circle cx="9" cy="8" r="3.5" /><path d="M2 20a7 7 0 0 1 14 0M16 4.5a3.5 3.5 0 0 1 0 7M22 20a6 6 0 0 0-5-5.9" /></>,
  checkout: <><rect x="2" y="6" width="20" height="13" rx="2" /><path d="M2 10h20M6 15h4" /></>,
  money: <path d="M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M6 12h.01M18 12h.01" />,
  inbox: <path d="M21 12a8 8 0 0 1-11.6 7.2L4 21l1.8-5A8 8 0 1 1 21 12z" />,
  marketing: <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15 9a4 4 0 0 1 0 6" />,
  reports: <path d="M3 3v18h18M7 14l4-4 4 4 5-6" />,
  services: <path d="M4 6h16M4 12h16M4 18h10" />,
  storefront: <path d="M3 9 5 3h14l2 6M3 9h18M3 9v2a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V9M5 13v8h14v-8M10 21v-5h4v5" />,
  inventory: <path d="M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8" />,
  staff: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  spark: <path d="m12 3 1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4zM5 17l.9 2.1L8 20l-2.1.9L5 23l-.9-2.1L2 20l2.1-.9z" />,
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.200 9.5l6.1-.9z" />,
  check: <path d="m5 12 5 5 9-10" />,
  chevR: <path d="m9 6 6 6-6 6" />,
  chevL: <path d="m15 6-6 6 6 6" />,
  updown: <path d="m8 9 4-4 4 4M8 15l4 4 4-4" />,
  download: <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />,
  external: <path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />,
  bank: <path d="M3 10 12 4l9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18" />,
  shield: <path d="M12 3 4 6v6c0 4.5 3.2 7.9 8 9 4.800-1.100 8-4.500 8-9V6z" />,
};
export type IconName = keyof typeof P;
export function Ic({ name, size = 18, stroke = 2, color }: { name: string; size?: number; stroke?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? "currentColor"} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name]}
    </svg>
  );
}
