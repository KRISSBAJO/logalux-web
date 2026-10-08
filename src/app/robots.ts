import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Public pages are open to search engines. Private areas and the pages that only make sense mid-task are not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/business", "/account", "/cart", "/pay", "/api", "/staff", "/signin", "/signup"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
