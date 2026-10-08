import Link from "next/link";
import { ExportLink } from "@/components/export-link";
import { Btn, Content, Empty, Facts, Field, FilterSearch, Flash, Hidden, Panel, Tabs, Topbar, fmtMoney, fmtWhen, inputCls, statusPill } from "@/components/admin-ui";
import { load, qs, type Row } from "@/lib/admin-api";
import { bookingAction } from "../actions";

type SP = { q?: string; status?: string; business?: string; from?: string; to?: string; id?: string; ok?: string; err?: string };

/** The start time as a value for a datetime-local input, in the business's time zone. */
const localInput = (iso: string, timeZone: string) => new Date(iso).toLocaleString("sv-SE", { timeZone }).replace(" ", "T").slice(0, 16);

export default async function Bookings({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { q = "", status = "", business = "", from = "", to = "" } = sp;
  const filters = { q, status, business, from, to };
  const res = await load(`/bookings${qs(filters)}`);
  const list: Row[] = res.data.bookings ?? [];
  const sel = list.find((b) => b.id === sp.id);
  const here = (extra: Record<string, string | undefined>) => `/admin/bookings${qs({ ...filters, ...extra })}`;
  const back = here({ id: sel?.id });
  const active = sel && ["requested", "confirmed", "checked_in", "in_progress"].includes(sel.status);

  return (
    <>
      <Topbar title="Bookings" sub={`${list.length} shown, newest first. Times are in each business's own time zone.`}>
        <Tabs items={[["", "All"], ["confirmed", "Confirmed"], ["completed", "Completed"], ["no_show", "No-show"], ["cancelled_client", "Client cancelled"], ["cancelled_business", "Business cancelled"]]} current={status} href={(s) => here({ status: s })} />
        <ExportLink kind="bookings" filters={filters} />
      </Topbar>
      <Content>
        <Flash sp={sp} error={res.error} />
        <div className="flex flex-wrap items-end gap-3">
          <FilterSearch action="/admin/bookings" q={q} placeholder="Client, phone, business or booking ID" keep={{ status, business, from, to }} />
          <form action="/admin/bookings" className="flex flex-wrap items-end gap-2">
            <Hidden values={{ q, status, business }} />
            <Field label="From"><input type="date" name="from" defaultValue={from} className={inputCls} /></Field>
            <Field label="To"><input type="date" name="to" defaultValue={to} className={inputCls} /></Field>
            <Btn>Apply</Btn>
          </form>
          {(q || business || from || to) && <Link href={`/admin/bookings${qs({ status })}`} className="pb-2.5 text-[13px] font-semibold text-wine">Clear filters{business ? ` (${business})` : ""}</Link>}
        </div>

        <div className={`grid items-start gap-5 ${sel ? "xl:grid-cols-[1fr_380px]" : ""}`}>
          <Panel flush>
            <table className="data min-w-[820px]">
              <thead><tr><th>When</th><th>Client</th><th>Business</th><th>Services</th><th>Total</th><th>Status</th><th /></tr></thead>
              <tbody>
                {list.map((b) => (
                  <tr key={b.id} className={sel?.id === b.id ? "bg-cream-3" : "hover:bg-cream"}>
                    <td className="whitespace-nowrap">{fmtWhen(b.starts_at, b.timezone)}</td>
                    <td><b className="block font-semibold">{b.client_name}</b><span className="text-[12px] text-muted">{b.client_phone}</span></td>
                    <td><Link href={`/admin/businesses/${b.business_id}`} className="font-medium hover:text-wine">{b.business}</Link><span className="block text-[12px] text-muted">with {b.staff}</span></td>
                    <td className="max-w-[220px] truncate" title={b.services}>{b.services}</td>
                    <td className="font-semibold">{fmtMoney(b.total_cents, b.currency)}</td>
                    <td>{statusPill(b.status)}</td>
                    <td><Link href={here({ id: b.id })} className="text-[13px] font-semibold text-wine">Manage</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.length === 0 && <Empty>No bookings match.</Empty>}
          </Panel>

          {sel && (
            <Panel title={sel.client_name} sub={`Booking ${String(sel.id).slice(0, 8)} · made on ${sel.source}`} action={<Link href={here({})} className="text-[13px] font-semibold text-muted hover:text-ink">Close</Link>}>
              <div className="flex flex-col gap-4">
                <Facts narrow items={[["When", fmtWhen(sel.starts_at, sel.timezone)], ["Status", statusPill(sel.status)], ["Total", fmtMoney(sel.total_cents, sel.currency)], ["Deposit", sel.deposit_cents ? `${fmtMoney(sel.deposit_cents, sel.currency)} · ${sel.deposit_paid ? "paid" : "unpaid"}` : "none"], ["Phone", sel.client_phone], ["With", sel.staff]]} />
                <p className="text-[13.5px]"><b className="font-semibold">Services:</b> {sel.services}</p>
                {sel.notes && <p className="rounded-xl bg-cream-2 px-3.5 py-2.5 text-[13.5px]">{sel.notes}</p>}

                <form action={bookingAction} className="flex flex-col gap-2.5 border-t border-line-2 pt-4">
                  <Hidden values={{ id: sel.id, back }} />
                  <Field label="Reason, kept on record"><input name="note" className={inputCls} /></Field>
                  <div className="flex flex-wrap gap-2">
                    {active && <Btn kind="ok" small name="decision" value="complete">Mark completed</Btn>}
                    {active && <Btn small name="decision" value="no_show">No-show</Btn>}
                    {active && <Btn kind="danger" small name="decision" value="cancel">Cancel</Btn>}
                    {!active && <Btn small name="decision" value="confirm" title="Fails if the slot has been taken">Restore to confirmed</Btn>}
                  </div>
                </form>

                {active && (
                  <form action={bookingAction} className="flex flex-col gap-2.5 border-t border-line-2 pt-4">
                    <Hidden values={{ id: sel.id, back, decision: "reschedule" }} />
                    <Field label={`New start (${sel.timezone})`}><input type="datetime-local" name="starts_at" required defaultValue={localInput(sel.starts_at, sel.timezone)} className={inputCls} /></Field>
                    <Field label="Reason"><input name="note" className={inputCls} /></Field>
                    <div><Btn kind="ink" small>Move booking</Btn></div>
                    <p className="text-[12px] text-muted">The move is refused if that staff member already has a booking at the new time.</p>
                  </form>
                )}
              </div>
            </Panel>
          )}
        </div>
      </Content>
    </>
  );
}
