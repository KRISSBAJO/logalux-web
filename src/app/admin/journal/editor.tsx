"use client";

import "@/app/cx-css/journal.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type ChangeEvent, type DragEvent } from "react";
import { Btn, Field, Hidden, Panel, Pill, inputCls } from "@/components/admin-ui";
import { Icon } from "@/components/icons";
import { JournalBlocks } from "@/components/journal-md";
import { CategoryMotif } from "@/components/journal-cards";
import type { Row } from "@/lib/admin-api";
import { JOURNAL_CATEGORIES, JOURNAL_COUNTRIES, journalCategory } from "@/lib/journal";
import { parseMarkdown, readingMinutes, slugFromTitle, wordCount } from "@/lib/journal-md";
import { zoneName } from "@/lib/place";
import { archiveArticle, deleteArticle, draftArticle, previewArticle, publishArticle, saveArticle, unpublishArticle, uploadArticleImage, type ArticleInput } from "./actions";

const area = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-ink";
const MIN_WORDS = 300;

/** "12 of 120" in grey, or wine when outside the range. */
function Count({ n, min = 0, max }: { n: number; min?: number; max: number }) {
  const bad = n > max || (min > 0 && n > 0 && n < min);
  return <span className={`ml-auto text-[11px] font-medium normal-case tracking-normal ${bad ? "text-bad" : "text-muted-2"}`}>{n} of {max}{min > 0 && n < min ? ` · at least ${min}` : ""}</span>;
}

/**
 * The article editor: the fields and the Markdown on the left, how it reads on
 * the right (tabs on a phone), pictures by upload, an AI draft to start from,
 * and the buttons that change its state. Saving never leaves the page.
 */
