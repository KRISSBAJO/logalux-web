import { NextRequest, NextResponse } from "next/server";
import { CustomerApiError, customerApi } from "@/lib/customer";

// Books the same visit again every so many weeks, for the signed-in customer whose booking it is.
// The API answers with what it booked and what it could not, each with its reason.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json(await customerApi(`/auth/bookings/${encodeURIComponent(id)}/repeat`, { method: "POST", body: { every_weeks: Number(body.every_weeks), times: Number(body.times) } }), { status: 201 });
  } catch (e) {
    const err = e as CustomerApiError;
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
