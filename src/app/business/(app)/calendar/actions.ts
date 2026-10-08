"use server";

import { mDel, mPost, mRun, str } from "@/lib/merchant-actions";

export async function createBooking(fd: FormData) {
  await mRun(fd, "Booked. It is on the calendar.", () => mPost("/bookings", {
    client_id: str(fd, "client_id"), client_name: str(fd, "client_name"), client_phone: str(fd, "client_phone"),
    staff_id: str(fd, "staff_id"), starts_at: str(fd, "starts_at"), service_ids: fd.getAll("service_ids").map(String),
    notes: str(fd, "notes"), source: str(fd, "source"),
  }));
}

/** Blocks out part of a day for one person: lunch, training, a break. */
export async function createBlock(fd: FormData) {
  const day = str(fd, "date");
  await mRun(fd, "Time blocked. Clients cannot book it.", () => mPost("/blocks", {
    staff_id: str(fd, "staff_id"), starts_at: `${day}T${str(fd, "from")}`, ends_at: `${day}T${str(fd, "to")}`, reason: str(fd, "reason"),
  }));
}

export async function deleteBlock(fd: FormData) {
  await mRun(fd, "Block removed. The time is open again.", () => mDel(`/blocks/${encodeURIComponent(str(fd, "id"))}`));
}
