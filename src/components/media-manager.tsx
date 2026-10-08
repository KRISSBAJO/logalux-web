import { Btn, Field, Hidden, Pill, ago, inputCls, inputSm } from "@/components/admin-ui";
import type { Row } from "@/lib/admin-api";
import { deleteMedia, updateMedia, uploadMedia } from "@/app/admin/actions";

const size = (n: number) => (n >= 1 << 20 ? `${(n / (1 << 20)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/**
 * Upload form and image cards for one place on the site: a slot, and inside
 * it one ref (a category, a business or a product). Used on several admin pages.
 */
const POSITIONS: [string, string][] = [["bottom-right", "Bottom right"], ["bottom-left", "Bottom left"], ["top-right", "Top right"], ["top-left", "Top left"], ["none", "No card"]];

export function MediaManager({ slot, refKey = "", items, back, canEdit, max, hint, aspect = "aspect-[4/5]", compact, quotes }: {
  slot: string; refKey?: string; items: Row[]; back: string; canEdit: boolean; max: number; hint?: string; aspect?: string; compact?: boolean;
  /** Each image carries a short quote card, and says where it sits. Used by the landing hero. */
  quotes?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <form action={uploadMedia} className={`grid items-end gap-3 rounded-2xl bg-cream-2 p-4 ${compact ? "" : "md:grid-cols-[1.2fr_1.4fr_auto]"}`}>
          <Hidden values={{ slot, ref: refKey, back }} />
          <Field label={compact ? "Image" : "Image · JPEG, PNG or WebP, up to 8 MB"}>
            <input type="file" name="file" required accept="image/jpeg,image/png,image/webp" className={`${inputCls} py-2 file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-3 file:py-1 file:text-[12.5px] file:font-semibold file:text-cream`} />
          </Field>
          <Field label={compact ? "Description" : "Describe it, for people using screen readers"}>
            <input name="alt" required maxLength={200} className={inputCls} />
          </Field>
          {quotes && (
            <div className="grid gap-3 sm:grid-cols-[1fr_180px] md:col-span-3">
              <Field label="Quote shown on the photo, optional"><input name="caption" maxLength={80} placeholder="Exactly what I booked." className={inputCls} /></Field>
              <Field label="Where the quote sits"><select name="caption_pos" defaultValue="bottom-right" className={inputCls}>{POSITIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
            </div>
          )}
          <div><Btn kind="ink">{max === 1 && items.some((m) => m.active) ? "Upload another" : "Upload"}</Btn></div>
          {hint && <p className={`text-[12.5px] text-muted ${compact ? "" : "md:col-span-3"}`}>{hint}</p>}
        </form>
      )}

      {items.length === 0 ? <p className="py-3 text-center text-[13.5px] text-muted">No images yet. The site shows a colour in its place.</p> : (
        <div className={`grid gap-4 ${compact ? "" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
          {items.map((m, i) => {
            const shown = m.active && items.filter((x) => x.active).indexOf(m) < max;
            return (
              <div key={m.id} className={`overflow-hidden rounded-2xl border bg-white ${m.active ? "border-line" : "border-dashed border-muted-2"}`}>
                <div className={`relative bg-cream-3 ${aspect}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/media/${m.id}`} alt={m.alt} loading="lazy" className={`absolute inset-0 h-full w-full object-cover ${m.active ? "" : "opacity-45 grayscale"}`} />
                  <span className="absolute left-3 top-3 flex gap-1">
                    {!m.active ? <Pill kind="grey">hidden</Pill> : shown ? <Pill kind="ok">showing</Pill> : <Pill kind="gold">over the limit of {max}</Pill>}
                    {shown && i === items.findIndex((x) => x.active) && max > 1 && <Pill kind="info">first</Pill>}
                  </span>
                </div>
                <div className="flex flex-col gap-3 p-3.5">
                  <p className="text-[12px] text-muted">{size(m.size_bytes)} · {String(m.content_type).replace("image/", "").toUpperCase()} · {m.uploaded_by} · {ago(m.created_at)}</p>
                  {canEdit ? (
                    <>
                      <form action={updateMedia} className="flex flex-col gap-2">
                        <Hidden values={{ id: m.id, back }} />
                        <div className="flex gap-2">
                          <input name="alt" defaultValue={m.alt} maxLength={200} aria-label="Description" className={`${inputSm} flex-1`} />
                          <input name="sort" type="number" defaultValue={m.sort} aria-label="Order, lowest first" title="Order, lowest first" className={`${inputSm} w-[58px]`} />
                        </div>
                        {quotes && (
                          <div className="flex gap-2">
                            <input name="caption" defaultValue={m.caption} maxLength={80} placeholder="Quote on the photo" aria-label="Quote on the photo" className={`${inputSm} flex-1`} />
                            <select name="caption_pos" defaultValue={m.caption_pos ?? "bottom-right"} aria-label="Where the quote sits" className={`${inputSm} w-[116px]`}>{POSITIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                          </div>
                        )}
                        <div><Btn small>Save text and order</Btn></div>
                      </form>
                      <div className="flex gap-2 border-t border-line-2 pt-3">
                        <form action={updateMedia}><Hidden values={{ id: m.id, active: m.active ? "0" : "1", back }} />{m.active ? <Btn small>Hide</Btn> : <Btn small kind="ok">Show</Btn>}</form>
                        <form action={deleteMedia}><Hidden values={{ id: m.id, back }} /><Btn small kind="danger" title="Removes the file from storage for good">Delete</Btn></form>
                      </div>
                    </>
                  ) : <p className="text-[13.5px]">{m.alt || "No description"}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
