import { Content, Empty, Flash, Panel, Pill, Topbar } from "@/components/admin-ui";
import { can, getAdmin, load } from "@/lib/admin-api";
import { FeatureSwitch } from "./switch";

type Feature = { key: string; title: string; about: string; on: boolean; ready: boolean; missing: string[] | null; live: boolean };

// Switching these on sends messages to real phones, so the switch asks first.
const ASK: Record<string, string> = {
  sms_messages: "Switch on texts to clients? Messages will reach real phones and cost money.",
  whatsapp: "Switch on WhatsApp messages? Messages will reach real phones and cost money.",
};

export default async function Features({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const [admin, res] = await Promise.all([getAdmin(), load("/features")]);
  const features: Feature[] = res.data.features ?? [];
  const boss = can(admin, "super_admin");
  const back = "/admin/features";

  return (
    <>
      <Topbar title="Features" sub="What customers and businesses are offered. A feature that is off is hidden everywhere." />
      <Content>
        <Flash sp={sp} error={res.error} />
        {!boss && <p className="rounded-xl bg-cream-2 px-3.5 py-2.5 text-[13px] text-muted">View only. A super admin can change these.</p>}
        <div className="grid items-start gap-5 lg:grid-cols-2">
          {features.map((f) => {
            const missing = f.missing ?? [];
            const one = missing.length === 1;
            return (
              <section key={f.key} className="card flex flex-col gap-3 p-5">
                <div className="flex items-start gap-4">
                  <div className="mr-auto min-w-0">
                    <h2 className="text-[15px] font-semibold">{f.title}</h2>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{f.about}</p>
                  </div>
                  {boss ? <FeatureSwitch feature={f.key} title={f.title} on={f.on} back={back} ask={ASK[f.key] ?? ""} /> : null}
                </div>
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 rounded-xl bg-cream-2 px-3.5 py-2.5 text-[13.5px]">
                  {f.live ? (
                    <><Pill kind="ok">Live</Pill><span className="text-muted">People are offered it now.</span></>
                  ) : f.on ? (
                    <>
                      <Pill kind="gold">Waiting for keys</Pill>
                      <span className="min-w-0">
                        Switched on, but waiting for {one ? "a key" : "keys"}: <b className="break-all font-mono text-[12.5px] font-semibold">{missing.join(", ")}</b>.
                        {" "}{one ? "It goes" : "They go"} in the API&apos;s .env file. Then restart the API. Until then nobody is offered it.
                      </span>
                    </>
                  ) : (
                    <>
                      <Pill kind="grey">Off</Pill>
                      <span className="min-w-0 text-muted">
                        Hidden everywhere.
                        {missing.length > 0 && <> Before it can go live it also needs {one ? "a key" : "keys"} in the API&apos;s .env file: <b className="break-all font-mono text-[12.5px] font-semibold">{missing.join(", ")}</b>.</>}
                      </span>
                    </>
                  )}
                </div>
                {ASK[f.key] && !f.on && <p className="text-[12.5px] text-muted">Switching this on sends messages to real phones, and each one costs money.</p>}

              </section>
            );
          })}
        </div>
        {features.length === 0 && !res.error && <Panel><Empty>No features to show.</Empty></Panel>}
      </Content>
    </>
  );
}
