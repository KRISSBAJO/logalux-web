"use client";

import Link from "next/link";
import { useEffect } from "react";
import { LoadError } from "@/components/merchant-ui";

/** Shown when a screen fails in a way it did not plan for. The side menu stays, so the rest of the console still works. */
export default function ScreenError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="main">
      <LoadError title="Something went wrong" error="This screen could not be shown. Try again, or open another screen. If it keeps happening, contact LogaLuxe support." />
      <div className="content" style={{ paddingTop: 0 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-ink btn-sm" onClick={reset}>Try again</button>
          <Link href="/business" className="btn btn-out btn-sm">Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
