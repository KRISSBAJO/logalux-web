"use server";

import { redirect } from "next/navigation";
import { adminFetch } from "@/lib/admin-api";
import { backTo, cents, id, int, list, on, post, put, run, str } from "@/lib/action-helpers";

// Creating and editing businesses, their locations, services and team, and shop products.

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function businessBody(fd: FormData) {
  return {
    name: str(fd, "name"), category: str(fd, "category"), owner_name: str(fd, "owner_name"), tagline: str(fd, "tagline"), about: str(fd, "about"),
    phone: str(fd, "phone"), email: str(fd, "email"), instagram: str(fd, "instagram"), timezone: str(fd, "timezone"), tone: str(fd, "tone"), highlights: list(fd, "highlights"),
  };
}

export async function createBusiness(fd: FormData) {
  let newId = "", error = "";
  try {
    const out = await adminFetch<{ id: string }>("/businesses", {
      method: "POST",
      body: { ...businessBody(fd), slug: str(fd, "slug"), market: str(fd, "market"), address: str(fd, "address"), city: str(fd, "city"), region: str(fd, "region") },
    });
    newId = out.id;
  } catch (e) {
    error = (e as Error).message;
  }
  if (error) return backTo(fd, "err", error);
  redirect(`/admin/businesses/${newId}/edit?ok=${encodeURIComponent("Business created. It is in the verification queue. Add its services and team here.")}`);
}

export async function saveBusinessProfile(fd: FormData) {
  await run(fd, "Profile saved.", () => put(`/businesses/${id(fd)}/profile`, businessBody(fd)));
}

export async function saveLocation(fd: FormData) {
  const hours: Record<string, string[]> = {};
  for (const d of DAYS) if (on(fd, `${d}_open`)) hours[d] = [str(fd, `${d}_from`), str(fd, `${d}_to`)];
  const lat = str(fd, "lat"), lng = str(fd, "lng");
  const body: Record<string, unknown> = { name: str(fd, "name"), address: str(fd, "address"), city: str(fd, "city"), region: str(fd, "region"), arrival_notes: str(fd, "arrival_notes"), hours };
  // Both empty: the API finds the position from the address.
  if (lat !== "" || lng !== "") { body.lat = lat === "" ? null : Number(lat); body.lng = lng === "" ? null : Number(lng); }
  let message = "", error = "";
  try {
    const out = await adminFetch<{ position: string }>(`/locations/${id(fd)}`, { method: "PUT", body });
    message = "Location and hours saved." + (out.position === "found from the address" ? " The map pin was placed from the address." : out.position === "not found" ? " We could not find that address on the map, so there is no pin yet. Check the address, or enter the position by hand." : "");
  } catch (e) {
    error = (e as Error).message;
  }
  return error ? backTo(fd, "err", error) : backTo(fd, "ok", message);
}

function serviceBody(fd: FormData) {
  return {
    name: str(fd, "name"), category: str(fd, "category"), description: str(fd, "description"), duration_min: int(fd, "duration_min"), processing_min: int(fd, "processing_min"),
    buffer_min: int(fd, "buffer_min"), price_cents: cents(fd, "price"), deposit_cents: cents(fd, "deposit"), online: on(fd, "online"), staff_ids: fd.getAll("staff_ids").map(String),
  };
}
export async function createService(fd: FormData) {
  await run(fd, "Service added.", () => post(`/businesses/${id(fd)}/services`, serviceBody(fd)));
}
export async function saveService(fd: FormData) {
  await run(fd, "Service saved.", () => put(`/services/${id(fd)}`, serviceBody(fd)));
}
export async function removeService(fd: FormData) {
  let message = "", error = "";
  try {
    const out = await adminFetch<{ retired: boolean }>(`/services/${id(fd)}`, { method: "DELETE" });
    message = out.retired ? "This service has bookings on record, so it was taken off the menu instead of deleted." : "Service deleted.";
  } catch (e) {
    error = (e as Error).message;
  }
  return error ? backTo(fd, "err", error) : backTo(fd, "ok", message);
}

function staffBody(fd: FormData) {
  return { name: str(fd, "name"), role: str(fd, "role"), level: str(fd, "level"), tone: str(fd, "tone"), bookable: on(fd, "bookable") };
}
export async function createStaff(fd: FormData) {
  await run(fd, "Team member added. They can do every service until you change that on each service.", () => post(`/businesses/${id(fd)}/staff`, staffBody(fd)));
}
export async function saveStaff(fd: FormData) {
  await run(fd, "Team member saved.", () => put(`/staff/${id(fd)}`, staffBody(fd)));
}
export async function removeStaff(fd: FormData) {
  let message = "", error = "";
  try {
    const out = await adminFetch<{ retired: boolean }>(`/staff/${id(fd)}`, { method: "DELETE" });
    message = out.retired ? "This person has bookings on record, so they were made unbookable instead of deleted." : "Team member removed.";
  } catch (e) {
    error = (e as Error).message;
  }
  return error ? backTo(fd, "err", error) : backTo(fd, "ok", message);
}

function productBody(fd: FormData) {
  const sizes = str(fd, "sizes").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const i = l.lastIndexOf("=");
    return { label: (i < 0 ? l : l.slice(0, i)).trim(), price_cents: i < 0 ? 0 : Math.round((parseFloat(l.slice(i + 1)) || 0) * 100) };
  });
  const compare = str(fd, "compare");
  return {
    name: str(fd, "name"), seller_name: str(fd, "seller_name"), business_slug: str(fd, "business_slug"), category: str(fd, "category"), description: str(fd, "description"),
    how_to_use: str(fd, "how_to_use"), price_cents: cents(fd, "price"), compare_cents: compare === "" ? null : cents(fd, "compare"), stock: int(fd, "stock"), tone: str(fd, "tone"),
    tags: list(fd, "tags"), pickup: on(fd, "pickup"), shipping: on(fd, "shipping"), shipping_cents: cents(fd, "shipping_price"), sizes,
  };
}
export async function createProduct(fd: FormData) {
  let slug = "", error = "";
  try {
    slug = (await adminFetch<{ slug: string }>("/products", { method: "POST", body: { ...productBody(fd), slug: str(fd, "slug") } })).slug;
  } catch (e) {
    error = (e as Error).message;
  }
  if (error) return backTo(fd, "err", error);
  redirect(`/admin/products/${slug}?ok=${encodeURIComponent("Product created and on sale. Add its photos below.")}`);
}
export async function saveProduct(fd: FormData) {
  await run(fd, "Product saved.", () => put(`/products/${id(fd)}`, productBody(fd)));
}
