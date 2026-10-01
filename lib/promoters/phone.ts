/**
 * S1 — one definition of a promoter's phone number, because it is the identity rule.
 *
 * This was a private function inside `app/promoters/actions.ts`. The bulk importer has to decide
 * "is this person already on the roster?" using EXACTLY the rule the manual form uses, and a
 * `"use server"` module may export nothing but async functions (CLAUDE.md), so it could not simply
 * be exported from there. Copying it would have been worse: two normalisers that drift apart mean
 * the importer creates the duplicates the form refuses. It lives here and both import it.
 *
 * Pure and client-safe — the import wizard normalises in the browser to show the coordinator what
 * will happen, and the server re-normalises everything it is sent.
 */

/**
 * Normalises a phone number to a consistent shape before it ever reaches the
 * `unique (agency_id, phone)` constraint. Two coordinators typing "6971234567" and
 * "+30 697 123 4567" must collide, not create two rows for the same person.
 */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  if (hasPlus) return `+${digits}`;
  // A 10-digit Greek mobile typed without a country code — the overwhelming common case.
  if (digits.length === 10 && digits.startsWith("6")) return `+30${digits}`;
  return digits;
}

/**
 * The same presence rule the promoter form applies (`phoneRaw.length < 6`), stated once so the
 * importer cannot accidentally be more permissive than the screen it is bulk-filling.
 */
export function isUsablePhone(raw: string): boolean {
  return raw.trim().length >= 6 && /\d/.test(raw);
}
