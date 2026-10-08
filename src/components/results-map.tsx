"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

export type Pin = { slug: string; name: string; rating: number; lat: number; lng: number; label: string };

const GROUP_WITHIN = 54; // pixels: pins closer than this on screen become one counted group

/**
 * The search map. Every matching business is a price pin. Pins that would
 * overlap at the current zoom merge into a counted group, so the map stays
 * readable with hundreds of businesses; clicking a group zooms into it.
 */
export function ResultsMap({ pins, active, onHover, onPick }: { pins: Pin[]; active: string | null; onHover: (slug: string | null) => void; onPick: (slug: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const els = useRef(new Map<string, HTMLElement>()); // slug -> the pin or group it is shown in
  const cb = useRef({ onHover, onPick });
  cb.current = { onHover, onPick };
  const activeRef = useRef(active);
  activeRef.current = active;

  // Create the map once.
  useEffect(() => {
    if (!box.current || map.current) return;
    const m = L.map(box.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false, zoomSnap: 0.5 });
    L.control.zoom({ position: "bottomright" }).addTo(m);
    // OpenStreetMap tiles need no key. They are fine at launch volume; a busy production site
    // should move to a paid tile host (MapTiler, Stadia, Mapbox) by changing this one URL.
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m);
    // Scrolling the page should not zoom the map by accident; a click on the map turns wheel zoom on.
    m.on("click", () => m.scrollWheelZoom.enable());
    m.on("mouseout", () => m.scrollWheelZoom.disable());
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => { m.remove(); map.current = null; };
  }, []);

  // Draw pins, and redraw whenever the zoom changes how they group.
  useEffect(() => {
    const m = map.current, group = layer.current;
    if (!m || !group) return;

    const draw = () => {
      group.clearLayers();
      els.current.clear();
      const placed: { x: number; y: number; items: Pin[] }[] = [];
      for (const p of pins) {
        const pt = m.latLngToLayerPoint([p.lat, p.lng]);
        const near = placed.find((g) => Math.hypot(g.x - pt.x, g.y - pt.y) < GROUP_WITHIN);
        if (near) near.items.push(p);
        else placed.push({ x: pt.x, y: pt.y, items: [p] });
      }
      for (const g of placed) {
        const one = g.items.length === 1 ? g.items[0] : null;
        const el = document.createElement("button");
        el.type = "button";
        el.className = one ? "lx-pin" : "lx-pin lx-pin-group";
        el.textContent = one ? one.label : String(g.items.length);
        el.setAttribute("aria-label", one ? `${one.name}, ${one.label}` : `${g.items.length} professionals here. Zoom in.`);
        const at = one ? L.latLng(one.lat, one.lng) : L.latLngBounds(g.items.map((i) => [i.lat, i.lng] as [number, number])).getCenter();
        const marker = L.marker(at, { icon: L.divIcon({ html: el, className: "lx-pin-wrap", iconSize: [0, 0] }), keyboard: false, riseOnHover: true }).addTo(group);
        for (const i of g.items) els.current.set(i.slug, el);
        if (one) {
          el.addEventListener("mouseenter", () => cb.current.onHover(one.slug));
          el.addEventListener("mouseleave", () => cb.current.onHover(null));
          el.addEventListener("click", (e) => { e.stopPropagation(); cb.current.onPick(one.slug); });
        } else {
          el.addEventListener("click", (e) => { e.stopPropagation(); m.fitBounds(L.latLngBounds(g.items.map((i) => [i.lat, i.lng] as [number, number])), { padding: [70, 70], maxZoom: 16 }); });
        }
        void marker;
      }
      const a = activeRef.current;
      if (a) els.current.get(a)?.classList.add("is-active");
    };

    if (pins.length > 0) {
      const b = L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number]));
      m.fitBounds(b, { padding: [56, 56], maxZoom: 14, animate: false });
    } else {
      m.setView([36.1627, -86.7816], 11, { animate: false });
    }
    draw();
    m.on("zoomend", draw);
    return () => { m.off("zoomend", draw); };
  }, [pins]);

  // Light up the pin for the card under the pointer.
  useEffect(() => {
    document.querySelectorAll(".lx-pin.is-active").forEach((e) => e.classList.remove("is-active"));
    if (active) els.current.get(active)?.classList.add("is-active");
  }, [active]);

  return <div ref={box} className="lx-map h-full w-full" role="application" aria-label="Map of results" />;
}
