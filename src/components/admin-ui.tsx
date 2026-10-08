import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./icons";

type Kind = "ok" | "gold" | "wine" | "grey" | "info";

export function Topbar({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line bg-cream px-5 py-4 md:px-8">
      <div className="mr-auto min-w-0">
        <h1 className="serif text-[30px] font-medium leading-none">{title}</h1>
        {sub && <p className="mt-1.5 text-[13px] text-muted">{sub}</p>}
      </div>
      {children}
      <form action="/admin/search" className="flex h-10 w-full items-center gap-2 rounded-full border border-line bg-white px-3.5 text-muted sm:w-[260px]">
        <Icon.Search />
        <input name="q" placeholder="Search everything" aria-label="Search the console" className="w-full min-w-0 bg-transparent text-[14px] text-ink outline-none placeholder:text-muted-2" />
      </form>
    </header>
  );
}

export function Content({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-5 p-5 md:p-8">{children}</div>;
}

/** Result of the last action, and any load error. */
export function Flash({ sp, error }: { sp: { ok?: string; err?: string }; error?: string }) {
  const bad = sp.err || error;
  if (bad) return <div role="alert" className="rounded-xl border border-bad/25 bg-bad-bg px-4 py-3 text-[14px] font-medium text-bad">{bad}</div>;
  if (sp.ok) return <div role="status" className="rounded-xl border border-ok/25 bg-ok-bg px-4 py-3 text-[14px] font-medium text-ok">{sp.ok}</div>;
  return null;
}

export function Kpi({ label, value, sub, tone, href }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "ok" | "bad"; href?: string }) {
  const body = (
    <>
      <small className="block text-[11px] font-semibold uppercase tracking-[.08em] text-muted">{label}</small>
      <b className="mt-1.5 block text-[28px] font-semibold leading-none tracking-tight">{value}</b>
      {sub && <span className={`mt-1.5 block text-[12px] ${tone === "ok" ? "text-ok" : tone === "bad" ? "text-bad" : "text-muted"}`}>{sub}</span>}
    </>
  );
  return href ? <Link href={href} className="card block p-4 transition hover:border-ink">{body}</Link> : <div className="card p-4">{body}</div>;
}

