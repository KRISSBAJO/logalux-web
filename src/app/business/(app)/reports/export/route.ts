import { cookies } from "next/headers";
import { MERCHANT_COOKIE } from "@/lib/merchant-api";

// Downloads the sales of a report range as a CSV file, one row per sale.
// The session cookie only travels to /business paths, so this handler lives
// here and attaches the token itself.
const BASE = process.env.LOGALUXE_API_URL ?? "http://127.0.0.1:18080";

export async function GET(req: Request) {
  const token = (await cookies()).get(MERCHANT_COOKIE)?.value;
  if (!token) return new Response("Sign in first.", { status: 401 });
  const q = new URL(req.url).searchParams;
  const pass = new URLSearchParams();
  for (const k of ["range"]) if (q.get(k)) pass.set(k, q.get(k)!);

  let res: Response;
  try {
    res = await fetch(`${BASE}/v1/m/reports/export?${pass}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
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
      "Content-Disposition": res.headers.get("Content-Disposition") ?? 'attachment; filename="sales.csv"',
      "Cache-Control": "no-store",
    },
  });
}
