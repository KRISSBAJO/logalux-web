"use server";

import { mFetch, type Row } from "@/lib/merchant-api";
import { mPost, mPut, mRun, str } from "@/lib/merchant-actions";
import { money } from "@/lib/merchant-format";

/** Sends the whole available balance to the bank. An instant payout carries a fee. */
export async function payOut(fd: FormData) {
  const instant = str(fd, "instant") === "1";
  await mRun(
    fd,
    (out) => {
      const p = out.payout as Row | undefined;
      if (!p) return "Payout created.";
      const fee = p.fee_cents > 0 ? `, after an instant payout fee of ${money(p.fee_cents, p.currency, { exact: true })}` : "";
      return out.simulated
        ? `Payout of ${money(p.amount_cents, p.currency, { exact: true })} recorded as paid${fee}. Payments are in simulation, so no bank transfer was made.`
        : `Payout of ${money(p.amount_cents, p.currency, { exact: true })} is on its way to your bank${fee}.`;
    },
    async () => {
      const made = await mPost("/payouts", { instant });
      // Read the payout back so the message can say what was sent and what the fee was.
      try {
        const d = await mFetch("/money");
        const payout = ((d.payouts ?? []) as Row[]).find((p) => p.id === made.id);
        return { payout, simulated: d.account?.mode !== "live" };
      } catch {
        return {};
      }
    },
  );
}

const SCHEDULE_DONE: Record<string, string> = {
  daily: "Payouts are now sent every day.",
  weekly: "Payouts are now sent every Monday.",
  manual: "Automatic payouts are off. Pay out when you choose.",
};

export async function setSchedule(fd: FormData) {
  const schedule = str(fd, "schedule");
  await mRun(fd, SCHEDULE_DONE[schedule] ?? "Schedule saved.", () => mPut("/payout-schedule", { schedule }));
}
