import type { Metadata } from "next";
import "./globals.css";
import { SubmitterFix } from "@/components/submitter-fix";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: { default: "LogaLuxe · Book beauty professionals in the United States and Nigeria", template: "%s · LogaLuxe" },
  description:
    "Find beauty professionals near you, see their free times and prices, and book online. Hair, braids, barbers, nails, lashes, skin and more, in the United States and Nigeria.",
  metadataBase: new URL(SITE_URL),
  openGraph: { siteName: "LogaLuxe", type: "website" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..700;1,6..96,400..700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}<SubmitterFix /></body>
    </html>
  );
}
