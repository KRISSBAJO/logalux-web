"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Gives any table search, column sorting, filters and paging.
 *
 * Wrap a normal <table> (with <thead> and <tbody>) in it. The rows stay the
 * rows the page rendered, so links, buttons and forms inside them keep working.
 *
 *   <DataTable id="sales" search="Search sales" filters={["Paid by", "Status"]} pageSize={10}>
 *     <table>…</table>
 *   </DataTable>
 *
 * Hints the table can carry:
 *   <th data-nosort>            a column that cannot be sorted (actions, switches)
 *   <td data-sort="1400">       the value to sort by when the text is not it (money, dates: use a number or ISO date)
 *   <td data-filter="Low">      the value to filter by when the text is not it
 *   <tr data-group>             a heading row inside the body; it is shown while any row under it is shown, and hidden while a sort is on
 *   <tr data-fixed>             a row that is never searched, sorted or paged (a totals row in the body)
 *
 * What someone chose is remembered for the tab, so it survives saving a form on the same page.
 */
export function DataTable({ id, children, search = "Search", filters = [], pageSize = 10, pageSizes = [10, 25, 50, 100], sort, empty = "Nothing matches. Clear the search or the filters.", noun = "row", tools }: {
  id: string;
  children: ReactNode;
  /** Placeholder of the search box. Pass false for a table that needs none. */
  search?: string | false;
  /** Column headings to offer as filters, exactly as written in the <th>. */
  filters?: string[];
  pageSize?: number;
  pageSizes?: number[];
  /** The order to start in: the column heading and the direction. */
  sort?: { col: string; dir?: "asc" | "desc" };
  empty?: string;
  /** What one row is called, for the count: "sale", "product". */
  noun?: string;
  /** Extra controls for the right of the toolbar (an export link, a button). */
  tools?: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const path = usePathname();
  const uid = useId();
  const key = `lx-dt:${path}:${id}`;
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [order, setOrder] = useState<{ col: string; dir: "asc" | "desc" } | null>(sort ? { col: sort.col, dir: sort.dir ?? "asc" } : null);
  const [size, setSize] = useState(pageSize);
  const [page, setPage] = useState(1);
  const [options, setOptions] = useState<Record<string, string[]>>({});
  const [count, setCount] = useState({ shown: 0, total: 0, from: 0, to: 0, pages: 1 });
  const [ready, setReady] = useState(false);

  // Bring back what was chosen earlier in this tab.
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) ?? "null");
      if (saved) { setQ(saved.q ?? ""); setPicked(saved.picked ?? {}); setOrder(saved.order ?? null); setSize(saved.size ?? pageSize); setPage(saved.page ?? 1); }
    } catch {}
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    if (!ready) return;
    try { sessionStorage.setItem(key, JSON.stringify({ q, picked, order, size, page })); } catch {}
  }, [ready, key, q, picked, order, size, page]);

  const heads = useCallback(() => {
    const table = box.current?.querySelector("table");
    const ths = [...(table?.querySelectorAll<HTMLTableCellElement>("thead th") ?? [])];
    return { table, ths, index: (name: string) => ths.findIndex((th) => (th.dataset.col ?? th.textContent ?? "").trim().toLowerCase() === name.trim().toLowerCase()) };
  }, []);

  const text = (td: HTMLTableCellElement | undefined, attr: "sort" | "filter") => (td?.dataset[attr] ?? td?.textContent ?? "").trim();

  // Apply everything to the rows that are on the page. Runs after every render, so it also catches fresh data from the server.
  useLayoutEffect(() => {
    const { table, ths, index } = heads();
    const body = table?.tBodies[0];
    if (!table || !body) return;
    const all = [...body.rows];
    const rows = all.filter((r) => !("group" in r.dataset) && !("fixed" in r.dataset));
    const groups = all.filter((r) => "group" in r.dataset);

    // The choices for each filter come from what is in the table.
    const next: Record<string, string[]> = {};
    for (const name of filters) {
      const i = index(name);
      if (i < 0) continue;
      next[name] = [...new Set(rows.map((r) => text(r.cells[i], "filter")).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }
    setOptions((old) => (JSON.stringify(old) === JSON.stringify(next) ? old : next));

    // Remember the order the server sent, once per row.
    rows.forEach((r, i) => { if (!r.dataset.dt0) r.dataset.dt0 = String(i); });
    all.forEach((r, i) => { if (!r.dataset.dtAt) r.dataset.dtAt = String(i); });

    const needle = q.trim().toLowerCase();
    const wanted = Object.entries(picked).filter(([, v]) => v).map(([name, v]) => [index(name), v] as const).filter(([i]) => i >= 0);
    let hits = rows.filter((r) => (!needle || (r.textContent ?? "").toLowerCase().includes(needle)) && wanted.every(([i, v]) => text(r.cells[i], "filter") === v));

    const si = order ? index(order.col) : -1;
    if (si >= 0) {
      const val = (r: HTMLTableRowElement) => text(r.cells[si], "sort");
      const num = (s: string) => { const n = Number(s.replace(/[^0-9.\-−]/g, "").replace("−", "-")); return s !== "" && /\d/.test(s) && !/^\d{4}-\d{2}-\d{2}/.test(s) && Number.isFinite(n) ? n : null; };
      const numeric = hits.length > 0 && hits.every((r) => val(r) === "" || val(r) === "—" || num(val(r)) !== null);
      hits = [...hits].sort((a, b) => {
        const x = val(a), y = val(b);
        const c = numeric ? (num(x) ?? -Infinity) - (num(y) ?? -Infinity) : x.localeCompare(y, undefined, { numeric: true, sensitivity: "base" });
        return (order!.dir === "asc" ? c : -c) || Number(a.dataset.dt0) - Number(b.dataset.dt0);
      });
      for (const r of hits) body.appendChild(r);
      for (const r of all.filter((x) => "fixed" in x.dataset)) body.appendChild(r);
    } else if (all.some((r, i) => Number(r.dataset.dtAt) !== i)) {
      // Back to the order the server sent.
      for (const r of [...all].sort((a, b) => Number(a.dataset.dtAt) - Number(b.dataset.dtAt))) body.appendChild(r);
    }

    const pages = Math.max(1, Math.ceil(hits.length / size));
    const at = Math.min(page, pages);
    const visible = new Set(hits.slice((at - 1) * size, at * size));
    for (const r of rows) r.hidden = !visible.has(r);
    // A heading row shows while a row under it shows. With a sort on, the groups no longer mean anything.
    for (const g of groups) {
      let on = false;
      if (si < 0) for (let n = g.nextElementSibling as HTMLTableRowElement | null; n && !("group" in n.dataset); n = n.nextElementSibling as HTMLTableRowElement | null) if (!n.hidden && !("fixed" in n.dataset)) { on = true; break; }
      g.hidden = !on;
    }

    ths.forEach((th, i) => {
      if ("nosort" in th.dataset || !(th.textContent ?? "").trim()) return;
      th.classList.add("dt-sort");
      th.tabIndex = 0;
      th.setAttribute("role", "columnheader");
      th.setAttribute("aria-sort", si === i ? (order!.dir === "asc" ? "ascending" : "descending") : "none");
    });

    const c = { shown: visible.size, total: hits.length, from: hits.length ? (at - 1) * size + 1 : 0, to: Math.min(at * size, hits.length), pages };
    setCount((old) => (old.shown === c.shown && old.total === c.total && old.from === c.from && old.to === c.to && old.pages === c.pages ? old : c));
    if (at !== page) setPage(at);
  });

  // Clicking a heading sorts by it: first up, then down, then back to the order the page came in.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const act = (e: Event) => {
      const th = (e.target as HTMLElement).closest<HTMLTableCellElement>("thead th.dt-sort");
      if (!th || !el.contains(th)) return;
      if (e instanceof KeyboardEvent) { if (e.key !== "Enter" && e.key !== " ") return; e.preventDefault(); }
      const col = (th.dataset.col ?? th.textContent ?? "").trim();
      setOrder((o) => (o?.col.toLowerCase() !== col.toLowerCase() ? { col, dir: "asc" } : o.dir === "asc" ? { col, dir: "desc" } : null));
      setPage(1);
    };
    el.addEventListener("click", act);
    el.addEventListener("keydown", act);
    return () => { el.removeEventListener("click", act); el.removeEventListener("keydown", act); };
  }, []);

  const filtering = !!q.trim() || Object.values(picked).some(Boolean);
  const nums = (() => {
    const out: (number | "…")[] = [];
    for (let i = 1; i <= count.pages; i++) {
      if (i === 1 || i === count.pages || Math.abs(i - page) <= 1) out.push(i);
      else if (out[out.length - 1] !== "…") out.push("…");
    }
    return out;
  })();

  return (
    <div className="dt" ref={box}>
      <div className="dt-bar">
        {search !== false && (
          <label className="dt-search">
            <span className="sr">{search}</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input type="search" value={q} placeholder={search} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </label>
        )}
        {filters.map((name) => (options[name]?.length ?? 0) > 1 || picked[name] ? (
          <label key={name} className="dt-filter">
            <span className="sr">{name}</span>
            <select value={picked[name] ?? ""} onChange={(e) => { setPicked({ ...picked, [name]: e.target.value }); setPage(1); }}>
              <option value="">{name}: all</option>
              {(options[name] ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
              {picked[name] && !(options[name] ?? []).includes(picked[name]) ? <option value={picked[name]}>{picked[name]}</option> : null}
            </select>
          </label>
        ) : null)}
        {filtering || order ? <button type="button" className="dt-clear" onClick={() => { setQ(""); setPicked({}); setOrder(sort ? { col: sort.col, dir: sort.dir ?? "asc" } : null); setPage(1); }}>Clear</button> : null}
        <span className="dt-grow" />
        {tools}
      </div>

      <div className="dt-scroll">{children}</div>
      {ready && count.total === 0 ? <div className="dt-empty" role="status">{empty}</div> : null}

      <div className="dt-foot">
        <span className="dt-count" aria-live="polite">
          {count.total === 0 ? `0 ${noun}s` : `${count.from} to ${count.to} of ${count.total} ${noun}${count.total === 1 ? "" : "s"}`}
        </span>
        <span className="dt-grow" />
        <label className="dt-size" htmlFor={uid}>Show</label>
        <select id={uid} className="dt-size-pick" value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(1); }}>
          {[...new Set([...pageSizes, pageSize])].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <nav className="dt-pages" aria-label="Pages">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page">‹</button>
          {nums.map((n, i) => n === "…" ? <span key={"g" + i} aria-hidden="true">…</span> : <button type="button" key={n} className={n === page ? "on" : ""} aria-current={n === page ? "page" : undefined} onClick={() => setPage(n)}>{n}</button>)}
          <button type="button" disabled={page >= count.pages} onClick={() => setPage(page + 1)} aria-label="Next page">›</button>
        </nav>
      </div>
    </div>
  );
}
