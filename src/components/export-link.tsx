import { can, getAdmin, qs, type Role } from "@/lib/admin-api";

/** A CSV download of the list on screen, with the same filters. Hidden from roles that may not export. */
export async function ExportLink({ kind, filters = {}, need = "ops" }: { kind: string; filters?: Record<string, string | undefined>; need?: Role }) {
  if (!can(await getAdmin(), need)) return null;
  return (
    <a href={`/admin/export/${kind}${qs(filters)}`} className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-white px-4 text-[13.5px] font-semibold hover:border-ink">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>
      Export CSV
    </a>
  );
}
