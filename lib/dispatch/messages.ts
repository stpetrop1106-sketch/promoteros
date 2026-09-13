/**
 * P39 — the words of every automatic message.
 *
 * One builder per message, used by BOTH the automatic send and the coordinator's manual list on
 * /settings/messaging, so the promoter reads the same thing whichever way it reached them. Every
 * string goes through `t()`; the availability wording reuses P30's keys so the email and the
 * WhatsApp message a coordinator pastes by hand never drift apart.
 *
 * No Supabase. Minting needs `TOKEN_SIGNING_SECRET`, nothing else.
 */

import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { availabilityLinkFor, mintAvailabilityToken } from "@/lib/availability-links";
import type { OutboundMessage } from "@/lib/messaging";

const t = translatorFor(DEFAULT_LOCALE);

export type Recipient = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
};

export type AvailabilityOccasion = "welcome" | "periodic";

/** First name only in a greeting — "Γεια σου Μαρία Παπαδοπούλου!" reads like a form letter. */
export function firstName(fullName: string): string {
  const trimmed = fullName.trim();
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export function availabilityMessage(
  recipient: Recipient,
  occasion: AvailabilityOccasion,
  agencyName: string | null,
): OutboundMessage {
  const { token } = mintAvailabilityToken(recipient.id);
  const url = availabilityLinkFor(token);

  const intro =
    occasion === "welcome"
      ? agencyName
        ? t("messaging.availability.welcome_intro", { agency: agencyName })
        : t("messaging.availability.welcome_intro_no_agency")
      : agencyName
        ? t("messaging.availability.periodic_intro", { agency: agencyName })
        : t("messaging.availability.periodic_intro_no_agency");

  const body = [
    t("availability_link.message.greeting", { name: firstName(recipient.fullName) }),
    intro,
    t("availability_link.message.body"),
  ].join("\n");

  return {
    to: { name: recipient.fullName, phone: recipient.phone, email: recipient.email },
    body,
    url,
    subject:
      occasion === "welcome"
        ? t("messaging.email.availability.subject_welcome")
        : t("messaging.email.availability.subject_periodic"),
    actionLabel: t("messaging.email.availability.action"),
  };
}

export type CheckinShift = {
  campaignName: string;
  storeName: string;
  startTime: string;
  endTime: string;
};

export function checkinMessage(recipient: Recipient, shift: CheckinShift, url: string): OutboundMessage {
  const start = shift.startTime.slice(0, 5);
  const end = shift.endTime.slice(0, 5);
  const where = [shift.campaignName, shift.storeName].filter(Boolean).join(" · ");

  const body = [
    t("availability_link.message.greeting", { name: firstName(recipient.fullName) }),
    t("messaging.checkin.today", { where, start, end }),
    t("messaging.checkin.instruction"),
  ].join("\n");

  return {
    to: { name: recipient.fullName, phone: recipient.phone, email: recipient.email },
    body,
    url,
    subject: t("messaging.email.checkin.subject", { start }),
    actionLabel: t("messaging.email.checkin.action"),
  };
}

/** What a coordinator pastes: the same text the email carries, link last. */
export function manualText(message: Pick<OutboundMessage, "body" | "url">): string {
  return `${message.body}\n\n${message.url}`;
}
