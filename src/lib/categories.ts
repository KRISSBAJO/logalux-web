// The kinds of business a client can look for, and the two cities LogaLuxe
// serves. Search, the city pages and the sitemap all read from here.

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

export type City = { slug: string; name: string; market: "US" | "NG" };
export const CITIES: City[] = [{ slug: "nashville", name: "Nashville", market: "US" }, { slug: "lagos", name: "Lagos", market: "NG" }];
export const cityPage = (slug: string) => CITIES.find((c) => c.slug === slug);

/** Full search with the same filters as a city page. */
export function searchHref(city: City, categoryId = "") {
  const p = new URLSearchParams();
  if (categoryId) p.set("category", categoryId);
  if (city.market !== "US") p.set("market", city.market);
  const s = p.toString();
  return s ? `/search?${s}` : "/search";
}
