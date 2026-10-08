// Hands the browser a calendar file for one booking. The API writes it; this
// only passes it through, because the browser cannot call the API itself.
const BASE = process.env.LOGALUXE_API_URL ?? "http://127.0.0.1:18080";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new Response("Booking not found", { status: 404 });
  let res: Response;
  try {
    res = await fetch(`${BASE}/v1/bookings/${id}/calendar.ics`, { cache: "no-store" });
  } catch {
    return new Response("The calendar file is not available right now. Try again in a moment.", { status: 503 });
  }
  if (!res.ok || !res.body) return new Response("Booking not found", { status: res.status === 404 ? 404 : 502 });
  return new Response(res.body, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "text/calendar; charset=utf-8",
      "Content-Disposition": res.headers.get("Content-Disposition") ?? 'attachment; filename="logaluxe-booking.ics"',
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
