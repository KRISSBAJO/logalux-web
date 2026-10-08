"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";

/** One link in the dark side menu. It lights up for its own page and the pages under it. */
export function MNavLink({ href, exact, count, children }: { href: string; exact?: boolean; count?: number; children: ReactNode }) {
  const path = usePathname();
  const on = exact ? path === href : path === href || path.startsWith(href + "/");
  return (
    <Link href={href} className={"nav" + (on ? " on" : "")} aria-current={on ? "page" : undefined}>
      {children}
      {count ? <span className="cnt">{count}</span> : null}
    </Link>
  );
}

/**
 * A panel that slides in from the right: the place for a form or a detail view.
 * `trigger` is the content of the button that opens it. Pass `open` to have it
 * open when the page loads (for example from a link with ?new=1).
 */
export function Sheet({ trigger, triggerClass = "btn btn-out", title, sub, children, open = false, wide = false, closeHref }: {
  trigger?: ReactNode; triggerClass?: string; title: string; sub?: ReactNode; children: ReactNode; open?: boolean; wide?: boolean;
  /** Where to go when a sheet opened by the URL is closed, so a reload does not open it again. */
  closeHref?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && ref.current && !ref.current.open) ref.current.showModal();
  }, [open]);
  const close = () => {
    ref.current?.close();
    if (closeHref) window.history.replaceState(null, "", closeHref);
  };
  return (
    <>
      {trigger !== undefined && <button type="button" className={triggerClass} onClick={() => ref.current?.showModal()}>{trigger}</button>}
      <dialog ref={ref} className={"sheet" + (wide ? " sheet-wide" : "")} onClick={(e) => { if (e.target === ref.current) close(); }} onClose={() => { if (closeHref) window.history.replaceState(null, "", closeHref); }}>
        <div className="sheet-in">
          <div className="sheet-hd">
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 className="serif">{title}</h2>
              {sub ? <div className="sheet-sub">{sub}</div> : null}
            </div>
            <button type="button" className="sheet-x" aria-label="Close" onClick={close}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
          <div className="sheet-bd">{children}</div>
        </div>
      </dialog>
    </>
  );
}

/** A submit button that asks first. Use it inside a form for anything that cannot be undone. */
export function ConfirmButton({ message, children, ...props }: { message: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} onClick={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}

/** Submits its form as soon as a field inside it changes: filters, switches and pickers. */
export function AutoForm({ children, ...props }: React.FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form {...props} onChange={(e) => { const t = e.target as HTMLElement; if (!t.closest("[data-no-auto]")) e.currentTarget.requestSubmit(); }}>
      {children}
    </form>
  );
}

/** Copies a piece of text, such as the booking link. */
export function CopyButton({ text, children, className = "btn btn-out btn-sm" }: { text: string; children: ReactNode; className?: string }) {
  return (
    <button type="button" className={className} onClick={(e) => {
      const b = e.currentTarget, old = b.textContent;
      navigator.clipboard?.writeText(text).then(() => { b.textContent = "Copied"; setTimeout(() => { b.textContent = old; }, 1400); });
    }}>
      {children}
    </button>
  );
}
