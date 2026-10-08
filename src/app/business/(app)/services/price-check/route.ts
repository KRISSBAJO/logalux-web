import { mFetch, qs } from "@/lib/merchant-api";

// What one service costs with one person at one time. The price checker on the
// pricing rules view asks here, so the session cookie never leaves the server.
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  try {
    const out = await mFetch("/price-check" + qs({ service: p.get("service"), staff: p.get("staff"), at: p.get("at") }));
    return Response.json(out, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const err = e as Error & { status?: number };
    return Response.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
