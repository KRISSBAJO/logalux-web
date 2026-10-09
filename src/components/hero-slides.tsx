"use client";

import { useEffect, useState } from "react";

export type HeroImage = { id: string; alt: string; caption?: string; caption_pos?: string };

// Where the caption card sits. Each photo chooses its own, so the card never covers its subject.
const CARD_AT: Record<string, string> = {
  "bottom-right": "-right-10 bottom-[9%]",
  "bottom-left": "-left-10 bottom-[9%]",
  "top-right": "-right-10 top-[22%]",
  "top-left": "-left-10 top-[22%]",
};

/**
 * The hero arch: the photos, and the caption that belongs to each one, as the admin wrote it.
 * One photo sits still; several cross-fade slowly, and the caption changes with
 * them. Rotation stops for people who ask their device to reduce motion.
 */
export function HeroShowcase({ images }: { images: HeroImage[] }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (images.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setCurrent((c) => (c + 1) % images.length), 6000);
    return () => clearInterval(t);
  }, [images.length]);

  const shown = images[Math.min(current, Math.max(0, images.length - 1))];
  // With no photo yet, the arch shows the brand art and nothing is said.
  const caption = (shown?.caption ?? "").trim();
  const at = CARD_AT[shown?.caption_pos ?? "bottom-right"];

  return (
    <>
      <div className="float">
        <div aria-hidden className="draw-in absolute -right-4 -top-4 h-full w-full rounded-t-[240px] rounded-b-[28px] border border-gold/35" />
        <div className="hero-portrait relative aspect-[4/5] overflow-hidden rounded-t-[240px] rounded-b-[28px]">
          {images.length === 0 && (
            <svg aria-hidden viewBox="0 0 400 500" className="absolute inset-0 z-[1] h-full w-full" fill="none" stroke="#E7B86A" strokeWidth="1">
              {[0, 1, 2, 3, 4].map((n) => {
                const inset = 34 + n * 30, r = 200 - inset;
                return <path key={n} d={`M${inset} 500V${inset + r}a${r} ${r} 0 0 1 ${r * 2} 0V500`} opacity={0.5 - n * 0.09} />;
              })}
              <path d="M200 262l5 14 14 5-14 5-5 14-5-14-14-5 14-5z" fill="#E7B86A" stroke="none" opacity=".9" />
            </svg>
          )}
          {images.map((img, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={img.id}
              src={`/media/${img.id}`}
              alt={i === current ? img.alt : ""}
              aria-hidden={i !== current}
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : "auto"}
              className={`absolute inset-0 z-10 h-full w-full object-cover transition-[opacity,transform] duration-[1800ms] ease-out ${i === current ? "scale-100 opacity-100" : "scale-105 opacity-0"}`}
            />
          ))}
          <div aria-hidden className="absolute inset-x-0 bottom-0 z-10 h-1/3 bg-gradient-to-t from-black/50 to-transparent" />
          {images.length > 1 && (
            <div className="absolute inset-x-0 bottom-5 z-20 flex justify-center gap-1.5">
              {images.map((img, i) => (
                <button key={img.id} type="button" onClick={() => setCurrent(i)} aria-label={`Show picture ${i + 1} of ${images.length}`} aria-current={i === current} className={`h-1.5 rounded-full transition-all duration-500 ${i === current ? "w-6 bg-gold" : "w-1.5 bg-white/55 hover:bg-white"}`} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* The caption the admin gave the photo, as plain words: no stars, no quotation marks, no claim about who said it. */}
      {caption && at && (
        <figure key={shown?.id ?? "default"} className={`fade-in float-slow absolute z-20 w-[226px] rounded-[20px] border border-white/12 bg-[#1A1513]/75 p-5 text-[#F4ECE3] shadow-[0_24px_60px_rgba(0,0,0,.5)] backdrop-blur-md ${at}`}>
          <figcaption className="serif text-[21px] leading-[1.2]">{caption}</figcaption>
        </figure>
      )}
    </>
  );
}
