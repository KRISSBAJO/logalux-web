"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "./icons";
import { PlacePicker, type PickerWhere } from "./place-picker";

/**
 * What, where and when. "Where" is the place the visitor is looking in: the
 * one they chose, or our first guess. Choosing another here changes it for
 * the whole site. The search itself goes to /search, which reads the place
 * from the same cookie, so nothing about where a person is goes in the address.
 */
export function SearchBar({ initial = {}, where, keep = {} }: {
  initial?: { q?: string; when?: string };
  /** The place being looked in and how we came by it. */
  where: PickerWhere;
  /** Filters to carry into the search, such as the category being browsed. */
  keep?: Record<string, string>;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initial.q ?? "");
  const [when, setWhen] = useState(initial.when ?? "anytime");
  return (
    <form
      id="search"
      className="beauty-search grid gap-1 rounded-[22px] bg-cream p-1.5 shadow-[0_20px_50px_rgba(0,0,0,.4)] ring-1 ring-white/10 md:grid-cols-[1.4fr_1fr_0.9fr_auto] md:items-center md:rounded-full md:pl-3"
      onSubmit={(e) => {
        e.preventDefault();
        const p = new URLSearchParams();
        if (q.trim()) p.set("q", q.trim());
        for (const [k, v] of Object.entries(keep)) if (v) p.set(k, v);
        if (when !== "anytime") p.set("when", when);
        const s = p.toString();
        router.push(s ? `/search?${s}` : "/search");
      }}
    >
      <label className="flex min-w-0 flex-col border-line px-3.5 py-1.5 md:border-r">
        <span className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted">Service or business</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Braids, fade, nails…" className="w-full min-w-0 bg-transparent text-[15px] leading-tight text-ink outline-none placeholder:text-muted-2" />
      </label>
      <PlacePicker look="field" where={where} />
      <label className="flex min-w-0 flex-col px-3.5 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted">When</span>
        <select aria-label="When" value={when} onChange={(e) => setWhen(e.target.value)} className="w-full bg-transparent text-[15px] leading-tight text-ink outline-none">
          <option value="anytime">Anytime</option><option value="today">Today</option><option value="tomorrow">Tomorrow</option><option value="weekend">This weekend</option>
        </select>
      </label>
      <button type="submit" aria-label="Search professionals" className="btn btn-ink min-h-[46px] rounded-[16px] px-6 text-[14.5px] md:rounded-full"><Icon.Search /><span>Search</span></button>
    </form>
  );
}
