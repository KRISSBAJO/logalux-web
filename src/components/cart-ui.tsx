"use client";

import Link from "next/link";
import { cart, useCart } from "@/lib/cart";
import { Icon } from "./icons";

/** The cart link with its count. `tone` picks the dark-background or the light-background button. */
export function CartLink({ tone = "ghost" }: { tone?: "ghost" | "out" }) {
  const { count } = useCart();
  return (
    <Link href="/cart" className={`btn btn-${tone} btn-sm cartb`} aria-label={count ? `Cart, ${count} ${count === 1 ? "item" : "items"}` : "Cart"}>
      <Icon.Cart width={16} height={16} aria-hidden />Cart{count > 0 && <span className="n" aria-hidden>{count}</span>}
    </Link>
  );
}

/** "Keep shopping" on the cart page. A cart that holds only naira items leads back to the naira shop. */
export function KeepShopping() {
  const { items } = useCart();
  const naira = items.length > 0 && items.every((i) => i.currency === "NGN");
  return (
    <Link href={naira ? "/shop?market=ng" : "/shop"} className="btn btn-out btn-sm">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 18-6-6 6-6" /></svg>
      Keep shopping
    </Link>
  );
}

/** The small button on a product card. Press again to take the product back out. */
export function AddToCart({ product, size, unitCents }: { product: { slug: string; name: string; seller_name: string; tone: string; stock: number; currency: string }; size: string; unitCents: number }) {
  const { items } = useCart();
  const inCart = items.some((i) => i.slug === product.slug && i.size === size);
  if (product.stock < 1) return <button type="button" className="add" disabled>Sold out</button>;
  return (
    <button
      type="button"
      className={`add ${inCart ? "in" : ""}`}
      aria-pressed={inCart}
      aria-label={inCart ? `${product.name} is in your cart. Remove it` : `Add ${product.name} to cart`}
      onClick={() => (inCart ? cart.remove(product.slug, size) : cart.add({ slug: product.slug, name: product.name, seller: product.seller_name, size, unit_cents: unitCents, tone: product.tone, currency: product.currency }, 1, product.stock))}
    >
      {inCart ? "In cart ✓" : "Add"}
    </button>
  );
}
