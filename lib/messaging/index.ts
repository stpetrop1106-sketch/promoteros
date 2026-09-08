/**
 * Messaging adapters.
 *
 * WhatsApp business verification and template approval take 3–10 business days and are outside
 * our control, so nothing in the product may depend on a specific channel being available.
 * Feature code calls `getAdapter().sendInvitation(...)` and never touches a provider SDK.
 *
 * Add adapters, not conditionals. See decisions.md D3.
 */

export type OutboundMessage = {
  to: { name: string; phone: string };
  body: string;
  url: string;
};

export type SendResult =
  | { delivered: true; channel: Channel }
  | { delivered: false; channel: Channel; manualBody: string };

export type Channel = "clipboard" | "telegram" | "whatsapp" | "viber" | "sms";

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
