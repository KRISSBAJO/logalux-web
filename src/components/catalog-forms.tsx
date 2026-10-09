import { Field, inputCls } from "@/components/admin-ui";
import type { Row } from "@/lib/admin-api";

export const BUSINESS_CATEGORIES: [string, string][] = [["hair", "Hair"], ["braids", "Braids & locs"], ["barber", "Barber"], ["nails", "Nails"], ["lashes", "Lashes & brows"], ["skin", "Skin"], ["makeup", "Makeup"], ["spa", "Spa & massage"]];
export const PRODUCT_CATEGORIES: [string, string][] = [["hair", "Hair & scalp"], ["styling", "Styling"], ["tools", "Tools & bonnets"], ["skin", "Skin"], ["nails", "Nails"], ["gift", "Gift cards"]];
/** Every zone a business in the United States or Nigeria can be in. Normally it is set from the address; this list is for a correction by hand. */
export const TIMEZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "America/Adak", "Pacific/Honolulu", "America/Puerto_Rico", "America/St_Thomas", "Pacific/Guam", "Pacific/Pago_Pago", "Africa/Lagos"];

const area = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-ink";

export function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-[14px]">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 accent-[#1A1513]" />
      {label}
    </label>
  );
}

/** The fields shared by "new business" and "edit profile". */
export function BusinessFields({ b = {} }: { b?: Row }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Business name"><input name="name" required minLength={2} maxLength={80} defaultValue={b.name} className={inputCls} /></Field>
      <Field label="Owner's name"><input name="owner_name" required defaultValue={b.owner_name} className={inputCls} /></Field>
      <Field label="Category"><select name="category" required defaultValue={b.category ?? ""} className={inputCls}><option value="" disabled>Choose</option>{BUSINESS_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
      <Field label="Phone"><input name="phone" defaultValue={b.phone} placeholder="+1 615 555 0100" className={inputCls} /></Field>
      <Field label="Email"><input name="email" type="email" defaultValue={b.email} className={inputCls} /></Field>
      <Field label="Instagram"><input name="instagram" defaultValue={b.instagram} placeholder="@name" className={inputCls} /></Field>
      <Field label="Tagline, under 140 characters" className="sm:col-span-2 lg:col-span-3"><input name="tagline" maxLength={140} defaultValue={b.tagline} className={inputCls} /></Field>
      <Field label="About" className="sm:col-span-2 lg:col-span-3"><textarea name="about" rows={4} maxLength={2000} defaultValue={b.about} className={area} /></Field>
      <Field label="Highlights, one per line (up to 8)" className="sm:col-span-2"><textarea name="highlights" rows={3} defaultValue={(b.highlights ?? []).join("\n")} placeholder={"Hair included\nFree parking"} className={area} /></Field>
      <div className="flex flex-col gap-3">
        <Field label="Time zone"><select name="timezone" defaultValue={b.timezone ?? ""} className={inputCls}><option value="">From the address</option>{[...new Set([...(b.timezone ? [b.timezone] : []), ...TIMEZONES])].map((t) => <option key={t} value={t}>{t}</option>)}</select></Field>
        <Field label="Brand colour, shown where there is no photo"><input name="tone" type="color" defaultValue={b.tone ?? "#3B1D22"} className="h-10 w-full cursor-pointer rounded-xl border border-line bg-white p-1" /></Field>
      </div>
    </div>
  );
}

/** The fields shared by "add service" and "edit service". Money is typed in whole units. */
export function ServiceFields({ sv = {}, staff, currency }: { sv?: Row; staff: Row[]; currency: string }) {
  const chosen: string[] = sv.staff_ids ?? [];
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Service name" className="sm:col-span-2"><input name="name" required maxLength={80} defaultValue={sv.name} className={inputCls} /></Field>
        <Field label="Menu group"><input name="category" required maxLength={40} defaultValue={sv.category} placeholder="Braids, Add-ons…" className={inputCls} /></Field>
        <Field label={`Price (${currency})`}><input name="price" type="number" min="0" step="0.01" required defaultValue={sv.price_cents != null ? sv.price_cents / 100 : ""} className={inputCls} /></Field>
        <Field label="Length, minutes"><input name="duration_min" type="number" min="5" max="720" step="5" required defaultValue={sv.duration_min ?? 60} className={inputCls} /></Field>
        <Field label="Processing, minutes"><input name="processing_min" type="number" min="0" max="480" step="5" defaultValue={sv.processing_min ?? 0} className={inputCls} /></Field>
        <Field label="Clean-up after, minutes"><input name="buffer_min" type="number" min="0" max="120" step="5" defaultValue={sv.buffer_min ?? 0} className={inputCls} /></Field>
        <Field label={`Deposit (${currency})`}><input name="deposit" type="number" min="0" step="0.01" defaultValue={sv.deposit_cents != null ? sv.deposit_cents / 100 : 0} className={inputCls} /></Field>
        <Field label="Description" className="sm:col-span-2 lg:col-span-4"><input name="description" maxLength={300} defaultValue={sv.description} className={inputCls} /></Field>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Check name="online" label="Clients can book it online" defaultChecked={sv.online ?? true} />
        <span className="text-[12.5px] font-semibold uppercase tracking-[.06em] text-muted">Who does it</span>
        {staff.map((p) => (
          <label key={p.id} className="flex cursor-pointer items-center gap-2 text-[14px]">
            <input type="checkbox" name="staff_ids" value={p.id} defaultChecked={sv.id ? chosen.includes(p.id) : true} className="h-4 w-4 accent-[#1A1513]" />{p.name}
          </label>
        ))}
      </div>
    </div>
  );
}

