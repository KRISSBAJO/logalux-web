"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AdminApiError, SESSION_COOKIE, adminFetch, adminUpload } from "@/lib/admin-api";
import { backTo, del, id, post, run, str } from "@/lib/action-helpers";
import { JOURNAL_CATEGORIES, PREVIEW_COOKIE } from "@/lib/journal";
import { slugFromTitle } from "@/lib/journal-md";

// The Journal: articles are written and published here. Saving answers the
// editor directly (what was typed is never lost to a redirect); publishing and
// the rest go back to the page with a message, as the console's forms do.

/** What the editor sends to be saved. */
export type ArticleInput = {
  id?: string; title: string; slug: string; dek: string; body_md: string; category: string; country: string; tags: string[];
  author_name: string; author_role: string; cover_media_id: string | null; cover_alt: string; featured: boolean;
  related_category: string | null; cta_text: string; seo_title: string; seo_description: string; sort: number;
};

const sentence = (m: string) => { const s = (m || "Something went wrong.").trim(); return s[0].toUpperCase() + s.slice(1) + (/[.?!]$/.test(s) ? "" : "."); };
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim().slice(0, max) : "");
const CATEGORY = new Set(JOURNAL_CATEGORIES.map((c) => c.key));

/** The fields as the API expects them, with nothing the browser should not decide. */
function clean(input: ArticleInput) {
  const title = text(input.title, 120);
  const category = CATEGORY.has(input.category) ? input.category : "";
  const related = input.related_category && CATEGORY.has(input.related_category) ? input.related_category : null;
  return {
    title,
    slug: text(input.slug, 80).toLowerCase() || slugFromTitle(title),
    dek: text(input.dek, 200),
    body_md: text(input.body_md, 200_000),
    category,
    country: input.country === "US" || input.country === "NG" ? input.country : "",
    tags: (Array.isArray(input.tags) ? input.tags : []).map((t) => text(t, 40)).filter(Boolean).slice(0, 12),
    author_name: text(input.author_name, 80) || "LogaLuxe editorial",
    author_role: text(input.author_role, 80),
    cover_media_id: typeof input.cover_media_id === "string" && /^[0-9a-f-]{36}$/i.test(input.cover_media_id) ? input.cover_media_id : null,
    cover_alt: text(input.cover_alt, 200),
    featured: !!input.featured,
    related_category: related,
    cta_text: text(input.cta_text, 80),
    seo_title: text(input.seo_title, 120),
    seo_description: text(input.seo_description, 200),
    sort: Number.isFinite(input.sort) ? Math.round(input.sort) : 0,
  };
}

/** Saves a new or an existing article. The editor keeps what was typed either way. */
export async function saveArticle(input: ArticleInput): Promise<{ ok: true; id: string; slug: string } | { ok: false; error: string }> {
  const body = clean(input);
  if (!body.title) return { ok: false, error: "Give it a title." };
  if (!body.category) return { ok: false, error: "Choose a category." };
  try {
    const out = input.id
      ? await adminFetch<{ ok?: boolean; id?: string; slug?: string }>(`/journal/${encodeURIComponent(input.id)}`, { method: "PUT", body })
      : await adminFetch<{ ok?: boolean; id?: string; slug?: string }>("/journal", { method: "POST", body });
    revalidatePath("/", "layout");
    const savedId = out.id || input.id || "";
    if (!savedId) return { ok: false, error: "Saved, but the API did not say which article it is. Open it from the list." };
    return { ok: true, id: savedId, slug: out.slug || body.slug };
  } catch (e) {
    return { ok: false, error: sentence((e as Error).message) };
  }
}

