/**
 * A3-06 — what "cut off" means, in one place.
 *
 * PURE on purpose, like `lib/retention.ts` and `lib/billing/access.ts`: no Supabase, no network,
 * no `server-only`. It exists because the same rule was previously written in exactly one of the
 * four places that needed it.
 *
 * ---------------------------------------------------------------------------
 * WHY `paused` STILL COUNTS AS ACTIVE
 * ---------------------------------------------------------------------------
 * `app/a/[token]/data.ts` already made this distinction and its reasoning holds everywhere:
 * archiving and blocklisting are what a coordinator records when cooperation has ENDED — including
 * after an incident — so the links stop working without waiting out a token's TTL. `paused` is a
 * promoter taking a break; a paused promoter declaring next month's availability, or answering an
 * invitation that was already sent, is exactly how they come back. Blocking them would be a
 * different product decision, and not one this fix is entitled to make.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS DOES NOT GATE
 * ---------------------------------------------------------------------------
 * The field report. Someone who has already stood in the store for eight hours must still be able
 * to file what they saw, whatever happened afterwards — blocking that punishes the promoter by
 * throwing away the client's data. `submitFieldReport` and `attachReportPhoto` in
 * `lib/checkins.ts` are deliberately left open, and say so at the call site.
 */

/** The statuses that mean "cooperation has ended". Anything else is workable. */
const REVOKED_STATUSES = new Set(["archived", "blocklisted"]);

/**
 * `undefined` is treated as active on purpose: a missing embed must never silently lock a
 * promoter out of a shift they were invited to. The database is the record; an absent join is a
 * bug in the query, and it should look like one rather than like a blocklisting.
 */
export function isActivePromoterStatus(status: string | null | undefined): boolean {
  if (status === null || status === undefined) return true;
  return !REVOKED_STATUSES.has(status);
}
