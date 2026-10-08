import "@/app/cx-css/book.css";
import { EmbedFoot } from "@/app/b/[slug]/book/view";

export default function EmbedNotFound() {
  return (
    <div className="cx pg-book embed">
      <main className="wrap">
        <div className="card" style={{ marginTop: 20 }}>
          <h2 className="serif">This booking page is not available</h2>
          <div className="muted" style={{ fontSize: 14 }}>The business may have changed its address or stopped taking bookings online. Contact the business directly.</div>
        </div>
        <EmbedFoot />
      </main>
    </div>
  );
}
