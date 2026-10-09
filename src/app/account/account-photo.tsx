"use client";
import { useState } from "react";

export function AccountPhoto({ id, name, tone }: { id?: string; name: string; tone?: string }) {
  const [failed, setFailed] = useState(false);
  return <span aria-hidden className="relative flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-2xl" style={{ background: tone || "#7A1F2B" }}>
    <span className="serif text-2xl text-white">{name.split(/\s+/).slice(0, 2).map(w => w[0]).join("")}</span>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {id && !failed && <img src={`/media/${id}`} alt="" className="absolute inset-0 h-full w-full object-cover" onError={() => setFailed(true)} />}
  </span>;
}
