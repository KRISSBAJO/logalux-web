// What a form built with <LocationFields> sends, read into the shape the API takes
// (POST /v1/m/signup, POST and PUT /v1/m/locations, POST /v1/admin/businesses, PUT /v1/admin/locations).

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export function locationBody(fd: FormData): Record<string, unknown> {
  const body: Record<string, unknown> = { address: s(fd, "address"), city: s(fd, "city"), region: s(fd, "region") };
  if (s(fd, "country")) body.country = s(fd, "country");
  // A pin the person dragged. Without one the API finds the position from the address.
  const lat = Number(s(fd, "lat")), lng = Number(s(fd, "lng"));
  if (s(fd, "lat") !== "" && s(fd, "lng") !== "" && Number.isFinite(lat) && Number.isFinite(lng)) { body.lat = lat; body.lng = lng; }
  if (fd.has("travels")) {
    body.travels = s(fd, "travels") === "1";
    const km = s(fd, "travel_radius_km");
    if (body.travels && km !== "") body.travel_radius_km = Math.max(0, Math.round(Number(km) || 0)); // 0 means no limit
  }
  return body;
}

/** What a save says about the pin, for the message after it. */
export function pinWords(position: string | undefined): string {
  switch (position) {
    case "found": case "found from the address": return " The pin was placed from the address.";
    case "approximate": return " Only the city was found, so the pin is the city centre. Check the street, or place the pin on the map.";
    case "set by hand": return " The pin is where you put it.";
    case "not found": return " We could not find that address on the map. Check the street and city, or place the pin on the map.";
  }
  return "";
}

/** The class names of the form <LocationFields> sits in, so it looks native in sign-up, the business console and the staff console. */
export type FieldLook = { field: string; label: string; input: string; hint: string; button: string };

/** The look of each form this is used in. */
export const LOOKS: Record<"auth" | "merchant" | "admin", FieldLook> = {
  auth: { field: "field", label: "text-[11px] font-semibold uppercase tracking-[.06em] text-muted", input: "", hint: "text-[12.5px] leading-snug text-muted", button: "btn btn-out btn-sm" },
  merchant: { field: "field", label: "", input: "", hint: "muted text-[12.5px]", button: "btn btn-out btn-sm" },
  admin: { field: "flex min-w-0 flex-col gap-1.5", label: "text-[11px] font-semibold uppercase tracking-[.06em] text-muted", input: "h-10 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-[14px] text-ink outline-none focus:border-ink", hint: "text-[12.5px] leading-snug text-muted", button: "inline-flex h-9 items-center rounded-full border border-line bg-white px-4 text-[13px] font-semibold text-ink hover:border-ink disabled:opacity-50" },
};
