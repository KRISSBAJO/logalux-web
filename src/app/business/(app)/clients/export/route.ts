import { cookies } from "next/headers";
import { MERCHANT_COOKIE } from "@/lib/merchant-api";

// Streams the client list as a CSV. The session cookie only travels to
// /business paths, so this handler lives there and attaches the token itself.
const BASE = process.env.LOGALUXE_API_URL ?? "http://127.0.0.1:18080";

export async function GET() {
  const token = (await cookies()).get(MERCHANT_COOKIE)?.value;
  if (!token) return new Response("Sign in first.", { status: 401 });

  let res: Response;
  try {
    res = await fetch(`${BASE}/v1/m/clients/export`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  } catch {
    return new Response("The service is not reachable. Try again in a moment.", { status: 503 });
  }
  if (!res.ok || !res.body) {
    const message = (await res.json().catch(() => ({}))).error ?? "The export failed.";
    return new Response(message, { status: res.status });
  }
  return new Response(res.body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": res.headers.get("Content-Disposition") ?? `attachment; filename="clients.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