/** Asks the AI for a draft to fill the editor. A person reads and edits it before anything is published. */
export async function draftArticle(input: { topic: string; category: string; country: string; notes: string }): Promise<{ ok: true; draft: { title: string; dek: string; body_md: string; tags: string[] } } | { ok: false; error: string }> {
  const topic = text(input.topic, 200);
  if (topic.length < 4) return { ok: false, error: "Say what the article is about." };
  try {
    const out = await adminFetch<{ title?: string; dek?: string; body_md?: string; tags?: string[] }>("/journal/draft", {
      method: "POST",
      body: { topic, category: CATEGORY.has(input.category) ? input.category : "", country: input.country === "US" || input.country === "NG" ? input.country : "", notes: text(input.notes, 1000) },
    });
    return { ok: true, draft: { title: out.title ?? "", dek: out.dek ?? "", body_md: (out.body_md ?? "").replace(/\r\n?/g, "\n"), tags: Array.isArray(out.tags) ? out.tags.map(String) : [] } };
  } catch (e) {
    const err = e as AdminApiError;
    return { ok: false, error: err.status === 503 ? sentence(err.message || "Writing is not set up: the API has no OpenAI key.") : sentence(err.message) };
  }
}

/** Uploads a cover or an inline picture for an article, filed under its slug. Answers with the picture's id. */
export async function uploadArticleImage(fd: FormData): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const file = fd.get("file");
  const ref = str(fd, "ref").toLowerCase();
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image to upload." };
  if (file.size > 8 * 1024 * 1024) return { ok: false, error: "The image is too large. The limit is 8 MB." };
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(ref)) return { ok: false, error: "Save the draft first, so the picture can be filed under the article." };
  const out = new FormData();
  out.set("slot", "article");
  out.set("ref", ref);
  out.set("alt", str(fd, "alt"));
  out.set("file", file, file.name);
  try {
    const res = await adminUpload<{ id?: string; media?: { id?: string } }>("/media", out);
    const mediaId = res.id || res.media?.id;
    if (!mediaId) return { ok: false, error: "Uploaded, but the API did not answer with the picture's id." };
    return { ok: true, id: mediaId };
  } catch (e) {
    return { ok: false, error: sentence((e as Error).message) };
  }
}

// ---- state changes: forms that come back with a message ----

export async function publishArticle(fd: FormData) {
  const at = str(fd, "at");
  const when = at ? new Date(at) : null;
  if (at && (!when || Number.isNaN(when.getTime()))) return backTo(fd, "err", "Choose a date and time.");
  const scheduled = !!when && when.getTime() > Date.now() + 60_000;
  await run(fd, scheduled ? `Scheduled. It goes live by itself at ${when!.toLocaleString("en-GB", { timeZone: str(fd, "tz") || "UTC", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} (${str(fd, "tz") || "UTC"}).` : "Published. It is live on the site.", async () => {
    await post(`/journal/${id(fd)}/publish`, scheduled ? { at: when!.toISOString() } : {});
    revalidatePath("/", "layout");
  });
}
export async function unpublishArticle(fd: FormData) {
  await run(fd, "Taken off the site. It is a draft again.", async () => { await post(`/journal/${id(fd)}/unpublish`, {}); revalidatePath("/", "layout"); });
}
export async function archiveArticle(fd: FormData) {
  await run(fd, "Archived. It is off the site and out of the way.", async () => { await post(`/journal/${id(fd)}/archive`, {}); revalidatePath("/", "layout"); });
}
export async function deleteArticle(fd: FormData) {
  let error = "";
  try {
    await del(`/journal/${id(fd)}`);
  } catch (e) {
    error = sentence((e as Error).message);
  }
  if (error) return backTo(fd, "err", error);
  redirect(`/admin/journal?ok=${encodeURIComponent("Draft deleted.")}`);
}

/** Opens the article's public page as staff: a copy of the session token goes along, for ten minutes, only to /journal. */
export async function previewArticle(fd: FormData) {
  const slug = str(fd, "slug").toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,119}$/.test(slug)) return backTo(fd, "err", "Save the draft first, so it has an address to preview.");
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return backTo(fd, "err", "You are signed out.");
  jar.set(PREVIEW_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/journal", maxAge: 600 });
  redirect(`/journal/${slug}?preview=1`);
}
