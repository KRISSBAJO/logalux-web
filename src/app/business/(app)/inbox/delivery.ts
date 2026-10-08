// What really happened to a message, in plain words. Shared by the Inbox and
// the Clients screen. Not a "use server" file, so nothing here is callable from the browser.
import { CHANNEL_LABEL } from "@/lib/merchant-format";
import type { ChannelModes } from "@/lib/merchant-channels";

export const CHANNELS = ["in_app", "email", "whatsapp", "sms"] as const;

/** The label under one message in a conversation. */
export function deliveryLabel(delivery: string): string {
  if (delivery === "delivered") return "Delivered";
  if (delivery === "sent") return "Sent";
  if (delivery === "logged") return "Logged, not sent";
  if (delivery === "failed") return "Failed to send";
  return delivery ? `Not sent: ${delivery}` : "";
}

/**
 * The sentence shown after sending, and whether it counts as a problem.
 * `modes` says whether WhatsApp and SMS really go out for this business right now.
 */
export function deliveryResult(delivery: string, channel: string, modes?: ChannelModes): { kind: "ok" | "err"; message: string } {
  const name = CHANNEL_LABEL[channel] ?? channel;
  const phone = channel === "whatsapp" || channel === "sms";
  if (delivery === "delivered") return { kind: "ok", message: phone ? (channel === "sms" ? "Message sent to the client's phone by SMS." : "Message sent to the client's phone on WhatsApp.") : "Message delivered to the client's LogaLuxe account." };
  if (delivery === "sent") return { kind: "ok", message: "Message sent by email." };
  if (delivery === "logged") {
    if (phone && modes?.[channel as "whatsapp" | "sms"] === "live") return { kind: "ok", message: `Message logged, not sent. ${name} is on, but this client's number cannot be reached on it. Check the number has its country code.` };
    if (phone) return { kind: "ok", message: `Message logged, not sent. ${name} is not connected on this install.` };
    if (channel === "email") return { kind: "ok", message: "Message logged, not sent. No mail provider is set on this install." };
    return { kind: "ok", message: "Message logged, not sent. This client has no LogaLuxe account to read it in." };
  }
  if (delivery === "failed") return { kind: "err", message: phone ? `The ${name} message could not be sent. It is saved in the conversation as failed.` : "The email could not be sent. The message is saved in the conversation as failed." };
  return { kind: "err", message: `Message saved but not sent: ${delivery || "unknown reason"}.` };
}
