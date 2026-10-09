// Storage contains opaque hashes and random IDs only, never ticket/contact data.
export type CheckoutRequest = { key: string; id: string };
const flights = new Map<string, Promise<CheckoutRequest>>();
const idPattern = /^[A-Za-z0-9_-]{20,80}$/;
async function digest(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((n) => n.toString(16).padStart(2, "0")).join("");
}
async function prefix(business: string, merchant: string, customer: string) {
  return "lx_checkout." + await digest([business, merchant, customer]) + ".";
}
export async function checkoutRequest(fd: FormData, business: string, merchant: string, customer: string): Promise<CheckoutRequest> {
  const fields = [...fd.entries()].filter(([k]) => !["back", "request_id", "replay_only", "business_scope", "merchant_scope"].includes(k)).sort(([a], [b]) => a.localeCompare(b));
  const key = await prefix(business, merchant, customer) + await digest(fields);
  let flight = flights.get(key);
  if (!flight) {
    const reserve = () => {
      const saved = localStorage.getItem(key);
      if (saved && !idPattern.test(saved)) throw new Error("The saved checkout request is invalid.");
      const id = saved || crypto.randomUUID();
      localStorage.setItem(key, id); // Must succeed before the server action is invoked.
      return { key, id };
    };
    // Coordinate independent tabs as well as simultaneous clicks in this tab.
    flight = typeof navigator !== "undefined" && navigator.locks
      ? navigator.locks.request(key, reserve)
      : Promise.resolve().then(reserve);
    flights.set(key, flight);
  }
  try { return await flight; }
  catch { flights.delete(key); throw new Error("This browser could not save a safe checkout request. Check its storage permissions before trying again."); }
}
export async function pendingCheckouts(business: string, merchant: string, customer: string): Promise<CheckoutRequest[]> {
  const start = await prefix(business, merchant, customer), pending: CheckoutRequest[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(start)) continue;
    const id = localStorage.getItem(key);
    if (id && idPattern.test(id)) pending.push({ key, id });
  }
  return pending;
}
export function completeCheckout(request: CheckoutRequest) {
  try { if (localStorage.getItem(request.key) === request.id) localStorage.removeItem(request.key); } catch {}
  flights.delete(request.key);
}
