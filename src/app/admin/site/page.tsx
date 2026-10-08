import Link from "next/link";
import { Content, Flash, Panel, ReadOnly, Topbar } from "@/components/admin-ui";
import { MediaManager } from "@/components/media-manager";
import { can, getAdmin, load, type Row } from "@/lib/admin-api";

const CATEGORIES: [string, string][] = [["hair", "Hair"], ["braids", "Braids & locs"], ["barber", "Barber"], ["nails", "Nails"], ["lashes", "Lashes & brows"], ["skin", "Skin"], ["makeup", "Makeup"], ["spa", "Spa & massage"]];

export default async function SiteImages({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const [admin, res] = await Promise.all([getAdmin(), load("/media")]);
  const media: Row[] = res.data.media ?? [];
  const ops = can(admin, "ops");
  const back = "/admin/site";
  const hero = media.filter((m) => m.slot === "hero");
  const live = hero.filter((m) => m.active).length;
  const count = (slot: string) => media.filter((m) => m.slot === slot).length;

  return (
    <>
      <Topbar title="Site images" sub="Pictures shown on the public site. Changes appear straight away.">
        <Link href="/" className="inline-flex h-10 items-center rounded-full border border-line bg-white px-4 text-[13.5px] font-semibold hover:border-ink">View the site</Link>
      </Topbar>
      <Content>
        <Flash sp={sp} error={res.error} />
        {res.data.storage === false && <div role="alert" className="rounded-xl border border-bad/25 bg-bad-bg px-4 py-3 text-[14px] font-medium text-bad">Image storage is not set up. Add the four AWS settings to the API&rsquo;s .env file and restart it.</div>}
        {!ops && <ReadOnly need="ops" />}

        <Panel title="Landing page hero" sub={`${live} showing${live > 1 ? ", cross-fading every 6 seconds" : ""}. Up to 6 can show at once. With none, the arch shows its gradient.`}>
          <MediaManager quotes slot="hero" items={hero} back={back} canEdit={ops} max={6} hint="Each photo can carry a short client quote. Choose a corner where it does not cover the subject. Best result: a portrait photo, about 4 wide by 5 tall, at least 1,000 pixels wide, with the face in the upper half. The top is cut to an arch." />
        </Panel>

        <Panel title="Category tiles" sub="One picture for each service category on the landing page. A square photo works best.">
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {CATEGORIES.map(([id, name]) => (
              <div key={id} className="rounded-2xl border border-line p-3.5">
                <h3 className="mb-3 text-[14.5px] font-semibold">{name}</h3>
                <MediaManager compact slot="category" refKey={id} items={media.filter((m) => m.slot === "category" && m.ref === id)} back={back} canEdit={ops} max={1} aspect="aspect-square" />
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Business and product photos">
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/admin/businesses" className="rounded-2xl border border-line p-4 transition hover:border-ink">
              <b className="block text-[15px] font-semibold">Business photos · {count("business")}</b>
              <span className="text-[13.5px] text-muted">Open a business, then use its Photos panel. The first photo is the cover on search and on the storefront.</span>
            </Link>
            <Link href="/admin/products" className="rounded-2xl border border-line p-4 transition hover:border-ink">
              <b className="block text-[15px] font-semibold">Product photos · {count("product")}</b>
              <span className="text-[13.5px] text-muted">Open a product from the list and press Photos. The first photo shows in the shop grid.</span>
            </Link>
          </div>
        </Panel>
      </Content>
    </>
  );
}
