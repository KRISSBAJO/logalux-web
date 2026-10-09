import type { ReactNode, SVGProps } from "react";

// One line drawing for each kind of business, in the same hand as icons.tsx:
// a 24 by 24 box, round caps and joins, the stroke taking the text colour.
// They stand in the round tile of a category until a photo is uploaded for it.

const paths: Record<string, ReactNode> = {
  // A comb.
  hair: <><path d="M4 5h16v5H4z" /><path d="M7 10v9M10 10v9M13 10v9M16 10v9" /></>,
  // Two strands crossing down a braid.
  braids: <><path d="M9 2.5c0 3.2 6 3.2 6 6.4s-6 3.1-6 6.3 6 3.2 6 6.3" /><path d="M15 2.5c0 3.2-6 3.2-6 6.4s6 3.1 6 6.3-6 3.2-6 6.3" /></>,
  // Scissors.
  barber: <><circle cx="6" cy="6.5" r="2.5" /><circle cx="6" cy="17.5" r="2.5" /><path d="M8.2 8 20 17M8.2 16 20 7" /></>,
  // A bottle of polish.
  nails: <><path d="M10 3h4v6h-4z" /><path d="M8 12a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3z" /></>,
  // A closed eye and its lashes.
  lashes: <><path d="M3 10c2.5 3.4 5.5 5 9 5s6.5-1.6 9-5" /><path d="M12 15v3.5M7.6 14.2 6.2 17.2M16.4 14.2l1.4 3M4.6 11.8l-2 1.9M19.4 11.8l2 1.9" /></>,
  // A drop.
  skin: <><path d="M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11z" /><path d="M9.5 14.5A2.5 2.5 0 0 0 12 17" /></>,
  // A lipstick.
  makeup: <><path d="M9 12h6v9H9z" /><path d="M10 12V6.5L14 3v9" /><path d="M9 15.5h6" /></>,
  // A lotus.
  spa: <><path d="M12 20c-2.6-2-3.6-4.9-3.6-7.8 0-2.9 1.5-5.4 3.6-7.4 2.1 2 3.6 4.5 3.6 7.4 0 2.9-1 5.8-3.6 7.8z" /><path d="M8.6 14.4C7 13.5 5 13.2 3 13.6c1 3.7 4.8 6.4 9 6.4" /><path d="M15.4 14.4c1.6-.9 3.6-1.2 5.6-.8-1 3.7-4.8 6.4-9 6.4" /></>,
  // A shop front with its awning: the Journal's articles for professionals.
  business: <><path d="M4 10 5.5 4h13L20 10" /><path d="M4 10c0 1.4 1.1 2.5 2.5 2.5S9 11.4 9 10c0 1.4 1.1 2.5 2.5 2.5S14 11.4 14 10c0 1.4 1.1 2.5 2.5 2.5S19 11.4 19 10" /><path d="M5.5 12.5V20h13v-7.5" /><path d="M10 20v-5h4v5" /></>,
  // A signpost: how to use LogaLuxe.
  guide: <><path d="M12 3v18M8 21h8" /><path d="M12 6h7l2 2.5L19 11h-7z" /><path d="M12 13H5l-2 2.5L5 18h7z" /></>,
};

/** The drawing for a category id (hair, braids, barber, nails, lashes, skin, makeup, spa, business, guide). Nothing for an id it does not know. */
export function CategoryIcon({ id, ...props }: { id: string } & SVGProps<SVGSVGElement>) {
  const drawing = paths[id];
  if (!drawing) return null;
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      {drawing}
    </svg>
  );
}
