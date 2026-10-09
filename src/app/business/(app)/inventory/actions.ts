"use server";

import { getMe, mUpload } from "@/lib/merchant-api";
import { cents, fid, int, mBackTo, mDel, mPost, mPut, mRun, on, str } from "@/lib/merchant-actions";
import { money } from "@/lib/merchant-format";
import { policyFromChoices, sentence } from "../shop-policy";

// Stock: products, what is on the shelf, suppliers, and orders to them.

function product(fd: FormData) {
  const kind = str(fd, "kind") || "retail";
  return {
    // A full shelf is optional: left empty, the level that is saved stays.
    ...(str(fd, "par_level") === "" ? {} : { par_level: Math.max(0, int(fd, "par_level")) }),
    name: str(fd, "name"), sku: str(fd, "sku"), kind, category: str(fd, "category") || "hair", description: str(fd, "description"),
    price_cents: kind === "backbar" ? 0 : cents(fd, "price"), cost_cents: cents(fd, "cost"), reorder_at: int(fd, "reorder_at"),
    supplier_id: str(fd, "supplier_id"), online: kind !== "backbar" && on(fd, "online"),
    // Shipping only travels when the form offered it; an empty charge keeps what is saved.
    ...(fd.has("shipping_set") ? { shipping: on(fd, "shipping") } : {}),
    ...(str(fd, "shipping_charge") === "" ? {} : { shipping_cents: cents(fd, "shipping_charge") }),
  };
}

const backWith = (fd: FormData, set: Record<string, string>, drop: string[] = []) => {
  const url = new URL(str(fd, "back") || "/business/inventory", "http://merchant");
  for (const k of drop) url.searchParams.delete(k);
  for (const [k, v] of Object.entries(set)) url.searchParams.set(k, v);
  fd.set("back", url.pathname + url.search);
};

export async function productCreate(fd: FormData) {
  await mRun(fd, "Product added.", async () => {
    const out = await mPost("/products", { ...product(fd), stock: Math.max(0, int(fd, "stock")) });
    backWith(fd, { sel: String(out.id ?? "") }, ["new", "q", "filter"]);
    return out;
  });
}

export async function productSave(fd: FormData) {
  await mRun(fd, "Product saved.", () => mPut(`/products/${fid(fd)}`, product(fd)));
}

const STOCK_DONE: Record<string, string> = { restock: "Delivery added.", backbar: "Use recorded.", adjust: "Stock corrected.", count: "Count saved." };

export async function productStock(fd: FormData) {
  const reason = str(fd, "reason");
  // A location is only named when the business has more than one; left out, the API uses the main one.
  const at = str(fd, "location_id");
  await mRun(fd, (out) => `${STOCK_DONE[reason] ?? "Saved."} ${at ? `There are ${out.here} at that location and ${out.stock} in all.` : `There are ${out.stock} in stock now.`}`, () => {
    if (str(fd, "qty") === "") throw new Error("Enter a number.");
    return mPost(`/products/${fid(fd)}/stock`, { delta: int(fd, "qty"), reason, note: str(fd, "note"), ...(at ? { location_id: at } : {}) });
  });
}

/** A count of the whole shelf: every product whose number was changed is set to what was counted. */
export async function stockCount(fd: FormData) {
  let changed = 0;
  await mRun(fd, () => (changed ? `Count saved. ${changed} ${changed === 1 ? "product was" : "products were"} corrected.` : "Nothing was different, so nothing changed."), async () => {
    for (const [k, v] of fd.entries()) {
      if (!k.startsWith("count_") || String(v).trim() === "") continue;
      const id = k.slice(6), counted = Math.round(Number(v));
      if (!Number.isFinite(counted) || counted < 0) throw new Error("A count cannot be negative.");
      if (String(counted) === str(fd, `was_${id}`)) continue;
      await mPost(`/products/${encodeURIComponent(id)}/stock`, { delta: counted, reason: "count", note: str(fd, "note") || "Stock count", ...(str(fd, "location_id") ? { location_id: str(fd, "location_id") } : {}) });
      changed++;
    }
    return {};
  });
}

export async function supplierCreate(fd: FormData) {
  await mRun(fd, "Supplier added.", () => mPost("/suppliers", { name: str(fd, "name"), contact: str(fd, "contact"), email: str(fd, "email"), phone: str(fd, "phone") }));
}

export async function supplierDelete(fd: FormData) {
  await mRun(fd, "Supplier removed. Its products are kept without a supplier.", () => mDel(`/suppliers/${fid(fd)}`));
}

/** Drafts an order for everything at or below its reorder level. */
export async function orderSuggest(fd: FormData) {
  await mRun(fd, (out) => `Draft ${out.ref} is ready with ${out.items} ${out.items === 1 ? "product" : "products"}. Check it under Purchase orders, then mark it as ordered.`,
    () => mPost("/purchase-orders", { suggest: true, supplier_id: str(fd, "supplier_id") }));
}

export async function orderCreate(fd: FormData) {
  await mRun(fd, (out) => `Draft ${out.ref} saved. Mark it as ordered once you have placed it with the supplier.`, () => {
    const items: { product_id: string; qty: number }[] = [];
    for (const [k, v] of fd.entries()) if (k.startsWith("qty_") && Math.round(Number(v)) > 0) items.push({ product_id: k.slice(4), qty: Math.round(Number(v)) });
    if (!items.length) throw new Error("Enter a quantity for at least one product.");
    return mPost("/purchase-orders", { supplier_id: str(fd, "supplier_id"), expected_on: str(fd, "expected_on"), items });
  });
}