export function Panel({ title, sub, action, children, flush }: { title?: string; sub?: string; action?: ReactNode; children: ReactNode; flush?: boolean }) {
  return (
    <section className="card overflow-hidden">
      {title && (
        <div className="flex flex-wrap items-center gap-3 border-b border-line-2 px-5 py-3.5">
          <div className="mr-auto"><h2 className="text-[15px] font-semibold">{title}</h2>{sub && <p className="text-[12.5px] text-muted">{sub}</p>}</div>
          {action}
        </div>
      )}
      <div className={flush ? "overflow-x-auto" : "p-5"}>{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-5 py-10 text-center text-[14px] text-muted">{children}</div>;
}

/** Filter links styled as a segmented control. */
export function Tabs({ items, current, href }: { items: [string, string][]; current: string; href: (value: string) => string }) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-full bg-[#EFE5DA] p-0.5">
      {items.map(([v, l]) => (
        <Link key={v} href={href(v)} className={`whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-semibold ${current === v ? "bg-ink text-cream" : "text-muted hover:text-ink"}`}>{l}</Link>
      ))}
    </div>
  );
}

/** A GET search box that keeps the page's other filters. */
export function FilterSearch({ action, q, placeholder, keep = {} }: { action: string; q?: string; placeholder: string; keep?: Record<string, string | undefined> }) {
  return (
    <form action={action} className="flex h-10 w-full items-center gap-2 rounded-full border border-line bg-white px-3.5 text-muted sm:w-[300px]">
      {Object.entries(keep).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <Icon.Search />
      <input name="q" defaultValue={q} placeholder={placeholder} aria-label={placeholder} className="w-full min-w-0 bg-transparent text-[14px] text-ink outline-none placeholder:text-muted-2" />
    </form>
  );
}

export function Pill({ kind, children }: { kind: Kind; children: ReactNode }) {
  return <span className={`pill pill-${kind}`}>{children}</span>;
}

const pillFor: Record<string, Kind> = {
  live: "ok", verified: "ok", approved: "ok", published: "ok", resolved: "ok", confirmed: "ok", completed: "ok", paid: "ok", delivered: "ok", active: "ok", succeeded: "ok", ok: "ok",
  pending: "gold", needs_info: "gold", with_business: "gold", flagged: "gold", held: "gold", warn: "gold", processing: "gold",
  needs_decision: "wine", suspended: "wine", rejected: "wine", removed: "wine", failed: "wine", no_show: "wine", down: "wine", blocked: "wine", disabled: "wine", locked: "wine",
  scheduled: "info", ready: "info", shipped: "info", super_admin: "info",
};
export function statusPill(s: string | null | undefined) {
  const v = s || "unknown";
  return <Pill kind={pillFor[v] ?? "grey"}>{v.replace(/_/g, " ")}</Pill>;
}

export const ago = (iso: string | null | undefined) => {
  if (!iso) return "never";
  const h = (Date.now() - new Date(iso).getTime()) / 36e5;
  if (h < 0) return "soon";
  return h < 1 ? `${Math.max(1, Math.round(h * 60))} min ago` : h < 48 ? `${Math.round(h)} h ago` : `${Math.round(h / 24)} d ago`;
};

export const fmtMoney = (cents: number | null | undefined, currency = "USD") => {
  const n = (cents ?? 0) / 100;
  return currency === "NGN" ? `₦${n.toLocaleString("en-NG", { maximumFractionDigits: 0 })}` : `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
};

/** Date and time in the business's own time zone. */
export const fmtWhen = (iso: string | null | undefined, timeZone = "UTC") =>
  iso ? new Date(iso).toLocaleString("en-US", { timeZone, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—";

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }) : "—";

export const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

// ---- form pieces used inside <form action={serverAction}> ----

export function Hidden({ values }: { values: Record<string, string | number | undefined> }) {
  return <>{Object.entries(values).map(([k, v]) => <input key={k} type="hidden" name={k} value={v ?? ""} />)}</>;
}

const tone = {
  ink: "bg-ink text-cream hover:bg-ink-3",
  ok: "bg-ok text-white hover:opacity-90",
  out: "border border-line bg-white text-ink hover:border-ink",
  danger: "border border-bad/30 bg-white text-bad hover:bg-bad-bg",
};
export function Btn({ children, kind = "out", name, value, small, title }: { children: ReactNode; kind?: keyof typeof tone; name?: string; value?: string; small?: boolean; title?: string }) {
  return (
    <button type="submit" name={name} value={value} title={title} className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition ${small ? "h-8 px-3 text-[12.5px]" : "h-10 px-4 text-[13.5px]"} ${tone[kind]}`}>
      {children}
    </button>
  );
}

export const inputCls = "h-10 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-[14px] text-ink outline-none focus:border-ink";

/** A compact input for table rows. Set the width where it is used. */
export const inputSm = "h-8 min-w-0 rounded-lg border border-line bg-white px-2 text-[13px] text-ink outline-none focus:border-ink";

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className="text-[11px] font-semibold uppercase tracking-[.06em] text-muted">{label}</span>
      {children}
    </label>
  );
}

/** Explains why the controls are missing instead of leaving a blank space. */
export function ReadOnly({ need }: { need: "ops" | "super admin" }) {
  return <p className="rounded-xl bg-cream-2 px-3.5 py-2.5 text-[13px] text-muted">View only. Changes here need the {need} role.</p>;
}

export function Facts({ items, narrow }: { items: [string, ReactNode][]; narrow?: boolean }) {
  return (
    <div className={`grid gap-2 ${narrow ? "grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0 rounded-xl bg-cream-2 px-3.5 py-2.5">
          <small className="block text-[11px] font-semibold uppercase tracking-[.05em] text-muted">{k}</small>
          <b className="block break-words text-[14px] font-semibold">{v || "—"}</b>
        </div>
      ))}
    </div>
  );
}
