"use client";

import { distanceTo, nearProblem, usePosition } from "@/lib/near";

/**
 * Beside an address: "How far is it?" until the visitor shares their position,
 * then "2.3 mi from you". Unstyled on purpose: the page that uses it gives the
 * classes, so it sits in a design-scoped page and a Tailwind one alike.
 */
export function HowFar({ lat, lng, miles, className = "", buttonClassName = "", noteClassName = "" }: { lat: number; lng: number; miles: boolean; className?: string; buttonClassName?: string; noteClassName?: string }) {
  const { point, status, ask, forget } = usePosition();
  const far = distanceTo(point, { lat, lng }, miles);
  const problem = nearProblem(status);
  return (
    <span className={className}>
      {far ? (
        <>
          <span aria-live="polite">{far} from you</span>
          <button type="button" className={buttonClassName} onClick={forget} aria-label="Stop using my location">Clear</button>
        </>
      ) : (
        <button type="button" className={buttonClassName} onClick={ask} disabled={status === "asking"}>{status === "asking" ? "Finding you…" : "How far is it?"}</button>
      )}
      {!far && problem ? <span role="status" className={noteClassName}>{problem}</span> : null}
    </span>
  );
}
