"use client";

// "Near me". The device is asked where it is only when a person presses a
// control that calls findMe(). The position is rounded to about a hundred
// metres, turned into a place by our own server, and kept in the same cookie
// as a place chosen by hand, so search can order results by distance.
import { keepChosen, rememberRefusal, toChosen, type Place } from "./place";

export type FoundMe = { ok: true; place: Place } | { ok: false; why: string };

const position = () =>
  new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 }));

export async function findMe(home = ""): Promise<FoundMe> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return { ok: false, why: "This browser cannot share a location. Choose a place instead." };
  let pos: GeolocationPosition;
  try {
    pos = await position();
  } catch (e) {
    const denied = (e as GeolocationPositionError).code === 1;
    if (denied) rememberRefusal(); // the site carries on with the approximate place
    return { ok: false, why: denied ? "Your browser did not share your location. You can allow it in the browser's site settings, or choose a place." : "We could not get your location. Try again, or choose a place." };
  }
  const lat = Math.round(pos.coords.latitude * 1000) / 1000, lng = Math.round(pos.coords.longitude * 1000) / 1000;
  try {
    const res = await fetch(`/api/places/reverse?${new URLSearchParams({ lat: String(lat), lng: String(lng) })}`);
    const data = (await res.json()) as { place?: Place; error?: string };
    if (!res.ok || !data.place) return { ok: false, why: data.error ?? "We found you, but could not name the place. Choose one instead." };
    // The device's own position is kept, so distances are from where the person is, not from the middle of the town.
    const place = { ...data.place, label: data.place.label || "Your location", lat, lng };
    keepChosen(toChosen(place, "device", data.place.country && data.place.kind !== "point" ? data.place.country : home));
    return { ok: true, place };
  } catch {
    return { ok: false, why: "We could not look up where you are just now. Choose a place instead." };
  }
}
