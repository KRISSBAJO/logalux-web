import { NextRequest, NextResponse } from "next/server";
import { journalList } from "@/lib/journal";

// The next page of Journal articles, for "Load more" on the front. Only the
// list filters are passed on; the API decides what is published.
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const pick = (k: string, max: number, re?: RegExp) => { const v = (p.get(k) ?? "").trim().slice(0, max); return !re || re.test(v) ? v : ""; };
  const limit = Math.min(48, Math.max(1, parseInt(p.get("limit") ?? "12", 10) || 12));
  const offset = Math.max(0, parseInt(p.get("offset") ?? "0", 10) || 0);
  const list = await journalList({
    category: pick("category", 20, /^[a-z]*$/), country: pick("country", 2, /^(US|NG)?$/), q: pick("q", 80), tag: pick("tag", 40), limit, offset,
  });
  if (!list) return NextResponse.json({ error: "The Journal could not be reached." }, { status: 503 });
  return NextResponse.json(list);
}
