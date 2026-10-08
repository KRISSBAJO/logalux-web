import Link from "next/link";
import { Btn, Content, Flash, Hidden, Panel, ReadOnly, Topbar } from "@/components/admin-ui";
import { ProductFields } from "@/components/catalog-forms";
import { can, getAdmin } from "@/lib/admin-api";
import { createProduct } from "../../actions-catalog";

export default async function NewProduct({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const ops = can(await getAdmin(), "ops");
  return (
    <>
      <Topbar title="Add a product" sub="It goes on sale in the shop as soon as you save it">
        <Link href="/admin/products" className="text-[13px] font-semibold text-muted hover:text-ink">All products</Link>
      </Topbar>
      <Content>
        <Flash sp={sp} />
        {!ops ? <ReadOnly need="ops" /> : (
          <Panel>
            <form action={createProduct} className="flex flex-col gap-4">
              <Hidden values={{ back: "/admin/products/new" }} />
              <ProductFields creating />
              <div className="flex flex-wrap items-center gap-3"><Btn kind="ink">Create product</Btn><span className="text-[13px] text-muted">You add photos on the next screen.</span></div>
            </form>
          </Panel>
        )}
      </Content>
    </>
  );
}
