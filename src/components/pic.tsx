import type { Media } from "@/lib/media";

/**
 * Fills its parent with an uploaded image. Renders nothing when there is no
 * image, so the parent's colour shows through as the placeholder. The parent
 * needs `position: relative` (the `.photo` class has it).
 */
export function Pic({ img, eager, className = "" }: { img?: Media; eager?: boolean; className?: string }) {
  if (!img) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/media/${img.id}`} alt={img.alt} loading={eager ? "eager" : "lazy"} decoding="async" className={`absolute inset-0 h-full w-full object-cover ${className}`} />;
}
