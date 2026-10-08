"use client";

import { useActionState } from "react";
import { resolveBank, saveBank } from "./actions";

export type BankState = {
  step: "enter" | "resolved";
  error?: string;
  bank_code?: string; bank_name?: string; account_number?: string; account_name?: string;
  /** True when the name came from the bank, false when it is the name that was typed. */
  checked?: boolean;
};

const Tick = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
);

/**
 * Adding a Nigerian bank account takes two steps: check whose account it is,
 * then confirm and save. The number being checked stays in this form.
 */
export function BankForm({ banks, live, verified, hasAccount, back }: {
  banks: { code: string; name: string }[]; live: boolean; verified: boolean; hasAccount: boolean; back: string;
}) {
  const [s, check, checking] = useActionState(resolveBank, { step: "enter" } as BankState);
  const resolved = s.step === "resolved";
  const last4 = (s.account_number ?? "").slice(-4);

  return (
    <>
      {resolved ? (
        <>
          <div className="resolved" role="status">
            <Tick />
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>{s.account_name}</b>
              <span>{s.checked ? `Name returned by ${s.bank_name}` : "The name you typed. The bank was not asked, because this install has no Paystack key."}</span>
            </div>
          </div>
          <div className="kv">
            <div><span>Bank</span><b>{s.bank_name}</b></div>
            <div><span>Account number</span><b>···· {last4}</b></div>
          </div>
        </>
      ) : (
        <form action={check} className="stack" id="bank-check">
          <div className="two">
            <div className="field">
              <label htmlFor="bank">Bank</label>
              <select id="bank" name="bank" required defaultValue={s.bank_code ? `${s.bank_code}|${s.bank_name}` : ""}>
                <option value="" disabled>Choose a bank</option>
                {banks.map((b) => <option key={`${b.code}|${b.name}`} value={`${b.code}|${b.name}`}>{b.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="acc">Account number</label>
              <input id="acc" name="account_number" type="text" inputMode="numeric" autoComplete="off" required pattern="[0-9 ]{10,13}" maxLength={13} placeholder="10 digits" defaultValue={s.account_number ?? ""} />
            </div>
          </div>
          {!live ? (
            <div className="field">
              <label htmlFor="accname">Name on the account</label>
              <input id="accname" name="account_name" type="text" autoComplete="off" required maxLength={120} defaultValue={s.account_name ?? ""} />
              <small>With a Paystack key the bank returns this name. This install has none, so type it as it appears on the account.</small>
            </div>
          ) : null}
          {s.error ? <div role="alert" className="flash flash-err">{s.error}</div> : null}
          {checking ? <div className="note" role="status">{live ? "Checking the account name with the bank…" : "Checking the details…"}</div> : null}
        </form>
      )}

      <div className="steps">
        <div className="step">
          <span className={"n " + (verified ? "done" : "todo")}>{verified ? "✓" : "1"}</span>
          <div><b>{verified ? "Business verified" : "Business being checked"}</b><span>{verified ? "Our team has approved your listing." : "Our team is still checking your listing. You can add the account now."}</span></div>
        </div>
        <div className="step">
          <span className={"n" + (resolved ? " done" : "")}>{resolved ? "✓" : "2"}</span>
          <div><b>{resolved ? "Account name confirmed" : "Confirm the account name"}</b><span>{live ? "We ask the bank whose account it is, through Paystack. No transfer is made." : "In simulation you type the name and confirm it. No bank is contacted and no transfer is made."}</span></div>
        </div>
        <div className="step">
          <span className={"n" + (resolved ? "" : " todo")}>3</span>
          <div><b>Save as payout account</b><span>{hasAccount ? "The new account becomes your default. The one you have now stays on the list." : "It becomes the account your payouts are sent to."}</span></div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {resolved ? (
          <>
            <form action={saveBank}>
              <input type="hidden" name="back" value={back} />
              <input type="hidden" name="bank_code" value={s.bank_code ?? ""} />
              <input type="hidden" name="bank_name" value={s.bank_name ?? ""} />
              <input type="hidden" name="account_number" value={s.account_number ?? ""} />
              <input type="hidden" name="account_name" value={s.account_name ?? ""} />
              <button className="btn btn-ink">Save payout account</button>
            </form>
            <form action={check}>
              <input type="hidden" name="intent" value="reset" />
              <button className="btn btn-out" disabled={checking}>Use a different account</button>
            </form>
          </>
        ) : (
          <button form="bank-check" className="btn btn-ink" disabled={checking}>{live ? "Check with the bank" : "Check the details"}</button>
        )}
      </div>
    </>
  );
}
