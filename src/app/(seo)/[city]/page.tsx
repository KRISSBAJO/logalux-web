import { notFound } from "next/navigation";
import { CityListing, cityMetadata } from "@/components/city-listing";
import { cityPage } from "@/lib/categories";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ city: string }> };

// Only the cities LogaLuxe serves have a page. Any other single-word address is not found.
export async function generateMetadata({ params }: Props) {
  const city = cityPage((await params).city);
  return city ? cityMetadata(city) : {};
}

export default async function CityPage({ params }: Props) {
  const city = cityPage((await params).city);
  if (!city) notFound();
  return <CityListing city={city} />;
}
