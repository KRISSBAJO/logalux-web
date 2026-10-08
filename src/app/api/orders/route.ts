import { NextRequest, NextResponse } from "next/server";
import { CustomerApiError, customerApi } from "@/lib/customer";

// Forwards to the API. When the visitor is signed in, their session token goes
// along, so the result is saved to their account. A guest works the same way.
export async function POST(req: NextRequest) {
  try {
    return NextResponse.json(await customerApi("/orders", { method: "POST", body: await req.json() }), { status: 201 });
  } catch (e) {
    const err = e as CustomerApiError;
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
