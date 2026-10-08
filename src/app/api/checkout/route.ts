import { NextRequest, NextResponse } from "next/server";
import { customerApi, CustomerApiError as ApiError } from "@/lib/customer";

// Lets the cart and the booking form show what a promo code or gift card is
// worth before paying. The order and booking endpoints check again themselves.
export async function POST(req: NextRequest) {
  try {
    return NextResponse.json(await customerApi("/checkout/check", { method: "POST", auth: false, body: await req.json() }));
  } catch (e) {
    const err = e as ApiError;
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
