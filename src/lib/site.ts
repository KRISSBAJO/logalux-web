// Where the site lives on the public internet. Canonical addresses, the
// sitemap and structured data are all built from this one value.

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://logaluxe.com").replace(/\/+$/, "");
export const SITE_NAME = "LogaLuxe";

/** A path on this site as a full address. */
export const absoluteUrl = (path = "/") => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

/** Leftover test data that must never reach a search engine. */
export function isTestEntry(...labels: (string | null | undefined)[]) {
  return labels.some((l) => /^(e2e|scale test|test )/i.test((l ?? "").trim()));
}

/** Text cut to a length at a word, for a description. */
export function clip(text: string, max = 200) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 40)).replace(/[\s,;:.]+$/, "")}…`;
}
