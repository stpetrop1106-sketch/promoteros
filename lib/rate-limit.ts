/**
 * A fixed-window request counter, and nothing more.
 *
 * Why this exists: the promoter-facing token routes (`/i`, `/c`, `/a`) had no limit of any kind.
 * The A3 audit fired 40 requests at `/i/<garbage>` and 25 at a valid `/a/<token>` and got 40 and
 * 25 answers, every one of them costing two database reads through the service-role client. The
 * signature is not brute-forceable, so what is at stake is availability and our Supabase bill,
 * and the long-lived availability link (eight weeks, not revocable) makes a leaked URL worth
 * hammering. P16 lists a limiter as a must.
 *
 * WHAT THIS IS NOT. The counter lives in the memory of one server instance. Vercel runs several,
 * and recycles them, so the real-world limit is "per instance, until it is recycled" — a
 * determined attacker spreading requests across instances gets a multiple of `limit`. That is a
 * deliberate trade: it removes the trivial case (one script, one IP, no ceiling at all) with no
 * new infrastructure, no new dependency and no key to buy. A shared store (Upstash/Vercel KV) is
 * what makes the number exact, and that is an infrastructure decision with a bill attached —
 * recorded in docs/audit/security.md rather than assumed here.
 *
 * Deliberately NOT keyed on the token. Keying on the credential would let anyone lock a specific
 * promoter out of their own shift by replaying their link, which turns a limiter into a denial of
 * service against the person it is meant to protect.
 */

export type RateLimitDecision = {
  allowed: boolean;
  /** Requests still available in this window. Zero once the limit is reached. */
  remaining: number;
  /** Whole seconds until the current window ends — what `Retry-After` wants. */
  retryAfterSeconds: number;
};

type Window = { count: number; resetAt: number };

/**
 * Bucketing by `floor(now / windowMs)` rather than by a rolling timestamp list: one integer per
 * caller instead of an array, and no way for a long-lived key to grow without bound.
 */
export function decide(
  windows: Map<string, Window>,
  key: string,
  now: number,
  limit: number,
  windowMs: number,
): RateLimitDecision {
  const existing = windows.get(key);
  const window =
    existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: Math.floor(now / windowMs) * windowMs + windowMs };

  window.count += 1;
  windows.set(key, window);

  const retryAfterSeconds = Math.max(1, Math.ceil((window.resetAt - now) / 1000));

  return {
    allowed: window.count <= limit,
    remaining: Math.max(0, limit - window.count),
    retryAfterSeconds,
  };
}

/**
 * Drops windows that have already ended. Called on a fraction of requests rather than on every
 * one, because the map is small and walking it is not free; an instance that is being hammered
 * is exactly the instance that should not be doing extra work per request.
 */
export function sweep(windows: Map<string, Window>, now: number): number {
  let removed = 0;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) {
      windows.delete(key);
      removed += 1;
    }
  }
  return removed;
}

const MAX_KEYS = 10_000;

/** A limiter bound to one in-memory map. One per process. */
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const windows = new Map<string, Window>();

  return {
    check(key: string, now: number = Date.now()): RateLimitDecision {
      // A cheap ceiling on memory: if an attacker rotates keys faster than windows expire, drop
      // everything expired, and if that is not enough, start again rather than grow forever.
      if (windows.size > MAX_KEYS) {
        sweep(windows, now);
        if (windows.size > MAX_KEYS) windows.clear();
      }
      return decide(windows, key, now, limit, windowMs);
    },
    get size() {
      return windows.size;
    },
  };
}
