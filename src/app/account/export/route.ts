import { customerApi, CustomerApiError } from "@/lib/customer";

export async function GET() {
  try {
    const data = await customerApi("/auth/export");
    return Response.json(data, { headers: { "Content-Disposition": 'attachment; filename="logaluxe-account.json"', "Cache-Control": "no-store" } });
  } catch(e) {
    const status = e instanceof CustomerApiError ? e.status : 503;
    return Response.json({ error: "Your download could not be prepared. Return to Details and password and try again." }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
