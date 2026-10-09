import Link from "next/link";
import { Btn, Content, Field, Flash, Hidden, Panel, Pill, ReadOnly, Topbar, fmtMoney, inputCls, statusPill } from "@/components/admin-ui";
import { BusinessFields, Check, ServiceFields, StaffFields } from "@/components/catalog-forms";
import { can, getAdmin, load, type Row } from "@/lib/admin-api";
import { LocationFields } from "@/components/location-fields";
import { LOOKS } from "@/lib/location-form";
import { zoneName } from "@/lib/place";
import { allStates } from "@/lib/places";
import { createService, createStaff, removeService, removeStaff, saveBusinessProfile, saveLocation, saveService, saveStaff } from "../../../actions-catalog";

const DAYS: [string, string][] = [["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"], ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"]];
const summary = "flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 hover:bg-cream [&::-webkit-details-marker]:hidden";

export default async function EditBusiness({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [admin, res, states] = await Promise.all([getAdmin(), load(`/businesses/${encodeURIComponent(id)}`), allStates()]);
  const b: Row | undefined = res.data.business;
  const back = `/admin/businesses/${id}/edit`;

  if (!b) {
    return (
      <>
        <Topbar title="Business" />
        <Content><Flash sp={sp} error={res.error || "Business not found."} /><Link href="/admin/businesses" className="text-[14px] font-semibold text-wine">Back to businesses</Link></Content>
      </>
    );
  }
  const staff: Row[] = res.data.staff ?? [];
  const services: Row[] = res.data.services ?? [];
  const locations: Row[] = res.data.locations ?? [];
  const cur = b.currency;
  const nameOf = (sid: string) => staff.find((p) => p.id === sid)?.name;

  return (
    <>
      <Topbar title={`Edit ${b.name}`} sub={`logaluxe.com/@${b.slug} · ${b.market} · ${cur}`}>
        {statusPill(b.status)}
        <Link href={`/admin/businesses/${id}`} className="inline-flex h-10 items-center rounded-full border border-line bg-white px-4 text-[13.5px] font-semibold hover:border-ink">Back to overview</Link>
      </Topbar>
      <Content>
        <Flash sp={sp} />
        {!can(admin, "ops") ? <ReadOnly need="ops" /> : (
          <>
            <Panel title="Profile" sub="What clients read on the storefront">
              <form action={saveBusinessProfile} className="flex flex-col gap-4">
                <Hidden values={{ id: b.id, back }} />
                <BusinessFields b={b} />
                <div><Btn kind="ink">Save profile</Btn></div>
              </form>
            </Panel>

            {locations.map((l) => (
              <Panel key={l.id} title={`Location and hours · ${l.name}`} sub={`Times are in ${zoneName(String(l.timezone))} (${l.timezone}), from where it is. Clients can only book inside these hours.`}>
                <form action={saveLocation} className="flex flex-col gap-4">
                  <Hidden values={{ id: l.id, back }} />
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Location name"><input name="name" required defaultValue={l.name} className={inputCls} /></Field>
                    <div className="sm:col-span-2 lg:col-span-4">
                      <LocationFields states={states} look={LOOKS.admin} idp={l.id} country={String(l.country || b.market)} fixedCountry
                        value={{ address: l.address, city: l.city, region: l.region, lat: l.lat ?? null, lng: l.lng ?? null, travels: !!l.travels, travel_radius_km: l.travel_radius_km ?? null, timezone: l.timezone }} />
                    </div>
                    <Field label="Arrival notes, shown after booking" className="sm:col-span-2 lg:col-span-4"><input name="arrival_notes" defaultValue={l.arrival_notes} placeholder="Free parking behind the building. Ring the bell." className={inputCls} /></Field>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {DAYS.map(([d, label]) => {
                      const h: string[] | null = l.hours?.[d] ?? null;
                      return (
                        <div key={d} className="rounded-xl border border-line p-3">
                          <Check name={`${d}_open`} label={label} defaultChecked={!!h} />
                          <div className="mt-2 flex items-center gap-2">
                            <input type="time" name={`${d}_from`} defaultValue={h?.[0] ?? "09:00"} aria-label={`${label} opens`} className={`${inputCls} h-9 px-2`} />
                            <span className="text-muted">to</span>
                            <input type="time" name={`${d}_to`} defaultValue={h?.[1] ?? "18:00"} aria-label={`${label} closes`} className={`${inputCls} h-9 px-2`} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center gap-3"><Btn kind="ink">Save location and hours</Btn><span className="text-[13px] text-muted">Untick a day to mark it closed.</span></div>
                </form>
              </Panel>
            ))}

            <Panel title={`Team · ${staff.length}`} sub="Someone with past bookings is made unbookable instead of deleted." flush>
              {staff.map((p) => (
                <details key={p.id} className="border-b border-line-2">
                  <summary className={summary}>
                    <i className="block h-8 w-8 flex-none rounded-full" style={{ background: p.tone }} />
                    <span className="min-w-0 flex-1"><b className="block text-[14.5px] font-semibold">{p.name}</b><span className="text-[12.5px] capitalize text-muted">{p.role} · {p.level}</span></span>
                    {!p.bookable && <Pill kind="grey">not bookable</Pill>}
                    <span className="text-[13px] font-semibold text-wine">Edit</span>
                  </summary>
                  <div className="flex flex-col gap-3 bg-cream px-5 py-4">
                    <form action={saveStaff} className="flex flex-col gap-3"><Hidden values={{ id: p.id, back }} /><StaffFields p={p} /><div><Btn small kind="ink">Save</Btn></div></form>
                    <form action={removeStaff}><Hidden values={{ id: p.id, back }} /><Btn small kind="danger">Remove from the team</Btn></form>
                  </div>
                </details>
              ))}
              <details className="group">
                <summary className={`${summary} text-[14px] font-semibold text-wine`}>+ Add a team member</summary>
                <form action={createStaff} className="flex flex-col gap-3 bg-cream px-5 py-4"><Hidden values={{ id: b.id, back }} /><StaffFields /><div><Btn small kind="ink">Add to the team</Btn></div></form>
              </details>
            </Panel>

            <Panel title={`Services · ${services.length}`} sub="A service that has been booked is taken off the menu instead of deleted." flush>
              {services.map((sv) => (
                <details key={sv.id} className="border-b border-line-2">
                  <summary className={summary}>
                    <span className="min-w-0 flex-1">
                      <b className="block text-[14.5px] font-semibold">{sv.name}</b>
                      <span className="text-[12.5px] text-muted">{sv.category} · {sv.duration_min} min · {(sv.staff_ids as string[]).map(nameOf).filter(Boolean).join(", ") || "nobody assigned"}</span>
                    </span>
                    {!sv.online && <Pill kind="grey">off the menu</Pill>}
                    {(sv.staff_ids as string[]).length === 0 && <Pill kind="wine">cannot be booked</Pill>}
                    <b className="text-[14.5px] font-semibold">{fmtMoney(sv.price_cents, cur)}</b>
                    <span className="text-[13px] font-semibold text-wine">Edit</span>
                  </summary>
                  <div className="flex flex-col gap-3 bg-cream px-5 py-4">
                    <form action={saveService} className="flex flex-col gap-3"><Hidden values={{ id: sv.id, back }} /><ServiceFields sv={sv} staff={staff} currency={cur} /><div><Btn small kind="ink">Save service</Btn></div></form>
                    <form action={removeService}><Hidden values={{ id: sv.id, back }} /><Btn small kind="danger">Delete service</Btn></form>
                  </div>
                </details>
              ))}
              <details open={services.length === 0}>
                <summary className={`${summary} text-[14px] font-semibold text-wine`}>+ Add a service</summary>
                <form action={createService} className="flex flex-col gap-3 bg-cream px-5 py-4"><Hidden values={{ id: b.id, back }} /><ServiceFields staff={staff} currency={cur} /><div><Btn small kind="ink">Add service</Btn></div></form>
              </details>
            </Panel>
          </>
        )}
      </Content>
    </>
  );
}
