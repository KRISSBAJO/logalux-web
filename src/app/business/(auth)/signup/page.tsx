import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard, AuthField } from "@/components/auth-card";
import { getMe } from "@/lib/merchant-api";
import { LocationFields } from "@/components/location-fields";
import { LOOKS } from "@/lib/location-form";
import { allStates, whereAmI } from "@/lib/places";
import { merchantSignUp } from "../actions";

export const metadata = { title: "List your business" };

const CATEGORIES = [["hair", "Hair"], ["braids", "Braids"], ["barber", "Barber"], ["nails", "Nails"], ["lashes", "Lashes & brows"], ["skin", "Skin"], ["makeup", "Makeup"], ["spa", "Spa & massage"]];
const label = "text-[11px] font-semibold uppercase tracking-[.06em] text-muted";

export default async function BusinessSignUp({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  if (await getMe()) redirect("/business");
  // The country starts as the one we think they are in; they choose.
  const [states, where] = await Promise.all([allStates(), whereAmI()]);
  const country = sp.country === "NG" || sp.market === "NG" ? "NG" : sp.country === "US" || sp.market === "US" ? "US" : where.scope === "NG" ? "NG" : "US";
  return (
    <AuthCard title="List your business" sub="Free to start. Your booking page, calendar and client book are ready in a minute." sp={sp}
      footer={<>Already listed? <Link href="/business/signin" className="font-semibold text-wine">Sign in</Link></>}>
      <form action={merchantSignUp} className="flex flex-col gap-4">
        <AuthField label="Business name" name="business" required minLength={2} maxLength={80} defaultValue={sp.business} autoFocus placeholder="Ada's Braid Studio" />
        <label className="field">
          <span className={label}>What you do</span>
          <select name="category" required defaultValue={sp.category ?? ""}>
            <option value="" disabled>Choose</option>
            {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        {/* Where it is. The country sets the money and the payment provider; the address sets the time zone. */}
        <LocationFields states={states} look={LOOKS.auth} country={country} value={{ address: sp.address, city: sp.city, region: sp.region, travels: sp.travels === "1" }} />
        <hr className="border-line-2" />
        <AuthField label="Your name" name="name" required maxLength={80} defaultValue={sp.name} autoComplete="name" />
        <div className="grid grid-cols-2 gap-3">
          <AuthField label="Email" name="email" type="email" required defaultValue={sp.email} autoComplete="email" />
          <AuthField label="Phone" name="phone" type="tel" required defaultValue={sp.phone} autoComplete="tel" placeholder="With or without the country code" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <AuthField label="Password" name="password" type="password" required minLength={10} autoComplete="new-password" />
          <AuthField label="Again" name="again" type="password" required minLength={10} autoComplete="new-password" />
        </div>
        <p className="text-[12.5px] leading-relaxed text-muted">At least 10 characters. Your listing goes live after a quick check by our team; you can set everything up while you wait.</p>
        <button className="btn btn-ink mt-1 min-h-[50px] w-full">Create my business</button>
      </form>
    </AuthCard>
  );
}
