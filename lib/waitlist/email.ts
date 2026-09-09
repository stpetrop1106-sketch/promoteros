/**
 * Waitlist confirmation email, behind an adapter — same shape as `lib/messaging/index.ts` and
 * for the same reason: feature code must not care which provider (or no provider) is behind
 * it, and the product must work with zero configuration.
 *
 * The default is `NullEmailAdapter`: it logs and sends nothing. That is not a placeholder to
 * "finish later" — it is the correct behaviour with no `RESEND_API_KEY` set, because the
 * signup row is already saved in `waitlist_signups` regardless of whether a confirmation
 * email goes out. See docs/keys-needed.md §1.
 *
 * A failed or skipped email must never fail the signup itself — callers wrap this in a
 * try/catch and ignore the result beyond logging.
 */

export type WaitlistConfirmation = {
  to: { name: string; email: string };
};

export type EmailSendResult =
  | { sent: true }
  | { sent: false; reason: "not_configured" | "provider_error" };

export interface EmailAdapter {
  sendWaitlistConfirmation(message: WaitlistConfirmation): Promise<EmailSendResult>;
}

/**
 * The default. Logs that a confirmation *would* be sent, without the recipient's address —
 * the existing waitlist code logs only error codes and identifiers, never personal data, and
 * this keeps that rule.
 */
class NullEmailAdapter implements EmailAdapter {
  async sendWaitlistConfirmation(): Promise<EmailSendResult> {
    console.log("Waitlist confirmation email skipped: no RESEND_API_KEY configured.");
    return { sent: false, reason: "not_configured" };
  }
}

/**
 * Live provider, used once RESEND_API_KEY is set. Greek first, English underneath — the
 * registrant's locale is not tracked on `waitlist_signups`, so this does not attempt to pick
 * one; both are short enough that showing both costs nothing.
 */
class ResendAdapter implements EmailAdapter {
  constructor(
    private readonly apiKey: string,
    private readonly fromAddress: string,
  ) {}

  async sendWaitlistConfirmation(message: WaitlistConfirmation): Promise<EmailSendResult> {
    const subject = "Καταχωρήθηκε η εγγραφή σου στο PromoterOS / You're on the PromoterOS waitlist";
    const body = [
      `Γεια σου ${message.to.name},`,
      "",
      "Η εγγραφή σου στη waitlist του PromoterOS καταχωρήθηκε. Θα επικοινωνήσουμε όταν ανοίξει το early access.",
      "",
      "—",
      "",
      `Hi ${message.to.name},`,
      "",
      "Your PromoterOS waitlist registration is saved. We'll reach out when early access opens.",
    ].join("\n");

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: this.fromAddress,
          to: message.to.email,
          subject,
          text: body,
        }),
      });

      if (!res.ok) {
        console.error("Waitlist confirmation email failed", { status: res.status });
        return { sent: false, reason: "provider_error" };
      }

      return { sent: true };
    } catch (error) {
      console.error("Waitlist confirmation email could not be sent", {
        error: error instanceof Error ? error.name : "unknown",
      });
      return { sent: false, reason: "provider_error" };
    }
  }
}

export function getEmailAdapter(): EmailAdapter {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return new NullEmailAdapter();

  const fromAddress = process.env.RESEND_FROM_ADDRESS ?? process.env.NEXT_PUBLIC_PRIVACY_EMAIL;
  if (!fromAddress) {
    console.warn(
      "RESEND_API_KEY is set but RESEND_FROM_ADDRESS (and NEXT_PUBLIC_PRIVACY_EMAIL) are both unset; using NullEmailAdapter",
    );
    return new NullEmailAdapter();
  }

  return new ResendAdapter(apiKey, fromAddress);
}
