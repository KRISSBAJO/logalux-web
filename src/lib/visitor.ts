// Server only. The API limits how often one connection may try to sign in, sign up, book and so on.
// Our server makes those calls for the visitor, so it passes the visitor's own address along;
// otherwise everyone would share one limit. The API believes it only with the shared WEB_API_KEY.
import { headers } from "next/headers";

export async function visitorHeaders(): Promise<Record<string, string>> {
  try {
    const h = await headers();
    const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || (h.get("x-real-ip") ?? "").trim();
    if (!ip) return {};
    return { "X-Visitor-IP": ip, ...(process.env.WEB_API_KEY ? { "X-Web-Key": process.env.WEB_API_KEY } : {}) };
  } catch {
    return {}; // outside a request (a build step, a background job): nothing to pass on
  }
}
