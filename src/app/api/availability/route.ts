import { NextRequest, NextResponse } from "next/server";
import { api, ApiError } from "@/lib/api";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const slug = p.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
  const qs = new URLSearchParams({ date: p.get("date") ?? "", services: p.get("services") ?? "", staff: p.get("staff") ?? "any" });
  try {
    return NextResponse.json(await api.get(`/v1/businesses/${slug}/availability?${qs}`));
  } catch (e) {
    const err = e as ApiError;
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
