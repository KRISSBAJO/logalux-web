import Link from "next/link";
import { ConfirmButton } from "@/components/merchant-client";
import { Flash, Ic, LoadError, NoAccess } from "@/components/merchant-ui";
import { getMe, mLoad, type Row } from "@/lib/merchant-api";
import { initials } from "@/lib/merchant-format";
import { setSchedule } from "../actions";
import { connectStripe, makeDefault, removeAccount } from "./actions";
import { BankForm } from "./bank-form";
import "../../../css/payout.css";

export const metadata = { title: "Payout account" };

const BACK = "/business/money/payout-account";
const SCHEDS = [["daily", "Daily", "every day"], ["weekly", "Weekly", "Mondays"], ["manual", "When I ask", "pay out by hand"]] as const;
const PROVIDER: Record<string, string> = { stripe: "Stripe", paystack: "Paystack", flutterwave: "Flutterwave" };
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1).replace(/_/g, " ") : s);
const GREEN = { color: "#1F6B3A" };
/** Two letters for the square beside an account: "Chase" gives CH, "First Bank" gives FB. */
const mark = (name: string) => (/\s/.test(name.trim()) ? initials(name) : name.trim().slice(0, 2).toUpperCase());

const Shield = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none", marginTop: 1 }}><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" /></svg>
);

