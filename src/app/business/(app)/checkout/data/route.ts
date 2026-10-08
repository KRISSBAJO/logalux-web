import { mFetch, MerchantApiError, qs, type Row } from "@/lib/merchant-api";

// What the ticket asks for while it is being built: a client search, what a
// client holds, the price of a service right now, and whether a pay link was paid. The session cookie only
// travels to /business paths, so the browser asks here and this asks the API.
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const kind = p.get("kind");
  try {
    if (kind === "clients") {
      const out = await mFetch<Row>("/clients" + qs({ q: p.get("q") ?? "", sort: "name" }));
      const clients = ((out.clients ?? []) as Row[]).slice(0, 8).map((c) => ({ id: c.id, name: c.name, phone: c.phone ?? "", email: c.email ?? "" }));
      return Response.json({ clients, total: out.total ?? clients.length });
    }
    if (kind === "plans") return Response.json(await mFetch(`/clients/${encodeURIComponent(p.get("client") ?? "")}/plans`));
    if (kind === "price") return Response.json(await mFetch("/price-check" + qs({ service: p.get("service") ?? "", staff: p.get("staff") ?? "" })));
    if (kind === "payment") return Response.json(await mFetch(`/payments/${encodeURIComponent(p.get("ref") ?? "")}`));
    return Response.json({ error: "Unknown request." }, { status: 400 });
  } catch (e) {
    const err = e as MerchantApiError;
    return Response.json({ error: err.message || "Something went wrong." }, { status: err.status ?? 500 });
  }
}
