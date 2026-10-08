import { NextRequest, NextResponse } from "next/server";
import { api, ApiError } from "@/lib/api";

// Lets the cart and the booking form show what a promo code or gift card is
// worth before paying. The order and booking endpoints check again themselves.
export async function POST(req: NextRequest) {
  try {
    return NextResponse.json(await api.post("/v1/checkout/check", await req.json()));
  } catch (e) {
    const err = e as ApiError;
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
