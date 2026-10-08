import type { MetadataRoute } from "next";

// What a phone needs to add LogaLuxe to its home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LogaLuxe",
    short_name: "LogaLuxe",
    description: "Find verified beauty professionals, see real openings and book online. Nashville and Lagos.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    theme_color: "#1A1513",
    background_color: "#FBF7F2",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
