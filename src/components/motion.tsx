"use client";

import { useEffect } from "react";

/**
 * Scroll-triggered reveals for the marketing pages.
 *
 * Mark an element with `data-reveal` to fade it up when it enters the screen,
 * or a container with `data-stagger` to bring its children in one after another.
 * The hidden starting state only applies once `js-motion` is on <html>, so the
 * page stays fully readable without JavaScript, and nothing moves for people
 * who ask their device to reduce motion.
 */
export function Motion() {
  useEffect(() => {
    const root = document.documentElement;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      root.classList.remove("js-motion");
      return;
    }
    root.classList.add("js-motion");

    const show = (el: Element) => {
      if (el.hasAttribute("data-stagger")) {
        Array.from(el.children).forEach((child, i) => {
          (child as HTMLElement).style.setProperty("--d", `${Math.min(i, 8) * 80}ms`);
          child.classList.add("in");
        });
      }
      el.classList.add("in");
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          show(e.target);
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    const watch = () => document.querySelectorAll("[data-reveal]:not(.in), [data-stagger]:not(.in)").forEach((el) => io.observe(el));
    watch();
    // Elements that arrive after the first paint (a new place chosen, a list reloaded) are watched too.
    const mo = new MutationObserver(() => watch());
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, []);
  return null;
}

/** Runs before paint so content that will animate in never flashes first. */
export function MotionBoot() {
  const code = `try{if(!matchMedia("(prefers-reduced-motion: reduce)").matches&&"IntersectionObserver" in window)document.documentElement.classList.add("js-motion")}catch(e){}`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
