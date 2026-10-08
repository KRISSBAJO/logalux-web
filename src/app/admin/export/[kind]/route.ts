import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/admin-api";

// Streams a CSV download from the API. The session cookie only travels to
// /admin paths, so this handler lives there and attaches the token itself.
const BASE = process.env.LOGALUXE_API_URL ?? "http://127.0.0.1:18080";
const KINDS = new Set(["bookings", "orders", "payouts", "clients", "businesses", "products", "audit", "gift-cards"]);

export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!KINDS.has(kind)) return new Response("Unknown export", { status: 404 });
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return new Response("Sign in to the console first.", { status: 401 });

  let res: Response;
  try {
    res = await fetch(`${BASE}/v1/admin/export/${kind}${new URL(req.url).search}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  } catch {
    return new Response("The API is not reachable.", { status: 503 });
  }
  if (!res.ok || !res.body) {
    const message = (await res.json().catch(() => ({}))).error ?? "The export failed.";
    return new Response(message, { status: res.status });
  }
  return new Response(res.body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": res.headers.get("Content-Disposition") ?? `attachment; filename="logaluxe-${kind}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
