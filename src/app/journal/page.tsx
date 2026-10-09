import type { Metadata } from "next";
import { JournalFront } from "./front";

export const dynamic = "force-dynamic";

type SP = { q?: string; tag?: string; category?: string; all?: string };
const one = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const q = one(sp.q, 80), tag = one(sp.tag, 40);
  const title = q ? `“${q}” in the Journal` : tag ? `#${tag} in the Journal` : "The Journal";
  const description = "Useful articles about hair, braids, barbering, nails, lashes, skin, makeup, spa, and running a beauty business, for the United States and Nigeria. Each one ends with real professionals you can book.";
  const plain = !q && !tag && !sp.category && !sp.all;
  return {
    title,
    description,
    alternates: { canonical: "/journal" },
    robots: plain ? undefined : { index: false, follow: true },
    openGraph: { title: `${title} · LogaLuxe`, description, url: "/journal", siteName: "LogaLuxe", type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function JournalPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  // ?category= still works for an old link; the category pages are the real addresses.
  const category = /^[a-z]{1,20}$/.test(sp.category ?? "") ? sp.category! : "";
  return <JournalFront q={one(sp.q, 80)} tag={one(sp.tag, 40)} category={category} all={sp.all === "1"} />;
}
