import type { ReactNode } from "react";
import { AutoForm, ConfirmButton, CopyButton } from "@/components/merchant-client";
import { mCan, mLoad, qs, type Me, type Row } from "@/lib/merchant-api";
import { clock, dayShort, plural, ymd } from "@/lib/merchant-format";
import { calFeedMake, calFeedOff, calImportRun, calImportSave, calImportStop } from "./actions";

const sentence = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) + (/[.!?]$/.test(s) ? "" : ".") : s);
const note: React.CSSProperties = { fontSize: 12.5, lineHeight: 1.5, color: "#6B5F57" };
const part: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 10, minWidth: 0 };
const h4: React.CSSProperties = { margin: 0, fontSize: 14, fontWeight: 600 };

/**
 * Calendar sync for one person: their bookings shown in their own calendar, and
 * the times they are busy there kept out of their bookings. It is the signed-in
 * person's own, or for a manager the team member named by ?staff=.
 */
export async function CalendarSync({ me, staff }: { me: Me; staff?: string }) {
  const m = me.merchant, manager = mCan(me, "manager");
  const chosen = manager && staff ? staff : undefined;
  const [sync, cal] = await Promise.all([mLoad("/calendar-sync" + qs({ staff_id: chosen })), manager ? mLoad("/calendar") : null]);
  const people = ((cal?.data.staff ?? []) as Row[]).map((s) => ({ id: s.id as string, name: s.name as string }));
  const s = sync.data;
  const own = !sync.error && s.id === m.staff_id;
  const back = "/business/settings" + qs({ tab: "account", staff: sync.error || own ? chosen : (s.id as string) }) + "#calendar-sync";
  const whose = own ? "my" : "their";

  const picker: ReactNode = manager && people.length > (m.staff_id ? 1 : 0) ? (
    <AutoForm action="/business/settings#calendar-sync" style={{ display: "flex", alignItems: "flex-end", gap: 8, flexWrap: "wrap" }}>
      <input type="hidden" name="tab" value="account" />
      <div className="field" style={{ flex: "1 1 220px", maxWidth: 320, minWidth: 0 }}>
        <label htmlFor="cs-who">Whose calendar</label>
        <select id="cs-who" name="staff" defaultValue={sync.error ? chosen ?? "" : s.id}>
          {sync.error && !chosen ? <option value="">Choose a person</option> : null}
          {people.map((p) => <option key={p.id} value={p.id}>{p.id === m.staff_id ? `${p.name} (me)` : p.name}</option>)}
        </select>
      </div>
      <noscript><button className="btn btn-out btn-sm">Show</button></noscript>
    </AutoForm>
  ) : null;

  if (sync.error) {
    return (
      <div className="card" id="calendar-sync">
        <h3>Calendar sync</h3>
        <div className="sub">{sync.status === 409 && manager ? "Your sign-in is not linked to a person on the calendar. Choose a team member to set up their calendar." : sentence(sync.error)}</div>
        {picker}
      </div>
    );
  }

  const feed = (s.feed_url ?? "") as string;
  const hidden = <><input type="hidden" name="back" value={back} />{own ? null : <input type="hidden" name="staff" value={s.id} />}</>;
  const readAt = s.cal_import_at ? (ymd(s.cal_import_at, m.timezone) === ymd(new Date(), m.timezone) ? `today at ${clock(s.cal_import_at, m.timezone)}` : `${dayShort(s.cal_import_at, m.timezone)} at ${clock(s.cal_import_at, m.timezone)}`) : "";

  return (
    <div className="card" id="calendar-sync">
      <h3>Calendar sync</h3>
      <div className="sub">{own ? "Your LogaLuxe bookings and your own calendar, kept in step." : `You are setting this up for ${s.name}.`}</div>
      {picker}

      <div style={part}>
        <h4 style={h4}>Show {whose} bookings in {own ? "my" : "their"} own calendar <span className={"pill " + (feed ? "pill-ok" : "pill-grey")} style={{ marginLeft: 6, verticalAlign: "middle" }}>{feed ? "On" : "Off"}</span></h4>
        {feed ? (
          <>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div className="field" style={{ flex: "1 1 240px", minWidth: 0 }}>
                <label htmlFor="cs-feed">Private calendar address</label>
                <input id="cs-feed" type="text" readOnly value={feed} style={{ textOverflow: "ellipsis" }} />
              </div>
              <CopyButton text={feed} className="btn btn-ink btn-sm">Copy</CopyButton>
            </div>
            {feed.startsWith("https://") ? null : <div role="note" style={{ ...note, background: "#FBF4E3", border: "1px dashed #C9B27A", borderRadius: 12, padding: "8px 12px", color: "#7A5A12" }}>This address is on this computer only, so Google, Apple and Outlook cannot reach it yet. It will work once LogaLuxe is on the internet.</div>}
            <ul style={{ ...note, margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 2 }}>
              <li><b>Google Calendar:</b> Other calendars, +, From URL.</li>
              <li><b>Apple Calendar:</b> File, New Calendar Subscription.</li>
              <li><b>Outlook:</b> Add calendar, Subscribe from web.</li>
            </ul>
            <div style={note}>Anyone who has this address can read the bookings in it, so keep it to yourself. If it gets out, make a new one.</div>
            <div style={note}>Your calendar fetches the bookings on its own schedule. Google Calendar can take several hours to show a change.</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <form action={calFeedMake}>{hidden}<input type="hidden" name="again" value="on" /><ConfirmButton message="Make a new address? The old one stops working at once, so you will need to add the new one to your calendar." className="btn btn-out btn-sm">Make a new address</ConfirmButton></form>
              <form action={calFeedOff}>{hidden}<ConfirmButton message="Turn this off? The address stops working and the bookings will no longer update in your calendar." className="btn btn-ghost btn-sm">Turn off</ConfirmButton></form>
            </div>
          </>
        ) : (
          <>
            <div style={note}>Get a private address to add to Google Calendar, Apple Calendar or Outlook. {own ? "Your" : "Their"} bookings then show there next to everything else.</div>
            <form action={calFeedMake}>{hidden}<button className="btn btn-ink btn-sm">{own ? "Get my calendar address" : "Get their calendar address"}</button></form>
          </>
        )}
      </div>

      <hr style={{ border: 0, borderTop: "1px solid #EDE4DA", margin: "4px 0", width: "100%" }} />

      <div style={part}>
        <h4 style={h4}>Keep {whose} busy times out of {own ? "my" : "their"} bookings <span className={"pill " + (s.cal_import_set ? "pill-ok" : "pill-grey")} style={{ marginLeft: 6, verticalAlign: "middle" }}>{s.cal_import_set ? "On" : "Off"}</span></h4>
        {s.cal_import_set ? (
          <div style={{ background: "#FBF7F2", borderRadius: 12, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4, fontSize: 13.5, lineHeight: 1.45, overflowWrap: "anywhere" }}>
            <b>Connected to {s.cal_import_host || "a calendar"}</b>
            {s.cal_import_note ? <span>{s.cal_import_note}</span> : null}
            <span className="muted">{readAt ? `Last read ${readAt}. ` : "Not read yet. "}{plural(Number(s.imported_blocks ?? 0), "busy time")} held from now on.</span>
          </div>
        ) : (
          <div style={note}>Paste the private address of {own ? "your" : "their"} own calendar. The times {own ? "you are" : "they are"} busy there cannot be booked here. It is read at once and then every ten minutes.</div>
        )}
        <form action={calImportSave} style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          {hidden}
          <div className="field" style={{ flex: "1 1 240px", minWidth: 0 }}>
            <label htmlFor="cs-url">{s.cal_import_set ? "Replace it with another address" : "Private address in iCal format"}</label>
            <input id="cs-url" name="url" type="url" required maxLength={2000} autoComplete="off" spellCheck={false} placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" />
          </div>
          <button className="btn btn-ink btn-sm">Save</button>
        </form>
        <div style={note}>In Google Calendar: Settings, choose the calendar, then copy &quot;Secret address in iCal format&quot;.</div>
        <div style={note}>Only the times are kept, never what the events are. The saved address is not shown again here.</div>
        {s.cal_import_set ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <form action={calImportRun}>{hidden}<button className="btn btn-out btn-sm">Read it again now</button></form>
            <form action={calImportStop}>{hidden}<ConfirmButton message="Stop reading this calendar and remove the busy times it added? Those times can be booked again." className="btn btn-ghost btn-sm" style={{ whiteSpace: "normal", textAlign: "left" }}>Stop and remove these busy times</ConfirmButton></form>
          </div>
        ) : null}
      </div>
    </div>
  );
}
