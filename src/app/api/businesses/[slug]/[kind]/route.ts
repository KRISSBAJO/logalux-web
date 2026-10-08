import { NextRequest, NextResponse } from "next/server";
import { api, ApiError } from "@/lib/api";

// The public, read-only questions a business page asks from the browser:
// its next free times, which days of a month have room, the free times of
// one day, and its reviews a page at a time. Only the parameters each one
// understands are passed on.
const PASS: Record<string, string[]> = {
  openings: ["services", "staff", "limit"],
  days: ["month", "services", "staff"],
  availability: ["date", "services", "staff"],
  reviews: ["page", "stars"],
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string; kind: string }> }) {
  const { slug, kind } = await params;
  const allowed = PASS[kind];
  if (!allowed || !/^[a-z0-9][a-z0-9-]*$/i.test(slug)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const qs = new URLSearchParams();
  for (const k of allowed) {
    const v = req.nextUrl.searchParams.get(k);
    if (v) qs.set(k, v);
  }
  try {
    return NextResponse.json(await api.get(`/v1/businesses/${encodeURIComponent(slug)}/${kind}?${qs}`));
  } catch (e) {
    const err = e as ApiError;
    return NextResponse.json({ error: err.message || "We could not reach the service. Try again in a moment." }, { status: err.status ?? 502 });
  }
}
