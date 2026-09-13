import { createHash, timingSafeEqual } from "node:crypto";

/**
 * P39 — is this request the scheduler?
 *
 * Vercel Cron calls the route with `Authorization: Bearer <CRON_SECRET>`. Anything else — no
 * header, a different scheme, a near-miss — is refused, and with `CRON_SECRET` unset EVERYTHING is
 * refused: an unconfigured deployment must not expose "email every promoter" to the internet.
 *
 * Constant time: both sides are hashed to 32 bytes first, so `timingSafeEqual` never sees buffers
 * of different lengths (which would throw, and whose early exit would leak the secret's length).
 */
export function isAuthorizedCronRequest(
  authorizationHeader: string | null | undefined,
  secret: string | null | undefined,
): boolean {
  if (!secret) return false;
  if (typeof authorizationHeader !== "string") return false;

  const expected = createHash("sha256").update(`Bearer ${secret}`, "utf8").digest();
  const presented = createHash("sha256").update(authorizationHeader, "utf8").digest();
  return timingSafeEqual(expected, presented);
}
