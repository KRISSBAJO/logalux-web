import { notFound, permanentRedirect } from "next/navigation";
import { CityListing, cityMetadata } from "@/components/city-listing";
import { getPlace } from "@/lib/places";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ city: string }> };

// A place has a page when the API knows it: a city ("/nashville-tn", "/port-harcourt-rivers"), a state
// ("/tennessee", "/lagos-state") or a country ("/nigeria"). A city's address ends in its state, so two cities
// of one name never share one. An older address without the state ("/nashville") goes to the new one for good.
async function find(raw: string) {
  const slug = raw.toLowerCase();
  const found = await getPlace(slug);
  if (!found) return null;
  if (found.canonical && found.canonical !== slug) permanentRedirect(`/${found.canonical}`);
  if (raw !== slug) permanentRedirect(`/${slug}`);
  return found;
}

export async function generateMetadata({ params }: Props) {
  const found = await find((await params).city);
  return found ? cityMetadata(found.place) : {};
}

export default async function CityPage({ params }: Props) {
  const found = await find((await params).city);
  if (!found) notFound();
  return <CityListing place={found.place} nearest={found.nearest} />;
}
