import { headers } from "next/headers";
import { LocationFields } from "@/components/location-fields";
import { LOOKS } from "@/lib/location-form";
import { zoneName } from "@/lib/place";
import { allStates } from "@/lib/places";
import Link from "next/link";
import { toDataURL } from "qrcode";
import type { ReactNode } from "react";
import { ConfirmButton, CopyButton, Sheet } from "@/components/merchant-client";
import { Avatar, Flash, LoadError, Topbar } from "@/components/merchant-ui";
import { mReadFlash } from "@/lib/merchant-actions";
import { getMe, mCan, mLoad, qs, type Me, type Row } from "@/lib/merchant-api";
import { dateMed, dateOnly, money, plural, when } from "@/lib/merchant-format";
import { channelModes, liveNames, loggedNames } from "@/lib/merchant-channels";
import { CalendarSync } from "./calendar-sync";
import { cancelTwoStepSetup, changePassword, changePlan, dismissRecoveryCodes, finishTwoStep, locationAction, saveAccount, saveLocation, saveProfile, saveRules, setListing, startTwoStep, stopTwoStep } from "./actions";
import "../../css/settings.css";

export const metadata = { title: "Settings" };

type SP = { ok?: string; err?: string; tab?: string; staff?: string };
type Hours = Record<string, string[] | null> | null | undefined;

const SECTIONS: [string, string][] = [["biz", "Business & locations"], ["page", "Booking page"], ["policy", "Policies & deposits"], ["notif", "Notifications"], ["team", "Team & permissions"], ["integ", "Integrations"], ["billing", "Plan & billing"], ["data", "Data & privacy"], ["account", "Your account"]];
const CATEGORIES: [string, string][] = [["braids", "Braids & locs"], ["hair", "Hair"], ["barber", "Barber"], ["nails", "Nails"], ["lashes", "Lashes & brows"], ["skin", "Skin"], ["makeup", "Makeup"], ["spa", "Spa"]];
const DAYS: [string, string, string][] = [["mon", "Mon", "Monday"], ["tue", "Tue", "Tuesday"], ["wed", "Wed", "Wednesday"], ["thu", "Thu", "Thursday"], ["fri", "Fri", "Friday"], ["sat", "Sat", "Saturday"], ["sun", "Sun", "Sunday"]];
const FEES: [string, string][] = [["none", "No fee"], ["deposit", "Keep the deposit"], ["50", "50% of the service"], ["100", "100% of the service"]];
const ROLE: Record<string, string> = { owner: "Owner", manager: "Manager", staff: "Team member" };
const ROLE_CAN: [string, string, string][] = [
  ["owner", "Owner", "Everything, including money, payouts, the plan and who can sign in"],
  ["manager", "Manager", "Everything except money, payouts, the plan and inviting people"],
  ["staff", "Team member", "Calendar, clients, checkout, inbox, the menu and the roster. No marketing, reports, stock or settings"],
];

/** Days in a row with the same hours are grouped: "Tue and Wed 09:00 to 18:00 · Sat 08:00 to 18:00". */
function hoursLine(hours: Hours): string {
  const out: string[] = [];
  let start = -1, cur = "";
  const flush = (end: number) => {
    if (start >= 0 && cur) out.push(`${DAYS[start][1]}${end > start + 1 ? ` to ${DAYS[end][1]}` : end > start ? ` and ${DAYS[end][1]}` : ""} ${cur}`);
  };
  DAYS.forEach(([key], i) => {
    const h = hours?.[key];
    const text = h && h.length === 2 ? `${h[0]} to ${h[1]}` : "";
    if (text !== cur) { flush(i - 1); start = i; cur = text; }
  });
  flush(DAYS.length - 1);
  return out.join(" · ");
}

/** An on/off switch that posts with its form. It looks like the design's switch and works without scripts. */
function Toggle({ name, on, label }: { name: string; on: boolean; label: string }) {
  return <span className="tog"><input type="checkbox" name={name} defaultChecked={on} aria-label={label} /><span className="sw" aria-hidden="true" /></span>;
}
function Rule({ name, on, title, sub }: { name: string; on: boolean; title: string; sub: ReactNode }) {
  return <div className="row"><div><b>{title}</b><span>{sub}</span></div><Toggle name={name} on={on} label={title} /></div>;
}

/** Seven rows: open or closed, and from when to when. */
function HoursRows({ hours, idp }: { hours: Hours; idp: string }) {
  return (
    <div className="hrs">
      {DAYS.map(([key, , full]) => {
        const h = hours?.[key];
        const open = !!h && h.length === 2;
        return (
          <div key={key} className="hr">
            <label className="hr-day"><input type="checkbox" name={`open_${key}`} defaultChecked={open} /><b>{full}</b><i className="hr-closed">Closed</i></label>
            <span className="hr-t">
              <input type="time" name={`from_${key}`} defaultValue={open ? h[0] : "09:00"} aria-label={`${full} opens at`} id={`${idp}-f-${key}`} />
              <span>to</span>
              <input type="time" name={`to_${key}`} defaultValue={open ? h[1] : "18:00"} aria-label={`${full} closes at`} id={`${idp}-t-${key}`} />
            </span>
          </div>
        );
      })}
    </div>
  );
}
/** The same hours as hidden fields, for a form that edits the address but must send the hours too. */
function HoursKept({ hours }: { hours: Hours }) {
  return (
    <>
      {DAYS.map(([key]) => {
        const h = hours?.[key];
        return h && h.length === 2 ? <span key={key} hidden><input type="hidden" name={`open_${key}`} value="1" /><input type="hidden" name={`from_${key}`} value={h[0]} /><input type="hidden" name={`to_${key}`} value={h[1]} /></span> : null;
      })}
    </>
  );
}

