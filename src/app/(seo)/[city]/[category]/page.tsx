import { notFound } from "next/navigation";
import { CityListing, cityMetadata } from "@/components/city-listing";
import { categoryPage, cityPage } from "@/lib/categories";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ city: string; category: string }> };

// Only a real city with a category that search offers has a page.
export async function generateMetadata({ params }: Props) {
  const p = await params;
  const city = cityPage(p.city), category = categoryPage(p.category);
  return city && category ? cityMetadata(city, category) : {};
}

export default async function CityCategoryPage({ params }: Props) {
  const p = await params;
  const city = cityPage(p.city), category = categoryPage(p.category);
  if (!city || !category) notFound();
  return <CityListing city={city} category={category} />;
}
