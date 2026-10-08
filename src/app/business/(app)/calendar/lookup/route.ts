import { mFetch, qs } from "@/lib/merchant-api";

// Lookups the booking forms make while someone is typing: open slots for a
// day, and clients by name or phone. The session cookie never leaves the server.
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  try {
    if (p.get("kind") === "clients") {
      const q = (p.get("q") ?? "").trim();
      if (q.length < 2) return Response.json({ clients: [] });
      const out = await mFetch<{ clients: { id: string; name: string; phone: string; email: string }[] }>("/clients" + qs({ q }));
      return Response.json({ clients: out.clients.slice(0, 6).map((c) => ({ id: c.id, name: c.name, phone: c.phone, email: c.email })) });
    }
    const out = await mFetch("/availability" + qs({ date: p.get("date"), services: p.get("services"), staff: p.get("staff") || "any", exclude: p.get("exclude") }));
    return Response.json(out, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const err = e as Error & { status?: number };
    return Response.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
