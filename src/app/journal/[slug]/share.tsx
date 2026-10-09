"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";

/**
 * Share an article: copy the link, post it to X or WhatsApp, or hand it to the
 * phone's own share sheet where there is one. `rail` stacks the buttons for
 * the side of a wide page; otherwise they sit in a row.
 */
export function ShareButtons({ title, path, rail }: { title: string; path: string; rail?: boolean }) {
  const [note, setNote] = useState("");
  const [native, setNative] = useState(false);
  const [url, setUrl] = useState(path);
  useEffect(() => {
    setUrl(window.location.origin + path);
    setNative(typeof navigator.share === "function");
  }, [path]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setNote("Link copied");
    } catch {
      window.prompt("Copy this link", url);
      return;
    }
    window.setTimeout(() => setNote(""), 2500);
  }
  async function share() {
    try {
      await navigator.share({ title, text: `${title} · LogaLuxe Journal`, url });
    } catch {
      // The visitor closed the sheet.
    }
  }
  const text = encodeURIComponent(`${title} · LogaLuxe Journal`);
  const btn = `inline-flex h-10 items-center justify-center gap-2 rounded-full border border-line bg-white text-[13px] font-semibold text-ink transition hover:border-ink ${rail ? "w-10" : "px-3.5"}`;
  const label = (s: string) => (rail ? <span className="sr-only">{s}</span> : s);

  return (
    <div className={`flex ${rail ? "flex-col items-center gap-2" : "flex-wrap items-center gap-2"}`} aria-label="Share this article">
      {rail && <span className="mb-1 text-[10.5px] font-semibold uppercase tracking-[.12em] text-muted">Share</span>}
      <button type="button" onClick={copy} className={btn} title="Copy the link"><Icon.Link width={15} height={15} />{label(note || "Copy link")}</button>
      <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${text}`} target="_blank" rel="noopener noreferrer" className={btn} title="Post on X">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M18.2 2h3.4l-7.4 8.5L23 22h-6.8l-5.3-7-6.1 7H1.4l7.9-9.1L1 2h7l4.8 6.4zm-1.2 18h1.9L7.1 3.9H5.1z" /></svg>
        {label("Post on X")}
      </a>
      <a href={`https://wa.me/?text=${text}%20${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" className={btn} title="Send on WhatsApp">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 1.8a8.2 8.2 0 1 1-4.2 15.3l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 0 1 12 3.8zm-3.3 4.4c-.2 0-.5 0-.7.3-.3.3-1 1-1 2.3s1 2.7 1.1 2.9c.2.2 2 3.1 4.9 4.2 2.4.9 2.9.8 3.4.7.5 0 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3l-2-.9c-.3-.1-.5-.2-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.5-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5.3-.5c.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5z" /></svg>
        {label("WhatsApp")}
      </a>
      {native && <button type="button" onClick={share} className={btn} title="More ways to share"><Icon.Share width={15} height={15} />{label("More")}</button>}
      {rail && note && <span role="status" className="text-[11px] font-semibold text-ok">{note}</span>}
    </div>
  );
}
