import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JournalFront } from "../../front";
import { journalCategory } from "@/lib/journal";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ key: string }>; searchParams: Promise<{ q?: string; all?: string }> };
const one = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ key }, sp] = await Promise.all([params, searchParams]);
  const c = journalCategory(key);
  if (!c) return { title: "Not found", robots: { index: false, follow: false } };
  const q = one(sp.q, 80);
  const title = q ? `“${q}” in ${c.label}` : `${c.label} · The Journal`;
  const description = `Articles about ${c.phrase} in the LogaLuxe Journal, written for the United States and Nigeria.${c.service ? " Each one ends with real professionals you can book." : ""}`;
  return {
    title,
    description,
    alternates: { canonical: `/journal/category/${c.key}` },
    robots: q || sp.all ? { index: false, follow: true } : undefined,
    openGraph: { title: `${title} · LogaLuxe`, description, url: `/journal/category/${c.key}`, siteName: "LogaLuxe", type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function JournalCategoryPage({ params, searchParams }: Props) {
  const [{ key }, sp] = await Promise.all([params, searchParams]);
  if (!journalCategory(key)) notFound();
  return <JournalFront category={key} q={one(sp.q, 80)} all={sp.all === "1"} />;
}