export function ArticleEditor({ article, canWrite, canPublish, back }: { article: Row | null; canWrite: boolean; canPublish: boolean; back: string }) {
  const router = useRouter();
  const a = article ?? {};
  const status: string = a.status ?? "draft";
  const isDraft = !article || status === "draft";
  const [title, setTitle] = useState<string>(a.title ?? "");
  const [slug, setSlug] = useState<string>(a.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!a.slug);
  const [dek, setDek] = useState<string>(a.dek ?? "");
  const [body, setBody] = useState<string>((a.body_md ?? "").replace(/\r\n?/g, "\n"));
  const [category, setCategory] = useState<string>(a.category ?? "");
  const [country, setCountry] = useState<string>(a.country ?? "");
  const [tags, setTags] = useState<string>((a.tags ?? []).join(", "));
  const [authorName, setAuthorName] = useState<string>(a.author_name ?? "LogaLuxe editorial");
  const [authorRole, setAuthorRole] = useState<string>(a.author_role ?? "");
  const [coverId, setCoverId] = useState<string | null>(a.cover_media_id ?? null);
  const [coverAlt, setCoverAlt] = useState<string>(a.cover_alt ?? "");
  const [featured, setFeatured] = useState<boolean>(!!a.featured);
  const [related, setRelated] = useState<string>(a.related_category ?? "");
  const [cta, setCta] = useState<string>(a.cta_text ?? "");
  const [seoTitle, setSeoTitle] = useState<string>(a.seo_title ?? "");
  const [seoDescription, setSeoDescription] = useState<string>(a.seo_description ?? "");
  const [sort, setSort] = useState<number>(Number(a.sort ?? 0));

  const [dirty, setDirty] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, startSave] = useTransition();
  const [pane, setPane] = useState<"write" | "read">("write");
  const [over, setOver] = useState(false);
  const [uploading, setUploading] = useState<"" | "cover" | "inline">("");
  const [inlineAlt, setInlineAlt] = useState("");
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [drafting, startDraft] = useTransition();
  const [when, setWhen] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const coverFile = useRef<HTMLInputElement>(null);
  const inlineFile = useRef<HTMLInputElement>(null);

  const zone = useMemo(() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "UTC"; } }, []);
  const blocks = useMemo(() => parseMarkdown(body), [body]);
  const words = useMemo(() => wordCount(body), [body]);
  const minutes = readingMinutes(words);
  const cat = journalCategory(category);
  const tagList = tags.split(/[,\n]/).map((t) => t.trim()).filter(Boolean);
  const shortTitle = title.trim().length > 0 && title.trim().length < 8;
  const shortDek = dek.trim().length > 0 && dek.trim().length < 20;
  const canPublishNow = words >= MIN_WORDS && title.trim().length >= 8 && dek.trim().length >= 20 && !!category;
  const disabled = !canWrite;

  // Nothing typed is lost by accident: the browser asks before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const ask = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", ask);
    return () => window.removeEventListener("beforeunload", ask);
  }, [dirty]);

  const touch = <T,>(set: (v: T) => void) => (v: T) => { set(v); setDirty(true); setNote(""); };
  const onTitle = (v: string) => { touch(setTitle)(v); if (!slugTouched && isDraft) setSlug(slugFromTitle(v)); };

  const payload = (): ArticleInput => ({
    id: article?.id, title, slug: slug || slugFromTitle(title), dek, body_md: body, category, country, tags: tagList, author_name: authorName, author_role: authorRole,
    cover_media_id: coverId, cover_alt: coverAlt, featured, related_category: related || null, cta_text: cta, seo_title: seoTitle, seo_description: seoDescription, sort,
  });

  function save() {
    if (disabled || saving) return;
    setError("");
    startSave(async () => {
      const r = await saveArticle(payload());
      if (!r.ok) { setError(r.error); return; }
      setDirty(false);
      if (!article) { router.replace(`/admin/journal/${r.id}?ok=${encodeURIComponent("Draft saved.")}`); return; }
      setSlug(r.slug);
      router.replace(`${back}?ok=${encodeURIComponent("Saved.")}`);
      router.refresh();
    });
  }

  // Ctrl+S or Cmd+S saves.
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); } };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  async function upload(file: File, kind: "cover" | "inline", alt: string) {
    if (!article) { setError("Save the draft first, then add pictures: they are filed under the article."); return; }
    if (!alt.trim()) { setError("Describe the picture first, for people using screen readers."); return; }
    setError("");
    setUploading(kind);
    const fd = new FormData();
    fd.set("file", file, file.name);
    fd.set("alt", alt.trim());
    fd.set("ref", slug);
    const r = await uploadArticleImage(fd);
    setUploading("");
    if (!r.ok) { setError(r.error); return; }
    if (kind === "cover") { setCoverId(r.id); setDirty(true); setNote("Cover uploaded. Save to keep it."); return; }
    insertAtCursor(`\n\n![${alt.trim().replace(/[\[\]]/g, "")}](media:${r.id})\n\n`);
    setInlineAlt("");
  }

  function insertAtCursor(text: string) {
    const el = bodyRef.current;
    const at = el ? el.selectionStart : body.length;
    const next = body.slice(0, at) + text + body.slice(at);
    setBody(next);
    setDirty(true);
    requestAnimationFrame(() => { if (el) { el.focus(); el.selectionStart = el.selectionEnd = at + text.length; } });
  }

  const pick = (kind: "cover" | "inline") => (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) upload(f, kind, kind === "cover" ? coverAlt : inlineAlt);
  };
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f && /^image\/(jpeg|png|webp)$/.test(f.type)) upload(f, "cover", coverAlt);
    else setError("Drop a JPEG, PNG or WebP image.");
  };

  function draft() {
    if (!topic.trim()) { setError("Say what the article is about."); return; }
    if (body.trim() && !window.confirm("Replace the text in the editor with the draft?")) return;
    setError("");
    startDraft(async () => {
      const r = await draftArticle({ topic, category, country, notes });
      if (!r.ok) { setError(r.error); return; }
      onTitle(r.draft.title || title);
      setDek(r.draft.dek || dek);
      setBody(r.draft.body_md);
      if (!tags.trim() && r.draft.tags.length) setTags(r.draft.tags.join(", "));
      setDirty(true);
      setNote("A draft is in the editor. Read every line and edit it before it is published.");
      setPane("write");
    });
  }

  const atIso = when ? (() => { const d = new Date(when); return Number.isNaN(d.getTime()) ? "" : d.toISOString(); })() : "";
  const hidden = { id: article?.id ?? "", back };

  return (
    <div className="jn-editor flex flex-col gap-5">
      {error && <div role="alert" className="rounded-xl border border-bad/25 bg-bad-bg px-4 py-3 text-[14px] font-medium text-bad">{error}</div>}
      {note && !error && <div role="status" className="rounded-xl border border-ok/25 bg-ok-bg px-4 py-3 text-[14px] font-medium text-ok">{note}</div>}

      {/* Phones: write or read, one at a time. */}
      <div className="inline-flex self-start rounded-full bg-[#EFE5DA] p-0.5 xl:hidden" role="tablist">
        {(["write", "read"] as const).map((p) => <button key={p} type="button" role="tab" aria-selected={pane === p} onClick={() => setPane(p)} className={`rounded-full px-4 py-2 text-[13px] font-semibold ${pane === p ? "bg-ink text-cream" : "text-muted"}`}>{p === "write" ? "Write" : "Preview"}</button>)}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className={`flex min-w-0 flex-col gap-5 ${pane === "read" ? "max-xl:hidden" : ""}`}>
          <Panel title="Article" sub={article ? `/journal/${slug}` : "A new article. It starts as a draft."}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Title" className="sm:col-span-2">
                <input value={title} onChange={(e) => onTitle(e.target.value)} disabled={disabled} required minLength={8} maxLength={120} placeholder="Knotless braids: what to ask for" className={`${inputCls} !h-12 text-[17px] font-semibold`} />
                <span className="flex text-[11px]"><span className={shortTitle ? "text-bad" : "text-muted-2"}>8 to 120 characters</span><Count n={title.length} max={120} /></span>
              </Field>
              <Field label="Address" className="sm:col-span-2">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-muted">/journal/</span>
                  <input value={slug} onChange={(e) => { setSlugTouched(true); touch(setSlug)(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-")); }} disabled={disabled || !isDraft} pattern="[a-z0-9][a-z0-9-]*" maxLength={80} className={`${inputCls} font-mono text-[13px]`} />
                </div>
                <span className="text-[11px] text-muted-2">{isDraft ? "Made from the title. It can be changed until the article is published." : "Fixed once published, so links keep working."}</span>
              </Field>
              <Field label="Dek: one sentence under the title" className="sm:col-span-2">
                <textarea value={dek} onChange={(e) => touch(setDek)(e.target.value)} disabled={disabled} rows={2} maxLength={200} className={area} />
                <span className="flex text-[11px]"><span className={shortDek ? "text-bad" : "text-muted-2"}>20 to 200 characters</span><Count n={dek.length} max={200} /></span>
              </Field>
              <Field label="Category">
                <select value={category} onChange={(e) => touch(setCategory)(e.target.value)} disabled={disabled} required className={inputCls}>
                  <option value="" disabled>Choose</option>
                  {JOURNAL_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Who sees it by default">
                <select value={country} onChange={(e) => touch(setCountry)(e.target.value)} disabled={disabled} className={inputCls}>{JOURNAL_COUNTRIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              </Field>
              <Field label="Tags, separated by commas" className="sm:col-span-2"><input value={tags} onChange={(e) => touch(setTags)(e.target.value)} disabled={disabled} placeholder="knotless, aftercare" className={inputCls} /></Field>
              <Field label="Author"><input value={authorName} onChange={(e) => touch(setAuthorName)(e.target.value)} disabled={disabled} maxLength={80} className={inputCls} /></Field>
              <Field label="Author's role"><input value={authorRole} onChange={(e) => touch(setAuthorRole)(e.target.value)} disabled={disabled} maxLength={80} placeholder="Master braider, Nashville" className={inputCls} /></Field>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
              <label className="flex cursor-pointer items-center gap-2.5 text-[14px]"><input type="checkbox" checked={featured} onChange={(e) => touch(setFeatured)(e.target.checked)} disabled={disabled} className="h-4 w-4 accent-[#1A1513]" />Featured: shown first on the home screens</label>
              <label className="flex items-center gap-2 text-[13px] text-muted">Order<input type="number" value={sort} onChange={(e) => touch(setSort)(Number(e.target.value) || 0)} disabled={disabled} className={`${inputCls} !h-8 w-[70px] !px-2 text-[13px]`} /></label>
            </div>
          </Panel>

          <Panel title="Text" sub="Markdown: ## for a heading, - for a bullet, > for a pull quote, **bold**, [link](https://…)" action={<span className="text-[12.5px] text-muted">{words.toLocaleString("en-US")} {words === 1 ? "word" : "words"} · {minutes} min read</span>}>
            <div className="flex flex-col gap-3">
              {canWrite && (
                <div className="flex flex-wrap items-center gap-2">
                  <input value={inlineAlt} onChange={(e) => setInlineAlt(e.target.value)} placeholder="Describe the picture, then insert it" maxLength={200} aria-label="Description of the picture to insert" className={`${inputCls} !h-9 max-w-[360px] text-[13px]`} />
                  <input ref={inlineFile} type="file" accept="image/jpeg,image/png,image/webp" onChange={pick("inline")} className="hidden" />
                  <button type="button" onClick={() => inlineFile.current?.click()} disabled={!article || uploading !== ""} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-[12.5px] font-semibold transition hover:border-ink disabled:opacity-50"><Icon.Image width={14} height={14} />{uploading === "inline" ? "Uploading…" : "Insert a picture"}</button>
                  {!article && <span className="text-[12px] text-muted">Save the draft first to add pictures.</span>}
                </div>
              )}
              <textarea ref={bodyRef} value={body} onChange={(e) => touch(setBody)(e.target.value)} disabled={disabled} className="jn-md" spellCheck placeholder={"Start with the point. Short paragraphs. A ## heading every few paragraphs.\n\n## What to ask for\n\n- Size\n- Length"} />
              <p className="text-[12px] text-muted">{words < MIN_WORDS ? `At least ${MIN_WORDS} words are needed to publish: ${MIN_WORDS - words} to go.` : "Long enough to publish."}</p>
            </div>
          </Panel>

          <Panel title="Cover" sub="One picture at the top of the article and on its card. Without one, the category's drawing shows.">
            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <div
                onDragOver={(e) => { e.preventDefault(); if (canWrite) setOver(true); }} onDragLeave={() => setOver(false)} onDrop={canWrite ? drop : (e) => e.preventDefault()}
                className={`jn-drop relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[16px] ${over ? "over" : ""}`}
              >
                {coverId
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={`/media/${coverId}`} alt={coverAlt} className="absolute inset-0 h-full w-full object-cover" />
                  : category ? <CategoryMotif category={category} className="!rounded-[16px]" /> : null}
                {!coverId && <span className="relative z-10 rounded-full bg-cream/90 px-3 py-1.5 text-center text-[12.5px] font-semibold text-ink">{uploading === "cover" ? "Uploading…" : "Drop a picture here"}</span>}
              </div>
              <div className="flex flex-col gap-3">
                <Field label="Describe the cover, for people using screen readers"><input value={coverAlt} onChange={(e) => touch(setCoverAlt)(e.target.value)} disabled={disabled} maxLength={200} className={inputCls} /></Field>
                {canWrite && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input ref={coverFile} type="file" accept="image/jpeg,image/png,image/webp" onChange={pick("cover")} className="hidden" />
                    <button type="button" onClick={() => coverFile.current?.click()} disabled={!article || uploading !== ""} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-[12.5px] font-semibold transition hover:border-ink disabled:opacity-50"><Icon.Camera width={14} height={14} />{coverId ? "Replace the cover" : "Choose a picture"}</button>
                    {coverId && <button type="button" onClick={() => { setCoverId(null); setDirty(true); }} className="text-[12.5px] font-semibold text-wine hover:underline">Remove</button>}
                    <span className="text-[12px] text-muted">JPEG, PNG or WebP, up to 8 MB. Wide works best, about 16 by 9.</span>
                  </div>
                )}
              </div>
            </div>
          </Panel>

          <Panel title="Book it" sub="What the article sends the reader on to. Service articles end with the four nearest professionals.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Professionals to show">
                <select value={related} onChange={(e) => touch(setRelated)(e.target.value)} disabled={disabled} className={inputCls}>
                  <option value="">{cat?.service ? `Same as the category (${cat.label})` : "None: a link to search"}</option>
                  {JOURNAL_CATEGORIES.filter((c) => c.service).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Heading of the booking section"><input value={cta} onChange={(e) => touch(setCta)(e.target.value)} disabled={disabled} maxLength={80} placeholder={journalCategory(related || category)?.cta ?? "Find a professional near you"} className={inputCls} /></Field>
            </div>
          </Panel>

          <Panel title="Search engines" sub="Left empty, the title and the dek are used.">
            <div className="grid gap-3">
              <Field label="Title in search results"><input value={seoTitle} onChange={(e) => touch(setSeoTitle)(e.target.value)} disabled={disabled} maxLength={120} placeholder={title} className={inputCls} /><span className="flex text-[11px]"><span className="text-muted-2">About 60 characters shows in full</span><Count n={(seoTitle || title).length} max={60} /></span></Field>
              <Field label="Description in search results"><textarea value={seoDescription} onChange={(e) => touch(setSeoDescription)(e.target.value)} disabled={disabled} rows={2} maxLength={200} placeholder={dek} className={area} /><span className="flex text-[11px]"><span className="text-muted-2">About 160 characters shows in full</span><Count n={(seoDescription || dek).length} max={160} /></span></Field>
            </div>
          </Panel>

          {canWrite && (
            <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-cream/95 px-4 py-3 backdrop-blur">
              <Btn kind="ink">{saving ? "Saving…" : article ? "Save" : "Save draft"}</Btn>
              <span className="text-[12.5px] text-muted">{dirty ? "Unsaved changes" : article ? "Everything is saved" : "Not saved yet"} · Ctrl+S saves</span>
            </div>
          )}
        </form>

        <div className={`min-w-0 xl:sticky xl:top-5 ${pane === "write" ? "max-xl:hidden" : ""}`}>
          <Panel title="How it reads" sub="Updates as you type. The public page adds the author line, the booking cards and related articles.">
            <div className="jn-preview max-h-[calc(100vh-140px)] overflow-y-auto pr-1">
              <div className="mb-6 border-b border-line pb-6">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[.08em] text-wine">{cat?.label ?? "Category"}{featured && <span className="text-gold-ink">· Featured</span>}</div>
                <h2 className="serif mt-3 text-[34px] leading-[1.05]">{title || <span className="text-muted-2">Untitled</span>}</h2>
                {dek && <p className="mt-3 text-[17px] leading-relaxed text-muted">{dek}</p>}
                <p className="mt-3 text-[13px] text-muted">{authorName || "LogaLuxe editorial"}{authorRole ? `, ${authorRole}` : ""} · {minutes} min read</p>
                {(coverId || category) && (
                  <div className="relative mt-5 aspect-[16/9] overflow-hidden rounded-[16px]">
                    {coverId ? (
                      // The picture is the uploaded file itself, served by our own /media route; next/image would re-encode it.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/media/${coverId}`} alt={coverAlt} className="absolute inset-0 h-full w-full object-cover" />
                    ) : <CategoryMotif category={category} />}
                  </div>
                )}
              </div>
              {body.trim() ? <div className="jn-body"><JournalBlocks blocks={blocks} /></div> : <p className="py-10 text-center text-[14px] text-muted">Nothing written yet.</p>}
            </div>
          </Panel>
        </div>
      </div>

      {canWrite && (
        <Panel title="Write a draft with AI" sub="Fills the editor with a starting point in the house voice. Nothing written by the AI is published without a person: read every line and edit it first.">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <Field label="What it is about"><input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} placeholder="Knotless braids: what to ask for and how long they last" className={inputCls} /></Field>
            <Field label="Notes for the writer, optional"><input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} placeholder="Mention aftercare and what it usually costs" className={inputCls} /></Field>
            <button type="button" onClick={draft} disabled={drafting} className="inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-white px-4 text-[13.5px] font-semibold transition hover:border-ink disabled:opacity-60"><Icon.Spark width={15} height={15} />{drafting ? "Writing…" : "Write a draft"}</button>
          </div>
          <p className="mt-3 text-[12.5px] text-muted">It uses the category ({cat?.label ?? "none yet"}) and country ({JOURNAL_COUNTRIES.find(([v]) => v === country)?.[1]}) chosen above. Facts, prices and names must be checked by hand.</p>
        </Panel>
      )}

      {article && (
        <Panel title="Publishing" sub={`Status: ${status}${article.published_at ? ` · ${status === "scheduled" ? "goes live" : "published"} ${new Date(article.published_at).toLocaleString("en-GB", { timeZone: zone, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}`}>
          <div className="flex flex-col gap-4">
            {dirty && <p className="rounded-xl bg-warn-bg px-3.5 py-2.5 text-[13px]">Save first: these buttons work on the saved version.</p>}
            <div className="flex flex-wrap items-center gap-2.5">
              {canWrite && <form action={previewArticle}><Hidden values={{ ...hidden, slug }} /><Btn>Preview on the site</Btn></form>}
              {canPublish && status !== "published" && (
                <form action={publishArticle} onSubmit={(e) => { if (!canPublishNow) { e.preventDefault(); setError(`To publish: a title of 8 to 120 characters, a dek of 20 to 200, a category, and at least ${MIN_WORDS} words (now ${words}).`); } }}>
                  <Hidden values={{ ...hidden, at: "", tz: zone }} /><Btn kind="ok">{status === "scheduled" ? "Publish now instead" : "Publish now"}</Btn>
                </form>
              )}
              {canPublish && (status === "published" || status === "scheduled") && <form action={unpublishArticle}><Hidden values={hidden} /><Btn>{status === "scheduled" ? "Cancel the schedule" : "Unpublish"}</Btn></form>}
              {canPublish && status !== "archived" && <form action={archiveArticle} onSubmit={(e) => { if (!window.confirm("Archive this article? It leaves the site and the list of drafts.")) e.preventDefault(); }}><Hidden values={hidden} /><Btn>Archive</Btn></form>}
              {canWrite && status === "draft" && <form action={deleteArticle} onSubmit={(e) => { if (!window.confirm("Delete this draft for good?")) e.preventDefault(); }}><Hidden values={hidden} /><Btn kind="danger">Delete draft</Btn></form>}
              {!canPublish && <span className="text-[12.5px] text-muted">Publishing, scheduling and archiving need the super admin role.</span>}
            </div>
            {canPublish && status !== "published" && (
              <form action={publishArticle} onSubmit={(e) => { if (!atIso) { e.preventDefault(); setError("Choose a date and time to schedule."); } else if (!canPublishNow) { e.preventDefault(); setError(`To schedule: a title of 8 to 120 characters, a dek of 20 to 200, a category, and at least ${MIN_WORDS} words (now ${words}).`); } }} className="flex flex-wrap items-end gap-3 border-t border-line-2 pt-4">
                <Hidden values={{ ...hidden, at: atIso, tz: zone }} />
                <Field label={`Schedule for (${zoneName(zone)})`} className="w-[240px]"><input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} className={inputCls} /></Field>
                <Btn kind="ink">Schedule</Btn>
                <span className="pb-2.5 text-[12.5px] text-muted">It goes live by itself at that time, in your zone ({zone}).</span>
              </form>
            )}
          </div>
        </Panel>
      )}

      {article && (
        <p className="text-[12.5px] text-muted">
          {article.view_count ? `${Number(article.view_count).toLocaleString("en-US")} ${article.view_count === 1 ? "read" : "reads"}` : "No reads yet"}
          {article.created_by ? ` · written by ${article.created_by}` : ""}
          {article.updated_at ? ` · last saved ${new Date(article.updated_at).toLocaleString("en-GB", { timeZone: zone, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` : ""}
          {status === "published" && <> · <Link href={`/journal/${slug}`} className="font-semibold text-wine hover:underline">Open on the site</Link></>}
          {status !== "draft" && <> · <Pill kind={status === "published" ? "ok" : status === "scheduled" ? "info" : "grey"}>{status}</Pill></>}
        </p>
      )}
    </div>
  );
}
