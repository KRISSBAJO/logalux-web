"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Content, Panel, Topbar } from "@/components/admin-ui";

/** Shown when a page fails in a way it did not plan for. The side menu stays, so the rest of the console still works. */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <>
      <Topbar title="Something went wrong" />
      <Content>
        <div role="alert" className="rounded-xl border border-bad/25 bg-bad-bg px-4 py-3 text-[14px] font-medium text-bad">This page could not be shown. Try again, or open another page. If it keeps happening, tell the engineers{error.digest ? ` and quote ${error.digest}` : ""}.</div>
        <Panel>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={reset} className="inline-flex h-10 items-center justify-center rounded-full bg-ink px-4 text-[13.5px] font-semibold text-cream hover:bg-ink-3">Try again</button>
            <Link href="/admin" className="inline-flex h-10 items-center rounded-full border border-line bg-white px-4 text-[13.5px] font-semibold hover:border-ink">Back to the overview</Link>
          </div>
        </Panel>
      </Content>
    </>
  );
}
