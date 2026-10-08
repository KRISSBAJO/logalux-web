import Link from "next/link";
import type { ReactNode } from "react";
import { ConfirmButton, CopyButton, Sheet } from "@/components/merchant-client";
import { Avatar, Empty, Flash, Ic, LoadError, NoAccess, Topbar } from "@/components/merchant-ui";
import { getMe, mLoad, qs, type Row } from "@/lib/merchant-api";
import { clock, dateMed, dur, money, plural } from "@/lib/merchant-format";
import { deletePhoto, orderPhotos, pinReview, removeLogo, replyReview, saveLanguages, saveStorefront, updatePhoto, uploadLogo, uploadPhoto } from "./actions";
import { HashTab, LivePreview, type PreviewData } from "./preview";
import "../../css/storefront.css";

export const metadata = { title: "Storefront" };

type SP = { ok?: string; err?: string; tab?: string };

const FORM = "sf-form";
const TABS: [string, string][] = [["basics", "Basics"], ["photos", "Photos"], ["services", "Services & reviews"], ["hours", "Hours & location"], ["found", "Being found"]];
const CATEGORIES: [string, string][] = [["braids", "Braids & locs"], ["hair", "Hair"], ["barber", "Barber"], ["nails", "Nails"], ["lashes", "Lashes & brows"], ["skin", "Skin"], ["makeup", "Makeup"], ["spa", "Spa"]];
const HIGHLIGHT_IDEAS = ["Hair included", "Gentle on edges", "Walk-ins for take-downs", "Free parking", "Kids welcome", "LGBTQ+ friendly", "Women-owned", "English and Yoruba", "Card and Apple Pay", "Wi-Fi"];
const DAYS: [string, string][] = [["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"]];

