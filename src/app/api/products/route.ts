import { NextRequest, NextResponse } from "next/server";
import { api, ApiError } from "@/lib/api";
import type { CartProduct } from "@/lib/shop";

// The cart is kept in the browser, so it asks here what its products cost and
// how they can be delivered today. A product that is no longer sold comes back as null.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export async function GET(req: NextRequest) {
  const slugs = [...new Set((req.nextUrl.searchParams.get("slugs") ?? "").split(",").map((s) => s.trim()).filter((s) => /^[a-z0-9][a-z0-9-]{0,80}$/i.test(s)))].slice(0, 40);
  const products: Record<string, CartProduct | null> = {};
  try {
    await Promise.all(slugs.map(async (slug) => {
      try {
        const { product: p, photos } = await api.get<{ product: Row; photos: { id: string }[] | null }>(`/v1/products/${encodeURIComponent(slug)}`);
        products[slug] = {
          slug: p.slug, name: p.name, seller_name: p.seller_name, price_cents: Number(p.price_cents) || 0, stock: Number(p.stock) || 0, tone: p.tone ?? "#3B1D22",
          sizes: Array.isArray(p.sizes) ? p.sizes : [], pickup: !!p.pickup, shipping: !!p.shipping, shipping_cents: Number(p.shipping_cents) || 0,
          business_slug: p.business_slug ?? null, business_city: p.business_city ?? null, seller_verified: p.seller_verified === true, photo_id: photos?.[0]?.id ?? null,
        };
      } catch (e) {
        if ((e as ApiError).status === 404) products[slug] = null; else throw e;
      }
    }));
  } catch {
    return NextResponse.json({ error: "We could not check your cart just now. Try again in a moment." }, { status: 502 });
  }
  return NextResponse.json({ products });
}
