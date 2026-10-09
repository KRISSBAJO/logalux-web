import Link from "next/link";
import { Content, Empty, Panel, Topbar } from "@/components/admin-ui";

/** An address under /admin that is not a page. */
export default function NotFound() {
  return (
    <>
      <Topbar title="Not found" />
      <Content>
        <Panel>
          <Empty>There is no page at this address. Check the address, or pick a page from the menu.</Empty>
          <div className="text-center"><Link href="/admin" className="inline-flex h-10 items-center rounded-full border border-line bg-white px-4 text-[13.5px] font-semibold hover:border-ink">Back to the overview</Link></div>
        </Panel>
      </Content>
    </>
  );
}
