"use server";

import { mFetch, type Row } from "@/lib/merchant-api";
import { fid, int, mDel, mPost, mPut, mRun, on, str } from "@/lib/merchant-actions";

// The questions a business asks when a client books online.

/** The API answers with a plain sentence that starts in lower case: show it as a sentence. */
async function said<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (e) {
    const text = ((e as Error).message || "Something went wrong.").trim();
    throw new Error(text.charAt(0).toUpperCase() + text.slice(1) + (/[.?!]$/.test(text) ? "" : "."));
  }
}

function fields(fd: FormData) {
  const kind = str(fd, "kind");
  return {
    service_id: str(fd, "service_id"),
    label: str(fd, "label"),
    kind,
    options: kind === "choice" ? String(fd.get("options") ?? "").split(/\r?\n/).map((o) => o.trim()).filter(Boolean) : [],
    // A box the client must tick is always required; its checkbox is disabled, so it is not sent.
    required: kind === "consent" || on(fd, "required"),
    sort: Math.max(0, int(fd, "sort")),
    active: on(fd, "active"),
  };
}

export async function questionCreate(fd: FormData) {
  const q = fields(fd);
  await mRun(fd, q.active ? "Added. Clients are asked it the next time they book online." : "Added, switched off. Switch it on when you want it asked.", () => said(() => mPost("/intake", q)));
}

export async function questionSave(fd: FormData) {
  await mRun(fd, "Saved. Past bookings keep what was asked at the time.", () => said(() => mPut(`/intake/${fid(fd)}`, fields(fd))));
}

/** Switches one question on or off and leaves the rest of it as it is. */
export async function questionToggle(fd: FormData) {
  const id = str(fd, "id");
  let now = false;
  await mRun(fd, () => (now ? "Switched on. Clients are asked it when they book online." : "Switched off. Clients are no longer asked it."), () => said(async () => {
    const all = ((await mFetch("/intake")).questions ?? []) as Row[];
    const q = all.find((x) => x.id === id);
    if (!q) throw new Error("That question no longer exists.");
    now = !q.active;
    return mPut(`/intake/${encodeURIComponent(id)}`, { service_id: q.service_id ?? "", label: q.label, kind: q.kind, options: q.options ?? [], required: !!q.required, sort: q.sort ?? 0, active: now });
  }));
}

export async function questionDelete(fd: FormData) {
  await mRun(fd, (out) => (out.switched_off ? "This question has answers, so it was switched off instead of removed. Past bookings keep what was asked." : "Removed."), () => said(() => mDel(`/intake/${fid(fd)}`)));
}
