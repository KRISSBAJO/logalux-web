"use server";

import { mUpload } from "@/lib/merchant-api";
import { fid, list, mDel, mPost, mPut, mRun, on, str } from "@/lib/merchant-actions";
import { policyWithLanguages, sentence } from "../shop-policy";

// The storefront: the words, photos and switches of the public booking page,
// and the replies to its reviews. A save goes live at once; there is no draft.

/**
 * Saves the page. The API replaces every text field in one go, so each form
 * sends them all (the ones it does not show travel as hidden fields). Only
 * the display switches named in `display_keys` are touched.
 */
export async function saveStorefront(fd: FormData) {
  const seen = new Set<string>();
  const highlights = [...fd.getAll("highlights").map((v) => String(v).trim()), ...list(fd, "highlights_more")].filter((h) => {
    const key = h.toLowerCase();
    if (!h || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const keys = str(fd, "display_keys").split(",").filter(Boolean);
  const display: Record<string, boolean | string> = {};
  for (const k of keys) display[k] = k === "notice" ? str(fd, "notice") : on(fd, k);
  const slug = str(fd, "slug").toLowerCase(), was = str(fd, "old_slug");

  await mRun(
    fd,
    (out) => (out.slug && out.slug !== was ? `Saved. Your page has moved to /b/${out.slug}. Links to /b/${was} no longer work, so update them wherever you shared them.` : "Saved. Your page is up to date."),
    async () => {
      if (highlights.length > 6) throw new Error("Pick up to six highlights.");
      return mPut("/storefront", {
        name: str(fd, "name"), slug, tagline: str(fd, "tagline"), about: str(fd, "about"), category: str(fd, "category"), highlights,
        instagram: str(fd, "instagram"), tiktok: str(fd, "tiktok"), website: str(fd, "website"), tone: str(fd, "tone").toUpperCase(),
        ...(keys.length ? { display } : {}),
      });
    },
  );
}

export async function uploadPhoto(fd: FormData) {
  const file = fd.get("file");
  await mRun(fd, "Photo added.", async () => {
    if (!(file instanceof File) || file.size === 0) throw new Error("Choose a photo to upload.");
    if (file.size > 8 * 1024 * 1024) throw new Error("The photo is too large. The limit is 8 MB.");
    const out = new FormData();
    out.set("alt", str(fd, "alt"));
    out.set("file", file, file.name);
    return mUpload("/storefront/photos", out);
  });
}

/** One logo per business. A new one replaces the old. */
export async function uploadLogo(fd: FormData) {
  const file = fd.get("file");
  await mRun(fd, "Logo saved. It shows on your page now.", async () => {
    if (!(file instanceof File) || file.size === 0) throw new Error("Choose an image to upload.");
    if (file.size > 8 * 1024 * 1024) throw new Error("The image is too large. The limit is 8 MB.");
    const out = new FormData();
    out.set("file", file, file.name);
    return mUpload("/storefront/logo", out);
  });
}

export async function removeLogo(fd: FormData) {
  await mRun(fd, "Logo removed. Your page shows your first letter instead.", () => mDel("/storefront/logo"));
}

/** Saves a new order. The first photo is the cover. */
export async function orderPhotos(fd: FormData) {
  const ids = str(fd, "ids").split(",").filter(Boolean);
  await mRun(fd, "Order saved.", () => mPut("/storefront/photos", { ids }));
}

export async function updatePhoto(fd: FormData) {
  const cover = on(fd, "cover");
  const body: { alt?: string; cover?: boolean } = {};
  if (fd.has("alt")) body.alt = str(fd, "alt");
  if (cover) body.cover = true;
  await mRun(fd, cover ? "This photo is now the cover." : "Description saved.", () => mPut(`/storefront/photos/${fid(fd)}`, body));
}

export async function deletePhoto(fd: FormData) {
  await mRun(fd, "Photo deleted.", () => mDel(`/storefront/photos/${fid(fd)}`));
}

export async function replyReview(fd: FormData) {
  const reply = str(fd, "reply");
  await mRun(fd, reply ? "Reply saved. It shows under the review on your page." : "Reply removed.", () => mPost(`/reviews/${fid(fd)}`, { reply }));
}

export async function pinReview(fd: FormData) {
  const pinned = on(fd, "pinned");
  await mRun(fd, pinned ? "Pinned. It now shows first on your page." : "Unpinned.", () => mPost(`/reviews/${fid(fd)}`, { pinned }));
}

/**
 * Saves the languages the business speaks. They are stored with the shop policy,
 * which the API replaces whole, so the form carries the other values back as they were.
 */
export async function saveLanguages(fd: FormData) {
  await mRun(fd, (out) => (out.n ? "Saved. Your page now lists the languages you speak." : "Saved. Your page no longer lists any languages."), async () => {
    const body = policyWithLanguages(fd);
    try {
      await mPut("/shop-policy", body);
    } catch (e) {
      throw new Error(sentence((e as Error).message));
    }
    return { n: body.languages.length };
  });
}
