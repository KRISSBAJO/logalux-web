import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Isolated QA previews must never overwrite the running development preview.
  distDir: process.env.LOGALUXE_QA === "1" ? ".next-qa" : ".next",
  // Image uploads from the admin console pass through a server action.
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  // LOGALUXE_API_URL is read on the server only (process.env in server code), so it is not put in the browser bundle.
  env: {
    NEXT_PUBLIC_LOGALUXE_QA: process.env.LOGALUXE_QA === "1" ? "1" : "0",
  },
  // The Journal on its own host: journal.<site host> serves /journal/*. Nothing changes until the owner adds a DNS
  // record for the subdomain (see the README). The site's own files, pictures and API routes pass through untouched,
  // and so does /journal/... itself, so the links inside the pages keep working on either host.
  async rewrites() {
    const journalHost = [{ type: "host" as const, value: "journal\\..+" }];
    return {
      beforeFiles: [
        { source: "/", has: journalHost, destination: "/journal" },
        { source: "/category/:key", has: journalHost, destination: "/journal/category/:key" },
        { source: "/:slug((?!search$|shop$|cart$|signin$|signup$|help$|places$|account$|business$|journal$|admin$|staff$|verify$|forgot$|reset$|pay$|embed$|legal$|media$|api$|gift-cards$|_next$)[a-z0-9][a-z0-9-]*)", has: journalHost, destination: "/journal/:slug" },
      ],
    };
  },
  // Who may put our pages inside a frame. Only the booking page made for a business's own website
  // (/embed/<slug>) may be framed by other sites; everything else only by LogaLuxe itself.
  // No X-Frame-Options is sent anywhere: it cannot say "any site", and frame-ancestors replaces it.
  async headers() {
    return [
      { source: "/((?!embed/).*)", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self'" }] },
      { source: "/embed/:path*", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }] },
    ];
  },
};

export default nextConfig;
