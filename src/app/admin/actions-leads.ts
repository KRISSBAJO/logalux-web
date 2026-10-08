"use server";

import { id, num, post, put, run, str } from "@/lib/action-helpers";

// Decisions about leads: refunding or upholding a disputed fee, and the
// adjustment to the lead rate for one kind of business.

export async function resolveLead(fd: FormData) {
  const outcome = str(fd, "outcome");
  await run(fd, outcome === "refund" ? "Fee refunded to the business's balance." : "Charge upheld.", () => post(`/leads/${id(fd)}/resolve`, { outcome, note: str(fd, "note") }));
}

export async function setLeadRate(fd: FormData) {
  const delta = num(fd, "delta");
  await run(fd, delta === 0 ? "Adjustment removed." : "Adjustment saved. It applies to new leads.", () => put("/leads/rates", { market: str(fd, "market"), category: str(fd, "category"), delta_pct: delta }));
}
