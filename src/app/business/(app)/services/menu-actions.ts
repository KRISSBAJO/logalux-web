"use server";

import { mFetch, type Row } from "@/lib/merchant-api";
import { cents, fid, int, mDel, mPost, mPut, mRun, num, on, str } from "@/lib/merchant-actions";

// The rest of the menu: a pasted price list, pricing rules, packages,
// memberships, who holds them, and the rooms and chairs services need.

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const amount = (text: string) => Math.round((parseFloat(text.replace(/[^0-9.\-]/g, "")) || 0) * 100);

/** Pasted lines: name, category, minutes, price, deposit. Tabs or commas. A heading line is skipped. */
export async function serviceImport(fd: FormData) {
  const lines = String(fd.get("lines") ?? "").split(/\r?\n/);
  const rows: Record<string, unknown>[] = [], at: number[] = [];
  lines.forEach((line, i) => {
    if (!line.trim()) return;
    const cell = (line.includes("\t") ? line.split("\t") : line.split(",")).map((c) => c.trim());
    if (!rows.length && !/\d/.test(cell[2] ?? "") && /^(name|service)/i.test(cell[0] ?? "")) return; // the heading row
    rows.push({ name: cell[0] ?? "", category: cell[1] ?? "", duration_min: Math.round(parseFloat(cell[2] ?? "") || 0), price_cents: amount(cell[3] ?? ""), deposit_cents: amount(cell[4] ?? "") });
    at.push(i + 1);
  });
  await mRun(fd, (out) => {
    const added = Number(out.added ?? 0);
    // The API numbers the rows it was sent; put back the line numbers of what was pasted.
    const skipped = ((out.skipped ?? []) as string[]).map((s) => s.replace(/^Line (\d+)/, (_, n) => `line ${at[Number(n) - 1] ?? n}`));
    const first = `${added} ${added === 1 ? "service was" : "services were"} added.`;
    if (!skipped.length) return first;
    return `${first} ${skipped.length} ${skipped.length === 1 ? "line was" : "lines were"} skipped: ${skipped.slice(0, 8).join("; ")}${skipped.length > 8 ? `; and ${skipped.length - 8} more` : ""}.`;
  }, () => {
    if (!rows.length) throw new Error("Paste at least one line: name, category, minutes, price, deposit.");
    return mPost("/services/import", { rows });
  });
}

// ---------- pricing rules ----------

function rule(fd: FormData) {
  const percent = str(fd, "adjust_kind") === "percent";
  const size = percent ? Math.round(Math.abs(num(fd, "adjust"))) : Math.abs(cents(fd, "adjust"));
  return {
    name: str(fd, "name"), service_id: str(fd, "service_id"), days: fd.getAll("days").map(String).filter((d) => DAYS.includes(d)),
    from_time: str(fd, "from_time"), to_time: str(fd, "to_time"), level: str(fd, "level"), starts_on: str(fd, "starts_on"), ends_on: str(fd, "ends_on"),
    adjust_kind: percent ? "percent" : "amount", adjust_value: str(fd, "direction") === "less" ? -size : size, active: on(fd, "active"),
  };
}

export async function ruleCreate(fd: FormData) {
  await mRun(fd, "Rule added. It applies to bookings and sales made from now on.", () => mPost("/price-rules", rule(fd)));
}

export async function ruleSave(fd: FormData) {
  await mRun(fd, "Rule saved.", () => mPut(`/price-rules/${fid(fd)}`, rule(fd)));
}

export async function ruleDelete(fd: FormData) {
  await mRun(fd, "Rule deleted.", () => mDel(`/price-rules/${fid(fd)}`));
}

/** Switches one rule on or off and leaves the rest of it as it is. */
export async function ruleToggle(fd: FormData) {
  const id = str(fd, "id");
  let now = false;
  await mRun(fd, () => (now ? "Rule switched on." : "Rule switched off. Prices go back to what they were without it."), async () => {
    const r = (((await mFetch("/menu")).price_rules ?? []) as Row[]).find((x) => x.id === id);
    if (!r) throw new Error("That rule no longer exists.");
    now = !r.active;
    return mPut(`/price-rules/${encodeURIComponent(id)}`, {
      name: r.name, service_id: r.service_id ?? "", days: r.days ?? [], from_time: r.from_time ?? "", to_time: r.to_time ?? "", level: r.level ?? "",
      starts_on: String(r.starts_on ?? "").slice(0, 10), ends_on: String(r.ends_on ?? "").slice(0, 10), adjust_kind: r.adjust_kind, adjust_value: r.adjust_value, active: now,
    });
  });
}