/** "Your account": the one part of Settings every person on the team can use. */
type Security = { twoStep: boolean; left: number; setup?: { secret: string; uri: string }; recovery?: string[]; qr: string };

/** How this person signs in, with the setup key or the new recovery codes when there are some to show. */
async function loadSecurity(): Promise<Security> {
  const [{ data }, flash] = await Promise.all([mLoad("/security"), mReadFlash()]);
  const twoStep = !!data.two_step;
  const setup = !twoStep ? flash?.setup : undefined;
  return {
    twoStep, left: Number(data.recovery_left ?? 0), setup, recovery: twoStep ? flash?.recovery : undefined,
    qr: setup ? await toDataURL(setup.uri, { margin: 1, width: 220, color: { dark: "#1A1513", light: "#FFFFFF" } }) : "",
  };
}

function Account({ me, account, back, sec }: { me: Me; account: Row | null; back: string; sec: Security }) {
  const m = me.merchant;
  return (
    <>
      {sec.recovery ? (
        <div className="card">
          <h3>Save your recovery codes</h3>
          <div className="sub">Each code signs you in once if you lose your phone. They are shown only now, so write them down or keep them in a password manager.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 8, maxWidth: 520, margin: "14px 0", fontFamily: "ui-monospace,Menlo,Consolas,monospace", fontSize: 15 }}>
            {sec.recovery.map((c) => <span key={c} style={{ background: "#F4ECE2", borderRadius: 10, padding: "8px 12px", textAlign: "center", letterSpacing: ".06em" }}>{c}</span>)}
          </div>
          <form action={dismissRecoveryCodes}><input type="hidden" name="back" value={back} /><button className="btn btn-ink btn-sm">I have saved them</button></form>
        </div>
      ) : null}
      <div className="card">
        <h3>Your account</h3>
        <div className="sub">These are your own details, not the business&apos;s. You are signed in to {m.business} as {ROLE[m.role]?.toLowerCase() ?? m.role}.</div>
        <form action={saveAccount} id="account-form" className="stack">
          <input type="hidden" name="back" value={back} />
          <div className="two">
            <div className="field"><label htmlFor="ac-name">Your name</label><input id="ac-name" name="name" type="text" required maxLength={80} defaultValue={account?.name ?? m.name} autoComplete="name" /></div>
            <div className="field">
              <label htmlFor="ac-phone">Your phone · with the country code</label>
              <input id="ac-phone" name="phone" type="tel" maxLength={24} defaultValue={account?.phone ?? ""} placeholder={m.market === "NG" ? "+234 803 123 4567" : "+1 615 555 0144"} autoComplete="tel" />
              {account ? null : <small className="muted">We cannot show the number we hold for you on this screen. Type it again to keep it: saving with this box empty removes it.</small>}
            </div>
          </div>
          <div className="field"><label htmlFor="ac-email">Sign-in email</label><input id="ac-email" type="email" value={account?.email ?? m.email} readOnly /><small className="muted">You sign in with this address. It cannot be changed here{m.role === "owner" ? "; contact LogaLuxe support to move the account." : "; ask the owner to invite your new address from Staff & rosters."}</small></div>
          <div><button className="btn btn-ink btn-sm">Save my details</button></div>
        </form>
      </div>
      <div className="card">
        <h3>Change password</h3>
        <div className="sub">At least 10 characters. Changing it signs you out on your other devices.</div>
        <form action={changePassword} className="stack">
          <input type="hidden" name="back" value={back} />
          <div className="three">
            <div className="field"><label htmlFor="pw-cur">Current password</label><input id="pw-cur" name="current" type="password" required autoComplete="current-password" /></div>
            <div className="field"><label htmlFor="pw-new">New password</label><input id="pw-new" name="new" type="password" required minLength={10} maxLength={200} autoComplete="new-password" /></div>
            <div className="field"><label htmlFor="pw-again">New password again</label><input id="pw-again" name="again" type="password" required minLength={10} maxLength={200} autoComplete="new-password" /></div>
          </div>
          <div><button className="btn btn-out btn-sm">Change password</button></div>
        </form>
      </div>
      <div className="card" id="two-step">
        <h3>Two-step sign-in <span className={"pill " + (sec.twoStep ? "pill-ok" : "pill-grey")} style={{ marginLeft: 8, verticalAlign: "middle" }}>{sec.twoStep ? "On" : "Off"}</span></h3>
        {sec.twoStep ? (
          <>
            <div className="sub">Signing in needs your password and a 6-digit code from your authenticator app. You have {plural(sec.left, "recovery code")} left{sec.left <= 2 ? "; turn it off and set it up again to get a fresh set" : ""}.</div>
            <form action={stopTwoStep} className="stack">
              <input type="hidden" name="back" value={back} />
              <div className="field" style={{ maxWidth: 320 }}><label htmlFor="ts-pw">Your password, to turn it off</label><input id="ts-pw" name="password" type="password" required autoComplete="current-password" /></div>
              <div><button className="btn btn-out btn-sm">Turn off two-step sign-in</button></div>
            </form>
          </>
        ) : sec.setup ? (
          <>
            <div className="sub">1. Open an authenticator app, such as Google Authenticator, Authy or 1Password. 2. Scan this code, or type the key in by hand. 3. Enter the 6-digit code the app shows.</div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 20, margin: "14px 0" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sec.qr} alt="QR code for your authenticator app" width={176} height={176} style={{ borderRadius: 12, border: "1px solid #E6DCD2" }} />
              <div style={{ minWidth: 0 }}>
                <small className="muted" style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase" }}>Key</small>
                <code style={{ display: "block", wordBreak: "break-all", fontSize: 14, letterSpacing: ".06em" }}>{sec.setup.secret.replace(/(.{4})/g, "$1 ").trim()}</code>
              </div>
            </div>
            <form action={finishTwoStep} style={{ display: "flex", alignItems: "flex-end", gap: 8, flexWrap: "wrap" }}>
              <input type="hidden" name="back" value={back} />
              <div className="field" style={{ width: 170 }}><label htmlFor="ts-code">6-digit code</label><input id="ts-code" name="code" required inputMode="numeric" pattern="[0-9 ]{6,7}" autoComplete="one-time-code" style={{ textAlign: "center", letterSpacing: ".3em", fontSize: 18 }} /></div>
              <button className="btn btn-ink btn-sm">Turn on</button>
            </form>
            <form action={cancelTwoStepSetup} style={{ marginTop: 10 }}><input type="hidden" name="back" value={back} /><button className="btn btn-ghost btn-sm">Cancel setup</button></form>
          </>
        ) : (
          <>
            <div className="sub">Adds a 6-digit code from your phone to every sign-in, so a stolen password alone cannot get into your calendar, your clients or your payouts.{m.role === "owner" ? " We recommend it for every owner." : ""}</div>
            <form action={startTwoStep}><input type="hidden" name="back" value={back} /><button className="btn btn-ink btn-sm">Set up two-step sign-in</button></form>
          </>
        )}
      </div>
    </>
  );
}

