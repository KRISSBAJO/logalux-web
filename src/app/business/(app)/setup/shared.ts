// Helpers shared by the setup page and the setup card on Home. Everything here
// reads what GET /m/onboarding returned; nothing is worked out on its own.
import type { Row } from "@/lib/merchant-api";

/** The kinds of ID the API accepts, spelled exactly as it expects them. */
export const ID_TYPES = ["Driver's licence", "Passport", "National ID card", "Voter's card", "State ID"];

/** The order the kinds of document are offered in. Their labels come from the API. */
export const KIND_ORDER = ["id", "licence", "address"];

/** The most documents the API keeps for one business. */
export const MAX_DOCUMENTS = 10;

/** Where the identity check stands. */
export type Papers = "verified" | "waiting" | "needs_info" | "rejected" | "open";

export function papersState(ob: Row): Papers {
  const v = (ob.verification ?? {}) as Row;
  if (v.status === "verified") return "verified";
  if (v.request_status === "needs_info") return "needs_info";
  if (v.request_status === "rejected" || v.status === "rejected") return "rejected";
  if (v.submitted_at && v.request_status === "pending") return "waiting";
  return "open";
}

export type Step = { key: string; title: string; hint: string; href: string; done: boolean };

export const stepsOf = (ob: Row) => (Array.isArray(ob.steps) ? (ob.steps as Step[]) : []);

/** True while Home should show the setup card. */
export const setupOpen = (ob: Row) => !ob.dismissed && (!ob.live || stepsOf(ob).some((s) => !s.done));

const lower = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);

/** One plain sentence on where things stand, for the states that have no link in them. */
export function standing(ob: Row): string {
  const v = (ob.verification ?? {}) as Row;
  const note = String(v.decision_note ?? "").trim();
  const left = stepsOf(ob).filter((s) => !s.done);
  switch (papersState(ob)) {
    case "needs_info":
      return note ? `LogaLuxe asked for more: ${note}` : "LogaLuxe asked for more before your page can go live.";
    case "rejected":
      return note ? `Not approved: ${note}` : "Not approved. You can upload new papers and send them again.";
    case "waiting":
      return "Your papers are with LogaLuxe. We will email you when they are checked." + (left.length ? " You can finish the other steps while you wait." : "");
    case "verified":
      return "Your identity is confirmed. Your page is not live yet.";
    default:
      return left.length ? `Your page is not live yet. Still to do: ${left.map((s) => lower(s.title)).join("; ")}.` : "Your page is not live yet.";
  }
}

export function fileSize(bytes: number | null | undefined): string {
  const n = Number(bytes ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "0 KB";
  if (n < 1024) return `${n} bytes`;
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
