/**
 * P30 — the promoter's own availability LINK.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS LEFT IN THIS FILE, AND WHY (A1-09)
 * ---------------------------------------------------------------------------
 * Only the signed link. Everything pure — the Athens date arithmetic, the hour lists, `DayState`,
 * `summariseDay`, `planRow` — moved to `lib/availability-dates.ts` and is re-exported below, so
 * no existing import had to change. The split exists because this module reaches `lib/tokens.ts`,
 * which reads `TOKEN_SIGNING_SECRET` and now carries `import "server-only"`: without the split,
 * that guardrail would have put a fortnight of date maths behind the same wall for no reason.
 *
 * Same shape as `lib/billing/subscription.ts` re-exporting `lib/billing/access.ts`.
 *
 * **This module is server-only by inheritance.** A client component that needs a date helper or
 * the hour lists must import `lib/availability-dates.ts` directly. Both availability grids already
 * take the hour lists as props and say so in their own comments; that remains the right pattern.
 *
 * ---------------------------------------------------------------------------
 * WHY THE TTL IS WEEKS AND NOT HOURS
 * ---------------------------------------------------------------------------
 * An invitation token (`lib/invitations.ts`, 24h) concerns exactly one shift: it is minted,
 * answered, and dead. An availability link is the opposite kind of object — the promoter keeps it
 * in their chat history and comes back to it whenever their month changes. A 24-hour link would
 * mean the coordinator re-sends a link every time someone wants to update a day, which is the
 * manual work `product-spec.md` §2 exists to remove.
 *
 * 56 days — eight weeks, exactly four of the two-week windows the page renders. Long enough that a
 * promoter who declares in September is still using the same link in October; short enough that an
 * anonymous, unrevokable credential dies on its own within two months, so a link forwarded to the
 * wrong chat stops working without anybody having to notice. Re-issuing is one tap for the
 * coordinator (`app/promoters/[id]/availability-link.tsx`), and an expired link says so and says
 * what to do about it rather than showing a dead page.
 *
 * There is NO stored `token_hash` for these links, unlike invitations — that would need a column
 * and this parcel adds no migration. The consequence is honest and written down: an availability
 * link cannot be revoked early, only out-waited (or cut off by archiving the promoter, which the
 * loader checks). See `docs/status/P30.md`.
 *
 * ---------------------------------------------------------------------------
 * WHY THE RECORD ID IS NAMESPACED
 * ---------------------------------------------------------------------------
 * `TokenPurpose` in `lib/tokens.ts` is `"invitation" | "checkin"`, and `lib/tokens.ts` is not this
 * parcel's file to widen. Rather than inventing a second signing scheme (explicitly not wanted),
 * we reuse `mintToken`/`verifyToken` unchanged and carry the purpose in the signed record id:
 * `availability:<promoter uuid>`. The HMAC covers the payload, so the prefix cannot be forged or
 * stripped, and the checks compose:
 *
 *   - an invitation token presented at `/a/[token]` carries a bare uuid → rejected, `wrong_purpose`
 *   - an availability token presented at `/i/[token]` or `/c/[token]` resolves to a record id that
 *     is not a uuid, so the lookup finds nothing and those pages return `not_found`
 *
 * When someone owns `lib/tokens.ts` again, adding `"availability"` to `TokenPurpose` lets this
 * prefix be deleted with no change to anything else. Requested in `docs/status/P30.md`.
 */

import { mintToken, verifyToken } from "@/lib/tokens";

/**
 * A1-09 — the pure half, re-exported so every existing `@/lib/availability-links` import keeps
 * working. New code, and anything that might ever run in the browser, should import
 * `@/lib/availability-dates` directly.
 */
export * from "@/lib/availability-dates";

export const AVAILABILITY_TTL_DAYS = 56;
export const AVAILABILITY_TTL_SECONDS = AVAILABILITY_TTL_DAYS * 24 * 60 * 60;

/** The purpose we piggyback on. See the header. */
const CARRIER_PURPOSE = "invitation" as const;
const RECORD_PREFIX = "availability:";

export function mintAvailabilityToken(
  promoterId: string,
  ttlSeconds: number = AVAILABILITY_TTL_SECONDS,
): { token: string; expiresAt: Date } {
  const { token, expiresAt } = mintToken(
    CARRIER_PURPOSE,
    `${RECORD_PREFIX}${promoterId}`,
    ttlSeconds,
  );
  return { token, expiresAt };
}

export type AvailabilityTokenResult =
  | { ok: true; promoterId: string }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" | "wrong_purpose" };

export function verifyAvailabilityToken(token: string): AvailabilityTokenResult {
  const verified = verifyToken(token, CARRIER_PURPOSE);
  if (!verified.ok) return { ok: false, reason: verified.reason };

  if (!verified.recordId.startsWith(RECORD_PREFIX)) {
    // A perfectly valid invitation token. Correct signature, wrong kind of link.
    return { ok: false, reason: "wrong_purpose" };
  }

  const promoterId = verified.recordId.slice(RECORD_PREFIX.length);
  if (promoterId.length === 0) return { ok: false, reason: "malformed" };

  return { ok: true, promoterId };
}

/**
 * `/a/` for availability, matching `/i/` for invitation and `/c/` for check-in.
 * `linkFor()` in `lib/tokens.ts` only knows those two paths and is not ours to extend.
 */
export function availabilityLinkFor(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/a/${token}`;
}
