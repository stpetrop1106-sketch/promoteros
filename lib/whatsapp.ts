/**
 * WhatsApp "click to chat" links — https://wa.me/<number>?text=<message>.
 *
 * Not a messaging adapter and not a provider SDK (CLAUDE.md, "Messaging"): nothing is sent. The link
 * opens WhatsApp on the coordinator's own phone or desktop with the message already typed, and the
 * coordinator presses send. That is the same human-in-the-loop step as the clipboard adapter, minus
 * the clipboard — which matters, because the async Clipboard API is refused outright inside many
 * embedded browsers, and an in-app browser is exactly where a coordinator opens links from WhatsApp.
 *
 * Pure and client-safe on purpose: no `server-only`, no environment.
 */

/**
 * The international form WhatsApp wants: digits only, country code first, no `+` and no leading
 * zeros. Greek numbers are stored the way people type them (`6912345678`, `+30 691 234 5678`,
 * `0030691...`), so a bare ten-digit Greek mobile or landline gets `30` in front.
 *
 * Returns null for anything that cannot be a real number rather than producing a wa.me link that
 * opens a "this number is not on WhatsApp" dead end.
 */
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  // Ten digits starting 69 (mobile) or 2 (landline) is a Greek number written without its code.
  if (digits.length === 10 && /^(69|2)/.test(digits)) digits = `30${digits}`;
  // E.164 allows at most 15 digits; anything under 10 is not a dialable international number.
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

/** A wa.me link with the message prefilled, or null when the phone cannot be used. */
export function whatsappUrl(phone: string | null | undefined, text: string): string | null {
  const number = toWhatsAppNumber(phone);
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
