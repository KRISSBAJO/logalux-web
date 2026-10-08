"use server";

import { mUpload } from "@/lib/merchant-api";
import { fid, mDel, mPost, mRun, str } from "@/lib/merchant-actions";
import { sentence } from "../shop-policy";

// Getting a business ready: the identity papers and the setup list.

// The API takes files up to 10 MB, but a form sent through this server may be
// 10 MB in all, so the file itself has to be a little smaller than that.
const MAX_BYTES = 9 * 1024 * 1024;

/** The API answers in plain words without a capital or a full stop; this tidies them for the page. */
async function tidy<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (e) {
    throw new Error(sentence((e as Error).message));
  }
}

export async function uploadDocument(fd: FormData) {
  const file = fd.get("file");
  await mRun(fd, "Document uploaded.", async () => {
    if (!(file instanceof File) || file.size === 0) throw new Error("Choose a file to upload.");
    if (file.size > MAX_BYTES) throw new Error("The file is too large. The limit is 9 MB.");
    const out = new FormData();
    out.set("kind", str(fd, "kind"));
    out.set("file", file, file.name);
    return tidy(() => mUpload("/verification/documents", out));
  });
}

export async function removeDocument(fd: FormData) {
  await mRun(fd, "Document removed.", () => tidy(() => mDel(`/verification/documents/${fid(fd)}`)));
}

export async function sendForChecking(fd: FormData) {
  await mRun(fd, "Sent. Your papers are with LogaLuxe now.", () => tidy(() => mPost("/verification/submit", { id_type: str(fd, "id_type"), note: str(fd, "note") })));
}

export async function dismissSetup(fd: FormData) {
  await mRun(fd, "The setup list is hidden from Home.", () => tidy(() => mPost("/onboarding/dismiss")));
}
