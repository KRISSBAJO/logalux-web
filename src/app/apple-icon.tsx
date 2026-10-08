import { ImageResponse } from "next/og";

// The home-screen icon for phones: the gold arch and star on burgundy.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#5A1420" }}>
        <svg width="92" height="115" viewBox="0 0 32 40" fill="none">
          <path d="M3 38.6V16a13 13 0 0 1 26 0v22.6Z" stroke="#D4AF5A" strokeWidth="1.9" />
          <path d="M16 15.2c.55 5.3 2.5 7.25 7.8 7.8-5.3.55-7.25 2.5-7.8 7.8-.55-5.3-2.5-7.25-7.8-7.8 5.3-.55 7.25-2.5 7.8-7.8Z" fill="#D4AF5A" />
        </svg>
      </div>
    ),
    size,
  );
}
