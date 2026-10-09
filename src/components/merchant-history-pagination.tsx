"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type HistoryPage = {
  page: number;
  pages: number;
  total: number;
  per_page: number;
  sort_columns?: string[];
};

const SORT_LABEL: Record<string, string> = {
  created_at: "Date", starts_at: "Visit date", started_at: "Started",
  last_message_at: "Last message", last_at: "Last activity", last_visit: "Last visit",
  period_start: "Period", amount_cents: "Amount", refund_cents: "Refund",
  total_cents: "Total", spent_cents: "Spent", fee_cents: "Fee",
  lifetime_cents: "Lifetime spend", net_cents: "Net", client_name: "Client",
  customer_name: "Customer", author_name: "Reviewer", credits_left: "Credits left",
  points: "Points", kind: "Type", ref: "Reference", delta: "Stock change",
};
const sortLabel = (column: string) => SORT_LABEL[column] ?? column.charAt(0).toUpperCase() + column.slice(1).replaceAll("_", " ");

export function MerchantHistoryPagination({ name, label, pagination, selection }: {
  name: string;
  label: string;
  pagination?: HistoryPage;
  selection?: Record<string, string>;
}) {
  const path = usePathname(), params = useSearchParams(), router = useRouter();
  if (!pagination) return null;

  const change = (values: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(selection ?? {})) next.set(key, value);
    for (const [key, value] of Object.entries(values)) next.set(name + "_" + key, value);
    router.push(path + "?" + next);
  };

  return (
    <section aria-label={label + " pagination"} style={{ padding: "12px 0", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <strong>{label}</strong>
      <span className="muted" role="status" style={{ fontSize: 12.5 }}>{pagination.total.toLocaleString()} records · Page {pagination.page} of {pagination.pages}</span>
      <button className="btn btn-out btn-sm" type="button" disabled={pagination.page <= 1} onClick={() => change({ page: String(pagination.page - 1) })}>Previous</button>
      <button className="btn btn-out btn-sm" type="button" disabled={pagination.page >= pagination.pages} onClick={() => change({ page: String(pagination.page + 1) })}>Next</button>
      <form className="rowx" style={{ gap: 6 }} onSubmit={event => {
        event.preventDefault();
        change({ page: String(new FormData(event.currentTarget).get("page") ?? "1") });
      }}>
        <div className="field" style={{ margin: 0, width: 76 }}>
          <input className="inp" aria-label={label + " page"} name="page" type="number" min={1} max={pagination.pages} defaultValue={pagination.page} key={pagination.page} style={{ height: 32 }} />
        </div>
        <button className="btn btn-out btn-sm" type="submit">Go</button>
      </form>
      <select className="btn btn-out btn-sm" aria-label={label + " rows per page"} value={pagination.per_page} onChange={event => change({ per_page: event.target.value, page: "1" })}>
        {[25, 50, 100, 200].map(n => <option key={n} value={n}>{n} per page</option>)}
      </select>
      <select className="btn btn-out btn-sm" aria-label={"Sort all " + label} value={params.get(name + "_sort") ?? ""} onChange={event => change({ sort: event.target.value, page: "1" })}>
        <option value="">Default order</option>
        {pagination.sort_columns?.map(column => <option key={column} value={column}>{sortLabel(column)}</option>)}
      </select>
      <select className="btn btn-out btn-sm" aria-label={label + " sort direction"} value={params.get(name + "_direction") ?? "asc"} onChange={event => change({ direction: event.target.value, page: "1" })}>
        <option value="asc">Ascending</option><option value="desc">Descending</option>
      </select>
      <form className="rowx" style={{ gap: 6 }} onSubmit={event => {
        event.preventDefault();
        change({ q: String(new FormData(event.currentTarget).get("search") ?? ""), page: "1" });
      }}>
        <div className="field" style={{ margin: 0 }}>
          <input className="inp" type="search" aria-label={"Search all " + label} placeholder={"Search all " + label.toLowerCase()} name="search" defaultValue={params.get(name + "_q") ?? ""} key={params.get(name + "_q")} style={{ height: 32 }} />
        </div>
        <button className="btn btn-out btn-sm" type="submit">Search</button>
      </form>
    </section>
  );
}
