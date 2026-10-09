"use client";

import { useEffect, useState } from "react";
import type { Heading } from "@/lib/journal-md";

/** The article's headings, with the one on screen marked. Shown beside the text on wide screens. */
export function TableOfContents({ headings }: { headings: Heading[] }) {
  const [on, setOn] = useState(headings[0]?.id ?? "");
  useEffect(() => {
    const els = headings.map((h) => document.getElementById(h.id)).filter((e): e is HTMLElement => !!e);
    if (!els.length || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        // The highest heading that has crossed the upper part of the screen is the one being read.
        const above = els.filter((e) => e.getBoundingClientRect().top < 140);
        if (above.length) setOn(above[above.length - 1].id);
        else if (entries.some((e) => e.isIntersecting)) setOn(els[0].id);
      },
      { rootMargin: "-130px 0px -60% 0px", threshold: [0, 1] },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [headings]);
  if (!headings.length) return null;
  return (
    <nav className="jn-toc" aria-label="In this article">
      <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[.12em] text-muted">In this article</p>
      {headings.map((h) => (
        <a key={h.id} href={`#${h.id}`} className={`${h.level === 3 ? "sub" : ""} ${on === h.id ? "on" : ""}`} aria-current={on === h.id ? "location" : undefined}>{h.text}</a>
      ))}
    </nav>
  );
}
