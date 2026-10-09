// The Journal's Markdown, read into a small tree. Nothing here touches the
// DOM or React, so the admin editor's live preview and the public reading page
// share one set of rules. What it understands: headings (## and ###), paragraphs,
// **bold**, *italic*, `code`, [links](https://…), bullet and numbered lists,
// > quotes (shown as pull quotes), pictures on a line of their own as
// ![alt](media:<id>) or ![alt](https://…), and --- as a rule. Raw HTML is never
// passed through: it is shown as the text that was typed.

export type Inline =
  | { t: "text"; v: string }
  | { t: "strong"; c: Inline[] }
  | { t: "em"; c: Inline[] }
  | { t: "code"; v: string }
  | { t: "link"; href: string; c: Inline[] };

export type Block =
  | { t: "h"; level: 2 | 3; id: string; text: string; c: Inline[] }
  | { t: "p"; c: Inline[] }
  | { t: "ul"; items: Inline[][] }
  | { t: "ol"; start: number; items: Inline[][] }
  | { t: "quote"; c: Inline[] }
  | { t: "img"; src: string; alt: string; caption: string }
  | { t: "hr" };

export type Heading = { id: string; text: string; level: 2 | 3 };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only ordinary web, mail and same-site links, and anchors. Anything else becomes plain text. */
export function safeHref(href: string): string {
  const h = href.trim();
  return /^(https?:\/\/|mailto:|#|\/(?!\/))/i.test(h) ? h : "";
}

/** Where a picture is served from: `media:<id>` is an upload of ours, served at /media/<id>. */
export function imageSrc(src: string): string {
  const s = src.trim();
  if (s.toLowerCase().startsWith("media:")) {
    const id = s.slice(6).trim();
    return UUID.test(id) ? `/media/${id}` : "";
  }
  return /^(https?:\/\/|\/(?!\/))/i.test(s) ? s : "";
}

/** The address of a heading on the page: "How long they last" is "how-long-they-last". */
export function headingId(text: string): string {
  return text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "section";
}

// ---- inline ----

const INLINE = /(\*\*(.+?)\*\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)\s]+)\))|((?<![A-Za-z0-9*])\*(?!\s|\*)(.+?)(?<!\s)\*(?![A-Za-z0-9*]))|((?<![A-Za-z0-9_])_(?!\s)(.+?)(?<!\s)_(?![A-Za-z0-9_]))/g;

/** Reads the marks inside one line of text. `inLink` stops a link from holding another. */
export function parseInline(text: string, inLink = false): Inline[] {
  const out: Inline[] = [];
  const re = new RegExp(INLINE.source, "g");
  let last = 0, m: RegExpExecArray | null;
  const push = (v: string) => { if (v) out.push({ t: "text", v }); };
  while ((m = re.exec(text))) {
    push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push({ t: "strong", c: parseInline(m[2], inLink) });
    else if (m[3] !== undefined) out.push({ t: "code", v: m[4] });
    else if (m[5] !== undefined) {
      const href = safeHref(m[7]);
      if (href && !inLink) out.push({ t: "link", href, c: parseInline(m[6], true) });
      else out.push(...parseInline(m[6], inLink));
    } else if (m[8] !== undefined) out.push({ t: "em", c: parseInline(m[9], inLink) });
    else if (m[10] !== undefined) out.push({ t: "em", c: parseInline(m[11], inLink) });
    last = re.lastIndex;
  }
  push(text.slice(last));
  return out;
}

/** The words of some inline content, with no marks. */
export function inlineText(c: Inline[]): string {
  return c.map((i) => (i.t === "text" || i.t === "code" ? i.v : inlineText(i.c))).join("");
}

// ---- blocks ----

const IMG = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*$/;

export function parseMarkdown(source: string): Block[] {
  const lines = (source ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  const seen = new Map<string, number>();
  let para: string[] = [];

  const flush = () => {
    if (para.length) blocks.push({ t: "p", c: parseInline(para.join(" ")) });
    para = [];
  };
  const heading = (level: 2 | 3, raw: string) => {
    const c = parseInline(raw.trim());
    const text = inlineText(c);
    let id = headingId(text);
    const n = seen.get(id) ?? 0;
    seen.set(id, n + 1);
    if (n) id = `${id}-${n + 1}`;
    blocks.push({ t: "h", level, id, text, c });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) { flush(); continue; }

    let m: RegExpMatchArray | null;
    if ((m = trimmed.match(/^#{1,2}\s+(.+)$/))) { flush(); heading(2, m[1]); continue; }
    if ((m = trimmed.match(/^#{3,6}\s+(.+)$/))) { flush(); heading(3, m[1]); continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) { flush(); blocks.push({ t: "hr" }); continue; }
    if ((m = trimmed.match(IMG))) {
      flush();
      const src = imageSrc(m[2]);
      if (src) blocks.push({ t: "img", src, alt: m[1].trim(), caption: (m[3] ?? "").trim() });
      else para.push(trimmed);
      continue;
    }
    if (/^>\s?/.test(trimmed)) {
      flush();
      const q: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) { q.push(lines[i].trim().replace(/^>\s?/, "")); i++; }
      i--;
      blocks.push({ t: "quote", c: parseInline(q.filter(Boolean).join(" ")) });
      continue;
    }
    if (/^[-*+]\s+/.test(trimmed)) {
      flush();
      const items: Inline[][] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) { items.push(parseInline(lines[i].trim().replace(/^[-*+]\s+/, ""))); i++; }
      i--;
      blocks.push({ t: "ul", items });
      continue;
    }
    if ((m = trimmed.match(/^(\d+)[.)]\s+/))) {
      flush();
      const items: Inline[][] = [];
      const start = parseInt(m[1], 10) || 1;
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) { items.push(parseInline(lines[i].trim().replace(/^\d+[.)]\s+/, ""))); i++; }
      i--;
      blocks.push({ t: "ol", start, items });
      continue;
    }
    para.push(trimmed);
  }
  flush();
  return blocks;
}

/** The ## and ### headings, for a table of contents. */
export function headingsOf(blocks: Block[]): Heading[] {
  return blocks.flatMap((b) => (b.t === "h" ? [{ id: b.id, text: b.text, level: b.level }] : []));
}

/** The article as plain words, for a description or a count. */
export function plainText(source: string): string {
  return parseMarkdown(source)
    .map((b) => {
      if (b.t === "h" || b.t === "p" || b.t === "quote") return inlineText(b.c);
      if (b.t === "ul" || b.t === "ol") return b.items.map(inlineText).join(" ");
      return "";
    })
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function wordCount(source: string): number {
  const t = plainText(source);
  return t ? t.split(/\s+/).length : 0;
}

/** Words / 220, and never less than one minute: the same rule the API keeps. */
export const readingMinutes = (words: number) => Math.max(1, Math.round(words / 220));

/** The title as a web address: "Knotless braids: what to ask for" is "knotless-braids-what-to-ask-for". */
export function slugFromTitle(title: string): string {
  return title.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
