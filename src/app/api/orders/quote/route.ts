import { NextRequest, NextResponse } from "next/server";
import { CustomerApiError, customerApi } from "@/lib/customer";

// What an order would come to, worked out by the API: tax by seller and state, the promo code,
// the gift card and the signed-in customer's store credit. It takes the same body as placing
// the order and changes nothing. The cart asks before the name and the street are typed, so
// those two are filled in here: they do not change any amount.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    if (!String(body.customer_name ?? "").trim()) body.customer_name = "Quote";
    const address = body.address as Record<string, unknown> | null | undefined;
    if (address && !String(address.line1 ?? "").trim()) address.line1 = "-";
    return NextResponse.json(await customerApi("/orders/quote", { method: "POST", body }));
  } catch (e) {
    const err = e as CustomerApiError;
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
