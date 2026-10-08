"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

/**
 * A small map with one pin that can be dragged, so a business can see where
 * its address landed and put the pin right when it is wrong.
 */
export function PinMap({ lat, lng, approximate, onMove }: { lat: number; lng: number; /** Only the city was found: say so on the pin. */ approximate: boolean; onMove: (lat: number, lng: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pin = useRef<L.Marker | null>(null);
  const move = useRef(onMove);
  move.current = onMove;

  useEffect(() => {
    if (!box.current || map.current) return;
    const m = L.map(box.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(m);
    m.on("click", () => m.scrollWheelZoom.enable());
    map.current = m;
    return () => { m.remove(); map.current = null; pin.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const el = document.createElement("span");
    el.className = approximate ? "lx-pin lx-pin-area" : "lx-pin";
    el.textContent = approximate ? "About here" : "Here";
    const icon = L.divIcon({ html: el, className: "lx-pin-wrap", iconSize: [0, 0] });
    if (!pin.current) {
      pin.current = L.marker([lat, lng], { icon, draggable: true, keyboard: true, title: "Drag to where the business is" }).addTo(m);
      pin.current.on("dragend", () => { const p = pin.current!.getLatLng(); move.current(Math.round(p.lat * 1e6) / 1e6, Math.round(p.lng * 1e6) / 1e6); });
    } else {
      pin.current.setLatLng([lat, lng]);
      pin.current.setIcon(icon);
    }
    m.setView([lat, lng], approximate ? 12 : 16, { animate: false });
  }, [lat, lng, approximate]);

  return <div ref={box} className="lx-map h-[220px] w-full overflow-hidden rounded-xl border border-line" role="application" aria-label="Map with the business's pin. Drag the pin to move it." />;
}
