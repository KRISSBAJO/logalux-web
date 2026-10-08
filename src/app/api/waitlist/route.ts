import { NextRequest, NextResponse } from "next/server";
import { customerApi, CustomerApiError as ApiError } from "@/lib/customer";

// A client asks to be told if a time opens on a full day.
export async function POST(req: NextRequest) {
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 400 });
  }
  const s = (v: unknown) => String(v ?? "").trim().slice(0, 200);
  const body = {
    business_slug: s(b.business_slug), client_name: s(b.client_name), client_phone: s(b.client_phone),
    dates: Array.isArray(b.dates) ? b.dates.map(s).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0, 7) : [],
    time_of_day: s(b.time_of_day),
  };
  if (!body.client_name) return NextResponse.json({ error: "Add your name." }, { status: 400 });
  if (!body.client_phone) return NextResponse.json({ error: "Add a mobile number so the business can reach you." }, { status: 400 });
  try {
    return NextResponse.json(await customerApi("/waitlist", { method: "POST", auth: false, body }), { status: 201 });
  } catch (e) {
    const err = e as ApiError;
    return NextResponse.json({ error: err.message || "We could not reach the service. Try again in a moment." }, { status: err.status ?? 502 });
  }
}
