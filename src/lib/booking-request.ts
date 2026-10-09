// Keep only an opaque request ID in browser storage, never contact or booking details.
// A lost response keeps the ID; the API safely replays the same booking on retry.
const pending = new Map<string, Promise<string>>();
export async function sendBookingRequest<T extends { booking?: { id: string } }>(body: Record<string, unknown>, owner = "guest"): Promise<{res: Response; data: T}> {
 const bytes = new TextEncoder().encode(JSON.stringify([owner,body]));
 const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(n=>n.toString(16).padStart(2,"0")).join("");
 const key = "lx_booking."+hash;
 let saved = pending.get(key);
 if(!saved) { saved = Promise.resolve().then(()=>{ const existing=localStorage.getItem(key); if(existing)return existing; const id=crypto.randomUUID(); localStorage.setItem(key,id); return id; }); pending.set(key,saved); }
 let id: string;
 try {id = await saved;} catch { pending.delete(key); throw new Error("This browser could not save a safe booking request. Check its storage permissions before trying again."); }
 const res = await fetch("/api/bookings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...body,request_id:id}),signal:AbortSignal.timeout(25000)});
 const data = await res.json() as T;
 if(res.ok && data.booking?.id) { try {if(localStorage.getItem(key)===id)localStorage.removeItem(key);} catch {} pending.delete(key); }
 return {res,data};
}
