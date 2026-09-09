/**
 * Every failure an admin RPC (0013_admin.sql) can raise, plus the ones this layer adds.
 *
 * Codes rather than sentences, same reasoning as `lib/team.ts`: the sentence belongs in
 * `lib/i18n/el.ts`/`en.ts`, and "Something went wrong" is banned by commercial-architecture §6 —
 * every one of these maps to a specific message that says what to do next.
 */
export const ADMIN_ERROR_CODES = [
  "not_platform_admin",
  "action_required",
  "reason_required",
  "agency_not_found",
  "invalid_days",
  "invalid_plan",
  "already_suspended",
  "not_suspended",
  "unknown",
] as const;

export type AdminErrorCode = (typeof ADMIN_ERROR_CODES)[number];

const CODE_SET = new Set<string>(ADMIN_ERROR_CODES);

/**
 * The functions in `0013_admin.sql` raise the code as the whole exception message, so the
 * common case is an exact match. The substring pass is for the day PostgREST decorates it; an
 * unrecognised message becomes `unknown`, rendered as a real sentence with a retry — never a raw
 * database string, which could leak schema detail into a support tool of all places.
 */
export function adminErrorCode(message: string | null | undefined): AdminErrorCode {
  if (!message) return "unknown";

  const trimmed = message.trim();
  if (CODE_SET.has(trimmed)) return trimmed as AdminErrorCode;

  for (const code of ADMIN_ERROR_CODES) {
    if (code !== "unknown" && trimmed.includes(code)) return code;
  }

  return "unknown";
}

/**
 * Enforced both here (defence in depth for a form submitted with JS disabled or tampered with)
 * and at the database (`admin_audit_log.reason` check constraint, `_admin_write_audit`). Kept in
 * one place so the client-side `minLength` hint and the server-side check never drift apart.
 */
export const REASON_MIN_LENGTH = 10;
