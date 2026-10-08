import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/admin-api";

// Streams one identity document from the API to signed-in staff. The session
// cookie only travels to /admin paths, so this handler lives there and
// attaches the token itself. The API writes each look to the audit log.
const BASE = process.env.LOGALUXE_API_URL ?? "http://127.0.0.1:18080";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIVATE = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

const say = (message: string, status: number) => new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8", ...PRIVATE } });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return say("Sign in to the console first.", 401);
  if (!UUID.test(id)) return say("Document not found.", 404);

  let res: Response;
  try {
    res = await fetch(`${BASE}/v1/admin/verification-documents/${id}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  } catch {
    return say("The API is not reachable.", 503);
  }
  if (!res.ok || !res.body) {
    const message = (await res.json().catch(() => ({}))).error ?? "The document could not be opened.";
    return say(String(message), res.ok ? 502 : res.status);
  }
  return new Response(res.body, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/octet-stream",
      "Content-Disposition": res.headers.get("Content-Disposition") ?? "inline",
      ...PRIVATE,
    },
  });
}
