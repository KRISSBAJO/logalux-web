import { notFound, permanentRedirect } from "next/navigation";
import { CityListing, cityMetadata } from "@/components/city-listing";
import { categoryPage } from "@/lib/categories";
import { getPlace } from "@/lib/places";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ city: string; category: string }> };

// Only a place the API knows, with a category that search offers, has a page. An older address
// ("/lagos/barbers") goes to the new one ("/lagos-lagos/barbers") for good.
async function find(rawPlace: string, rawCategory: string) {
  const category = categoryPage(rawCategory.toLowerCase());
  if (!category) return null;
  const slug = rawPlace.toLowerCase();
  const found = await getPlace(slug);
  if (!found) return null;
  const canonical = found.canonical && found.canonical !== slug ? found.canonical : slug;
  if (canonical !== rawPlace || category.slug !== rawCategory) permanentRedirect(`/${canonical}/${category.slug}`);
  return { ...found, category };
}

export async function generateMetadata({ params }: Props) {
  const p = await params;
  const found = await find(p.city, p.category);
  return found ? cityMetadata(found.place, found.category) : {};
}

export default async function CityCategoryPage({ params }: Props) {
  const p = await params;
  const found = await find(p.city, p.category);
  if (!found) notFound();
  return <CityListing place={found.place} nearest={found.nearest} category={found.category} />;
}
