import type { ReactNode } from "react";
import { parseMarkdown, type Block, type Inline } from "@/lib/journal-md";

/**
 * Renders a Journal article's Markdown as React elements, so nothing typed
 * into the editor can run as script. The look lives in cx-css/journal.css
 * under `.jn-body`; the editor's preview and the public page both use it.
 */

function inline(nodes: Inline[], key: string): ReactNode[] {
  return nodes.map((n, i) => {
    const k = `${key}-${i}`;
    switch (n.t) {
      case "text": return n.v;
      case "strong": return <strong key={k}>{inline(n.c, k)}</strong>;
      case "em": return <em key={k}>{inline(n.c, k)}</em>;
      case "code": return <code key={k}>{n.v}</code>;
      case "link": {
        const external = /^https?:\/\//i.test(n.href);
        return <a key={k} href={n.href} {...(external ? { rel: "noopener noreferrer", target: "_blank" } : {})}>{inline(n.c, k)}</a>;
      }
    }
  });
}

export function JournalBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        const k = `b${i}`;
        switch (b.t) {
          case "h": return b.level === 2 ? <h2 key={k} id={b.id}>{inline(b.c, k)}</h2> : <h3 key={k} id={b.id}>{inline(b.c, k)}</h3>;
          case "p": return <p key={k}>{inline(b.c, k)}</p>;
          case "ul": return <ul key={k}>{b.items.map((it, j) => <li key={j}>{inline(it, `${k}-${j}`)}</li>)}</ul>;
          case "ol": return <ol key={k} start={b.start}>{b.items.map((it, j) => <li key={j}>{inline(it, `${k}-${j}`)}</li>)}</ol>;
          case "quote": return <blockquote key={k}><p>{inline(b.c, k)}</p></blockquote>;
          case "img": return (
            <figure key={k}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.src} alt={b.alt} loading="lazy" decoding="async" />
              {b.caption && !/^AI[- ]generated sample/i.test(b.caption) && <figcaption>{b.caption}</figcaption>}
            </figure>
          );
          case "hr": return <hr key={k} />;
        }
      })}
    </>
  );
}

/** The whole body from its Markdown. */
export function JournalBody({ source, className = "" }: { source: string; className?: string }) {
  return <div className={`jn-body ${className}`}><JournalBlocks blocks={parseMarkdown(source)} /></div>;
}