export function StaffFields({ p = {} }: { p?: Row }) {
  return (
    <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_90px_auto]">
      <Field label="Name"><input name="name" required maxLength={60} defaultValue={p.name} className={inputCls} /></Field>
      <Field label="Role"><select name="role" defaultValue={p.role ?? "staff"} className={inputCls}><option value="staff">Staff</option><option value="manager">Manager</option><option value="owner">Owner</option></select></Field>
      <Field label="Level"><select name="level" defaultValue={p.level ?? "senior"} className={inputCls}><option value="junior">Junior</option><option value="senior">Senior</option><option value="master">Master</option></select></Field>
      <Field label="Colour"><input name="tone" type="color" defaultValue={p.tone ?? "#7A1F2B"} className="h-10 w-full cursor-pointer rounded-xl border border-line bg-white p-1" /></Field>
      <div className="pb-2.5"><Check name="bookable" label="Takes bookings" defaultChecked={p.bookable ?? true} /></div>
    </div>
  );
}

/** `howToApart`: the edit screen has "How to use" in its own panel beside the ingredients, so here it only travels along unchanged. */
export function ProductFields({ p = {}, creating, howToApart }: { p?: Row; creating?: boolean; howToApart?: boolean }) {
  const sizes = ((p.sizes ?? []) as { label: string; price_cents: number }[]).map((s) => `${s.label} = ${s.price_cents / 100}`).join("\n");
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="Product name" className="sm:col-span-2"><input name="name" required minLength={2} maxLength={100} defaultValue={p.name} className={inputCls} /></Field>
      <Field label="Category"><select name="category" required defaultValue={p.category ?? ""} className={inputCls}><option value="" disabled>Choose</option>{PRODUCT_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
      <Field label="Stock"><input name="stock" type="number" min="0" step="1" required defaultValue={p.stock ?? 0} className={inputCls} /></Field>
      <Field label={p.currency ? `Price (${p.currency})` : "Price, in the seller's currency (USD for a brand product)"}><input name="price" type="number" min="0.01" step="0.01" required defaultValue={p.price_cents != null ? p.price_cents / 100 : ""} className={inputCls} /></Field>
      <Field label="Was price, optional"><input name="compare" type="number" min="0" step="0.01" defaultValue={p.compare_cents != null ? p.compare_cents / 100 : ""} className={inputCls} /></Field>
      <Field label="Seller name"><input name="seller_name" defaultValue={p.seller_name} placeholder="A brand, or leave empty" className={inputCls} /></Field>
      <Field label="Sold by this business, optional"><input name="business_slug" defaultValue={p.business_slug ?? ""} placeholder="booking link, like ada" className={inputCls} /></Field>
      {creating && <Field label="Shop link, optional" className="sm:col-span-2"><input name="slug" pattern="[a-z0-9][a-z0-9-]{1,59}" placeholder="made from the name if left empty" className={inputCls} /></Field>}
      <Field label="Description" className="sm:col-span-2 lg:col-span-4"><textarea name="description" rows={3} maxLength={2000} defaultValue={p.description} className={area} /></Field>
      {howToApart
        ? <input type="hidden" name="how_to_use" value={p.how_to_use ?? ""} />
        : <Field label="How to use" className="sm:col-span-2 lg:col-span-4"><textarea name="how_to_use" rows={2} maxLength={2000} defaultValue={p.how_to_use} className={area} /></Field>}
      <Field label="Sizes, one per line as name = price" className="sm:col-span-2"><textarea name="sizes" rows={3} defaultValue={sizes} placeholder={"30 ml = 11\n60 ml = 18"} className={`${area} font-mono text-[13px]`} /></Field>
      <div className="flex flex-col gap-3 sm:col-span-2">
        <Field label="Tags, comma separated. 'bestseller' shows a badge"><input name="tags" defaultValue={(p.tags ?? []).join(", ")} className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Shipping fee (USD)"><input name="shipping_price" type="number" min="0" step="0.01" defaultValue={(p.shipping_cents ?? 499) / 100} className={inputCls} /></Field>
          <Field label="Colour with no photo"><input name="tone" type="color" defaultValue={p.tone ?? "#3B1D22"} className="h-10 w-full cursor-pointer rounded-xl border border-line bg-white p-1" /></Field>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2"><Check name="pickup" label="Pick up at a visit" defaultChecked={p.pickup ?? true} /><Check name="shipping" label="Can be shipped" defaultChecked={p.shipping ?? true} /></div>
      </div>
    </div>
  );
}