export default async function Settings({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const me = (await getMe())!;
  const { merchant: m } = me;
  const [{ data: d, error, status }, pay] = await Promise.all([mLoad("/settings"), sp.tab === "integ" ? mLoad("/payments") : Promise.resolve(null)]);

  // Team members cannot open the business settings, but their own account is theirs to manage.
  if (status === 403) {
    return (
      <div className="main pg-settings">
        <Topbar title="Settings"><span className="muted" style={{ fontSize: 13 }}>Your account</span></Topbar>
        <div className="content">
          <nav className="menu" aria-label="Settings sections"><Link href="/business/settings" className="mi on" aria-current="page">Your account</Link></nav>
          <div className="pane">
            <Flash sp={sp} />
            <Account me={me} account={null} back="/business/settings" sec={await loadSecurity()} />
            <CalendarSync me={me} staff={sp.staff} />
            <div className="card">
              <h3>Business settings</h3>
              <div className="sub">The business profile, opening hours, booking rules and the plan are looked after by managers and the owner. Ask them if something there needs changing.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (error) return <div className="main pg-settings"><LoadError title="Settings" error={error} /></div>;

  const owner = mCan(me, "owner");
  const tab = SECTIONS.some(([k]) => k === sp.tab) ? sp.tab! : "biz";
  const title = SECTIONS.find(([k]) => k === tab)![1];
  const back = "/business/settings" + qs({ tab: tab === "biz" ? undefined : tab });
  const b = d.business as Row, account = d.account as Row, rules = d.rules as Record<string, Row>;
  const locations = (d.locations ?? []) as Row[], logins = (d.logins ?? []) as Row[], plans = (d.plans ?? []) as Row[];
  const cur = String(b.currency ?? m.currency), tz = String(b.timezone ?? m.timezone);
  const mailLogged = d.mail_mode === "log";
  // WhatsApp and SMS are switched on by LogaLuxe staff. What is said about them follows what the API reports for this business.
  const modes = await channelModes();
  const phoneLive = liveNames(modes), phoneLogged = loggedNames(modes);
  const many = (names: string) => names.includes(" and ");
  const bill = (d.billing ?? {}) as Row;
  const proPrice = money(bill.pro_price_cents ?? ((d.plans ?? []) as Row[]).find((p) => p.plan === "pro")?.plan_price_cents ?? 0, cur);
  const graceDays = Number(bill.grace_days ?? 0);
  const taxPct = Number(b.sales_tax_bp ?? 0) / 100;
  const zones = (() => {
    const all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
    return all.includes(tz) ? all : [tz, ...all];
  })();
  const primary = locations.find((l) => l.is_primary) ?? locations[0];
  const states = await allStates();
  const hd = await headers();
  const bookingPath = `/b/${b.slug}`;
  const bookingUrl = `${hd.get("x-forwarded-proto") ?? "http"}://${hd.get("x-forwarded-host") ?? hd.get("host") ?? "localhost"}${bookingPath}`;
  const formId = ({ biz: "profile-form", page: "rules-form", policy: "rules-form", notif: "rules-form", account: "account-form" } as Record<string, string>)[tab];
  const statusText: Record<string, string> = { live: "Live", paused: "Paused", pending: "In review", suspended: "Suspended" };

  const locationFields = (l: Row | null, idp: string) => (
    <>
      <div className="field"><label htmlFor={`${idp}-name`}>Name · how you tell your locations apart</label><input id={`${idp}-name`} name="name" type="text" required maxLength={80} defaultValue={l?.name ?? ""} placeholder="Lekki Phase 1" /></div>
      {/* The country is the business's own; the address decides the pin and the time zone. */}
      <LocationFields states={states} look={LOOKS.merchant} idp={idp} country={String(b.market)} fixedCountry
        value={{ address: l?.address ?? "", city: l?.city ?? "", region: l?.region ?? "", lat: l?.lat ?? null, lng: l?.lng ?? null, travels: !!l?.travels, travel_radius_km: l?.travel_radius_km ?? null, timezone: l?.timezone }} />
      <div className="field"><label htmlFor={`${idp}-notes`}>Parking and arrival notes</label><textarea id={`${idp}-notes`} name="arrival_notes" maxLength={400} defaultValue={l?.arrival_notes ?? ""} placeholder="Free parking behind the building, ring bell 2" /></div>
    </>
  );

  return (
    <div className="main pg-settings">
      <Topbar title="Settings">
        <span className="muted" style={{ fontSize: 13 }}>{title}</span>
        <span style={{ flex: 1 }} />
        {formId ? <><Link href={back} className="btn btn-out">Discard</Link><button className="btn btn-ink" form={formId}>Save changes</button></> : null}
      </Topbar>

      <div className="content">
        <nav className="menu" aria-label="Settings sections">
          {SECTIONS.map(([k, name]) => <Link key={k} href={"/business/settings" + qs({ tab: k === "biz" ? undefined : k })} className={"mi" + (k === tab ? " on" : "")} aria-current={k === tab ? "page" : undefined}>{name}</Link>)}
        </nav>

        <div className="pane">
          <Flash sp={sp} />

          {tab === "biz" ? (
            <>
              {b.verification_status !== "verified" ? (
                <div className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}><h3>Your listing is being checked</h3><span className="pill pill-gold">In review</span></div>
                  <div className="sub">Our team checks every new business before it appears on LogaLuxe. You can set everything up now: your menu, hours, photos and payout account. It goes live once it is approved.</div>
                </div>
              ) : null}
              <div className="card">
                <h3>Business profile</h3>
                <form action={saveProfile} id="profile-form" className="stack">
                  <input type="hidden" name="back" value={back} />
                  <div className="two">
                    <div className="field"><label htmlFor="bn">Business name</label><input id="bn" name="name" type="text" required minLength={2} maxLength={80} defaultValue={b.name ?? ""} /></div>
                    <div className="field"><label htmlFor="cat">Primary category</label><select id="cat" name="category" defaultValue={b.category ?? ""} required>{CATEGORIES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></div>
                    <div className="field"><label htmlFor="ph">Business phone · with the country code</label><input id="ph" name="phone" type="tel" maxLength={24} defaultValue={b.phone ?? ""} /></div>
                    <div className="field"><label htmlFor="em">Email</label><input id="em" name="email" type="email" maxLength={120} defaultValue={b.email ?? ""} placeholder="hello@yourbusiness.com" /></div>
                    <div className="field"><label htmlFor="tz">Time zone · set from your main location</label><select id="tz" name="timezone" defaultValue={tz}>{zones.map((z) => <option key={z} value={z}>{z === tz ? `${zoneName(z)} (${z.replace(/_/g, " ")})` : z.replace(/_/g, " ")}</option>)}</select></div>
                    {b.market === "NG" ? (
                      <div className="field"><label htmlFor="taxn">Sales tax</label><input id="taxn" type="text" readOnly value="None · not charged in Nigeria" /><input type="hidden" name="sales_tax_pct" value={taxPct} /></div>
                    ) : (
                      <div className="field"><label htmlFor="tax">Sales tax on retail · %</label><input id="tax" name="sales_tax_pct" type="number" min={0} max={30} step={0.01} defaultValue={taxPct} /></div>
                    )}
                  </div>
                  <div className="field"><label htmlFor="bio">About · shown on your booking page</label><textarea id="bio" name="about" maxLength={2000} defaultValue={b.about ?? ""} /></div>
                  <div className="sub">Your time zone follows the address of your main location, and changes by itself when that address changes. Change it here only if it is wrong. Money is taken in {cur}; that is fixed for a business in {b.market === "NG" ? "Nigeria" : "the United States"}.</div>
                  <div><button className="btn btn-ink btn-sm">Save profile</button></div>
                </form>
              </div>

              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3>Locations</h3>
                  <Sheet trigger="Add location" triggerClass="btn btn-out btn-sm" title="New location" sub="A second place you trade from. It starts with Monday to Saturday hours, which you can change straight after.">
                    <form action={saveLocation}>
                      <input type="hidden" name="back" value={back} />
                      {locationFields(null, "new")}
                      <div className="sheet-ft"><button className="btn btn-ink">Add location</button></div>
                    </form>
                  </Sheet>
                </div>
                <div className="locs">
                  {locations.map((l) => (
                    <div key={l.id} className="lc">
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b>{l.name}</b>{l.is_primary ? <span className="pill pill-ok">Primary</span> : null}</div>
                      <span>{[l.address, l.city, l.region].filter(Boolean).join(", ") || "No address yet"}</span>
                      <span>{hoursLine(l.hours) || "Closed every day"}</span>
                      <span>{zoneName(String(l.timezone))}{l.travels ? ` · travels to clients${l.travel_radius_km ? ` up to ${b.market === "US" ? `${Math.round(Number(l.travel_radius_km) / 1.609344)} mi` : `${l.travel_radius_km} km`}` : ""}` : ""} · {cur}{taxPct > 0 ? ` · sales tax ${taxPct}% on retail` : ""}{l.lat === null || l.lat === undefined ? " · not on the map yet" : ""}</span>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Sheet trigger="Edit" triggerClass="btn btn-out btn-sm" title={`Edit ${l.name}`} sub="The address places you on the map and in search near the client.">
                          <form action={saveLocation}>
                            <input type="hidden" name="back" value={back} /><input type="hidden" name="id" value={l.id} /><input type="hidden" name="hours_set" value="1" />
                            <HoursKept hours={l.hours} />
                            {locationFields(l, `e-${l.id}`)}
                            <div className="sheet-ft"><button className="btn btn-ink">Save location</button></div>
                          </form>
                        </Sheet>
                        <Sheet trigger="Hours" triggerClass="btn btn-out btn-sm" title={`Opening hours · ${l.name}`} sub="Clients can only book inside these hours. Untick a day to close it.">
                          <form action={saveLocation}>
                            <input type="hidden" name="back" value={back} /><input type="hidden" name="id" value={l.id} /><input type="hidden" name="hours_set" value="1" />
                            <input type="hidden" name="name" value={l.name ?? ""} /><input type="hidden" name="address" value={l.address ?? ""} /><input type="hidden" name="city" value={l.city ?? ""} /><input type="hidden" name="region" value={l.region ?? ""} />{l.lat != null && <><input type="hidden" name="lat" value={l.lat} /><input type="hidden" name="lng" value={l.lng} /></>}<input type="hidden" name="arrival_notes" value={l.arrival_notes ?? ""} />
                            <HoursRows hours={l.hours} idp={`h-${l.id}`} />
                            <div className="muted" style={{ fontSize: 12.5 }}>Times are in {zoneName(String(l.timezone))}. Each person&apos;s own working days are set in Staff &amp; rosters.</div>
                            <div className="sheet-ft"><button className="btn btn-ink">Save hours</button></div>
                          </form>
                        </Sheet>
                        {!l.is_primary ? (
                          <>
                            <form action={locationAction}><input type="hidden" name="back" value={back} /><input type="hidden" name="id" value={l.id} /><input type="hidden" name="action" value="primary" /><button className="btn btn-out btn-sm">Make primary</button></form>
                            <form action={locationAction}><input type="hidden" name="back" value={back} /><input type="hidden" name="id" value={l.id} /><input type="hidden" name="action" value="delete" /><ConfirmButton className="btn btn-danger btn-sm" message={`Delete ${l.name}? A location with bookings on record cannot be deleted.`}>Delete</ConfirmButton></form>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="sub">The primary location is the one shown on your booking page.</div>
              </div>
            </>
          ) : null}

          {tab === "page" ? (
            <>
              <div className="card">
                <h3>Your booking page</h3>
                <div className="preview">
                  <span className="ph" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b>{b.name}</b>
                    <span>{[statusText[b.status] ?? b.status, b.verification_status === "verified" ? "Verified" : "Not verified yet", primary?.name].filter(Boolean).join(" · ")}</span>
                  </div>
                  <a href={bookingPath} target="_blank" rel="noreferrer" className="btn btn-gold btn-sm">Preview</a>
                </div>
                <div className="link">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7A1F2B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
                  <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{bookingUrl}</span>
                  <CopyButton text={bookingUrl}>Copy</CopyButton>
                  <Link href="/business/storefront" className="btn btn-out btn-sm">Change handle</Link>
                </div>
                <div className="sub">The words, photos and what the page shows are edited in <Link href="/business/storefront">Storefront</Link>.</div>
              </div>
              <div className="card">
                <h3>What clients can do</h3>
                <form action={saveRules} id="rules-form">
                  <input type="hidden" name="back" value={back} />
                  <input type="hidden" name="fields" value="booking.instant:b,booking.anyone:b,booking.multi_service:b,booking.waitlist:b,booking.on_search:b" />
                  <Rule name="booking.instant" on={!!rules.booking.instant} title="Instant booking" sub="Bookings are confirmed without your approval. Off means each one waits for you as a request." />
                  <Rule name="booking.anyone" on={!!rules.booking.anyone} title={'Choose "anyone available"'} sub="The client gets whoever on the team is free and can do the service" />
                  <Rule name="booking.multi_service" on={!!rules.booking.multi_service} title="Book several services in one visit" sub="The services follow one another in a single booking" />
                  <Rule name="booking.waitlist" on={!!rules.booking.waitlist} title="Join the waitlist" sub="When a day is full, clients can ask to be told if a slot opens" />
                  <Rule name="booking.on_search" on={!!rules.booking.on_search} title="Show on LogaLuxe search" sub="A new-client fee applies to bookings that come from search. See Plan & billing." />
                  <div style={{ paddingTop: 10 }}><button className="btn btn-ink btn-sm">Save</button></div>
                </form>
              </div>
            </>
          ) : null}

          {tab === "policy" ? (
            <form action={saveRules} id="rules-form" style={{ display: "contents" }}>
              <input type="hidden" name="back" value={back} />
              <input type="hidden" name="fields" value="policy.cancel_hours:n,policy.late_cancel_fee:s,policy.no_show_fee:s,policy.prepay_after_no_show:b,policy.new_client_deposit_pct:n,booking.lead_hours:n,booking.max_days:n" />
              <div className="card">
                <h3>Cancellation and no-shows</h3>
                <div className="three">
                  <div className="field"><label htmlFor="fc">Free cancellation until · hours before</label><input id="fc" name="policy.cancel_hours" type="number" min={0} max={168} step={1} required defaultValue={rules.policy.cancel_hours} /></div>
                  <div className="field"><label htmlFor="lc2">Late cancel fee</label><select id="lc2" name="policy.late_cancel_fee" defaultValue={String(rules.policy.late_cancel_fee)}>{FEES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></div>
                  <div className="field"><label htmlFor="ns">No-show fee</label><select id="ns" name="policy.no_show_fee" defaultValue={String(rules.policy.no_show_fee)}>{FEES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></div>
                </div>
                <div className="sub">0 hours means a client can cancel free of charge right up to the start. The most is 168 hours, one week.</div>
                <Rule name="policy.prepay_after_no_show" on={!!rules.policy.prepay_after_no_show} title="Full prepayment after a no-show" sub="A client who did not turn up pays in full to book again" />
              </div>
              <div className="card">
                <h3>Deposits and booking window</h3>
                <div className="three">
                  <div className="field"><label htmlFor="nc">New clients · deposit %</label><input id="nc" name="policy.new_client_deposit_pct" type="number" min={0} max={100} step={1} required defaultValue={rules.policy.new_client_deposit_pct} /></div>
                  <div className="field"><label htmlFor="lt">Lead time · hours</label><input id="lt" name="booking.lead_hours" type="number" min={0} max={168} step={1} required defaultValue={rules.booking.lead_hours} /></div>
                  <div className="field"><label htmlFor="hz">Book up to · days ahead</label><input id="hz" name="booking.max_days" type="number" min={1} max={365} step={1} required defaultValue={rules.booking.max_days} /></div>
                </div>
                <div className="sub">The new-client deposit is a share of a first booking, used when the service has no deposit of its own. 0 turns it off. Lead time is the shortest notice a client can book with; 0 allows a booking for right now.</div>
                <div className="row"><div><b>Deposits, durations and clean-up time for each service</b><span>Set on the service itself</span></div><Link href="/business/services" className="btn btn-out btn-sm">Open Services</Link></div>
              </div>
              <div><button className="btn btn-ink btn-sm">Save policies</button></div>
            </form>
          ) : null}

          {tab === "notif" ? (
            <>
              <div className="card">
                <h3>Messages to clients</h3>
                <div className="row"><div><b>Booking confirmation, reminders and review requests</b><span>Turned on and off, and worded, in Marketing</span></div><Link href="/business/marketing" className="btn btn-out btn-sm">Open Marketing</Link></div>
                {phoneLive ? <div className="row"><div><b>{phoneLive}</b><span>Connected. Messages on {many(phoneLive) ? "these channels" : "this channel"} go to the client&apos;s phone.</span></div><span className="pill pill-ok">Connected</span></div> : null}
                {phoneLogged ? <div className="row"><div><b>{phoneLogged}</b><span>Not connected yet. Messages on {many(phoneLogged) ? "these channels" : "this channel"} are logged, not delivered.</span></div><span className="pill pill-grey">Not available yet</span></div> : null}
              </div>
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}><h3>Alerts to you and your team</h3>{mailLogged ? <span className="sim">Email is not connected: alerts are logged, not delivered</span> : null}</div>
                <form action={saveRules} id="rules-form">
                  <input type="hidden" name="back" value={back} />
                  <input type="hidden" name="fields" value="notify.new_booking_email:b,notify.cancellation_email:b,notify.daily_summary:b,notify.low_stock_email:b" />
                  <Rule name="notify.new_booking_email" on={!!rules.notify.new_booking_email} title="New booking" sub="An email when a client books" />
                  <Rule name="notify.cancellation_email" on={!!rules.notify.cancellation_email} title="Cancellation" sub="An email when a client cancels" />
                  <Rule name="notify.daily_summary" on={!!rules.notify.daily_summary} title="Morning summary" sub="Today's bookings in one email" />
                  <Rule name="notify.low_stock_email" on={!!rules.notify.low_stock_email} title="Low stock" sub="An email when a product reaches its reorder level" />
                  <div style={{ paddingTop: 10 }}><button className="btn btn-ink btn-sm">Save</button></div>
                </form>
                <div className="sub">These emails go to the business email in your profile, or to the owner when there is none. New bookings and messages always show on Home and in the Inbox as well.</div>
              </div>
            </>
          ) : null}

          {tab === "team" ? (
            <>
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h3>Team logins</h3><Link href="/business/staff" className="btn btn-out btn-sm">Invite</Link></div>
                <div className="sub">{plural(logins.length, "person", "people")} can sign in to {b.name}. {owner ? "To give someone a sign-in, open them in Staff & rosters and invite them." : "Only the owner can invite people or remove a sign-in."}</div>
                {logins.map((l) => (
                  <div key={l.id} className="member">
                    <Avatar name={l.name} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b>{l.name}{l.id === m.id ? " · you" : ""}</b>
                      <span style={{ overflowWrap: "anywhere" }}>{l.email} · {l.last_login_at ? `last signed in ${when(l.last_login_at, tz)}` : "has not signed in yet"}</span>
                    </div>
                    <span className={"pill " + (l.role === "owner" ? "pill-gold" : "pill-grey")}>{ROLE[l.role] ?? l.role}</span>
                  </div>
                ))}
              </div>
              <div className="card">
                <h3>Roles</h3>
                {ROLE_CAN.map(([key, name, can]) => <div key={key} className="row"><div><b>{name}</b><span>{can}</span></div><span className="muted" style={{ fontSize: 12.5 }}>{logins.filter((l) => l.role === key).length}</span></div>)}
                <div className="sub">A person&apos;s role is chosen when they are invited from <Link href="/business/staff">Staff &amp; rosters</Link>.</div>
              </div>
            </>
          ) : null}

          {tab === "integ" ? (
            <>
              <div className="card">
                <h3>Built in</h3>
                {phoneLive ? <div className="row"><div><b>{phoneLive}</b><span>Messages to clients on {many(phoneLive) ? "these channels" : "this channel"} are delivered to their phone.</span></div><span className="pill pill-ok">Connected</span></div> : null}
                <div className="row"><div><b>Email</b><span>{mailLogged ? "Not connected on this server. Emails to clients and alerts to you are logged, not delivered." : "Emails to clients and alerts to you are delivered."}</span></div><span className={"pill " + (mailLogged ? "pill-grey" : "pill-ok")}>{mailLogged ? "Logged only" : "Connected"}</span></div>
                {pay && !pay.error ? (() => {
                  const provider = pay.data.provider === "paystack" ? "Paystack" : "Stripe";
                  return pay.data.mode === "live" ? (
                    <div className="row"><div><b>Online payments</b><span>Online payments are on through {provider}: deposits and pay links are taken for real.</span></div><div style={{ display: "flex", gap: 8, alignItems: "center", flex: "none" }}><span className="pill pill-ok">Live · {provider}</span><Link href="/business/money" className="btn btn-out btn-sm">Open Money</Link></div></div>
                  ) : (
                    <div className="row"><div><b>Online payments</b><span>Online payments are in simulation. {provider} is not connected on this server, so deposits and pay links are recorded as if paid, but no money moves and nothing reaches your bank.</span></div><span className="sim">Simulation</span></div>
                  );
                })() : (
                  <div className="row"><div><b>Online payments</b><span>The owner can see whether online payments are live or simulated, under Money.</span></div><span className="pill pill-grey">Owner only</span></div>
                )}
                {owner ? <div className="row"><div><b>Payouts</b><span>The bank account your money is paid into</span></div><Link href="/business/money/payout-account" className="btn btn-out btn-sm">Payout account</Link></div> : null}
              </div>
              <div className="card">
                <h3>Not available yet</h3>
                <div className="sub">These are planned. There is nothing to connect today, and LogaLuxe will say here when there is.</div>
                {[
                  ...(phoneLogged ? [[phoneLogged === "WhatsApp and SMS" ? "WhatsApp Business and SMS" : phoneLogged === "WhatsApp" ? "WhatsApp Business" : phoneLogged, many(phoneLogged) ? "Messages on these channels are logged, not delivered" : "Messages on this channel are logged, not delivered"]] : []),
                  ["Google Business Profile", "A book button on your Google listing"],
                  ["Instagram and Facebook", "A book button on your profile. For now, put your booking link in your bio."],
                  ["Card readers", "Taking a card in person on a reader"],
                  ["Calendar sync", "Google Calendar and Apple Calendar"],
                  ["Accounting and imports", "QuickBooks, and moving over from another booking system"],
                ].map(([name, what]) => <div key={name} className="row"><div><b>{name}</b><span>{what}</span></div><span className="pill pill-grey">Not available yet</span></div>)}
              </div>
            </>
          ) : null}

          {tab === "billing" ? (
            <>
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <h3>Your plan</h3>
                  {b.plan !== "pro" ? <span className="pill pill-grey">Free · no monthly fee</span>
                    : bill.plan_due_since ? <span className="pill pill-gold">Pro · fee due since {dateOnly(bill.plan_due_since, "med")}</span>
                      : bill.plan_paid_through ? <span className="pill pill-ok">Pro · paid through {dateOnly(bill.plan_paid_through, "med")}</span>
                        : <span className="pill pill-gold">Pro · first month not taken yet</span>}
                </div>
                <div className="two">
                  {plans.map((p) => {
                    const current = p.plan === b.plan;
                    return (
                      <div key={p.plan} className={"plan" + (current ? " hi" : "")}>
                        <b>{p.plan === "pro" ? "Pro" : "Free"}</b>
                        <div className="price">{money(p.plan_price_cents, cur)} <small>{p.plan_price_cents > 0 ? "per month" : "no monthly charge"}</small></div>
                        <ul>
                          <li>Payment fee: {Number(p.transaction_pct)}%{p.transaction_fixed_cents > 0 ? ` + ${money(p.transaction_fixed_cents, cur)}` : ""} of each payment{p.transaction_cap_cents ? `, never more than ${money(p.transaction_cap_cents, cur)}` : ""}</li>
                          <li>New-client fee, for bookings that come from LogaLuxe search: {Number(p.new_client_pct)}%</li>
                          <li>Marketplace fee: {Number(p.marketplace_pct)}%</li>
                          <li>Instant payout: {Number(p.instant_payout_pct) > 0 ? `${Number(p.instant_payout_pct)}% of the payout` : "no fee"}</li>
                        </ul>
                        {current ? <span className="pill pill-ok" style={{ alignSelf: "flex-start" }}>Current plan</span> : owner ? (
                          <form action={changePlan}>
                            <input type="hidden" name="back" value={back} /><input type="hidden" name="plan" value={p.plan} />
                            <ConfirmButton className="btn btn-out btn-sm" message={p.plan === "pro"
                              ? `Switch to Pro? ${proPrice} a month is taken from your LogaLuxe payout balance, not from a card. The first month is taken as soon as your balance can cover it.`
                              : "Move to Free? No further Pro fees are taken. Nothing is refunded for the month already paid."}>Switch to {p.plan === "pro" ? "Pro" : "Free"}</ConfirmButton>
                          </form>
                        ) : <span className="pill pill-grey" style={{ alignSelf: "flex-start" }}>Not on this plan</span>}
                      </div>
                    );
                  })}
                </div>
                {owner ? null : <div className="sub">Only the owner can change the plan.</div>}
              </div>
              <div className="card">
                <h3>How the Pro fee is paid</h3>
                {b.plan === "pro" ? (
                  <div className="row">
                    <div>
                      <b>{bill.plan_due_since ? `Fee due since ${dateOnly(bill.plan_due_since, "med")}` : bill.plan_paid_through ? `Paid through ${dateOnly(bill.plan_paid_through, "med")}` : "The first month has not been taken yet"}</b>
                      <span>{bill.plan_due_since || !bill.plan_paid_through ? `It will be taken when your balance reaches ${proPrice}.` : `The next ${proPrice} is taken from your balance after that date.`}</span>
                    </div>
                    {bill.plan_due_since ? <span className="pill pill-gold">Due</span> : bill.plan_paid_through ? <span className="pill pill-ok">Paid</span> : <span className="pill pill-gold">Waiting</span>}
                  </div>
                ) : null}
                <div className="row"><div><b>Paid so far: {money(bill.paid_total_cents ?? 0, cur)}</b><span>{bill.last_charged_at ? `Last taken ${dateMed(bill.last_charged_at, tz)}` : "No Pro fee has been taken yet"}</span></div>{owner ? <Link href="/business/money" className="btn btn-out btn-sm">Money and statements</Link> : null}</div>
                <ul className="how">
                  <li>The Pro fee is {proPrice} a month. It is taken from your LogaLuxe payout balance, not from a card.</li>
                  <li>The first month is taken as soon as your balance can cover it.</li>
                  <li>If your balance cannot cover a month, it is tried again every day. After {graceDays} days without it, you move back to Free with nothing owed.</li>
                  <li>Moving to Free stops further fees. Nothing is refunded for the month already paid.</li>
                </ul>
              </div>
              <div className="card">
                <h3>Fees you pay LogaLuxe</h3>
                <div className="sub">Payment and new-client fees are taken from each payment before it is paid out to you. {owner ? <>The full breakdown, payment by payment, is under <Link href="/business/money">Money</Link>.</> : "The owner can see the full breakdown under Money."}</div>
              </div>
            </>
          ) : null}

          {tab === "data" ? (
            <>
              <div className="card">
                <h3>Your data</h3>
                <div className="row"><div><b>Clients</b><span>Download your client list as a spreadsheet file</span></div><Link href="/business/clients" className="btn btn-out btn-sm">Open Clients</Link></div>
                <div className="row"><div><b>Sales and bookings</b><span>Download the numbers for any period</span></div><Link href="/business/reports" className="btn btn-out btn-sm">Open Reports</Link></div>
                {owner ? <div className="row"><div><b>Payments, fees and payouts</b><span>Download every money movement</span></div><Link href="/business/money" className="btn btn-out btn-sm">Open Money</Link></div> : null}
                <div className="sub">{b.name} has been on LogaLuxe since {dateMed(b.created_at, tz)}.</div>
              </div>
              <div className="card danger">
                <h3>Pause or close</h3>
                <div className="row">
                  <div><b>{b.status === "paused" ? "Online booking is paused" : "Pause online booking"}</b><span>{b.status === "paused" ? "Clients cannot find or book you. Your data and existing bookings are kept." : b.status === "live" ? "Takes you off search and stops new online bookings. Keeps your data and existing bookings." : "Only a live business can be paused. Yours is not live yet."}</span></div>
                  {!owner ? <span className="pill pill-grey">Owner only</span> : b.status === "live" ? (
                    <form action={setListing}><input type="hidden" name="back" value={back} /><input type="hidden" name="paused" value="1" /><ConfirmButton className="btn btn-out btn-sm" message="Pause online booking? Clients will not be able to find or book you until you bring it back.">Pause</ConfirmButton></form>
                  ) : b.status === "paused" ? (
                    <form action={setListing}><input type="hidden" name="back" value={back} /><input type="hidden" name="paused" value="0" /><button className="btn btn-ink btn-sm">Go live again</button></form>
                  ) : <span className="pill pill-gold">{statusText[b.status] ?? b.status}</span>}
                </div>
                <div className="row"><div><b>Close the business</b><span>This cannot be done from here. Contact LogaLuxe support and we will close the account and send you your data.</span></div></div>
              </div>
            </>
          ) : null}

          {tab === "account" ? <><Account me={me} account={account} back={back} sec={await loadSecurity()} /><CalendarSync me={me} staff={sp.staff} /></> : null}
        </div>
      </div>
    </div>
  );
}
