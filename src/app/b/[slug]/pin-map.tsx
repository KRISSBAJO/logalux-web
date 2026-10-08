"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

/** A small map with one pin where the business is. OpenStreetMap tiles, no key needed. */
export function PinMap({ lat, lng, label, name }: { lat: number; lng: number; label: string; name: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let off = false;
    let remove = () => {};
    // The map library needs a browser, so it is loaded only there.
    import("leaflet").then(({ default: L }) => {
      if (off || !box.current) return;
      const m = L.map(box.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false, dragging: !L.Browser.mobile, zoomSnap: 0.5 });
      L.control.zoom({ position: "bottomright" }).addTo(m);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(m);
      m.setView([lat, lng], 15, { animate: false });
      const el = document.createElement("span");
      el.className = "lx-pin";
      el.textContent = label;
      L.marker([lat, lng], { icon: L.divIcon({ html: el, className: "lx-pin-wrap", iconSize: [0, 0] }), keyboard: false, interactive: false }).addTo(m);
      remove = () => m.remove();
    }).catch(() => {});
    return () => { off = true; remove(); };
  }, [lat, lng, label]);
  return <div ref={box} className="lx-map" style={{ height: "100%", width: "100%" }} role="application" aria-label={`Map showing where ${name} is`} />;
}
