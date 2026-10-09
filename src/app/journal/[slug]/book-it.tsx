"use client";

import { useEffect, useState } from "react";
import { ResultCardItem, type Opening, type ResultCard } from "@/components/search-results";

/** The professionals under an article, as the search cards, with their next free times. */
export function BookItCards({ cards }: { cards: ResultCard[] }) {
  const [active, setActive] = useState<string | null>(null);
  const [openings, setOpenings] = useState<Record<string, Opening>>({});
  const slugs = cards.map((c) => c.slug).join(",");
  useEffect(() => {
    if (!slugs) return;
    let live = true;
    fetch(`/api/openings?${new URLSearchParams({ slugs })}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live && d?.openings) setOpenings(d.openings); })
      .catch(() => {});
    return () => { live = false; };
  }, [slugs]);
  return (
    <div className="grid gap-3.5 lg:grid-cols-2">
      {cards.map((c) => <ResultCardItem key={c.slug} c={c} active={active === c.slug} onEnter={() => setActive(c.slug)} onLeave={() => setActive(null)} opening={openings[c.slug]} src="marketplace" />)}
    </div>
  );
}
