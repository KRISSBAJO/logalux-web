import "@/app/cx-css/book.css";
import { BookView, type BookSearch } from "./view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Book", robots: { index: false } };

export default async function BookPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<BookSearch> }) {
  return <BookView slug={(await params).slug} sp={await searchParams} />;
}
