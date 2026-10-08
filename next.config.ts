import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Image uploads from the admin console pass through a server action.
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  env: {
    // Public base URL of the Go API, used by server components and route handlers.
    LOGALUXE_API_URL: process.env.LOGALUXE_API_URL ?? "http://127.0.0.1:18080",
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
