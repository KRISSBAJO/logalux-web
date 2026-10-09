import { Topbar } from "@/components/merchant-ui";

/** Shown in the content area while a screen loads its data. The side menu stays as it is. */
export default function Loading() {
  return (
    <div className="main" aria-busy="true">
      <Topbar title={<span className="muted" style={{ fontWeight: 500 }}>Loading…</span>} />
      <div className="content">
        <div role="status" aria-live="polite" className="muted" style={{ fontSize: 13.5 }}>Loading…</div>
      </div>
    </div>
  );
}
