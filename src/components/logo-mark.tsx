import type { SVGProps } from "react";

/**
 * The LogaLuxe mark: an arch with a four-point star inside. It is drawn as a
 * vector and takes the current text colour, so it stays sharp at any size and
 * works on dark and light backgrounds. Size it with a height class.
 */
export function LogoMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 40" fill="none" aria-hidden focusable="false" {...props}>
      <path d="M3 38.6V16a13 13 0 0 1 26 0v22.6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="miter" />
      <path d="M16 15.2c.55 5.3 2.5 7.25 7.8 7.8-5.3.55-7.25 2.5-7.8 7.8-.55-5.3-2.5-7.25-7.8-7.8 5.3-.55 7.25-2.5 7.8-7.8Z" fill="currentColor" />
    </svg>
  );
}
