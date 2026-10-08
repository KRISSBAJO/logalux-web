"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export type PreviewData = {
  name: string; tagline: string; tone: string; highlights: string[];
  display: { show_from: boolean; show_durations: boolean; show_staff: boolean; show_reviews: boolean; show_address: boolean; show_phone: boolean; open_badge: boolean; notice: string };
};
type Shot = { id: string; alt: string };

/**
 * The phone on the right: the page as it will look, built from what is saved
 * and updated as the form on the left is typed in. Nothing is saved from here.
 */
export function LivePreview({ formId, init, rating, reviewCount, verified, openNow, cover, logoId, grid, services, staff, address, area, phone }: {
  formId: string; init: PreviewData; rating: number; reviewCount: number; verified: boolean;
  /** null when the hours do not say. */
  openNow: boolean | null;
  cover?: Shot; logoId?: string; grid: Shot[];
  services: { name: string; dur: string; price: string; from: string }[];
  staff: { initials: string; tone: string; name: string }[];
  address: string; area: string; phone: string;
}) {
  const [v, setV] = useState(init);

  useEffect(() => {
    const read = () => {
      const form = document.getElementById(formId) as HTMLFormElement | null;
      if (!form) return;
      const fd = new FormData(form);
      const text = (k: string) => String(fd.get(k) ?? "");
      const seen = new Set<string>();
      const highlights = [...fd.getAll("highlights").map(String), ...text("highlights_more").split(/[\n,]/)].map((h) => h.trim()).filter((h) => h && !seen.has(h.toLowerCase()) && seen.add(h.toLowerCase()));
      const display = { ...init.display } as Record<string, boolean | string>;
      for (const k of text("display_keys").split(",").filter(Boolean)) display[k] = k === "notice" ? text("notice").trim() : fd.get(k) === "on" || fd.get(k) === "1";
      setV({ name: text("name"), tagline: text("tagline"), tone: /^#[0-9a-f]{6}$/i.test(text("tone")) ? text("tone") : init.tone, highlights: highlights.slice(0, 6), display: display as PreviewData["display"] });
    };
    document.addEventListener("input", read);
    document.addEventListener("change", read);
    return () => { document.removeEventListener("input", read); document.removeEventListener("change", read); };
  }, [formId, init]);

  const d = v.display;
  const tones = [v.tone, "#4A2A2A", "#2E2538"];
  return (
    <div className="phone">
      <div className="screen">
        <div className="cover" style={{ background: v.tone }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {cover ? <img src={`/media/${cover.id}`} alt={cover.alt} className="fill" /> : <span style={{ alignSelf: "flex-start" }}>No cover photo yet</span>}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className="logo serif">{logoId ? <img src={`/media/${logoId}`} alt={`${v.name} logo`} className="fill" /> : v.name.trim()[0]?.toUpperCase() ?? ""}</span>
        </div>
        <div className="pbody">
          <h2 className="serif">{v.name || "Your business name"}</h2>
          {v.tagline ? <div className="muted" style={{ fontSize: 12.5 }}>{v.tagline}</div> : null}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {d.show_reviews && reviewCount > 0 ? (
              <><span className="stars" aria-hidden="true">{"★".repeat(Math.round(rating))}{"☆".repeat(5 - Math.round(rating))}</span><b style={{ fontSize: 12.5 }}>{rating.toFixed(1)}</b><span className="muted" style={{ fontSize: 12 }}>({reviewCount})</span></>
            ) : d.show_reviews ? <span className="muted" style={{ fontSize: 12 }}>No reviews yet</span> : null}
            {verified ? <span className="pill pill-ok">Verified</span> : null}
            {d.open_badge && openNow !== null ? <span className={"pill " + (openNow ? "pill-gold" : "pill-grey")}>{openNow ? "Open now" : "Closed now"}</span> : null}
          </div>
          {d.notice ? <div className="pnote">{d.notice}</div> : null}
          {v.highlights.length ? <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{v.highlights.map((h) => <span key={h} className="pill pill-grey">{h}</span>)}</div> : null}
          <div className="pgrid">
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ background: tones[i], position: "relative", overflow: "hidden" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {grid[i] ? <img src={`/media/${grid[i].id}`} alt={grid[i].alt} className="fill" /> : null}
              </div>
            ))}
          </div>
          {services.length ? (
            <div>
              {services.map((s) => (
                <div key={s.name} className="svc"><div><b>{s.name}</b>{d.show_durations ? <span>{s.dur}</span> : null}</div><b>{d.show_from && s.from ? `from ${s.from}` : s.price}</b></div>
              ))}
            </div>
          ) : <div className="muted" style={{ fontSize: 12 }}>No services are bookable online yet.</div>}
          {d.show_staff && staff.length ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              {staff.map((p) => <span key={p.name} className="avatar" title={p.name} style={{ background: p.tone, width: 28, height: 28, fontSize: 10 }}>{p.initials}</span>)}
              <span className="muted" style={{ fontSize: 12 }}>Clients can choose who they see</span>
            </div>
          ) : null}
          <div className="muted" style={{ fontSize: 12 }}>
            {d.show_address ? address || area : area}
            {d.show_phone && phone ? ` · ${phone}` : ""}
          </div>
          <div className="pbtn">Book now</div>
        </div>
      </div>
    </div>
  );
}

/** Home links to "#reviews". The reviews live on one tab, so a visit to another tab with that hash is sent there. */
export function HashTab({ tab }: { tab: string }) {
  const router = useRouter();
  useEffect(() => {
    if (window.location.hash === "#reviews" && tab !== "services") router.replace("/business/storefront?tab=services#reviews");
  }, [tab, router]);
  return null;
}