/** "Tue to Fri 09:00 to 18:00 · Sat 08:00 to 18:00": days in a row with the same hours are grouped. */
function hoursLine(hours: Record<string, string[] | null> | null | undefined): string {
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

/** An on/off switch that travels with the main form. It looks like the design's switch and works without scripts. */
function Toggle({ name, on, label }: { name: string; on: boolean; label: string }) {
  return <span className="tog"><input type="checkbox" name={name} defaultChecked={on} form={FORM} aria-label={label} /><span className="sw" aria-hidden="true" /></span>;
}

export default async function Storefront({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const me = (await getMe())!;
  const { merchant: m } = me;
  const [{ data: d, error, status }, menu] = await Promise.all([mLoad("/storefront"), mLoad("/services")]);
  if (status === 403) return <div className="main pg-storefront"><NoAccess title="Storefront" need="manager" /></div>;
  if (error) return <div className="main pg-storefront"><LoadError title="Storefront" error={error} /></div>;

  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab! : "basics";
  // The languages are kept with the shop policy, which is saved whole: the form sends the rest back as it came.
  const policy = tab === "basics" ? await mLoad("/shop-policy") : null;
  const pol = policy && !policy.error ? policy.data : null;
  const spoken = ((pol?.languages ?? []) as string[]), langChoices = [...new Set([...((pol?.language_choices ?? []) as string[]), ...spoken])];
  const back = "/business/storefront" + qs({ tab: tab === "basics" ? undefined : tab });
  const b = d.business as Row, disp = d.display as PreviewData["display"], loc = (d.location ?? null) as Row | null;
  const photos = (d.photos ?? []) as Row[], reviews = (d.reviews ?? []) as Row[];
  const maxPhotos = Number(d.max_photos ?? 8), storage = !!d.storage;
  const url = String(d.url ?? ""), host = (() => { try { return new URL(url).host; } catch { return ""; } })();
  const highlights = (b.highlights ?? []) as string[];
  const logoId = b.logo_id ? String(b.logo_id) : "";
  const tone = /^#[0-9a-f]{6}$/i.test(b.tone ?? "") ? String(b.tone) : "#3B1D22";
  const shown = photos.filter((p) => p.active);
  const unreplied = reviews.filter((r) => r.status === "published" && !r.reply).length;
  const pinned = reviews.find((r) => r.pinned);

  // Is the business open at this moment, by its own hours and clock?
  const dayKey = new Intl.DateTimeFormat("en-US", { timeZone: m.timezone, weekday: "short" }).format(new Date()).toLowerCase();
  const today = (loc?.hours ?? null)?.[dayKey] as string[] | null | undefined;
  const now = clock(new Date(), m.timezone);
  const openNow = loc?.hours ? !!today && today.length === 2 && now >= today[0] && now < today[1] : null;

  const services = menu.error ? [] : ((menu.data.services ?? []) as Row[]).filter((s) => s.online && !s.archived).slice(0, 3).map((s) => {
    const prices = [s.price_cents, ...((s.staff ?? []) as Row[]).map((x) => x.price_cents).filter((x) => x !== null && x !== undefined)] as number[];
    const low = Math.min(...prices);
    return { name: String(s.name), dur: dur(s.duration_min), price: money(s.price_cents, m.currency), from: prices.some((p) => p !== low) ? money(low, m.currency) : "" };
  });
  const team = menu.error ? [] : ((menu.data.staff ?? []) as Row[]).filter((p) => p.bookable).slice(0, 5).map((p) => ({ initials: String(p.initials ?? ""), tone: String(p.tone ?? "#7A1F2B"), name: String(p.name) }));

  const live = b.status === "live";
  const statusPill = live ? <span className="pill pill-ok">Live · {host}/b/{b.slug}</span>
    : b.status === "paused" ? <span className="pill pill-grey">Paused · not taking online bookings</span>
      : b.status === "suspended" ? <span className="pill pill-bad">Suspended</span>
        : <span className="pill pill-gold">In review · not on search yet</span>;

  // Every text field goes with every save, so the tabs that do not show them carry them hidden.
  const keep = (
    <>
      <input type="hidden" name="name" value={b.name ?? ""} />
      <input type="hidden" name="slug" value={b.slug ?? ""} />
      <input type="hidden" name="tagline" value={b.tagline ?? ""} />
      <input type="hidden" name="about" value={b.about ?? ""} />
      <input type="hidden" name="category" value={b.category ?? ""} />
      {highlights.map((h) => <input key={h} type="hidden" name="highlights" value={h} />)}
      <input type="hidden" name="instagram" value={b.instagram ?? ""} />
      <input type="hidden" name="tiktok" value={b.tiktok ?? ""} />
      <input type="hidden" name="website" value={b.website ?? ""} />
      <input type="hidden" name="tone" value={tone} />
    </>
  );
  const displayKeys: Record<string, string> = { basics: "show_phone", services: "show_from,show_durations,show_staff,show_reviews", hours: "open_badge,notice,show_address", photos: "", found: "" };
  const hasForm = tab === "basics" || tab === "services" || tab === "hours";
  const saveBar = <div style={{ display: "flex", justifyContent: "flex-end" }}><button className="btn btn-ink" form={FORM}>Save changes</button></div>;

  // "Being found": things that are true or not, counted. No score is made up.
  const checks: { ok: boolean; title: ReactNode; more?: ReactNode }[] = [
    { ok: shown.length > 0, title: shown.length ? `${plural(shown.length, "photo")}, with a cover` : "No photos yet", more: shown.length ? undefined : <> · <Link href="/business/storefront?tab=photos">add your best work</Link></> },
    { ok: !!b.tagline && !!b.about, title: b.tagline && b.about ? "Tagline and about text are filled in" : "Tagline or about text is missing", more: b.tagline && b.about ? undefined : <> · <Link href="/business/storefront">write them</Link></> },
    { ok: highlights.length >= 3, title: highlights.length >= 3 ? `${highlights.length} highlights` : `${plural(highlights.length, "highlight")} · three or more reads better`, more: highlights.length >= 3 ? undefined : <> · <Link href="/business/storefront">pick some</Link></> },
    { ok: services.length > 0, title: services.length ? "Services can be booked online" : "No services can be booked online", more: services.length ? undefined : <> · <Link href="/business/services">open Services</Link></> },
    { ok: !!hoursLine(loc?.hours), title: hoursLine(loc?.hours) ? "Opening hours are set" : "No opening hours", more: hoursLine(loc?.hours) ? undefined : <> · <Link href="/business/settings">set them in Settings</Link></> },
    { ok: b.verification_status === "verified", title: b.verification_status === "verified" ? `Verified${b.review_count ? `, with ${plural(b.review_count, "review")}` : ""}` : "Not verified yet", more: b.verification_status === "verified" ? undefined : <span className="muted"> · our team is checking your listing</span> },
    { ok: unreplied === 0, title: unreplied ? `${plural(unreplied, "review")} without a reply` : "Every review has a reply", more: unreplied ? <> · <Link href="/business/storefront?tab=services#reviews">reply now</Link></> : undefined },
    { ok: !!(b.instagram || b.tiktok || b.website), title: b.instagram || b.tiktok || b.website ? "Social or website link added" : "No social or website link", more: b.instagram || b.tiktok || b.website ? undefined : <> · <Link href="/business/storefront">add one</Link></> },
  ];
  const done = checks.filter((c) => c.ok).length, share = Math.round((done / checks.length) * 100);

  const init: PreviewData = { name: String(b.name ?? ""), tagline: String(b.tagline ?? ""), tone, highlights, display: disp };

  return (
    <div className="main pg-storefront">
      <HashTab tab={tab} />
      <Topbar title="Storefront">
        <div className="seg">
          {TABS.map(([k, name]) => <Link key={k} href={"/business/storefront" + qs({ tab: k === "basics" ? undefined : k })} className={k === tab ? "on" : ""} aria-current={k === tab ? "page" : undefined}>{name}</Link>)}
        </div>
        <span style={{ flex: 1 }} />
        {statusPill}
        <a href={`/b/${b.slug}`} target="_blank" rel="noreferrer" className="btn btn-out">View live page</a>
        {hasForm ? <button className="btn btn-ink" form={FORM}>Save changes</button> : null}
      </Topbar>

      <div className="content">
        {sp.ok || sp.err ? <div style={{ flex: "1 1 100%" }}><Flash sp={sp} /></div> : null}

        <div className="editor">
          {hasForm ? (
            <form id={FORM} action={saveStorefront} hidden>
              <input type="hidden" name="back" value={back} />
              <input type="hidden" name="old_slug" value={b.slug ?? ""} />
              <input type="hidden" name="display_keys" value={displayKeys[tab]} />
              {tab === "basics" ? null : keep}
            </form>
          ) : null}

          {tab === "basics" ? (
            <>
              <div className="card">
                <h3>Name and handle</h3>
                <div className="two">
                  <div className="field"><label htmlFor="n">Business name</label><input id="n" name="name" type="text" form={FORM} defaultValue={b.name ?? ""} required minLength={2} maxLength={80} /></div>
                  <div className="field"><label htmlFor="h">Handle</label><div className="handle"><span>{host}/b/</span><input id="h" name="slug" type="text" form={FORM} defaultValue={b.slug ?? ""} required pattern="[a-z0-9][a-z0-9\-]{1,59}" title="Lower-case letters, numbers and dashes. At least two characters." autoCapitalize="none" spellCheck={false} /></div></div>
                </div>
                <div className="warn"><b>Changing the handle changes your public address.</b> Links, QR codes and social bios that use {host}/b/{b.slug} stop working as soon as you save. Leave it alone unless you mean to move.</div>
                <div className="field"><label htmlFor="tag">Tagline · one line under your name</label><input id="tag" name="tagline" type="text" form={FORM} defaultValue={b.tagline ?? ""} maxLength={140} /></div>
                <div className="field"><label htmlFor="bio">About</label><textarea id="bio" name="about" form={FORM} defaultValue={b.about ?? ""} maxLength={2000} /></div>
                <div className="field">
                  <label id="cat-l">Category · shown in search</label>
                  <div className="chips" role="radiogroup" aria-labelledby="cat-l">
                    {CATEGORIES.map(([k, name]) => <label key={k} className="chip pick"><input type="radio" name="category" value={k} form={FORM} defaultChecked={b.category === k} required />{name}</label>)}
                  </div>
                </div>
                <div className="field" style={{ maxWidth: 220 }}>
                  <label htmlFor="tone">Page colour</label>
                  <input id="tone" name="tone" type="color" form={FORM} defaultValue={tone} style={{ padding: 4 }} />
                  <small className="muted" style={{ fontSize: 12 }}>Shown where a photo is missing or still loading.</small>
                </div>
              </div>
              <div className="card">
                <h3>Logo</h3>
                <div className="sub">A small square image beside your name: a monogram or your mark. Without one, your page shows your first letter.</div>
                <div className="logo-ed">
                  <span className="logo-box serif" style={logoId ? undefined : { background: "#D4AF5A" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {logoId ? <img src={`/media/${logoId}`} alt={`${b.name} logo`} className="fill" /> : String(b.name ?? "").trim()[0]?.toUpperCase()}
                  </span>
                  {!storage ? (
                    <div className="warn" style={{ flex: 1 }}><b>Image uploads are not set up yet.</b> File storage has not been connected for LogaLuxe on this server, so a logo cannot be added for now. Your page shows your first letter. Contact LogaLuxe support if this does not change.</div>
                  ) : (
                    <form action={uploadLogo} className="logo-f">
                      <input type="hidden" name="back" value={back} />
                      <div className="field"><label htmlFor="logo-file">{logoId ? "Replace it" : "Add a logo"} · JPEG, PNG or WebP, up to 8 MB</label><input id="logo-file" name="file" type="file" required accept="image/jpeg,image/png,image/webp" /></div>
                      <button className="btn btn-out btn-sm">{logoId ? "Replace logo" : "Upload logo"}</button>
                    </form>
                  )}
                  {logoId ? <form action={removeLogo}><input type="hidden" name="back" value={back} /><ConfirmButton className="btn btn-danger btn-sm" message="Remove your logo? Your page will show your first letter instead.">Remove</ConfirmButton></form> : null}
                </div>
              </div>
              <div className="card">
                <h3>Highlights</h3>
                <div className="sub">Small facts clients scan before they book. Pick up to six. Only tick what is true for you.</div>
                <div className="chips">
                  {[...highlights, ...HIGHLIGHT_IDEAS.filter((h) => !highlights.some((x) => x.toLowerCase() === h.toLowerCase()))].map((h) => (
                    <label key={h} className="chip pick"><input type="checkbox" name="highlights" value={h} form={FORM} defaultChecked={highlights.includes(h)} />{h}</label>
                  ))}
                </div>
                <div className="field"><label htmlFor="hl-more">Add your own · separate with commas</label><input id="hl-more" name="highlights_more" type="text" form={FORM} placeholder="Private room, Open late" /></div>
              </div>
              {pol ? (
                <div className="card" id="languages">
                  <h3>Languages you speak</h3>
                  <div className="sub">Clients see these on your page. Tick only the ones someone on your team can serve a client in.</div>
                  <form action={saveLanguages} className="langs">
                    <input type="hidden" name="back" value={back} />
                    <input type="hidden" name="returns_days" value={pol.returns_days ?? ""} />
                    <input type="hidden" name="returns_note" value={pol.returns_note ?? ""} />
                    <input type="hidden" name="ship_days_min" value={pol.ship_days_min ?? ""} />
                    <input type="hidden" name="ship_days_max" value={pol.ship_days_max ?? ""} />
                    <input type="hidden" name="pickup_ready_mins" value={pol.pickup_ready_mins ?? ""} />
                    <div className="chips" role="group" aria-label="Languages you speak">
                      {langChoices.map((l) => <label key={l} className="chip pick"><input type="checkbox" name="languages" value={l} defaultChecked={spoken.includes(l)} />{l}</label>)}
                    </div>
                    <div className="rowx"><button className="btn btn-out btn-sm">Save languages</button><span className="sub">Saves straight away, apart from the rest of this page.</span></div>
                  </form>
                </div>
              ) : policy?.error ? (
                <div className="card" id="languages">
                  <h3>Languages you speak</h3>
                  <div className="warn">The languages could not be loaded: {policy.error}</div>
                </div>
              ) : null}
              <div className="card">
                <h3>Contact and social</h3>
                <div className="two">
                  <div className="field"><label htmlFor="ig">Instagram</label><input id="ig" name="instagram" type="text" form={FORM} defaultValue={b.instagram ?? ""} placeholder="@yourname" maxLength={80} /></div>
                  <div className="field"><label htmlFor="tt">TikTok</label><input id="tt" name="tiktok" type="text" form={FORM} defaultValue={b.tiktok ?? ""} placeholder="@yourname" maxLength={80} /></div>
                  <div className="field"><label htmlFor="web">Website</label><input id="web" name="website" type="url" form={FORM} defaultValue={b.website ?? ""} placeholder="https://" maxLength={200} /></div>
                  <div className="field">
                    <label htmlFor="phone">Show phone number</label>
                    <select id="phone" name="show_phone" form={FORM} defaultValue={disp.show_phone ? "1" : "0"}><option value="0">Hidden until booked</option><option value="1">Always shown</option></select>
                  </div>
                </div>
                <div className="sub">{b.phone ? `Your business phone is ${b.phone}.` : "You have not added a business phone."} Change it in <Link href="/business/settings">Settings</Link>.</div>
              </div>
              {saveBar}
            </>
          ) : null}

          {tab === "photos" ? (
            <>
              <div className="card">
                <h3>Cover</h3>
                <div className="sub">The cover is the first thing clients see. Use your best finished work, landscape, no text on it. The first photo in your portfolio is the cover.</div>
                <div className="photos">
                  <div className="ph cover" style={{ background: tone }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {photos[0] ? <img src={`/media/${photos[0].id}`} alt={photos[0].alt} className="fill" /> : null}
                    <span className="pill pill-gold tag">Cover</span>
                    {photos[0] ? null : <span>No cover yet. Your page shows this colour instead.</span>}
                  </div>
                </div>
                {photos[0] && !photos[0].active ? <div className="warn">This photo has been hidden by LogaLuxe, so it does not show on your page. Choose another cover.</div> : null}
              </div>

              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <h3>Portfolio · {plural(photos.length, "photo")}</h3>
                  <span className="muted" style={{ fontSize: 12.5 }}>Use the arrows to reorder. Up to {maxPhotos} are used on your page.</span>
                </div>
                {photos.length ? (
                  <div className="photos tiles">
                    {photos.map((p, i) => {
                      const ids = photos.map((x) => String(x.id));
                      const swap = (j: number) => { const o = [...ids]; [o[i], o[j]] = [o[j], o[i]]; return o.join(","); };
                      return (
                        <div key={p.id} className="tile">
                          <div className="ph" style={{ background: tone }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`/media/${p.id}`} alt={p.alt} loading="lazy" className={"fill" + (p.active ? "" : " dim")} />
                            {!p.active ? <span className="pill pill-grey tag">Hidden by LogaLuxe</span> : i === 0 ? <span className="pill pill-gold tag">Cover</span> : i >= maxPhotos ? <span className="pill pill-grey tag">Not shown</span> : null}
                            <form action={deletePhoto}>
                              <input type="hidden" name="back" value={back} /><input type="hidden" name="id" value={p.id} />
                              <ConfirmButton className="x" aria-label={`Delete photo${p.alt ? `: ${p.alt}` : ""}`} message="Delete this photo for good?">×</ConfirmButton>
                            </form>
                          </div>
                          <div className="ctl">
                            <form action={orderPhotos}><input type="hidden" name="back" value={back} /><input type="hidden" name="ids" value={i > 0 ? swap(i - 1) : ""} /><button className="ib" disabled={i === 0} aria-label="Move earlier"><Ic name="chevL" size={14} /></button></form>
                            <form action={orderPhotos}><input type="hidden" name="back" value={back} /><input type="hidden" name="ids" value={i < photos.length - 1 ? swap(i + 1) : ""} /><button className="ib" disabled={i === photos.length - 1} aria-label="Move later"><Ic name="chevR" size={14} /></button></form>
                            <form action={updatePhoto}><input type="hidden" name="back" value={back} /><input type="hidden" name="id" value={p.id} /><input type="hidden" name="cover" value="1" /><button className="ib" disabled={i === 0} aria-label="Make this the cover" title="Make this the cover"><Ic name="star" size={14} /></button></form>
                            <Sheet trigger="Edit" triggerClass="ib ib-t" title="Photo" sub="The description is read out to people who use a screen reader.">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={`/media/${p.id}`} alt={p.alt} style={{ width: "100%", borderRadius: 14, maxHeight: 340, objectFit: "cover" }} />
                              <form action={updatePhoto}>
                                <input type="hidden" name="back" value={back} /><input type="hidden" name="id" value={p.id} />
                                <div className="field"><label htmlFor={`alt-${p.id}`}>Description</label><input id={`alt-${p.id}`} name="alt" type="text" defaultValue={p.alt ?? ""} maxLength={200} placeholder="Waist-length knotless braids, side view" /></div>
                                <div className="sheet-ft"><button className="btn btn-ink">Save description</button></div>
                              </form>
                              <div className="muted" style={{ fontSize: 12.5 }}>Added {dateMed(p.created_at, m.timezone)} · {p.size_bytes >= 1 << 20 ? `${(p.size_bytes / (1 << 20)).toFixed(1)} MB` : `${Math.max(1, Math.round(p.size_bytes / 1024))} KB`}</div>
                            </Sheet>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : <Empty title="No photos yet">Add photos of finished work so clients can see what you do.</Empty>}

                {!storage ? (
                  <div className="warn"><b>Photo uploads are not set up yet.</b> File storage has not been connected for LogaLuxe on this server, so photos cannot be added for now. Your page shows your page colour in their place. Contact LogaLuxe support if this does not change.</div>
                ) : photos.length >= 40 ? (
                  <div className="warn">You have 40 photos, which is the most a page can hold. Delete one to add another.</div>
                ) : (
                  <form action={uploadPhoto} className="up">
                    <input type="hidden" name="back" value={back} />
                    <div className="field"><label htmlFor="up-file">Add a photo · JPEG, PNG or WebP, up to 8 MB</label><input id="up-file" name="file" type="file" required accept="image/jpeg,image/png,image/webp" /></div>
                    <div className="field"><label htmlFor="up-alt">Describe it, for people using screen readers</label><input id="up-alt" name="alt" type="text" maxLength={200} placeholder="Medium knotless braids, back view" /></div>
                    <button className="btn btn-ink">Add photo</button>
                  </form>
                )}
              </div>
            </>
          ) : null}

          {tab === "services" ? (
            <>
              <div className="card">
                <h3>What shows on the booking page</h3>
                <div className="sub">Prices, durations and the order of the menu live in Services.</div>
                <div className="row"><div><b>Your menu</b><span>{services.length ? services.map((s) => s.name).join(", ") : "Nothing can be booked online yet"}</span></div><Link href="/business/services" className="btn btn-out btn-sm">Open Services</Link></div>
                <div className="row"><div><b>Show &quot;from&quot; prices</b><span>The lowest price across your team, with &quot;from&quot; in front</span></div><Toggle name="show_from" on={disp.show_from} label="Show from prices" /></div>
                <div className="row"><div><b>Show durations</b><span>Clients plan their day around them</span></div><Toggle name="show_durations" on={disp.show_durations} label="Show durations" /></div>
                <div className="row"><div><b>Show staff and let clients choose</b><span>{team.length ? team.map((p) => p.name.split(" ")[0]).join(", ") : "Nobody on the team takes bookings yet"}</span></div><Toggle name="show_staff" on={disp.show_staff} label="Show staff" /></div>
              </div>
              {saveBar}

              <div className="card" id="reviews">
                <h3>Reviews</h3>
                <div className="row"><div><b>Show reviews</b><span>{b.review_count ? `${plural(b.review_count, "review")} · ${Number(b.rating).toFixed(1)} · only from completed bookings` : "No published reviews yet · only clients who finished a visit can leave one"}</span></div><Toggle name="show_reviews" on={disp.show_reviews} label="Show reviews" /></div>
                <div className="row"><div><b>Reply publicly</b><span>{unreplied ? `${plural(unreplied, "review")} without a reply` : reviews.length ? "Every published review has a reply" : "Replies show under the review on your page"}</span></div></div>
                <div className="row"><div><b>Pinned review</b><span>{pinned ? `"${String(pinned.body).slice(0, 70)}${String(pinned.body).length > 70 ? "…" : ""}" · ${pinned.author_name}` : "None. A pinned review shows first on your page."}</span></div></div>
                <div className="rowx"><button className="btn btn-out btn-sm" form={FORM}>Save changes</button><span className="sub">Saves the switch above. Replies and pins below save straight away.</span></div>

                {reviews.length ? reviews.map((r) => (
                  <div key={r.id} className="rv" id={`review-${r.id}`}>
                    <div className="rv-hd">
                      <Avatar name={r.author_name} tone="#5A4A3A" />
                      <div style={{ flex: 1, minWidth: 0 }}><b>{r.author_name}</b><span>{[r.service_name, dateMed(r.created_at, m.timezone)].filter(Boolean).join(" · ")}</span></div>
                      <span className="stars" role="img" aria-label={`${r.rating} out of 5`}>{"★".repeat(r.rating)}{"☆".repeat(Math.max(0, 5 - r.rating))}</span>
                      {r.pinned ? <span className="pill pill-gold">Pinned</span> : null}
                      {r.status === "flagged" ? <span className="pill pill-bad">Flagged</span> : r.status === "hidden" ? <span className="pill pill-grey">Hidden</span> : null}
                    </div>
                    <p>{r.body}</p>
                    {r.status === "flagged" ? <div className="warn">This review has been flagged and LogaLuxe is checking it. It is not on your page while that happens.</div> : null}
                    {r.status === "hidden" ? <div className="warn">This review is hidden from your page.</div> : null}
                    <form action={replyReview} className="rv-f">
                      <input type="hidden" name="back" value="/business/storefront?tab=services#reviews" /><input type="hidden" name="id" value={r.id} />
                      <div className="field"><label htmlFor={`rp-${r.id}`}>{r.reply ? `Your reply${r.replied_at ? ` · ${dateMed(r.replied_at, m.timezone)}` : ""}` : "Reply publicly"}</label><textarea id={`rp-${r.id}`} name="reply" defaultValue={r.reply ?? ""} maxLength={1000} placeholder="Thank them, or say what you have put right." style={{ minHeight: 64 }} /></div>
                      <div className="rowx">
                        <button className="btn btn-out btn-sm">{r.reply ? "Save reply" : "Reply"}</button>
                        {r.reply ? <span className="muted" style={{ fontSize: 12 }}>Clear the box and save to remove your reply.</span> : null}
                      </div>
                    </form>
                    {r.status === "published" ? (
                      <form action={pinReview}>
                        <input type="hidden" name="back" value="/business/storefront?tab=services#reviews" /><input type="hidden" name="id" value={r.id} /><input type="hidden" name="pinned" value={r.pinned ? "0" : "1"} />
                        <button className="btn btn-ghost btn-sm">{r.pinned ? "Unpin" : "Pin to the top of my page"}</button>
                      </form>
                    ) : null}
                  </div>
                )) : <Empty title="No reviews yet">Clients can review a visit once it is finished. Their reviews appear here for you to answer.</Empty>}
              </div>
            </>
          ) : null}

          {tab === "hours" ? (
            <>
              <div className="card">
                <h3>Hours shown on the page</h3>
                <div className="sub">These come from your location hours in Settings. Here you decide how they look.</div>
                <div className="row"><div><b>{hoursLine(loc?.hours) || "No opening hours set"}</b><span>{loc?.name ?? "No main location"}</span></div><Link href="/business/settings" className="btn btn-out btn-sm">Edit hours</Link></div>
                <div className="row"><div><b>Show &quot;open now&quot; badge</b><span>Based on your hours. Right now you are {openNow === null ? "without hours" : openNow ? "open" : "closed"}.</span></div><Toggle name="open_badge" on={disp.open_badge} label="Show open now badge" /></div>
                <div className="field"><label htmlFor="notice">Notice · for holidays and closures</label><input id="notice" name="notice" type="text" form={FORM} defaultValue={disp.notice ?? ""} maxLength={200} placeholder="Closed 24 to 26 Dec" /><small className="muted" style={{ fontSize: 12 }}>Shows on your page until you clear it. Leave empty for no notice.</small></div>
              </div>
              <div className="card">
                <h3>Location on the page</h3>
                <div className="row"><div><b>Show exact address</b><span>{loc ? [loc.address, loc.city, loc.region].filter(Boolean).join(", ") : "No address yet"} · off shows the area only until booked</span></div><Toggle name="show_address" on={disp.show_address} label="Show exact address" /></div>
                <div className="row"><div><b>Parking and arrival notes</b><span>{loc?.arrival_notes ? `"${loc.arrival_notes}"` : "None yet"}</span></div><Link href="/business/settings" className="btn btn-out btn-sm">Edit</Link></div>
              </div>
              {saveBar}
            </>
          ) : null}

          {tab === "found" ? (
            <>
              <div className="card">
                <h3>Being found</h3>
                <div className="score">
                  <div className="ring" style={{ background: `conic-gradient(#1A1513 0 ${share}%,#EFE5DA ${share}% 100%)` }}><i>{done}/{checks.length}</i></div>
                  <div><b style={{ fontSize: 15 }}>{done === checks.length ? "Your page has everything in place" : `${done} of ${checks.length} basics are in place`}</b><div className="sub">A plain checklist of what clients look for. It is not a ranking score.</div></div>
                </div>
                {checks.map((c, i) => <div key={i} className="tip"><span className={"ic " + (c.ok ? "ok" : "todo")} aria-hidden="true">{c.ok ? "✓" : "!"}</span><div><b>{c.title}</b>{c.more}</div></div>)}
              </div>
              <div className="card">
                <h3>Your address</h3>
                <div className="row"><div style={{ minWidth: 0 }}><b style={{ overflowWrap: "anywhere" }}>{url}</b><span>Put it in your Instagram bio, on WhatsApp and on your door</span></div><CopyButton text={url}>Copy</CopyButton></div>
                <div className="row"><div><b>{live ? "Your listing is live" : b.status === "paused" ? "Your listing is paused" : b.status === "suspended" ? "Your listing is suspended" : "Your listing is being checked"}</b><span>{live ? "Clients can find and book you" : b.status === "paused" ? "Bring it back in Settings" : b.status === "suspended" ? "Contact LogaLuxe support" : "You can set everything up now. It goes live once our team approves it."}</span></div>{live ? <span className="pill pill-ok">Live</span> : <Link href="/business/settings?tab=data" className="btn btn-out btn-sm">Settings</Link>}</div>
                <div className="row"><div><b>Show on LogaLuxe search</b><span>Whether clients browsing LogaLuxe can find you. A new-client fee applies to bookings from search.</span></div><Link href="/business/settings?tab=page" className="btn btn-out btn-sm">Change in Settings</Link></div>
              </div>
            </>
          ) : null}
        </div>

        <aside className="preview" aria-label="Preview of your page">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase" }}>Live preview</span>
            <a href={`/b/${b.slug}`} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontWeight: 600 }}>Open the real page</a>
          </div>
          <LivePreview formId={FORM} init={init} rating={Number(b.rating ?? 0)} reviewCount={Number(b.review_count ?? 0)} verified={b.verification_status === "verified"} openNow={openNow}
            logoId={logoId || undefined} cover={shown[0] ? { id: String(shown[0].id), alt: String(shown[0].alt ?? "") } : undefined} grid={shown.slice(1, 4).map((p) => ({ id: String(p.id), alt: String(p.alt ?? "") }))}
            services={services} staff={team} address={loc ? [loc.address, loc.city].filter(Boolean).join(", ") : ""} area={loc ? [loc.name, loc.city].filter(Boolean).join(", ") : ""} phone={String(b.phone ?? "")} />
          <div className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>The preview follows what you type. There is no draft: your page changes as soon as you press Save changes. Photos, replies and pins save straight away.</div>
        </aside>
      </div>
    </div>
  );
}
