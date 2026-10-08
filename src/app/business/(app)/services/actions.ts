"use server";

import { mFetch, qs, type Row } from "@/lib/merchant-api";
import { cents, fid, int, mPost, mPut, mRun, on, str } from "@/lib/merchant-actions";

// The menu: add and change services, switch them on and off online, and set their order.

/** What the form holds, in the shape the API takes. */
function fromForm(fd: FormData) {
  const staffIds = fd.getAll("staff").map(String).filter(Boolean);
  const staffPrices: Record<string, number | null> = {};
  for (const id of staffIds) staffPrices[id] = str(fd, `price_${id}`) === "" ? null : cents(fd, `price_${id}`);
  return {
    name: str(fd, "name"), category: str(fd, "category"), description: str(fd, "description"),
    duration_min: int(fd, "duration"), processing_min: int(fd, "processing"), buffer_min: int(fd, "buffer"),
    price_cents: cents(fd, "price"), deposit_cents: cents(fd, "deposit"), online: on(fd, "online"),
    staff_ids: staffIds, staff_prices: staffPrices,
  };
}

/** A saved service, in the shape the API takes. Used when only one thing about it changes. */
function fromRow(sv: Row, change: Record<string, unknown>) {
  const staff = (sv.staff ?? []) as Row[];
  return {
    name: sv.name, category: sv.category, description: sv.description,
    duration_min: sv.duration_min, processing_min: sv.processing_min, buffer_min: sv.buffer_min,
    price_cents: sv.price_cents, deposit_cents: sv.deposit_cents, online: sv.online,
    staff_ids: staff.map((x) => x.staff_id), staff_prices: Object.fromEntries(staff.map((x) => [x.staff_id, x.price_cents])),
    ...change,
  };
}

/** Saves which rooms, chairs or stations the service needs, when the form showed them. */
const needs = async (fd: FormData, id: string) => {
  if (id && str(fd, "has_resources")) await mPut(`/services/${encodeURIComponent(id)}/resources`, { ids: fd.getAll("res").map(String).filter(Boolean) });
};

const all = async () => ((await mFetch("/services")).services ?? []) as Row[];

export async function serviceCreate(fd: FormData) {
  await mRun(fd, "Service added.", async () => {
    const out = await mPost("/services", fromForm(fd));
    await needs(fd, String(out.id ?? ""));
    fd.set("back", "/business/services" + qs({ s: String(out.id ?? "") }));
    return out;
  });
}

export async function serviceSave(fd: FormData) {
  await mRun(fd, "Service saved.", async () => {
    const out = await mPut(`/services/${fid(fd)}`, fromForm(fd));
    await needs(fd, str(fd, "id"));
    return out;
  });
}

/** Flips whether clients can book the service online, and leaves everything else as it is. */
export async function serviceOnline(fd: FormData) {
  const id = str(fd, "id");
  let now = false;
  await mRun(fd, () => (now ? "Clients can book it online now." : "Hidden from online booking. You can still book it from the calendar."), async () => {
    const sv = (await all()).find((x) => x.id === id);
    if (!sv) throw new Error("That service is no longer on your menu.");
    now = !sv.online;
    return mPut(`/services/${encodeURIComponent(id)}`, fromRow(sv, { online: now }));
  });
}

const DONE: Record<string, string> = {
  archive: "Service archived. It can no longer be booked.",
  restore: "Service restored. Clients can book it online again.",
  duplicate: "Copy made. It stays hidden online until you switch it on.",
  delete: "Service deleted.",
};

async function act(fd: FormData, action: string) {
  await mRun(fd, DONE[action] ?? "Saved.", async () => {
    const out = await mPost(`/services/${fid(fd)}/action`, { action });
    if (action === "duplicate" && out.id) fd.set("back", "/business/services" + qs({ s: String(out.id) }));
    if (action === "delete") fd.set("back", "/business/services");
    return out;
  });
}

/** Moves a service one place up or down among the services of its own group. */
export async function serviceMove(fd: FormData) {
  const id = str(fd, "id"), up = str(fd, "dir") === "up";
  await mRun(fd, "Order saved.", async () => {
    const ids = (await all()).filter((x) => !x.archived);
    const i = ids.findIndex((x) => x.id === id);
    if (i < 0) throw new Error("That service is no longer on your menu.");
    let j = -1;
    if (up) { for (let k = i - 1; k >= 0; k--) if (ids[k].category === ids[i].category) { j = k; break; } }
    else { for (let k = i + 1; k < ids.length; k++) if (ids[k].category === ids[i].category) { j = k; break; } }
    if (j < 0) throw new Error(up ? "It is already first in its group." : "It is already last in its group.");
    [ids[i], ids[j]] = [ids[j], ids[i]];
    return mPut("/services/order", { ids: ids.map((x) => x.id) });
  });
}

// One action per button: a button that names its own action cannot also carry a value.
export async function serviceDuplicate(fd: FormData) { await act(fd, "duplicate"); }
export async function serviceArchive(fd: FormData) { await act(fd, "archive"); }
export async function serviceRestore(fd: FormData) { await act(fd, "restore"); }
export async function serviceDelete(fd: FormData) { await act(fd, "delete"); }