export default async function PayoutAccount({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; stripe?: string }> }) {
  const sp = await searchParams;
  const me = (await getMe())!;
  const { merchant: m } = me;
  const { data: d, error, status } = await mLoad("/payout-account");
  if (status === 403) return <div className="main pg-payout"><NoAccess title="Payout account" need="owner" /></div>;
  if (error) return <div className="main pg-payout"><LoadError title="Payout account" error={error} /></div>;

  const us = d.market === "US";
  const accounts = (d.accounts ?? []) as Row[];
  const def = accounts.find((a) => a.is_default) ?? null;
  const live = us ? d.stripe_live === true : d.paystack_live === true;
  // With real payments on, only an account connected for real can be paid. Simulated ones stay listed.
  const real = accounts.filter((a) => !live || a.mode === "live");
  const stale = live && accounts.some((a) => a.mode !== "live");
  const ready = real.some((a) => a.is_default && a.status === "verified");
  const pendingStripe = accounts.find((a) => a.provider === "stripe" && a.status === "pending");
  const verified = d.verification === "verified";
  // The live list from Paystack repeats some banks. Keep one of each, in name order.
  const seen = new Set<string>();
  const banks = ((d.banks ?? []) as { code: string; name: string }[])
    .filter((x) => { const k = `${x.code}|${x.name}`; if (!x.code || seen.has(k)) return false; seen.add(k); return true; })
    .sort((x, y) => x.name.localeCompare(y.name));
  const provider = us ? "Stripe" : "Paystack";
  const country = us ? "the United States" : "Nigeria";

  const accountsCard = (
    <div className="card">
      <h3>{us ? "Where your money goes" : accounts.length > 1 ? "Payout accounts" : "Current payout account"}</h3>
      {accounts.length ? accounts.map((a) => {
        const unfinished = a.status !== "verified";
        return (
          <div key={a.id} className="acct">
            <span className="avatar" style={{ background: a.is_default ? "#1F2A33" : "#6B5F57", borderRadius: 12 }}>{mark(a.bank_name || PROVIDER[a.provider] || "Bank")}</span>
            <div style={{ flex: 1 }}>
              <b>{a.bank_name ? `${a.bank_name}${a.account_last4 ? ` ···· ${a.account_last4}` : ""}` : `${PROVIDER[a.provider] ?? "Payout"} account`}</b>
              <span>{[a.account_name, a.is_default ? "default" : "", PROVIDER[a.provider] ?? a.provider, unfinished && a.provider === "stripe" ? "setup not finished" : ""].filter(Boolean).join(" · ")}</span>
            </div>
            {a.mode === "simulation" ? <span className="sim">Simulated</span> : null}
            <span className={"pill " + (a.status === "verified" ? "pill-ok" : "pill-gold")}>{a.status === "verified" ? "Verified" : cap(String(a.status))}</span>
            <div className="tools">
              {!a.is_default && a.status === "verified" ? (
                <form action={makeDefault}>
                  <input type="hidden" name="back" value={BACK} /><input type="hidden" name="id" value={a.id} />
                  <button className="btn btn-out btn-sm">Make default</button>
                </form>
              ) : null}
              <form action={removeAccount}>
                <input type="hidden" name="back" value={BACK} /><input type="hidden" name="id" value={a.id} />
                <ConfirmButton className="btn btn-danger btn-sm" message={a.is_default ? (accounts.length > 1 ? "Remove your default payout account? The newest verified account left becomes the default." : "Remove your only payout account? Payouts stop until you add another.") : "Remove this payout account?"}>Remove</ConfirmButton>
              </form>
            </div>
          </div>
        );
      }) : (
        <div className="empty"><b>No payout account yet</b><span>Add one {us ? "on the left" : "with the form"} so the money you take can reach your bank.</span></div>
      )}
      {stale ? <div className="note" role="note"><b>A simulated account cannot receive real payouts.</b> It was recorded before real payments were switched on, and no bank was ever contacted. {us ? "Set up your real account with Stripe" : "Add your real bank account"} on this page, then remove the simulated one.</div>
        : accounts.some((a) => a.mode === "simulation") ? <div className="sub">A simulated account is a label only. No bank was contacted, and a payout to it is recorded as paid without a real transfer.</div> : null}
    </div>
  );

  const scheduleCard = (
    <div className="card">
      <h3>Payout schedule</h3>
      <form action={setSchedule} className="sched">
        <input type="hidden" name="back" value={BACK} />
        {SCHEDS.map(([id, name, sub]) => (
          <button key={id} name="schedule" value={id} className={d.schedule === id ? "on" : ""} aria-pressed={d.schedule === id}><b>{name}</b><span>{sub}</span></button>
        ))}
      </form>
      <div className="sub">Money reaches your payout balance two days after the client pays, then follows this schedule. Deposits are held until the visit and released at checkout.</div>
    </div>
  );

  const statusCard = (
    <div className="card">
      <h3>Account status</h3>
      <div className="kv">
        <div><span>Payouts</span>{ready ? <b style={GREEN}>Enabled</b> : <b>{stale && !real.length ? "Needs a real account" : accounts.length ? "Waiting for a verified account" : "Not set up"}</b>}</div>
        <div><span>Paid through</span><b>{provider}</b></div>
        <div><span>Mode</span><b>{live ? "Live · payouts are really sent" : "Simulation · no real transfers"}</b></div>
        <div><span>Default account</span><b>{def ? `${def.bank_name || provider}${def.account_last4 ? ` ···· ${def.account_last4}` : ""}` : "None"}</b></div>
        <div><span>Business check</span>{verified ? <b style={GREEN}>Verified</b> : <b>{cap(String(d.verification ?? "pending"))}</b>}</div>
        <div><span>Currency</span><b>{d.currency}</b></div>
      </div>
    </div>
  );

  return (
    <div className="main pg-payout">
      <header className="topbar">
        <Link href="/business/money" className="btn btn-out btn-sm" style={{ minHeight: 40 }}><Ic name="chevL" size={16} />Money</Link>
        <h1 className="serif">Payout account</h1>
        <span style={{ flex: 1 }} />
        <span className="muted where" style={{ fontSize: 13 }}>Showing the setup for {m.business} in {country}</span>
      </header>

      <div className="content">
        <Flash sp={sp} />
        {!sp.ok && !sp.err && sp.stripe === "done" ? (
          ready ? <div role="status" className="flash flash-ok">Stripe has verified your account. Payouts are on, and your balance will be sent to {def?.bank_name || "your bank"}{def?.account_last4 ? ` ···· ${def.account_last4}` : ""}.</div>
          : pendingStripe ? <div role="status" className="flash flash-ok">You are back from Stripe. Stripe has not turned payouts on yet: it is still checking your details, or it needs something more. This page asks Stripe each time it loads, so reload in a few minutes, or continue the setup below.</div>
          : <div role="status" className="flash flash-ok">You are back from Stripe. Your account status is shown below.</div>
        ) : null}
        {!sp.ok && !sp.err && sp.stripe === "retry" ? <div role="alert" className="flash flash-err">The Stripe link expired before the setup was finished. Start it again below.</div> : null}

        {us ? (
          <div className="grid">
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="card">
                <h3>How payouts work in the United States</h3>
                <div className="sub">
                  {live
                    ? "LogaLuxe uses Stripe to hold and pay out your money. Stripe collects your bank details and identity on its own secure pages, so we never see your account number or SSN. You come back here when it is done."
                    : "LogaLuxe uses Stripe to hold and pay out your money. This install has no Stripe key, so it runs in simulation: you record which account payouts would go to, no bank is contacted, and no money moves."}
                </div>
                <div className={"prov" + (ready ? " on" : "")}>
                  <span className="logo" style={{ background: "#635BFF" }}>S</span>
                  <span style={{ flex: 1 }}><b>Stripe Connect</b><span>{live ? "Payouts to a US bank account. Your bank and identity details are entered on Stripe, not here." : "Not connected on this install. Accounts added here are simulated."}</span></span>
                  {live
                    ? <span className={"pill " + (ready ? "pill-ok" : pendingStripe ? "pill-gold" : "pill-grey")}>{ready ? "Connected" : pendingStripe ? "Setup not finished" : "Not set up"}</span>
                    : <span className="sim">Simulation</span>}
                </div>
              </div>

              <div className="card">
                <h3>{live ? (ready ? "Setup" : "Set up real payouts") : accounts.length ? "Add another account" : "Add a payout account"}</h3>
                <div className="steps">
                  <div className="step">
                    <span className={"n " + (verified ? "done" : "todo")}>{verified ? "✓" : "1"}</span>
                    <div><b>{verified ? "Business verified" : "Business being checked"}</b><span>{verified ? "Our team has approved your listing." : "Our team is still checking your listing. You can set up payouts now."}</span></div>
                  </div>
                  <div className="step">
                    <span className={"n" + (real.length && !pendingStripe ? " done" : "")}>{real.length && !pendingStripe ? "✓" : "2"}</span>
                    <div><b>{live ? "Bank and identity on Stripe" : "Payout account recorded"}</b><span>{live ? (pendingStripe ? "You started the setup on Stripe. Finish it, or wait for Stripe to check your details, to turn payouts on." : real.length ? "Entered on Stripe." : "Stripe asks for your legal details, identity and bank account on its own pages.") : accounts.length ? "You have recorded an account. It is simulated." : "Record the bank, the name on the account and its last four digits."}</span></div>
                  </div>
                  <div className="step">
                    <span className={"n " + (ready ? "done" : "todo")}>{ready ? "✓" : "3"}</span>
                    <div><b>Payouts enabled</b><span>{ready ? `Your balance is sent to ${def?.bank_name || "your account"}${def?.account_last4 ? ` ···· ${def.account_last4}` : ""}${def?.mode === "simulation" ? ", in simulation" : ""}.` : "Turns on once a verified account is your default."}</span></div>
                  </div>
                </div>

                {live ? (
                  <>
                    <form action={connectStripe} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input type="hidden" name="back" value={BACK} />
                      <button className="btn btn-ink">{pendingStripe ? "Continue the setup on Stripe" : ready ? "Update your details on Stripe" : "Open Stripe to set up payouts"}</button>
                    </form>
                    <div className="secure"><Shield /><span>This button takes you to Stripe&apos;s own pages, where you enter your legal details, identity and bank account. It takes about five minutes. When you finish, Stripe sends you back here. The account shows as pending until Stripe has checked your details, then turns to verified and becomes your default.</span></div>
                  </>
                ) : (
                  <>
                    <form action={connectStripe} className="stack">
                      <input type="hidden" name="back" value={BACK} />
                      <div className="two">
                        <div className="field"><label htmlFor="bank_name">Bank</label><input id="bank_name" name="bank_name" type="text" required maxLength={80} placeholder="Name of the bank" autoComplete="off" /></div>
                        <div className="field"><label htmlFor="last4">Last four digits</label><input id="last4" name="last4" type="text" inputMode="numeric" required pattern="[0-9]{4}" minLength={4} maxLength={4} placeholder="0000" autoComplete="off" /></div>
                      </div>
                      <div className="field"><label htmlFor="account_name">Name on the account</label><input id="account_name" name="account_name" type="text" required maxLength={120} autoComplete="off" /></div>
                      <div><button className="btn btn-ink">Add simulated account</button></div>
                    </form>
                    <div className="secure"><Shield /><span>Do not enter a full account number here. Only the last four digits are kept, to label the account. With a Stripe key, your bank details are entered on Stripe&apos;s own pages and never on this one.</span></div>
                  </>
                )}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {accountsCard}
              {scheduleCard}
              {statusCard}
            </div>
          </div>
        ) : (
          <div className="grid">
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="card">
                <h3>How payouts work in Nigeria</h3>
                <div className="sub">
                  LogaLuxe settles to your Nigerian bank account through Paystack. You add the account here, {live ? "we check the name with the bank" : "the name on it is checked"}, and you confirm.
                  {live ? "" : " This install has no Paystack key, so it runs in simulation: no bank is contacted and no money moves."}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div className="prov on">
                    <span className="logo" style={{ background: "#00C3F7" }}>P</span>
                    <span style={{ flex: 1 }}><b>Paystack</b><span>{live ? "Checks the account name with the bank and sends your payouts to any Nigerian bank." : "Not connected on this install. Accounts added here are simulated."}</span></span>
                    {live ? <span className="pill pill-ok">Default</span> : <span className="sim">Simulation</span>}
                  </div>
                  <div className="prov">
                    <span className="logo" style={{ background: "#F5A623" }}>F</span>
                    <span style={{ flex: 1 }}><b>Flutterwave</b><span>A second provider. Payouts on this page go through Paystack only.</span></span>
                    <span className="pill pill-grey">{d.flutterwave_live ? "Key set" : "Not connected"}</span>
                  </div>
                </div>
              </div>

              <div className="card">
                <h3>{real.length ? "Add another bank account" : live && stale ? "Add your real bank account" : "Add a bank account"}</h3>
                <BankForm key={accounts.length} banks={banks} live={live} verified={verified} hasAccount={real.length > 0} back={BACK} />
                <div className="secure"><Shield /><span>The full account number is used to check and register the account, and is not stored by LogaLuxe. We keep only the last four digits{live ? " and the Paystack recipient code" : ""}.</span></div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {accountsCard}
              {scheduleCard}
              {statusCard}
              <div className="note"><b>Currency:</b> clients see prices in naira and you are paid in naira.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
