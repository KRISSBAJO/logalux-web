// What a business tells shoppers: the languages it speaks, returns, delivery
// time and same-day pick-up. The API replaces all six values in one go, so the
// two forms that change them (Storefront for languages, Online orders for the
// rest) each send the whole set. This file is not marked "use server".
import { str } from "@/lib/merchant-actions";

export type ShopPolicy = {
  languages: string[];
  returns_days: number | null;
  returns_note: string;
  ship_days_min: number | null;
  ship_days_max: number | null;
  pickup_ready_mins: number | null;
};

/** A number the business may leave unstated. Empty travels to the API as null, never as 0. */
function orNull(fd: FormData, key: string): number | null {
  const raw = str(fd, key);
  if (raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error("Enter whole numbers only.");
  return Math.round(n);
}

/** A number that goes with a choice. It is needed only when that choice is the one picked. */
function need(fd: FormData, key: string, missing: string): number {
  const n = orNull(fd, key);
  if (n === null) throw new Error(missing);
  return n;
}

const languages = (fd: FormData) => [...new Set(fd.getAll("languages").map((v) => String(v).trim()).filter(Boolean))];

/** The Storefront form: the ticked languages, with the rest carried back unchanged. */
export function policyWithLanguages(fd: FormData): ShopPolicy {
  return {
    languages: languages(fd),
    returns_days: orNull(fd, "returns_days"), returns_note: str(fd, "returns_note"),
    ship_days_min: orNull(fd, "ship_days_min"), ship_days_max: orNull(fd, "ship_days_max"),
    pickup_ready_mins: orNull(fd, "pickup_ready_mins"),
  };
}

/** The shop policy form: returns, delivery and pick-up as chosen, with the languages carried back unchanged. */
export function policyFromChoices(fd: FormData): ShopPolicy {
  const returns = str(fd, "returns_mode"), ship = str(fd, "ship_mode"), pickup = str(fd, "pickup_mode");
  const shipOn = ship === "days";
  return {
    languages: languages(fd),
    returns_days: returns === "days" ? need(fd, "returns_n", "Enter how many days you take returns for.") : returns === "no" ? 0 : null,
    returns_note: str(fd, "returns_note"),
    ship_days_min: shipOn ? need(fd, "ship_min", "Enter the shortest and the longest delivery time.") : null,
    ship_days_max: shipOn ? need(fd, "ship_max", "Enter the shortest and the longest delivery time.") : null,
    pickup_ready_mins: pickup === "mins" ? need(fd, "pickup_n", "Enter how many minutes an order takes to get ready.") : null,
  };
}

/** The API answers in lower case without a full stop. Shown to a person, it reads as a sentence. */
export function sentence(message: string): string {
  const s = message.trim();
  if (!s) return "Something went wrong.";
  return s[0].toUpperCase() + s.slice(1) + (/[.?]$/.test(s) ? "" : ".");
}
