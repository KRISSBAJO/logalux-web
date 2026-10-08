import { NextRequest, NextResponse } from "next/server";
import { visitorHeaders } from "@/lib/visitor";

const BASE = process.env.LOGALUXE_API_URL ?? "http://127.0.0.1:18080";

async function pass(path: string, init?: RequestInit) {
  try {
    const res = await fetch(`${BASE}${path}`, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...(await visitorHeaders()) } });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  } catch {
    return NextResponse.json({ error: "We could not reach the place search just now." }, { status: 502 });
  }
}

// What the place picker and the address forms ask for, passed on to the API:
//   GET  /api/places/search?q=&lookup=1   places matching some text
//   GET  /api/places/reverse?lat=&lng=    the place a point is in ("Near me")
//   POST /api/places/locate               where an address lands on the map
export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const p = req.nextUrl.searchParams;
  if (kind === "search") {
    const q = new URLSearchParams({ q: (p.get("q") ?? "").slice(0, 80) });
    if (p.get("lookup") === "1") q.set("lookup", "1");
    if (p.get("country")) q.set("country", (p.get("country") ?? "").slice(0, 2));
    return pass(`/v1/places/search?${q}`);
  }
  if (kind === "reverse") {
    const lat = Number(p.get("lat")), lng = Number(p.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || p.get("lat") === null || p.get("lng") === null) return NextResponse.json({ error: "A position is needed." }, { status: 400 });
    return pass(`/v1/places/reverse?${new URLSearchParams({ lat: lat.toFixed(3), lng: lng.toFixed(3) })}`);
  }
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  if ((await params).kind !== "locate") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const text = (k: string, max: number) => String(b[k] ?? "").slice(0, max);
  const num = (k: string) => (typeof b[k] === "number" && Number.isFinite(b[k]) ? (b[k] as number) : undefined);
  return pass("/v1/places/locate", { method: "POST", body: JSON.stringify({ address: text("address", 200), city: text("city", 80), region: text("region", 80), country: text("country", 20), lat: num("lat"), lng: num("lng") }) });
}