const ORDER_DONE: Record<string, string> = {
  order: "Marked as ordered. Receive it when the delivery arrives.",
  receive: "Delivery received. Every line was added to stock.",
  cancel: "Order cancelled.",
};

export async function orderAction(fd: FormData) {
  const action = str(fd, "action");
  await mRun(fd, ORDER_DONE[action] ?? "Saved.", () => mPost(`/purchase-orders/${fid(fd)}`, { action }));
}

/** One photo per product. A new one replaces the old. */
export async function productPhoto(fd: FormData) {
  const file = fd.get("file");
  await mRun(fd, "Photo saved.", async () => {
    if (!(file instanceof File) || file.size === 0) throw new Error("Choose a photo to upload.");
    if (file.size > 8 * 1024 * 1024) throw new Error("The photo is too large. The limit is 8 MB.");
    const out = new FormData();
    out.set("alt", str(fd, "alt"));
    out.set("file", file, file.name);
    return mUpload(`/products/${fid(fd)}/photo`, out);
  });
}

export async function productPhotoRemove(fd: FormData) {
  await mRun(fd, "Photo removed.", () => mDel(`/products/${fid(fd)}/photo`));
}

/** How much of the product each service uses. Checkout takes it off the shelf as the service is paid for. */
export async function productUses(fd: FormData) {
  await mRun(fd, "Saved. Checkout takes this off the shelf as each service is paid for.", () => {
    const items: { service_id: string; qty: number }[] = [];
    for (const [k, v] of fd.entries()) {
      if (!k.startsWith("use_") || String(v).trim() === "") continue;
      const qty = Number(v);
      if (!Number.isFinite(qty) || qty < 0) throw new Error("The amount used must be a number above zero.");
      if (qty > 0) items.push({ service_id: k.slice(4), qty });
    }
    return mPut(`/products/${fid(fd)}/services`, { items });
  });
}

/** Moves stock from one location's shelf to another. The total does not change. */
export async function productTransfer(fd: FormData) {
  const qty = int(fd, "qty");
  await mRun(fd, `${qty} moved. The total in stock is the same.`, () => mPost(`/products/${fid(fd)}/transfer`, { from_location_id: str(fd, "from_location_id"), to_location_id: str(fd, "to_location_id"), qty, note: str(fd, "note") }));
}

const SHOP_DONE: Record<string, string> = {
  ready: "Marked as ready.",
  collected: "Marked as collected. The order is finished.",
  shipped: "Marked as shipped. The customer can see it in their account.",
  delivered: "Marked as delivered. The order is finished.",
};

/** Moves this business’s part of a shop order one step on: ready, collected, shipped (with a tracking reference) or delivered. */
export async function shopOrderAction(fd: FormData) {
  const action = str(fd, "step");
  await mRun(fd, SHOP_DONE[action] ?? "Saved.", () => mPost(`/orders/${fid(fd)}`, { action, tracking: action === "shipped" ? str(fd, "tracking") : "" }));
}

/** Ingredients and directions for one product, shown on its page in the shop. */
export async function productDetails(fd: FormData) {
  await mRun(fd, "Saved. The product page in the shop shows this now.", async () => {
    try {
      return await mPut(`/products/${fid(fd)}/details`, { ingredients: str(fd, "ingredients"), how_to_use: str(fd, "how_to_use") });
    } catch (e) {
      throw new Error(sentence((e as Error).message));
    }
  });
}

/**
 * What shoppers are told about returns, delivery time and same-day pick-up.
 * The API replaces the whole policy, so the languages travel back unchanged.
 */
export async function saveShopPolicy(fd: FormData) {
  await mRun(fd, "Saved. Shoppers see this on your products now.", async () => {
    const body = policyFromChoices(fd);
    try {
      return await mPut("/shop-policy", body);
    } catch (e) {
      throw new Error(sentence((e as Error).message));
    }
  });
}

/**
 * Answers a request to send an online order back: approve and refund, or refuse with a reason.
 * On a failure the form opens again with the sentence the API gave; nothing has changed then.
 */
export async function answerReturn(fd: FormData) {
  const refuse = str(fd, "decision") === "refuse", reply = str(fd, "reply");
  const again = () => backWith(fd, { answer: str(fd, "id") });
  if (refuse && reply.length < 10) { again(); mBackTo(fd, "err", "Tell the customer why, in a sentence. At least 10 characters."); }
  let out: Record<string, unknown> = {}, error = "";
  try {
    out = await mPost(`/returns/${fid(fd)}`, refuse ? { action: "refuse", reply } : { action: "approve", reply, refund_cents: cents(fd, "refund"), restock: on(fd, "restock") });
  } catch (e) {
    error = sentence((e as Error).message);
  }
  if (error) { again(); mBackTo(fd, "err", error); }
  if (refuse) mBackTo(fd, "ok", "Return refused. The customer is emailed your message. Nothing was refunded.");
  if (out.provider_refund_status === "pending") mBackTo(fd,"ok","Return approved. The card refund is reserved and awaiting provider confirmation. Recovery is automatic.");
  const refund = Number(out.refund_cents ?? 0), card = Number(out.to_card_cents ?? 0), credit = Number(out.credit_cents ?? 0);
  const cur = String(out.currency || (await getMe())?.merchant.currency || "USD"); // a naira order is refunded in naira
  const where = card > 0 && credit > 0 ? `${money(card, cur)} to the customer's card and ${money(credit, cur)} as LogaLuxe store credit` : card > 0 ? "to the customer's card" : "as LogaLuxe store credit";
  mBackTo(fd, "ok", `Return approved. ${money(refund, cur)} refunded, ${where}. ${on(fd, "restock") ? "The items are back in stock." : "Stock was not changed."}`);
}
