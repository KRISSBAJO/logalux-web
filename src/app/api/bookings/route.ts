import { NextRequest, NextResponse } from "next/server";
import { cardFields } from "@/lib/cards";
import { CustomerApiError, customerApi } from "@/lib/customer";

// Forwards to the API. When the visitor is signed in, their session token goes
// along, so the result is saved to their account. A guest works the same way.
// The two saved-card fields go along only for a signed-in customer while saved cards are switched on.
export async function POST(req: NextRequest) {
  try {
    return NextResponse.json(await customerApi("/bookings", { method: "POST", body: await cardFields(await req.json()) }), { status: 201 });
  } catch (e) {
    const err = e as CustomerApiError;
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
