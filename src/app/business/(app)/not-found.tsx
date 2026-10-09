import Link from "next/link";
import { Empty, Topbar } from "@/components/merchant-ui";

/** An address under /business that is not a screen. */
export default function NotFound() {
  return (
    <div className="main">
      <Topbar title="Not found" />
      <div className="content">
        <div className="card" style={{ maxWidth: 560 }}>
          <Empty title="There is no screen at this address">Check the address, or pick a screen from the menu.</Empty>
          <div style={{ marginTop: 12 }}><Link href="/business" className="btn btn-out btn-sm">Back to Home</Link></div>
        </div>
      </div>
    </div>
  );
}
