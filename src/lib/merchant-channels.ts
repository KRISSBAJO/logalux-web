// Server only. Whether a WhatsApp message or a text from this business really goes out.
// LogaLuxe staff switch each channel on in the console, so the business console never
// states it as fixed: every screen asks here and words itself from the answer.
import { cache } from "react";
import { getFeatures } from "./features";
import { mLoad, type Row } from "./merchant-api";

export type Mode = "live" | "log";
export type ChannelModes = { whatsapp: Mode; sms: Mode };

/**
 * The API says, for this business, which channels are live. Its answer comes with the marketing
 * screen, which a manager can read. For someone who cannot, the public list of switches is used.
 */
export const channelModes = cache(async (): Promise<ChannelModes> => {
  const m = await mLoad<Row>("/marketing");
  const modes = m.error ? null : (m.data.modes as Record<string, string> | undefined);
  if (modes) return { whatsapp: modes.whatsapp === "live" ? "live" : "log", sms: modes.sms === "live" ? "live" : "log" };
  const f = await getFeatures();
  return { whatsapp: f.whatsapp ? "live" : "log", sms: f.sms_messages ? "live" : "log" };
});

const NAMES: [keyof ChannelModes, string][] = [["whatsapp", "WhatsApp"], ["sms", "SMS"]];
const list = (names: string[]) => names.join(" and ");

/** The channels that only log, by name: "WhatsApp and SMS", "SMS", or "". */
export const loggedNames = (m: ChannelModes) => list(NAMES.filter(([k]) => m[k] === "log").map(([, n]) => n));
export const liveNames = (m: ChannelModes) => list(NAMES.filter(([k]) => m[k] === "live").map(([, n]) => n));

/** What a "Send by" choice says about the phone channels. */
export function phoneChannelsHint(m: ChannelModes): string {
  const live = liveNames(m), logged = loggedNames(m);
  return [
    live ? `${live} messages go to the client's phone.` : "",
    logged ? `${logged} ${logged.includes(" and ") ? "are" : "is"} not connected on this install, so those messages are logged, not sent.` : "",
  ].filter(Boolean).join(" ");
}

/** The words after a channel's name in a list of choices. */
export const loggedOnly = (m: ChannelModes, channel: "whatsapp" | "sms") => (m[channel] === "log" ? ", logged only" : "");
