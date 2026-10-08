"use client";

// How far a business is from the visitor. The position is asked for only when
// the visitor presses a control, is kept in this tab's sessionStorage, and
// never leaves the browser: it is not sent to the server or put in an address.
import { useCallback, useSyncExternalStore } from "react";

export type Point = { lat: number; lng: number };
export type NearStatus = "idle" | "asking" | "denied" | "failed" | "unsupported";

const KEY = "lx_near";
const listeners = new Set<() => void>();
let status: NearStatus = "idle";
let cached: { raw: string | null; point: Point | null } = { raw: null, point: null };

const valid = (p: unknown): p is Point => {
  const q = p as Point | null;
  return !!q && Number.isFinite(q.lat) && Number.isFinite(q.lng) && Math.abs(q.lat) <= 90 && Math.abs(q.lng) <= 180;
};

function read(): Point | null {
  let raw: string | null = null;
  try { raw = window.sessionStorage.getItem(KEY); } catch {}
  if (raw === cached.raw) return cached.point; // the same object each time, so React does not redraw for nothing
  let point: Point | null = null;
  try { const p = raw ? JSON.parse(raw) : null; if (valid(p)) point = { lat: p.lat, lng: p.lng }; } catch {}
  cached = { raw, point };
  return point;
}

function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
const none = () => null;
const idle = (): NearStatus => "idle";

/** The visitor's position once they have shared it, and the ways to ask for it and to forget it. */
export function usePosition() {
  const point = useSyncExternalStore(subscribe, read, none);
  const state = useSyncExternalStore(subscribe, () => status, idle);
  const ask = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { status = "unsupported"; emit(); return; }
    status = "asking"; emit();
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Three decimals is about a hundred metres: enough for a distance, and no more exact than it needs to be.
        const p = { lat: Math.round(pos.coords.latitude * 1000) / 1000, lng: Math.round(pos.coords.longitude * 1000) / 1000 };
        const raw = JSON.stringify(p);
        try { window.sessionStorage.setItem(KEY, raw); } catch {}
        cached = { raw, point: p }; // kept for this page even where the browser will not store it
        let stored: string | null = null;
        try { stored = window.sessionStorage.getItem(KEY); } catch {}
        if (stored !== raw) cached = { raw: stored, point: p };
        status = "idle"; emit();
      },
      (err) => { status = err.code === err.PERMISSION_DENIED ? "denied" : "failed"; emit(); },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 },
    );
  }, []);
  const forget = useCallback(() => {
    try { window.sessionStorage.removeItem(KEY); } catch {}
    let stored: string | null = null;
    try { stored = window.sessionStorage.getItem(KEY); } catch {}
    cached = { raw: stored, point: null };
    status = "idle"; emit();
  }, []);
  return { point, status: state, ask, forget };
}

/** Kilometres between two points on the globe (Haversine). */
export function kmBetween(a: Point, b: Point): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "2.3 mi" or "14 km": miles for a US business, kilometres for a Nigerian one; one decimal under ten, whole numbers above. */
export function distanceLabel(km: number, miles: boolean): string {
  const n = miles ? km / 1.609344 : km;
  if (!Number.isFinite(n)) return "";
  const shown = n < 9.95 ? (Math.round(n * 10) / 10).toFixed(1) : Math.round(n).toLocaleString("en-US");
  return `${shown} ${miles ? "mi" : "km"}`;
}

/** The distance from the visitor to a place, as text, or "" when either end is unknown. */
export function distanceTo(from: Point | null, to: { lat?: number | null; lng?: number | null }, miles: boolean): string {
  if (!from || typeof to.lat !== "number" || typeof to.lng !== "number") return "";
  return distanceLabel(kmBetween(from, { lat: to.lat, lng: to.lng }), miles);
}

/** What to say when the position could not be had. */
export function nearProblem(s: NearStatus): string {
  if (s === "denied") return "Your browser did not share your location. You can allow it in the browser's site settings.";
  if (s === "failed") return "We could not get your location. Try again in a moment.";
  if (s === "unsupported") return "This browser cannot share a location.";
  return "";
}
