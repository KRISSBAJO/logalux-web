import { NextRequest, NextResponse } from "next/server";
import { api, ApiError } from "@/lib/api";

// The next free times of several businesses at once, for the search results.
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const slugs = (p.get("slugs") ?? "").split(",").map((s) => s.trim()).filter((s) => /^[a-z0-9-]{1,80}$/i.test(s)).slice(0, 40);
  if (!slugs.length) return NextResponse.json({ openings: {} });
  const qs = new URLSearchParams({ slugs: slugs.join(","), q: (p.get("q") ?? "").slice(0, 80) });
  // The search "When": each business then also says whether it has a free time in that window.
  const when = p.get("when") ?? "";
  if (["today", "tomorrow", "weekend"].includes(when)) qs.set("when", when);
  try {
    return NextResponse.json(await api.get(`/v1/openings?${qs}`));
  } catch (e) {
    const err = e as ApiError;
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
