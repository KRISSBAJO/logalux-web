import { NextRequest, NextResponse } from "next/server";
import { CustomerApiError, customerApi, userToken } from "@/lib/customer";

// Saves a product to the signed-in customer's list (PUT) or takes it off (DELETE).
// A guest gets 401, and the button sends them to sign in.
async function set(method: "PUT" | "DELETE", slug: string) {
  if (!/^[a-z0-9][a-z0-9-]{0,80}$/i.test(slug)) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  if (!(await userToken())) return NextResponse.json({ error: "Sign in to save products." }, { status: 401 });
  try {
    const out = await customerApi<{ saved: boolean }>(`/auth/favourite-products/${encodeURIComponent(slug)}`, { method });
    return NextResponse.json({ saved: !!out.saved });
  } catch (e) {
    const err = e as CustomerApiError;
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

export async function PUT(_: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  return set("PUT", (await params).slug);
}
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  return set("DELETE", (await params).slug);
}
