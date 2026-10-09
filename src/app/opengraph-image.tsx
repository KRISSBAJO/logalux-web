import { ImageResponse } from "next/og";

// The picture a shared link shows when a page has none of its own: the mark, the name, and what the site is for.
export const alt = "LogaLuxe. Book beauty professionals in the United States and Nigeria.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 56, background: "linear-gradient(160deg, #7A1F2B 0%, #3B1D22 55%, #1A1513 100%)", color: "#F4ECE3", fontFamily: "Georgia, serif" }}>
        <svg width="200" height="250" viewBox="0 0 32 40" fill="none">
          <path d="M3 38.6V16a13 13 0 0 1 26 0v22.6Z" stroke="#D4AF5A" strokeWidth="1.6" />
          <path d="M16 15.2c.55 5.3 2.5 7.25 7.8 7.8-5.3.55-7.25 2.5-7.8 7.8-.55-5.3-2.5-7.25-7.8-7.8 5.3-.55 7.25-2.5 7.8-7.8Z" fill="#D4AF5A" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 720 }}>
          <div style={{ fontSize: 96, lineHeight: 1 }}>LogaLuxe</div>
          <div style={{ fontSize: 34, lineHeight: 1.25, color: "#E9DED3", fontFamily: "Arial, sans-serif" }}>Book beauty professionals in the United States and Nigeria.</div>
        </div>
      </div>
    ),
    size,
  );
}
