import { Content, Topbar } from "@/components/admin-ui";

/** Shown in the content area while a page loads its data. The side menu stays as it is. */
export default function Loading() {
  return (
    <div aria-busy="true">
      <Topbar title="Loading" />
      <Content>
        <p role="status" aria-live="polite" className="text-[13.5px] text-muted">Loading this page.</p>
      </Content>
    </div>
  );
}
