"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";

/**
 * What the visitor has chosen lives in the address, so a reload or a shared
 * link shows the same thing. Changing it does not ask the server for the
 * page again: Next keeps `useSearchParams` in step with the history API.
 */
export function useUrlState() {
  const sp = useSearchParams();
  const set = useCallback((changes: Record<string, string | null | undefined>, opts: { push?: boolean; hash?: string } = {}) => {
    const q = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === undefined || v === "") q.delete(k);
      else q.set(k, v);
    }
    const s = q.toString().replace(/%2C/g, ",").replace(/%3A/g, ":");
    const url = window.location.pathname + (s ? `?${s}` : "") + (opts.hash ?? window.location.hash);
    if (opts.push) window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }, []);
  return [sp, set] as const;
}
