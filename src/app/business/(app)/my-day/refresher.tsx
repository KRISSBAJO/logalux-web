"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Asks the server for the day again every three minutes while the screen is in view,
 * and as soon as the person comes back to it. The "in 25 min" labels are worked
 * out on the server, so this is what keeps them true.
 */
export function DayRefresher({ seconds = 180 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const fresh = () => { if (document.visibilityState === "visible") router.refresh(); };
    const timer = setInterval(fresh, seconds * 1000);
    document.addEventListener("visibilitychange", fresh);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", fresh); };
  }, [router, seconds]);
  return null;
}
