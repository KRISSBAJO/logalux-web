import Link from "next/link";
import { Btn, Content, Field, Flash, Hidden, Panel, ReadOnly, Topbar, inputCls } from "@/components/admin-ui";
import { BusinessFields } from "@/components/catalog-forms";
import { can, getAdmin } from "@/lib/admin-api";
import { createBusiness } from "../../actions-catalog";
import { LocationFields } from "@/components/location-fields";
import { LOOKS } from "@/lib/location-form";
import { allStates } from "@/lib/places";

export default async function NewBusiness({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const [ops, states] = await Promise.all([getAdmin().then((a) => can(a, "ops")), allStates()]);
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
            <Panel title="Where it trades" sub="The country sets the currency and cannot be changed later. The address sets the time zone.">
              <div className="flex flex-col gap-3">
                <LocationFields states={states} look={LOOKS.admin} />
                <Field label="Booking link, optional" className="max-w-[520px]"><input name="slug" pattern="[a-z0-9][a-z0-9-]{1,59}" placeholder="logaluxe.com/@… made from the name if left empty" className={inputCls} /></Field>
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
