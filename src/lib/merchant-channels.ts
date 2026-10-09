// Server only. Whether a WhatsApp message, a text or an email from this business really goes out.
// LogaLuxe staff switch each channel on in the console, so the business console never
// states it as fixed: every screen asks here and words itself from the answer.
import { cache } from "react";
import { getFeatures } from "./features";
import { mLoad, type Row } from "./merchant-api";

export type Mode = "live" | "log";
export type ChannelModes = { whatsapp: Mode; sms: Mode; email: Mode };

/** One rule for every channel: "log" means nothing is sent; anything else sends. */
export const asMode = (v: unknown): Mode => (v === "log" || v === undefined || v === null || v === "" ? "log" : "live");

/**
 * The API says, for this business, which channels are live. Its answer comes with the marketing
 * screen, which a manager can read. For someone who cannot, the public list of switches is used,
 * which says nothing about email; a page that has `mail_mode` of its own should pass it to `withMail`.
 */
export const channelModes = cache(async (): Promise<ChannelModes> => {
  const m = await mLoad<Row>("/marketing");
  const modes = m.error ? null : (m.data.modes as Record<string, string> | undefined);
  if (modes) return { whatsapp: asMode(modes.whatsapp), sms: asMode(modes.sms), email: asMode(modes.email) };
  const f = await getFeatures();
  return { whatsapp: f.whatsapp ? "live" : "log", sms: f.sms_messages ? "live" : "log", email: "log" };
});

/** The same modes, with the email channel taken from a page's own `mail_mode` when it has one. */
export const withMail = (m: ChannelModes, mailMode: unknown): ChannelModes => (mailMode === undefined || mailMode === null ? m : { ...m, email: asMode(mailMode) });

const PHONE: [keyof ChannelModes, string][] = [["whatsapp", "WhatsApp"], ["sms", "SMS"]];
const ALL: [keyof ChannelModes, string][] = [["email", "Email"], ...PHONE];
const list = (names: string[]) => (names.length > 2 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names.join(" and "));

/** The phone channels that only log, by name: "WhatsApp and SMS", "SMS", or "". */
export const loggedNames = (m: ChannelModes) => list(PHONE.filter(([k]) => m[k] === "log").map(([, n]) => n));
export const liveNames = (m: ChannelModes) => list(PHONE.filter(([k]) => m[k] === "live").map(([, n]) => n));

/** What a "Send by" choice says about the phone channels. */
export function phoneChannelsHint(m: ChannelModes): string {
  const live = liveNames(m), logged = loggedNames(m);
  return [
    live ? `${live} messages go to the client's phone.` : "",
    logged ? `${logged} ${logged.includes(" and ") ? "are" : "is"} not connected on this install, so those messages are logged, not sent.` : "",
  ].filter(Boolean).join(" ");
}

/** What a "Send by" choice says about every channel but in-app: email, WhatsApp and SMS. */
export function channelsHint(m: ChannelModes): string {
  const live = list(ALL.filter(([k]) => m[k] === "live").map(([, n]) => n)), logged = list(ALL.filter(([k]) => m[k] === "log").map(([, n]) => n));
  return [
    live ? `${live} messages reach the client.` : "",
    logged ? `${logged} ${logged.includes(" and ") ? "are" : "is"} not connected on this install, so those messages are logged, not sent.` : "",
  ].filter(Boolean).join(" ");
}

/** The words after a channel's name in a list of choices. */
export const loggedOnly = (m: ChannelModes, channel: keyof ChannelModes) => (m[channel] === "log" ? ", logged only" : "");
