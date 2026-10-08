// What a search engine is told about a business: its page title, its
// description and its structured data. Every value is the business's own,
// as the API gives it. Nothing is filled in when it is missing.
import { breadcrumbs } from "@/components/json-ld";
import { money } from "@/lib/api";
import { CATEGORY_PAGES, categoryLabel } from "@/lib/categories";
import { placeSlug } from "@/lib/place";
import { absoluteUrl, clip } from "@/lib/site";
import type { Loc, Payload } from "./shared";

// schema.org has no type for a barber shop, so a barber is a hair salon there.
const SCHEMA_TYPE: Record<string, string> = { hair: "HairSalon", braids: "HairSalon", barber: "HairSalon", nails: "NailSalon", spa: "DaySpa", lashes: "BeautySalon", skin: "BeautySalon", makeup: "BeautySalon" };
const DAYS: [string, string][] = [["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"], ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"]];

const primary = (locations: Loc[]) => locations.find((l) => l.is_primary) ?? locations[0];
const sentence = (s: string) => (s ? (/[.!?…]$/.test(s) ? s : `${s}.`) : "");
const amount = (cents: number) => (cents / 100).toFixed(2);

/** The services a price range is drawn from: the menu itself, without add-ons, unless add-ons are all there is. */
function menu(data: Payload) {
  const all = (data.services ?? []).filter((s) => s.price_cents > 0);
  const main = all.filter((s) => s.category !== "Add-ons");
  return main.length ? main : all;
}

/** The area, with the city after it when the area does not already name the city: "Lekki Phase 1, Lagos". */
function placeOf(loc: Loc | undefined) {
  if (!loc) return "";
  return [loc.name, loc.city && !(loc.name ?? "").includes(loc.city) ? loc.city : ""].filter(Boolean).join(", ");
}

export function businessTitle(data: Payload) {
  const b = data.business;
  const kind = categoryLabel(b.category) ?? (b.category ? b.category.charAt(0).toUpperCase() + b.category.slice(1) : "");
  const place = placeOf(primary(data.locations ?? []));
  const what = [kind, place ? `in ${place}` : ""].filter(Boolean).join(" ");
  return what ? `${b.name} · ${what}` : b.name;
}

export function businessDescription(data: Payload) {
  const b = data.business, display = data.display ?? {};
  const prices = menu(data).map((s) => s.price_cents);
  const count = Number(b.review_count) || 0, rating = Number(b.rating) || 0;
  const facts = [
    prices.length ? `Services from ${money(Math.min(...prices), b.currency)}.` : "",
    display.show_reviews !== false && count > 0 && rating > 0 ? `Rated ${rating.toFixed(1)} from ${count} ${count === 1 ? "review" : "reviews"}.` : "",
  ];
  const text = [sentence((b.tagline ?? "").trim()), ...facts, sentence((b.about ?? "").trim())].filter(Boolean).join(" ");
  return clip(text || `${b.name} on LogaLuxe.`, 220);
}

/** The business as schema.org structured data, and the trail of pages that leads to it. */
export function businessJsonLd(data: Payload, shown: { rating: number; reviewCount: number; photoId?: string }) {
  const b = data.business, display = data.display ?? {};
  const loc = primary(data.locations ?? []);
  const url = absoluteUrl(`/b/${b.slug}`);
  const showAddress = display.show_address !== false;
  const services = menu(data);
  const prices = services.map((s) => s.price_cents);
  const handle = (v?: string) => (v ?? "").replace(/^@/, "").trim();
  const site = b.website ? (/^https?:\/\//.test(b.website) ? b.website : `https://${b.website}`) : "";
  const sameAs = [handle(b.instagram) ? `https://instagram.com/${handle(b.instagram)}` : "", handle(b.tiktok) ? `https://tiktok.com/@${handle(b.tiktok)}` : "", site].filter(Boolean);
  const hours = DAYS.flatMap(([key, day]) => {
    const h = loc?.hours?.[key];
    return h ? [{ "@type": "OpeningHoursSpecification", dayOfWeek: `https://schema.org/${day}`, opens: h[0], closes: h[1] }] : [];
  });
  const address = loc
    ? {
        "@type": "PostalAddress",
        ...(showAddress && loc.address ? { streetAddress: loc.address } : {}),
        ...(loc.city ? { addressLocality: loc.city } : {}),
        ...(loc.region && loc.region !== loc.city ? { addressRegion: loc.region } : {}),
        ...(loc.country ? { addressCountry: loc.country } : {}),
      }
    : null;
  const hasPin = showAddress && typeof loc?.lat === "number" && typeof loc?.lng === "number";
  const description = [(b.tagline ?? "").trim(), (b.about ?? "").trim()].filter(Boolean).map(sentence).join(" ");

  const business = {
    "@context": "https://schema.org",
    "@type": SCHEMA_TYPE[b.category] ?? "LocalBusiness",
    "@id": `${url}#business`,
    name: b.name,
    url,
    ...(description ? { description } : {}),
    ...(shown.photoId ? { image: absoluteUrl(`/media/${shown.photoId}`) } : {}),
    ...(b.logo_id ? { logo: absoluteUrl(`/media/${b.logo_id}`) } : {}),
    ...(address ? { address } : {}),
    ...(hasPin ? { geo: { "@type": "GeoCoordinates", latitude: loc!.lat, longitude: loc!.lng } } : {}),
    // The API only sends a phone number when the business has chosen to show it.
    ...(b.phone ? { telephone: b.phone } : {}),
    ...(hours.length ? { openingHoursSpecification: hours } : {}),
    ...(prices.length ? { priceRange: Math.min(...prices) === Math.max(...prices) ? money(prices[0], b.currency) : `${money(Math.min(...prices), b.currency)} to ${money(Math.max(...prices), b.currency)}`, currenciesAccepted: b.currency } : {}),
    ...(display.show_reviews !== false && shown.reviewCount > 0 && shown.rating > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(shown.rating.toFixed(2)), reviewCount: shown.reviewCount, bestRating: 5, worstRating: 1 } } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(services.length
      ? {
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: "Services",
            itemListElement: services.slice(0, 12).map((s) => ({
              "@type": "Offer",
              price: amount(s.price_cents),
              priceCurrency: b.currency,
              url,
              itemOffered: { "@type": "Service", name: s.name, ...(s.description ? { description: s.description } : {}) },
            })),
          },
        }
      : {}),
  };

  // Home, then the city and the kind of service when LogaLuxe has a page for them, then the business.
  // The city is where the business's main location is; its page address is made the way the API makes it.
  const main = primary(data.locations ?? []);
  const slug = main ? placeSlug(main.city ?? "", main.region ?? "", main.country ?? b.market) : "";
  const city = slug && main ? { name: main.country === "NG" && (main.city ?? "").toLowerCase() === (main.region ?? "").toLowerCase() ? main.city ?? "" : `${main.city}, ${main.region}`, slug } : null;
  const kind = CATEGORY_PAGES.find((c) => c.id === b.category);
  const trail: [string, string][] = [["Home", absoluteUrl("/")]];
  if (city) trail.push([city.name, absoluteUrl(`/${city.slug}`)]);
  if (city && kind) trail.push([kind.heading, absoluteUrl(`/${city.slug}/${kind.slug}`)]);
  trail.push([b.name, url]);

  return [business, breadcrumbs(trail)];
}
