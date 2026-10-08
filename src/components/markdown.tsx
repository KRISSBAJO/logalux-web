import type { ReactNode } from "react";

/**
 * A small, safe renderer for the site's editable pages. It understands
 * headings (## and ###), paragraphs, bullet lists, numbered lists, **bold**
 * and [links](https://…). It builds React elements directly and never injects
 * HTML, so nothing typed into the editor can run as script.
 */

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0, m: RegExpExecArray | null, n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      out.push(<strong key={`${key}b${n++}`} className="font-semibold">{m[1]}</strong>);
    } else {
      const href = m[3];
      // Only ordinary web, mail and same-site links. Anything else is shown as plain text.
      const ok = /^(https?:\/\/|mailto:|\/(?!\/))/i.test(href);
      out.push(ok ? <a key={`${key}a${n++}`} href={href} className="font-medium text-wine underline decoration-wine/30 underline-offset-2 hover:decoration-wine" {...(href.startsWith("http") ? { rel: "noopener noreferrer", target: "_blank" } : {})}>{m[2]}</a> : m[2]);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const blocks = source.replace(/\r\n/g, "\n").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="flex flex-col gap-4 text-[16.5px] leading-[1.7] text-ink-3">
      {blocks.map((b, i) => {
        const k = `b${i}`;
        if (b.startsWith("### ")) return <h3 key={k} className="mt-2 text-[18px] font-semibold text-ink">{inline(b.slice(4), k)}</h3>;
        if (b.startsWith("## ")) return <h2 key={k} className="serif mt-5 text-[28px] font-medium leading-tight text-ink first:mt-0">{inline(b.slice(3), k)}</h2>;
        const lines = b.split("\n");
        if (lines.every((l) => /^[-*] /.test(l))) return <ul key={k} className="list-disc space-y-1.5 pl-6">{lines.map((l, j) => <li key={j}>{inline(l.slice(2), `${k}l${j}`)}</li>)}</ul>;
        if (lines.every((l) => /^\d+[.)] /.test(l))) return <ol key={k} className="list-decimal space-y-1.5 pl-6">{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\d+[.)] /, ""), `${k}l${j}`)}</li>)}</ol>;
        return <p key={k}>{lines.map((l, j) => <span key={j}>{j > 0 && <br />}{inline(l, `${k}p${j}`)}</span>)}</p>;
      })}
    </div>
  );
}
