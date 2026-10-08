import { cookies } from "next/headers";
import { MERCHANT_COOKIE } from "@/lib/merchant-api";

// The payroll CSV. The session cookie only travels to /business paths, so this
// handler lives there and passes the token on to the API itself.
const BASE = process.env.LOGALUXE_API_URL ?? "http://127.0.0.1:18080";
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const token = (await cookies()).get(MERCHANT_COOKIE)?.value;
  if (!token) return new Response("Sign in first.", { status: 401 });
  const asked = new URL(req.url).searchParams, q = new URLSearchParams({ format: "csv" });
  for (const k of ["from", "to"]) { const v = asked.get(k) ?? ""; if (DAY.test(v)) q.set(k, v); }

  let res: Response;
  try {
    res = await fetch(`${BASE}/v1/m/payroll?${q}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
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
      "Content-Disposition": res.headers.get("Content-Disposition") ?? `attachment; filename="payroll.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
