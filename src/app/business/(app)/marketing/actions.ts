"use server";

import { cents, fid, int, mBackTo, mDel, mPost, mPut, mRun, num, on, str } from "@/lib/merchant-actions";

// Marketing: the messages a business sends by itself, and one-off campaigns.

/** Turns an automation on or off, changes its wording, or both. */
export async function saveAutomation(fd: FormData) {
  const body: { enabled?: boolean; message?: string } = {};
  if (fd.has("message")) body.message = str(fd, "message");
  if (fd.has("enabled_set")) body.enabled = on(fd, "enabled");
  const done = body.message !== undefined ? "Saved." : body.enabled ? "Turned on." : "Turned off.";
  await mRun(fd, done, () => mPut(`/automations/${fid(fd, "key")}`, body));
}

/** Saves a campaign as a draft and opens it, ready for a test and then sending. */
export async function createCampaign(fd: FormData) {
  const channel = str(fd, "channel");
  let out: Record<string, unknown> = {}, error = "";
  try {
    out = await mPost("/campaigns", { name: str(fd, "name"), audience: str(fd, "audience"), channel, subject: channel === "email" ? str(fd, "subject") : "", message: str(fd, "message") });
  } catch (e) {
    error = (e as Error).message || "Something went wrong.";
  }
  if (error) mBackTo(fd, "err", error);
  fd.set("back", `/business/marketing?tab=camp&camp=${encodeURIComponent(String(out.id ?? ""))}`);
  const n = Number(out.recipients ?? 0);
  mBackTo(fd, "ok", `Draft saved. ${n} ${n === 1 ? "client is" : "clients are"} in this audience. Nothing has been sent yet.`);
}

export async function deleteCampaign(fd: FormData) {
  await mRun(fd, "Draft deleted.", () => mDel(`/campaigns/${fid(fd)}`));
}

/** The test always goes by email to the person signed in, whatever channel the campaign uses. */
export async function testCampaign(fd: FormData) {
  await mRun(
    fd,
    (out) => (out.status === "queued" ? `Test queued for ${out.to}. Delivery is not yet confirmed.` : out.status === "sent" ? `Test sent to ${out.to}.` : `Test recorded for ${out.to}, but not delivered: email is not connected, so it was only logged.`),
    () => mPost(`/campaigns/${fid(fd)}/test`),
  );
}

export async function sendCampaign(fd: FormData) {
  await mRun(fd, "Sending has started. It carries on in the background and the numbers fill in as it goes. Reload this page in a moment.", () => mPost(`/campaigns/${fid(fd)}/send`));
}

/**
 * Asks the AI for a draft of a campaign message. It only returns words for the
 * person to edit: nothing is saved and nothing is sent.
 */
export async function draftCampaign(audience: string, channel: string, goal: string): Promise<{ subject?: string; message?: string; error?: string }> {
  try {
    const out = await mPost("/ai/campaign", { audience: String(audience), channel: String(channel), goal: String(goal).slice(0, 400) });
    return { subject: String(out.subject ?? ""), message: String(out.message ?? "") };
  } catch (e) {
    return { error: (e as Error).message || "The draft could not be written. Try again." };
  }
}

// ---- new clients from LogaLuxe ----

/** The owner's offer to be promoted: extra points on new clients, a monthly budget, and a pause. */
export async function saveLeadSettings(fd: FormData) {
  const boost = Math.round(num(fd, "boost_pct") * 2) / 2, paused = on(fd, "paused");
  await mRun(
    fd,
    (out) => (out.running ? "Saved. You are promoted in search now." : boost > 0 && paused ? "Saved. Promotion is paused, so you are not promoted." : boost > 0 ? "Saved. Promotion is not running: this month's budget is already spent." : "Saved. Promotion is off."),
    () => mPut("/leads/settings", { boost_pct: boost, monthly_budget_cents: cents(fd, "budget"), paused }),
  );
}

export async function disputeLead(fd: FormData) {
  await mRun(fd, "Dispute sent. The LogaLuxe team will check it and the answer will show on this page.", () => mPost(`/leads/${fid(fd)}/dispute`, { reason: str(fd, "reason") }));
}

// ---- loyalty ----

export async function saveLoyalty(fd: FormData) {
  const enabled = on(fd, "enabled");
  await mRun(fd, enabled ? "Saved. Clients earn points from their next checkout." : "Saved. Loyalty is off: nobody earns or spends points.", () =>
    mPut("/loyalty/settings", { enabled, earn_points: int(fd, "earn_points"), per_cents: cents(fd, "per"), point_value_cents: cents(fd, "point_value"), min_redeem: int(fd, "min_redeem") }));
}

export async function adjustPoints(fd: FormData) {
  const points = int(fd, "points") * (str(fd, "dir") === "take" ? -1 : 1);
  await mRun(fd, (out) => `Done. They now have ${out.points} points.`, () => mPost("/loyalty/adjust", { client_id: str(fd, "client_id"), points, note: str(fd, "note") }));
}

// ---- promo codes ----

export async function createPromo(fd: FormData) {
  const kind = str(fd, "kind"), code = str(fd, "code").toUpperCase();
  const uses = str(fd, "max_uses");
  await mRun(fd, `Code ${code} is ready. It works on your booking page and at Checkout.`, () =>
    mPost("/promos", {
      code, description: str(fd, "description"), kind, value: kind === "fixed" ? cents(fd, "value") : int(fd, "value"),
      min_cents: cents(fd, "min"), max_uses: uses ? int(fd, "max_uses") : null, starts_at: str(fd, "starts_at"), ends_at: str(fd, "ends_at"),
    }));
}

/**
 * Changes a saved code. The code itself never changes. The kind and value only travel when the
 * form offered them (they are locked once the code has been used); an empty limit means no limit.
 */
export async function updatePromo(fd: FormData) {
  const uses = str(fd, "max_uses"), kind = str(fd, "kind");
  const body: Record<string, unknown> = {
    description: str(fd, "description"), min_cents: cents(fd, "min"), max_uses: uses ? int(fd, "max_uses") : null, no_limit: !uses,
    starts_at: str(fd, "starts_at"), ends_at: str(fd, "ends_at"),
  };
  if (kind) { body.kind = kind; body.value = kind === "fixed" ? cents(fd, "value") : int(fd, "value"); }
  await mRun(fd, "Code saved.", async () => {
    try {
      return await mPut(`/promos/${fid(fd)}`, body);
    } catch (e) {
      // The API answers in a plain sentence; it only needs a capital letter.
      const m = (e as Error).message || "Something went wrong.";
      throw new Error(m[0].toUpperCase() + m.slice(1) + (/[.?!]$/.test(m) ? "" : "."));
    }
  });
}

export async function togglePromo(fd: FormData) {
  const active = on(fd, "active");
  await mRun(fd, active ? "Code switched on." : "Code switched off. It no longer works.", () => mPut(`/promos/${fid(fd)}`, { active }));
}

export async function deletePromo(fd: FormData) {
  await mRun(fd, "Code deleted.", () => mDel(`/promos/${fid(fd)}`));
}
