"use server";

import { fid, mBackTo, mPost, mPut, mRun, str } from "@/lib/merchant-actions";
import type { Row } from "@/lib/merchant-api";
import { deliveryResult } from "./delivery";

/** Adds a reply to a conversation and says what really happened to it. */
export async function replyThread(fd: FormData) {
  let out: Row = {}, error = "";
  try {
    out = (await mPost(`/inbox/${fid(fd)}/reply`, { body: str(fd, "body") })) as Row;
  } catch (e) {
    error = (e as Error).message || "Something went wrong.";
  }
  if (error) mBackTo(fd, "err", error[0].toUpperCase() + error.slice(1) + ".");
  const r = deliveryResult(String(out.delivery ?? ""), str(fd, "channel"));
  mBackTo(fd, r.kind, r.message);
}

/** Closes or reopens a conversation. */
export async function setThreadStatus(fd: FormData) {
  const status = str(fd, "status") === "closed" ? "closed" : "open";
  await mRun(fd, status === "closed" ? "Conversation closed. Find it under Closed." : "Conversation reopened.", () => mPut(`/inbox/${fid(fd)}`, { status }));
}

/** Gives a conversation to someone on the team, or to nobody. */
export async function assignThread(fd: FormData) {
  const staff = str(fd, "assigned_staff_id");
  await mRun(fd, staff ? "Conversation assigned." : "Conversation is now unassigned.", () => mPut(`/inbox/${fid(fd)}`, { assigned_staff_id: staff }));
}

/** Replaces the list of saved replies. Rows left empty are dropped. */
export async function saveReplies(fd: FormData) {
  const titles = fd.getAll("title").map((v) => String(v).trim()), bodies = fd.getAll("body").map((v) => String(v).trim());
  const replies = titles.map((title, i) => ({ title, body: bodies[i] ?? "" })).filter((r) => r.title && r.body);
  const half = titles.some((t, i) => (t === "") !== ((bodies[i] ?? "") === ""));
  if (half) mBackTo(fd, "err", "Each saved reply needs both a name and a message. Nothing was changed.");
  const long = replies.find((r) => r.title.length > 40 || r.body.length > 1000);
  if (long) mBackTo(fd, "err", `"${long.title.slice(0, 40)}" is too long. Keep names to 40 characters and messages to 1,000. Nothing was changed.`);
  await mRun(fd, (out) => `Saved replies updated. You have ${out.saved ?? replies.length}.`, () => mPut("/saved-replies", { replies }));
}

export type Draft = { ok: true; draft: string } | { ok: false; error: string };

/**
 * Asks the AI for a reply to a conversation. It only writes: the text goes into
 * the reply box for the person to read, change and send themselves.
 */
export async function draftReply(threadId: string, hint: string): Promise<Draft> {
  try {
    const out = (await mPost("/ai/reply", { thread_id: threadId, hint: hint.trim().slice(0, 300) })) as Row;
    const draft = String(out.draft ?? "").trim();
    return draft ? { ok: true, draft } : { ok: false, error: "Nothing came back. Try again." };
  } catch (e) {
    const m = (e as Error).message || "The draft could not be written.";
    return { ok: false, error: m[0].toUpperCase() + m.slice(1) + (/[.?!]$/.test(m) ? "" : ".") };
  }
}

/** The business gives its side of a problem a client reported. Once; it then goes to LogaLuxe to decide. */
export async function answerProblem(fd: FormData) {
  const statement = str(fd, "statement"), id = str(fd, "id");
  const fail = (message: string): never => {
    // Back to the open report, so the reason is read beside the form.
    const url = new URL(str(fd, "back") || "/business/inbox?tab=problems", "http://merchant");
    url.searchParams.set("problem", id);
    fd.set("back", url.pathname + url.search);
    return mBackTo(fd, "err", message);
  };
  if (statement.length < 20 || statement.length > 2000) fail("Write your answer in 20 to 2,000 characters. Nothing was sent.");
  let error = "";
  try {
    await mPost(`/problems/${fid(fd)}`, { statement });
  } catch (e) {
    const m = (e as Error).message || "Something went wrong";
    error = m[0].toUpperCase() + m.slice(1) + (/[.?]$/.test(m) ? "" : ".");
  }
  if (error) fail(error);
  mBackTo(fd, "ok", "Your answer was sent to LogaLuxe. They decide and email you and the client.");
}
