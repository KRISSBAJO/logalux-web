// What the shop pages share: the shapes the API answers with, and how a
// category, a tag or a seller's name is written for a customer.

export type Size = { label: string; price_cents: number };

/** A product as GET /v1/products lists it. */
export type ShopProduct = {
  id: string; slug: string; name: string; seller_name: string; business_slug: string | null; seller_verified: boolean | null;
  category: string; description?: string; price_cents: number; compare_cents: number | null; stock: number; tone: string; tags: string[] | null;
  rating: number; review_count: number; sold: number; pickup: boolean; shipping: boolean; shipping_cents: number; sizes: Size[] | null; photo_id: string | null;
};

export type ShopList = {
  products: ShopProduct[]; total: number; page: number; per_page: number;
  categories: { category: string; n: number }[];
  sellers: { seller_name: string; business_slug: string | null; verified: boolean | null; n: number }[];
  tags: { tag: string; n: number }[];
  booked: string[];
};

/** What the cart needs to know about a product today, from GET /api/products. */
export type CartProduct = {
  slug: string; name: string; seller_name: string; price_cents: number; stock: number; tone: string; sizes: Size[];
  pickup: boolean; shipping: boolean; shipping_cents: number; business_slug: string | null; business_city: string | null;
  seller_verified: boolean; photo_id: string | null;
};

const CATEGORY: Record<string, string> = {
  hair: "Hair & scalp", braids: "Braid care", styling: "Styling", tools: "Tools & bonnets", skin: "Skin", nails: "Nails", gift: "Gift cards",
  makeup: "Makeup", body: "Body", fragrance: "Fragrance", lashes: "Lashes", barber: "Barber",
};
const PLACES = new Set(["nigeria", "lagos", "nashville", "abuja", "tennessee", "ghana", "africa", "us", "usa", "uk"]);

const sentence = (s: string) =>
  s.trim().split(/\s+/).map((w, i) => (PLACES.has(w.toLowerCase()) ? (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)) : i === 0 ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");

export const categoryName = (c: string) => CATEGORY[c] ?? sentence(c.replace(/[-_]+/g, " "));
export const tagName = (t: string) => sentence(t.replace(/_+/g, " "));

// Tags that say what a product stands for, as opposed to what it is good for.
const VALUES = new Set([
  "made in nigeria", "made in lagos", "made in nashville", "made in the us", "black-owned", "black owned", "woman-owned", "sulfate-free", "sulphate-free",
  "paraben-free", "silicone-free", "fragrance-free", "cruelty-free", "refillable", "vegan", "organic", "natural", "handmade", "small batch", "recyclable",
]);
export const isValueTag = (t: string) => VALUES.has(t.toLowerCase());

/** "Ada's Braid Studio" → "Ada's Braid Studio's" reads badly, so a name that already holds a possessive is left alone. */
export const possessive = (name: string) => (/['’]s\b/.test(name) ? name : /s$/i.test(name) ? `${name}'` : `${name}'s`);

/** A size's price for a round amount, e.g. "$3 per 10 ml", when the label is a plain measure. */
export function perUnit(label: string, cents: number): { per: number; unit: string; cents: number } | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(ml|g|oz)\s*$/i.exec(label);
  if (!m) return null;
  const amount = Number(m[1]), unit = m[2].toLowerCase();
  if (!(amount > 0)) return null;
  const per = unit === "oz" ? 1 : 10;
  return { per, unit, cents: Math.round((cents / amount) * per) };
}

/** Sales tax as the order endpoint works it out: 9.25% of the subtotal after the promo, to the nearest cent. */
export const salesTax = (afterDiscountCents: number) => Math.floor((afterDiscountCents * 925 + 5000) / 10000);
export const TAX_LABEL = "Sales tax · 9.25%";
