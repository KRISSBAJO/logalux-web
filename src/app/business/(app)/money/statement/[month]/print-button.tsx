"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/** Print only after the server has collected every page of the statement. */
export function PrintButton({ complete = false }: { complete?: boolean }) {
  const path = usePathname(), router = useRouter();
  useEffect(() => { if (complete) window.print(); }, [complete]);
  return <button type="button" className="btn btn-ink" onClick={() => {
    if (complete) window.print();
    else router.push(path + "?print=all");
  }}>Print or save as PDF</button>;
}
