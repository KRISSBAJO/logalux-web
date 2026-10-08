// The kinds of business a client can look for. Search, the place pages and
// the sitemap all read from here. The places themselves are not listed
// anywhere in the code: they come from where businesses are (lib/places.ts).

/** Category id as the API knows it, and its name in the search filters. */
export const CATEGORIES: [string, string][] = [["hair", "Hair"], ["braids", "Braids & locs"], ["barber", "Barber"], ["nails", "Nails"], ["lashes", "Lashes & brows"], ["skin", "Skin"], ["makeup", "Makeup"], ["spa", "Spa"]];

export const categoryLabel = (id: string) => CATEGORIES.find(([c]) => c === id)?.[1];

/** How each category is written on its city page: the address, the heading and the words used mid-sentence. */
const PAGE: Record<string, { slug: string; heading: string; phrase: string }> = {
  hair: { slug: "hair", heading: "Hair", phrase: "hair" },
  braids: { slug: "braids", heading: "Braids", phrase: "braids and locs" },
  barber: { slug: "barbers", heading: "Barbers", phrase: "barbering" },
  nails: { slug: "nails", heading: "Nails", phrase: "nails" },
  lashes: { slug: "lashes", heading: "Lashes and brows", phrase: "lashes and brows" },
  skin: { slug: "skin", heading: "Skin care", phrase: "skin care" },
  makeup: { slug: "makeup", heading: "Makeup", phrase: "makeup" },
  spa: { slug: "spa", heading: "Spas", phrase: "spa and massage" },
};

export type CategoryPage = { id: string; label: string; slug: string; heading: string; phrase: string };
export const CATEGORY_PAGES: CategoryPage[] = CATEGORIES.map(([id, label]) => ({ id, label, ...(PAGE[id] ?? { slug: id, heading: label, phrase: label.toLowerCase() }) }));
export const categoryPage = (slug: string) => CATEGORY_PAGES.find((c) => c.slug === slug);

/** Search in a place, with a category if there is one. */
export function searchHref(placeSlug: string, categoryId = "") {
  const p = new URLSearchParams();
  if (placeSlug) p.set("place", placeSlug);
  if (categoryId) p.set("category", categoryId);
  const s = p.toString();
  return s ? `/search?${s}` : "/search";
}
