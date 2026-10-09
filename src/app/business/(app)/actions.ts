"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MERCHANT_COOKIE, mFetch } from "@/lib/merchant-api";
import { mPost, mPut, mRun, str } from "@/lib/merchant-actions";

// Actions used across the merchant web: the session, and the booking steps
// that Home, Calendar and Checkout all share.

export async function signOutMerchant() {
  try {
    await mFetch("/logout", { method: "POST", body: {} });
  } catch {}
  (await cookies()).delete({ name: MERCHANT_COOKIE, path: "/" });
  (await cookies()).delete({ name: "lx_merchant", path: "/business" });
  redirect("/business/signin");
}

export async function switchBusiness(fd: FormData) {
  let error = "";
  try {
    await mPost("/switch", { business_id: str(fd, "business_id") });
  } catch (e) { error = (e as Error).message || "The business could not be switched. Please try again."; }
  if (error) redirect("/business?err=" + encodeURIComponent(error));
  redirect("/business");
}

const DONE: Record<string, string> = {
  confirm: "Booking confirmed.", check_in: "Checked in.", start: "Service started.", complete: "Finished. It is waiting at checkout.",
  no_show: "Marked as a no-show.", cancel: "Booking cancelled.", reschedule: "Booking moved.",
};

/** One step in the life of a booking: confirm, check in, start, complete, no-show, cancel or move. */
export async function bookingAction(fd: FormData) {
  const action = str(fd, "action");
  const body: Record<string, string> = { action };
  if (action === "cancel" || action === "no_show") body.reason = str(fd, "reason");
  if (action === "reschedule") {
    body.starts_at = str(fd, "starts_at") || `${str(fd, "date")}T${str(fd, "time")}`;
    if (str(fd, "staff_id")) body.staff_id = str(fd, "staff_id");
  }
  await mRun(fd, DONE[action] ?? "Saved.", () => mPost(`/bookings/${encodeURIComponent(str(fd, "id"))}/action`, body));
}

export async function waitlistUpdate(fd: FormData) {
  const status = str(fd, "status");
  await mRun(fd, status === "offered" ? "Marked as offered." : status === "booked" ? "Marked as booked." : "Removed from the waitlist.", () => mPut(`/waitlist/${encodeURIComponent(str(fd, "id"))}`, { status }));
}

export async function timeOffDecide(fd: FormData) {
  const decision = str(fd, "decision");
  await mRun(fd, decision === "approve" ? "Time off approved." : decision === "decline" ? "Time off declined." : "Time off removed.", () => mPost(`/time-off/${encodeURIComponent(str(fd, "id"))}`, { decision }));
}

export async function useAsCustomer() {
  const { USER_COOKIE, cookieOptions, userToken } = await import("@/lib/customer");
  const token = await userToken();
  let error = "";
  try {
    const out = await mFetch<{token:string; expires_in:number}>("/customer-profile", {method:"POST",body:{},headers:token ? {"X-Customer-Token":token} : {}});
    (await cookies()).set(USER_COOKIE,out.token,cookieOptions(out.expires_in));
  } catch(e) { error=(e as Error).message; }
  if(error) redirect("/business/customer?err="+encodeURIComponent(error));
  redirect("/account");
}
