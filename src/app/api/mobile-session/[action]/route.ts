import { NextRequest, NextResponse } from "next/server";
import { cookieOptions, customerApi, CustomerApiError, USER_COOKIE } from "@/lib/customer";

export async function POST(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Open this page from the app to continue." }, { status: 403 });
  const { action } = await context.params;
  if (action !== "preview" && action !== "exchange") return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const { code } = await request.json();
    if (typeof code !== "string" || !/^[a-f0-9]{64}$/.test(code)) return NextResponse.json({ error: "Invalid sign-in link." }, { status: 400 });
    const result = await customerApi(`/auth/web-handoff/${action}`, { auth: false, body: { code }, method: "POST" });
    const response = NextResponse.json(action === "preview" ? result : { next: result.next }, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
    if (action === "exchange") response.cookies.set(USER_COOKIE, result.token, cookieOptions(result.expires_in));
    return response;
  } catch (error) {
    const e = error as CustomerApiError;
    return NextResponse.json({ error: e.message || "Could not complete sign-in. Open the shop from the app again." }, { status: e.status || 503, headers: { "Cache-Control": "no-store" } });
  }
}
