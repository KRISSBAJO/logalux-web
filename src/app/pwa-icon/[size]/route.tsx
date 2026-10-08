import { ImageResponse } from "next/og";

// The home-screen icon at the sizes the web app manifest asks for, drawn from
// the same mark as apple-icon.tsx: the gold arch and star on burgundy.
const SIZES = [192, 512];

export async function GET(req: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  if (!SIZES.includes(size)) return new Response("Not found", { status: 404 });
  // A maskable icon may be cropped to a circle, so its mark sits inside the safe middle.
  const maskable = new URL(req.url).searchParams.has("maskable");
  const h = Math.round(size * (maskable ? 0.5 : 0.64)), w = Math.round(h * 0.8);
  const res = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#5A1420" }}>
        <svg width={w} height={h} viewBox="0 0 32 40" fill="none">
          <path d="M3 38.6V16a13 13 0 0 1 26 0v22.6Z" stroke="#D4AF5A" strokeWidth="1.9" />
          <path d="M16 15.2c.55 5.3 2.5 7.25 7.8 7.8-5.3.55-7.25 2.5-7.8 7.8-.55-5.3-2.5-7.25-7.8-7.8 5.3-.55 7.25-2.5 7.8-7.8Z" fill="#D4AF5A" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
  res.headers.set("Cache-Control", "public, max-age=86400");
  return res;
}
