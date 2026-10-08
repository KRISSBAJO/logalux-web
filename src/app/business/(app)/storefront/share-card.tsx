import { headers } from "next/headers";
import { toDataURL } from "qrcode";
import { CopyButton } from "@/components/merchant-client";

// "Share your booking page": the public link, a QR code of it, and the two
// ways to put booking on the business's own website.

const HOST = /^(\[[0-9a-f:]+\]|[a-z0-9]([a-z0-9.-]*[a-z0-9])?)(:\d{1,5})?$/i;

/** Where this site is reached from: the configured address when there is one, otherwise the address of this request. */
export async function siteOrigin(): Promise<string> {
  const set = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  if (/^https?:\/\/[^/\s]+$/i.test(set)) return set;
  const h = await headers();
  const first = (v: string | null) => (v ?? "").split(",")[0].trim();
  const host = [first(h.get("x-forwarded-host")), first(h.get("host"))].find((x) => HOST.test(x)) ?? "";
  if (!host) return "";
  const proto = first(h.get("x-forwarded-proto")).toLowerCase();
  return `${proto === "http" || proto === "https" ? proto : isLocal(host) ? "http" : "https"}://${host}`;
}

/** An address that only works on this computer or this network. */
function isLocal(hostOrOrigin: string) {
  const name = hostOrOrigin.replace(/^https?:\/\//i, "").replace(/:\d+$/, "").toLowerCase();
  return name === "localhost" || name.endsWith(".localhost") || name.endsWith(".test") || name.endsWith(".local") || name === "[::1]"
    || /^(127|10)\.\d+\.\d+\.\d+$/.test(name) || /^192\.168\.\d+\.\d+$/.test(name) || /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(name);
}

const attr = (text: string) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function ShareCard({ slug, name }: { slug: string; name: string }) {
  const origin = await siteOrigin();
  if (!slug || !origin) {
    return (
      <div className="card" id="share">
        <h3>Share your booking page</h3>
        <div className="sub">{slug ? "The address of this site could not be worked out, so there is no link to show yet." : "Give your page a handle on the Basics tab first. The link, QR code and website snippet are made from it."}</div>
      </div>
    );
  }
  const link = `${origin}/b/${slug}`, embed = `${origin}/embed/${slug}`;
  const script = `<script src="${origin}/embed.js" data-business="${slug}" async></script>`;
  const frame = `<iframe src="${embed}" title="Book with ${attr(name || "us")}" style="width:100%;max-width:480px;height:760px;border:0" loading="lazy"></iframe>`;
  const qr = await toDataURL(link, { margin: 1, width: 480, color: { dark: "#1A1513", light: "#FFFFFF" } }).catch(() => "");
  const local = isLocal(origin);

  return (
    <div className="card" id="share">
      <h3>Share your booking page</h3>
      {local ? <div className="warn">This site is running at a local address ({origin.replace(/^https?:\/\//, "")}), which only this computer can open. The link, the QR code and the snippets will work once LogaLuxe is on the internet.</div> : null}

      <div className="share-part">
        <div className="share-hd"><b>Your link</b><CopyButton text={link}>Copy link</CopyButton></div>
        <a className="share-link" href={`/b/${slug}`} target="_blank" rel="noreferrer">{link}</a>
        <div className="sub">Put it in your Instagram bio, your WhatsApp status and your messages to clients.</div>
      </div>

      {qr ? (
        <div className="share-part share-qr">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} width={148} height={148} alt={`QR code that opens ${link}`} />
          <div>
            <b>QR code</b>
            <div className="sub">Clients point their phone camera at it and your booking page opens. Print it for your mirror, your front desk and your business cards.</div>
            <a className="btn btn-out btn-sm" href={qr} download={`${slug}-booking-qr.png`}>Download QR code</a>
          </div>
        </div>
      ) : null}

      <div className="share-part">
        <div className="share-hd"><b>Add booking to your own website</b><CopyButton text={script}>Copy snippet</CopyButton></div>
        <div className="sub">Paste this into your page where you want the booking button to show.</div>
        <pre className="code" tabIndex={0} aria-label="Snippet for your website"><code>{script}</code></pre>
        <ul className="share-opts">
          <li><code>data-label=&quot;Book now&quot;</code> changes the words on the button. Leave it out to keep the standard words.</li>
          <li><code>data-color=&quot;#7A1F2B&quot;</code> changes the colour of the button. Leave it out to keep the standard colour.</li>
        </ul>
      </div>

      <div className="share-part">
        <div className="share-hd"><b>If your site builder does not allow scripts</b><CopyButton text={frame}>Copy snippet</CopyButton></div>
        <div className="sub">Use this instead. It shows the booking page inside a frame on your page. Some builders ask only for an address: give them {embed}</div>
        <pre className="code" tabIndex={0} aria-label="Frame snippet for your website"><code>{frame}</code></pre>
        <div className="rowx">
          <a className="btn btn-out btn-sm" href={`/embed/${slug}`} target="_blank" rel="noreferrer">Open the embedded booking page</a>
          <CopyButton text={embed}>Copy address</CopyButton>
        </div>
      </div>

      <div className="sub">Bookings made this way count as your own link, so no new-client fee applies to them.</div>
    </div>
  );
}
