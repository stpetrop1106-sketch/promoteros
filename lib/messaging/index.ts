/**
 * Messaging adapters.
 *
 * WhatsApp business verification and template approval take 3–10 business days and are outside
 * our control, so nothing in the product may depend on a specific channel being available.
 * Feature code calls `getAdapter().sendInvitation(...)` and never touches a provider SDK.
 *
 * Add adapters, not conditionals. See decisions.md D3.
 *
 * P39 added `EmailAdapter` (`./email.ts`, Resend over plain `fetch`) and `getAdapterFor()`, the one
 * place that decides between email and the manual channel.
 */

import { EmailAdapter, emailConfigFrom, type EmailAdapterOptions } from "./email";

export type OutboundMessage = {
  /** `email` was added in P39. Channels that do not address by email ignore it. */
  to: { name: string; phone: string; email?: string | null };
  body: string;
  url: string;
  /** P39, email only: the subject line. Other channels ignore it. */
  subject?: string;
  /** P39, email only: the button label for `url`. Other channels ignore it. */
  actionLabel?: string;
  /**
   * P39: a stable key for provider-side de-duplication (Resend's `Idempotency-Key`). The
   * dispatcher derives it from its dispatch row, so a retried request is never a second message.
   */
  idempotencyKey?: string;
};

/**
 * Why a message was not delivered. Optional, so every adapter written before P39 still satisfies
 * the type; an automated sender records it, an interactive one can ignore it.
 */
export type UndeliveredReason =
  | "no_address"
  | "invalid_address"
  | "reserved_domain"
  | "rate_limited"
  | "provider_error";

export type SendResult =
  | { delivered: true; channel: Channel; providerMessageId?: string | null }
  | {
      delivered: false;
      channel: Channel;
      manualBody: string;
      reason?: UndeliveredReason;
      /** A short provider error code. Never an address, never a raw response body. */
      error?: string;
    };

export type Channel = "clipboard" | "telegram" | "whatsapp" | "viber" | "sms" | "email";

export interface MessagingAdapter {
  readonly channel: Channel;
  send(message: OutboundMessage): Promise<SendResult>;
}

/**
 * The default, and not a placeholder: it renders the message for the coordinator to paste into
 * WhatsApp themselves. That is exactly what agencies do today, so adoption cost is zero and the
 * product is useful before any provider onboarding finishes.
 */
class ClipboardAdapter implements MessagingAdapter {
  readonly channel = "clipboard" as const;

  async send(message: OutboundMessage): Promise<SendResult> {
    return {
      delivered: false,
      channel: this.channel,
      manualBody: `${message.body}\n\n${message.url}`,
    };
  }
}

/**
 * Zero-friction real channel: a bot token from BotFather works instantly, with no business
 * verification. Useful to prove the loop end to end — not the channel Greek promoters use.
 */
class TelegramAdapter implements MessagingAdapter {
  readonly channel = "telegram" as const;

  constructor(private readonly botToken: string) {}

  async send(message: OutboundMessage): Promise<SendResult> {
    // Telegram addresses chats by id, not phone number. Until promoters are linked to a chat id
    // we cannot deliver, so we degrade to manual rather than pretending to have sent.
    const chatId = message.to.phone.startsWith("tg:")
      ? message.to.phone.slice(3)
      : null;

    if (!chatId) {
      return {
        delivered: false,
        channel: this.channel,
        manualBody: `${message.body}\n\n${message.url}`,
      };
    }

    const res = await fetch(
      `https://api.telegram.org/bot${this.botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `${message.body}\n\n${message.url}`,
        }),
      },
    );

    if (!res.ok) {
      return {
        delivered: false,
        channel: this.channel,
        manualBody: `${message.body}\n\n${message.url}`,
      };
    }

    return { delivered: true, channel: this.channel };
  }
}

/**
 * The adapter for sending to one specific person — P39.
 *
 * Email when Resend is configured (`RESEND_API_KEY` and `EMAIL_FROM`); the `EmailAdapter` itself
 * refuses a missing, malformed or reserved-domain address and hands back `getAdapter()`'s manual
 * result with a `reason`. With email unconfigured this is exactly `getAdapter()` — today's
 * behaviour, unchanged. The choice lives here so feature code never branches on a channel.
 *
 * `options.beforeRequest` lets a bulk sender pace every provider request (Resend's rate limit).
 */
export function getAdapterFor(
  options: EmailAdapterOptions = {},
  env: Record<string, string | undefined> = process.env,
): MessagingAdapter {
  const fallback = getAdapter();
  const config = emailConfigFrom(env);
  if (!config) return fallback;
  return new EmailAdapter(config, fallback, options);
}

/** True when automatic (unattended) delivery is possible at all. */
export function automaticDeliveryConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return emailConfigFrom(env) !== null;
}

export function getAdapter(): MessagingAdapter {
  const configured = process.env.MESSAGING_ADAPTER ?? "clipboard";

  if (configured === "telegram") {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token) return new TelegramAdapter(token);
    // Misconfiguration must not silently drop invitations.
    console.warn("MESSAGING_ADAPTER=telegram but TELEGRAM_BOT_TOKEN is unset; using clipboard");
  }

  return new ClipboardAdapter();
}
