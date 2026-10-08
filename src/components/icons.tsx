import type { SVGProps } from "react";

const base = (props: SVGProps<SVGSVGElement>) => ({
  width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, ...props,
});

export const Icon = {
  Search: (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>,
  Check: (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M20 6 9 17l-5-5" /></svg>,
  Shield: (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" /></svg>,
  Chat: (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M21 12a8 8 0 0 1-11.6 7.2L4 21l1.8-5A8 8 0 1 1 21 12z" /></svg>,
  Star: (p: SVGProps<SVGSVGElement>) => <svg {...base({ ...p, fill: "currentColor", stroke: "none" })}><path d="m12 2 3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21l1.4-7L2 9.3l7-.8z" /></svg>,
  Heart: (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>,
  Calendar: (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>,
  Card: (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><rect x="2" y="6" width="20" height="13" rx="2" /><path d="M2 10h20M6 15h4" /></svg>,
  Pin: (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M12 22s7-5.3 7-12a7 7 0 1 0-14 0c0 6.7 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></svg>,
  Camera: (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="12" cy="12" r="3.5" /></svg>,
  Arrow: (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="m9 6 6 6-6 6" /></svg>,
  Back: (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="m15 18-6-6 6-6" /></svg>,
  Plus: (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>,
  Clock: (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  Spark: (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="m12 3 1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4zM5 17l.9 2.1L8 20l-2.1.9L5 23l-.9-2.1L2 20l2.1-.9z" /></svg>,
  Cart: (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M6 6h15l-1.5 9h-12zM6 6 5 3H2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" /></svg>,
  Users: (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><circle cx="9" cy="8" r="3.5" /><path d="M2 20a7 7 0 0 1 14 0M16 4.5a3.5 3.5 0 0 1 0 7M22 20a6 6 0 0 0-5-5.9" /></svg>,
  Building: (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" /></svg>,
  Warn: (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>,
  Grid: (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>,
  List: (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M4 6h16M4 12h16M4 18h10" /></svg>,
  Flag: (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01" /></svg>,
  Doc: (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></svg>,
};

export function Stars({ rating, size = 12 }: { rating: number | string; size?: number }) {
  const r = Math.round(Number(rating));
  return (
    <span className="inline-flex gap-px text-gold" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => <Icon.Star key={i} width={size} height={size} style={{ opacity: i <= r ? 1 : 0.25 }} />)}
    </span>
  );
}

export function Avatar({ initials, tone = "#7A1F2B", size = 36 }: { initials: string; tone?: string; size?: number }) {
  return (
    <span className="inline-flex flex-none items-center justify-center rounded-full font-semibold text-[#F4ECE3]" style={{ width: size, height: size, background: tone, fontSize: size * 0.34 }}>
      {initials}
    </span>
  );
}