// ---------- packages and memberships ----------

const isPackage = (fd: FormData) => str(fd, "kind") !== "membership";
const pathOf = (fd: FormData) => (isPackage(fd) ? "/packages" : "/memberships");

function plan(fd: FormData) {
  const items: { service_id: string; qty: number }[] = [];
  for (const [k, v] of fd.entries()) if (k.startsWith("qty_") && Math.round(Number(v)) > 0) items.push({ service_id: k.slice(4), qty: Math.round(Number(v)) });
  const base = { name: str(fd, "name"), description: str(fd, "description"), price_cents: cents(fd, "price"), items, active: on(fd, "active") };
  return isPackage(fd) ? { ...base, valid_days: int(fd, "valid_days") } : { ...base, service_discount_pct: int(fd, "service_discount_pct"), retail_discount_pct: int(fd, "retail_discount_pct") };
}

export async function planCreate(fd: FormData) {
  await mRun(fd, isPackage(fd) ? "Package added. Sell it to a client at Checkout." : "Membership added. Sell it to a client at Checkout.", () => mPost(pathOf(fd), plan(fd)));
}

export async function planSave(fd: FormData) {
  await mRun(fd, "Saved. Clients who already hold it keep what they bought.", () => mPut(`${pathOf(fd)}/${fid(fd)}`, plan(fd)));
}

export async function planDelete(fd: FormData) {
  await mRun(fd, (out) => (out.archived ? "A client has held this, so it was switched off instead of deleted. Their record stays whole." : "Deleted."), () => mDel(`${pathOf(fd)}/${fid(fd)}`));
}

/** Puts a plan on or off sale and leaves the rest of it as it is. */
export async function planToggle(fd: FormData) {
  const id = str(fd, "id"), pkg = isPackage(fd);
  let now = false;
  await mRun(fd, () => (now ? "Back on sale at Checkout." : "Taken off sale. Clients who hold it keep it."), async () => {
    const menu = await mFetch("/menu");
    const p = ((pkg ? menu.packages : menu.memberships) ?? [] as Row[]).find((x: Row) => x.id === id);
    if (!p) throw new Error("That no longer exists.");
    now = !p.active;
    const base = { name: p.name, description: p.description, price_cents: p.price_cents, items: ((p.items ?? []) as Row[]).map((i) => ({ service_id: i.service_id, qty: i.qty })), active: now };
    return mPut(`${pathOf(fd)}/${encodeURIComponent(id)}`, pkg ? { ...base, valid_days: p.valid_days } : { ...base, service_discount_pct: p.service_discount_pct, retail_discount_pct: p.retail_discount_pct });
  });
}

export async function holderCancel(fd: FormData) {
  await mRun(fd, isPackage(fd) ? "Package ended. What was left on it can no longer be used." : "Membership cancelled. It will not renew.", () => mPost(`/client-plans/${fid(fd)}`, { action: "cancel" }));
}

export async function holderReactivate(fd: FormData) {
  await mRun(fd, "Active again.", () => mPost(`/client-plans/${fid(fd)}`, { action: "reactivate" }));
}

// ---------- rooms, chairs and stations ----------

export async function resourceCreate(fd: FormData) {
  await mRun(fd, "Added. Tick it under Requires on each service that needs it.", () => mPost("/resources", { name: str(fd, "name"), qty: int(fd, "qty") }));
}

export async function resourceSave(fd: FormData) {
  await mRun(fd, "Saved.", () => mPut(`/resources/${fid(fd)}`, { name: str(fd, "name"), qty: int(fd, "qty") }));
}

export async function resourceDelete(fd: FormData) {
  await mRun(fd, "Removed. Services that needed it no longer wait for it.", () => mDel(`/resources/${fid(fd)}`));
}
