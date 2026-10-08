// Serves an uploaded site image from the same origin as the site. The API
// reads it from the private bucket; browsers and CDNs can cache it for good,
// because a replaced image always gets a new id.
const BASE = process.env.LOGALUXE_API_URL ?? "http://127.0.0.1:18080";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });
  let res: Response;
  try {
    res = await fetch(`${BASE}/v1/media/${id}`, { cache: "no-store" });
  } catch {
    return new Response("Image service unavailable", { status: 503 });
  }
  if (!res.ok || !res.body) return new Response("Not found", { status: res.status === 404 ? 404 : 502 });
  return new Response(res.body, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
