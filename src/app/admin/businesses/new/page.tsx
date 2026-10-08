import Link from "next/link";
import { Btn, Content, Field, Flash, Hidden, Panel, ReadOnly, Topbar, inputCls } from "@/components/admin-ui";
import { BusinessFields } from "@/components/catalog-forms";
import { can, getAdmin } from "@/lib/admin-api";
import { createBusiness } from "../../actions-catalog";

export default async function NewBusiness({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const ops = can(await getAdmin(), "ops");
  return (
    <>
      <Topbar title="Add a business" sub="For a professional you are signing up yourself">
        <Link href="/admin/businesses" className="text-[13px] font-semibold text-muted hover:text-ink">All businesses</Link>
      </Topbar>
      <Content>
        <Flash sp={sp} />
        {!ops ? <ReadOnly need="ops" /> : (
          <form action={createBusiness} className="flex flex-col gap-5">
            <Hidden values={{ back: "/admin/businesses/new" }} />
            <Panel title="Where it trades" sub="The market sets the currency and cannot be changed later.">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Market"><select name="market" required defaultValue="US" className={inputCls}><option value="US">United States · USD</option><option value="NG">Nigeria · NGN</option></select></Field>
                <Field label="City"><input name="city" placeholder="Nashville" className={inputCls} /></Field>
                <Field label="State or region"><input name="region" placeholder="TN" className={inputCls} /></Field>
                <Field label="Street address"><input name="address" className={inputCls} /></Field>
                <Field label="Booking link, optional" className="sm:col-span-2"><input name="slug" pattern="[a-z0-9][a-z0-9-]{1,59}" placeholder="logaluxe.com/@… made from the name if left empty" className={inputCls} /></Field>
              </div>
            </Panel>
            <Panel title="Profile"><BusinessFields /></Panel>
            <div className="flex flex-wrap items-center gap-3">
              <Btn kind="ink">Create business</Btn>
              <p className="text-[13px] text-muted">It starts hidden, with the owner on the team and standard opening hours. It goes live when verification approves it.</p>
            </div>
          </form>
        )}
      </Content>
    </>
  );
}
