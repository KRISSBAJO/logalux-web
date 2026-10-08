"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "./icons";

export function SearchBar({ initial = {}, market }: { initial?: { q?: string; where?: string; when?: string }; market?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial.q ?? "");
  const [where, setWhere] = useState(initial.where ?? "");
  const [when, setWhen] = useState(initial.when ?? "anytime");
  return (
    <form
      id="search"
      className="grid gap-1 rounded-[22px] bg-cream p-1.5 shadow-[0_20px_50px_rgba(0,0,0,.4)] ring-1 ring-white/10 md:grid-cols-[1.4fr_1fr_0.9fr_auto] md:items-center md:rounded-full md:pl-3"
      onSubmit={(e) => {
        e.preventDefault();
        const p = new URLSearchParams();
        if (q) p.set("q", q);
        if (where) p.set("where", where);
        if (when !== "anytime") p.set("when", when);
        if (market && market !== "US") p.set("market", market); // stay in the city being browsed
        router.push(`/search?${p.toString()}`);
      }}
    >
      <label className="flex min-w-0 flex-col border-line px-3.5 py-1.5 md:border-r">
        <span className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted">Service or business</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Braids, fade, nails…" className="w-full min-w-0 bg-transparent text-[15px] leading-tight text-ink outline-none placeholder:text-muted-2" />
      </label>
      <label className="flex min-w-0 flex-col border-line px-3.5 py-1.5 md:border-r">
        <span className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted">Where</span>
        <input value={where} onChange={(e) => setWhere(e.target.value)} placeholder="City or area" className="w-full min-w-0 bg-transparent text-[15px] leading-tight text-ink outline-none placeholder:text-muted-2" />
      </label>
      <label className="flex min-w-0 flex-col px-3.5 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted">When</span>
        <select value={when} onChange={(e) => setWhen(e.target.value)} className="w-full bg-transparent text-[15px] leading-tight text-ink outline-none">
          <option value="anytime">Anytime</option><option value="today">Today</option><option value="tomorrow">Tomorrow</option><option value="weekend">This weekend</option>
        </select>
      </label>
      <button type="submit" className="btn btn-ink min-h-[46px] rounded-[16px] px-6 text-[14.5px] md:rounded-full"><Icon.Search />Search</button>
    </form>
  );
}
