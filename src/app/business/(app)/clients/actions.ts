"use server";

import { redirect } from "next/navigation";
import { fid, int, list, mBackTo, mPost, mPut, mRun, on, str } from "@/lib/merchant-actions";
import { qs, type Row } from "@/lib/merchant-api";
import { deliveryResult } from "../inbox/delivery";

/** API messages come as "that phone number…": show them as a sentence. */
const sentence = (m: string) => m[0].toUpperCase() + m.slice(1) + (/[.?!]$/.test(m) ? "" : ".");

const clientBody = (fd: FormData) => ({
  name: str(fd, "name"),
  phone: str(fd, "phone"),
  email: str(fd, "email"),
  notes: str(fd, "notes"),
  tags: list(fd, "tags").map((t) => t.toLowerCase()),
  birthday: str(fd, "birthday"),
  preferred_channel: str(fd, "preferred_channel") || "whatsapp",
  marketing_opt_in: on(fd, "marketing_opt_in"),
});

/** Adds a client, then opens them in the side panel. */
export async function createClient(fd: FormData) {
  await mRun(fd, "Client added.", async () => {
    const out = (await mPost("/clients", clientBody(fd))) as Row;
    if (out.id) fd.set("back", "/business/clients" + qs({ client: out.id }));
    return out;
  });
}

export async function updateClient(fd: FormData) {
  await mRun(fd, "Client saved.", () => mPut(`/clients/${fid(fd)}`, clientBody(fd)));
}

// One line of a pasted list: commas or tabs, with quotes allowed around a cell.
function cells(line: string): string[] {
  if (line.includes("\t")) return line.split("\t");
  const out: string[] = [];
  let cur = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === "," || ch === ";") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const EMAIL = /^\S+@\S+\.\S+$/, PHONE = /^\+?[\d\s().-]{7,}$/;

/** Reads pasted rows. The email and the phone are recognised wherever they sit on the line. */
function parseRows(text: string) {
  const rows: { name: string; phone: string; email: string; notes: string }[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  lines.forEach((line, i) => {
    const parts = cells(line).map((c) => c.trim()).filter(Boolean);
    let name = "", phone = "", email = "";
    const rest: string[] = [];
    for (const c of parts) {
      if (!email && EMAIL.test(c)) email = c;
      else if (!phone && PHONE.test(c)) phone = c;
      else if (!name) name = c;
      else rest.push(c);
    }
    // A heading row such as "name, phone, email" is not a client.
    if (i === 0 && !phone && !email && /^(name|full name|client|client name)$/i.test(name)) return;
    rows.push({ name, phone, email, notes: rest.join(", ") });
  });
  return rows;
}

export async function importClients(fd: FormData) {
  const rows = parseRows(str(fd, "rows"));
  if (!rows.length) mBackTo(fd, "err", "Paste at least one client: a name, then a phone number or an email.");
  let out: Row = {}, error = "";
  try {
    out = (await mPost("/clients/import", { rows })) as Row;
  } catch (e) {
    error = sentence((e as Error).message || "Something went wrong");
  }
  if (error) mBackTo(fd, "err", error);
  const added = Number(out.added ?? 0), skipped = Number(out.skipped ?? 0);
  const problems = ((out.problems ?? []) as string[]).join("; ");
  const message = `${added} added, ${skipped} skipped.` + (skipped ? ` Rows are skipped when the phone or email is already in your list or does not look right.${problems ? " " + problems + "." : ""}` : "");
  mBackTo(fd, added > 0 ? "ok" : "err", message);
}

/** Starts a conversation with a client (or adds to the one already open) and goes to it in the Inbox. */
export async function messageClient(fd: FormData) {
  let out: Row = {}, error = "";
  try {
    out = (await mPost("/inbox", { client_id: str(fd, "client_id"), channel: str(fd, "channel"), body: str(fd, "body") })) as Row;
  } catch (e) {
    error = sentence((e as Error).message || "Something went wrong");
  }
  if (error) mBackTo(fd, "err", error);
  // The API picks the channel when none is chosen, so say only what is known.
  const r = deliveryResult(String(out.delivery ?? ""), str(fd, "channel"));
  const message = str(fd, "channel") || out.delivery !== "logged" ? r.message : "Message logged, not sent. Open the conversation to see the channel it was logged on.";
  redirect("/business/inbox" + qs({ thread: out.id, [r.kind]: message }));
}

/** Cancels or brings back a package or membership a client holds. */
export async function planAction(fd: FormData) {
  const action = str(fd, "action") === "reactivate" ? "reactivate" : "cancel";
  const kind = str(fd, "kind");
  const done = action === "reactivate" ? "It is active again."
    : kind === "membership" ? "Membership cancelled. It will not renew, and the member discount has stopped."
    : "Package cancelled. The visits left on it are gone.";
  await mRun(fd, done, () => mPost(`/client-plans/${fid(fd)}`, { action }));
}

/** Adds loyalty points to a client, or takes some away, with the reason. */
export async function adjustPoints(fd: FormData) {
  const points = int(fd, "points");
  await mRun(fd, (out) => `${points > 0 ? `${points} points added` : `${-points} points taken away`}. They now have ${out.points ?? "their new balance of"} points.`,
    () => mPost("/loyalty/adjust", { client_id: str(fd, "client_id"), points, note: str(fd, "note") }));
}
