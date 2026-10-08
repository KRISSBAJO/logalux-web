"use client";

import { useState, type ReactNode } from "react";

/** The product picture, with thumbnails to switch between when there are several. Without a photo, the product's colour. */
export function ProductGallery({ images, tone, name, badge }: { images: { id: string; alt: string }[]; tone: string; name: string; badge?: ReactNode }) {
  const [current, setCurrent] = useState(0);
  const img = images[Math.min(current, images.length - 1)];
  return (
    <div className={`gallery ${images.length > 1 ? "" : "one"}`}>
      {images.length > 1 && (
        <div className="thumbs">
          {images.map((m, i) => (
            <button key={m.id} type="button" className={`thumb ${i === current ? "on" : ""}`} style={{ background: tone }} onClick={() => setCurrent(i)} aria-label={`Photo ${i + 1} of ${images.length}`} aria-pressed={i === current}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/media/${m.id}`} alt="" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      )}
      <div className="hero" style={{ background: tone }}>
        {img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={img.id} src={`/media/${img.id}`} alt={img.alt || name} decoding="async" />
        )}
        {badge}
      </div>
    </div>
  );
}
