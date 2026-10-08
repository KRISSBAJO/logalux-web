"use client";

import { useEffect } from "react";

/**
 * Keys pressed inside a frame never reach the page around it. When the booking page is shown by
 * /embed.js, Escape is passed up so the window can close. The message carries nothing else.
 */
export function EmbedBridge() {
  useEffect(() => {
    if (window.parent === window) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) window.parent.postMessage({ type: "logaluxe:close" }, "*"); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
