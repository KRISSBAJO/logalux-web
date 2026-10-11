import { NextRequest, NextResponse } from "next/server";
import { customerApi, CustomerApiError } from "@/lib/customer";

export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (!["send", "verify", "pin"].includes(action)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    return NextResponse.json(await customerApi(`/auth/security/${action}`, { method: "POST", body: await req.json() }));
  } catch (e) {
    const err = e as CustomerApiError;
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (action !== "status") return NextResponse.json({ error: "Not found" }, { status: 404 });
  try { return NextResponse.json(await customerApi("/auth/security/status"), { headers: { "Cache-Control": "no-store" } }); }
  catch (e) { const err = e as CustomerApiError; return NextResponse.json({ error: err.message }, { status: err.status ?? 500 }); }
}
