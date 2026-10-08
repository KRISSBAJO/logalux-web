import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Image uploads from the admin console pass through a server action.
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  env: {
    // Public base URL of the Go API, used by server components and route handlers.
    LOGALUXE_API_URL: process.env.LOGALUXE_API_URL ?? "http://127.0.0.1:18080",
  },
};

export default nextConfig;
