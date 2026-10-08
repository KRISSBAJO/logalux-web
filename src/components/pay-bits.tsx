// Pieces shared by every place a customer pays: the card they kept, and the note about Apple Pay and
// Google Pay. Nothing here holds state, so server pages and browser components can both use it.
// Each piece is shown only while LogaLuxe staff have its feature switched on; the caller decides that.

/** A card the customer kept. The number itself stays with the provider. */
export type SavedCard = { id: string; provider: "stripe" | "paystack"; currency: "USD" | "NGN"; brand: string; last4: string; exp_month: number; exp_year: number };
/** What a paying screen is told about the features that are switched on. */
export type PayFeatures = { /** Kept cards are offered to this signed-in customer. */ saved: boolean; /** Apple Pay and Google Pay may be named on payments that go to Stripe. */ wallets: boolean; cards: SavedCard[] };
export const NO_PAY: PayFeatures = { saved: false, wallets: false, cards: [] };

const BRANDS: Record<string, string> = { visa: "Visa", mastercard: "Mastercard", amex: "American Express", "american express": "American Express", discover: "Discover", verve: "Verve", diners: "Diners Club", jcb: "JCB", unionpay: "UnionPay" };
/** "Visa ending 4242". */
export const cardLabel = (c: SavedCard) => {
  const b = String(c.brand ?? "").trim().toLowerCase();
  return `${BRANDS[b] ?? (b ? b[0].toUpperCase() + b.slice(1) : "Card")} ending ${c.last4}`;
};
export const cardExpiry = (c: SavedCard) => (c.exp_month && c.exp_year ? `Expires ${String(c.exp_month).padStart(2, "0")}/${c.exp_year}` : "");
export const cardsFor = (cards: SavedCard[], currency: string) => cards.filter((c) => c.currency === (currency === "NGN" ? "NGN" : "USD"));
export const KEPT_BY = (provider: string) => `Your card is kept by ${provider}, not by LogaLuxe. You can remove it any time in your account.`;

const mark = { display: "inline-flex", alignItems: "center", gap: 3, height: 20, padding: "0 6px", border: "1px solid #D9CCBF", borderRadius: 5, background: "#FFFFFF", color: "#1A1513", font: "600 11px/1 system-ui, sans-serif", letterSpacing: 0, textTransform: "none", whiteSpace: "nowrap", verticalAlign: "middle" } as const;

/** Two small marks: Apple Pay and Google Pay. */
export function WalletMarks() {
  return (
    <span role="img" aria-label="Apple Pay and Google Pay" style={{ display: "inline-flex", gap: 5, verticalAlign: "middle" }}>
      <span style={mark} aria-hidden="true">
        <svg width="10" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 12.54c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.89 2.65 3.24 2.6 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.03 2.29-1.27 3.14-2.53.99-1.45 1.4-2.85 1.42-2.92-.03-.01-2.72-1.04-2.74-4.13zM14.46 4.9c.72-.87 1.2-2.08 1.07-3.28-1.03.04-2.28.69-3.02 1.55-.66.77-1.24 2-1.09 3.18 1.15.09 2.32-.58 3.04-1.45z" /></svg>
        Pay
      </span>
      <span style={mark} aria-hidden="true">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" /></svg>
        Pay
      </span>
    </span>
  );
}

/** One sentence and the two marks, for payments that go to Stripe. The caller shows it only when wallets are switched on. */
export function WalletNote({ lead = " " }: { /** What comes before the sentence: a space inside a paragraph, nothing at the start of a line. */ lead?: string }) {
  return <>{lead}Apple Pay and Google Pay can be used there too. <WalletMarks /></>;
}

/** Wallets are named only when they are switched on and the payment goes to Stripe, never Paystack. */
export const walletsFor = (pay: { wallets: boolean }, provider: string) => pay.wallets && provider === "Stripe";

/**
 * The choice between a card the customer kept and a different one, with the box to keep a new card.
 * `value` is the id of the kept card, or "" for a different card. The page styles `.opt` and `.radio`
 * on the booking and cart screens; in the account the same choice is drawn as chips.
 */
export function CardChoice({ cards, provider, value, onChange, keep, onKeep, name, look = "cx", wallets = false, otherSub = true, charge }: {
  /** False where the screen already says, beside this choice, how a different card is paid. */
  otherSub?: boolean;
  /** One plain sentence on what is charged and where: "You will be charged ₦7,000 on Paystack's page." */
  charge?: string;
  cards: SavedCard[]; provider: string; value: string; onChange: (id: string) => void; keep: boolean; onKeep: (on: boolean) => void;
  /** Unique on the page: two carts can be shown at once. */
  name: string; look?: "cx" | "chips"; wallets?: boolean;
}) {
  const other = value === "";
  const keepBox = other ? (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: look === "cx" ? 14 : 13.5, lineHeight: 1.45, cursor: "pointer" }}>
      <input type="checkbox" checked={keep} onChange={(e) => onKeep(e.target.checked)} style={{ width: 18, height: 18, minHeight: 0, margin: "1px 0 0", padding: 0, flex: "none", accentColor: "#1A1513" }} />
      <span>Keep this card for next time</span>
    </label>
  ) : null;
  const note = <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "#6B5F57" }}>{charge ? <b style={{ display: "block", color: "#1A1513", fontSize: 13.5, marginBottom: 2 }}>{charge}</b> : null}{KEPT_BY(provider)}</div>;

  if (look === "chips") {
    const chip = (on: boolean) => `flex min-h-[42px] cursor-pointer items-center rounded-full border px-3.5 text-[14px] font-semibold transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold ${on ? "border-ink bg-ink text-cream" : "border-line bg-white hover:border-ink"}`;
    return (
      <div className="flex flex-col gap-2.5">
        {cards.length > 0 && (
          <fieldset className="flex flex-wrap gap-2">
            <legend className="mb-2 text-[13.5px] text-muted">Pay with</legend>
            {cards.map((c) => (
              <label key={c.id} className={chip(value === c.id)}><input type="radio" name={name} className="sr-only" checked={value === c.id} onChange={() => onChange(c.id)} />{cardLabel(c)}</label>
            ))}
            <label className={chip(other)}><input type="radio" name={name} className="sr-only" checked={other} onChange={() => onChange("")} />A different card</label>
          </fieldset>
        )}
        {keepBox}
        {note}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {cards.length > 0 ? (
        <div role="radiogroup" aria-label="Card to pay with" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {cards.map((c) => (
            <button key={c.id} type="button" role="radio" aria-checked={value === c.id} className={`opt${value === c.id ? " on" : ""}`} onClick={() => onChange(c.id)}>
              <span className="radio">{value === c.id ? <i /> : null}</span>
              <span style={{ flex: 1 }}><b>{cardLabel(c)}</b><span>{[cardExpiry(c), `Charged now, with no payment page. If your bank asks you to approve it, ${provider}'s page opens.`].filter(Boolean).join(" · ")}</span></span>
            </button>
          ))}
          <button type="button" role="radio" aria-checked={other} className={`opt${other ? " on" : ""}`} onClick={() => onChange("")}>
            <span className="radio">{other ? <i /> : null}</span>
            <span style={{ flex: 1 }}><b>A different card</b>{otherSub ? <span>You will pay on {provider}&apos;s secure page. LogaLuxe never sees your card.{wallets ? <WalletNote /> : null}</span> : <span>Typed on {provider}&apos;s secure page</span>}</span>
          </button>
        </div>
      ) : null}
      {keepBox}
      {note}
    </div>
  );
}
