import "server-only";
import { headers } from "next/headers";
import { createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Rate limiting for the anonymous promoter endpoints — `/i`, `/c` and `/a`.
 *
 * Backed by `endpoint_rate_limit` (supabase/migrations/0019), NOT by a counter in memory. The
 * first version of this lived in `middleware.ts` and kept its counters in a module-level Map. It
 * was verified on a dev server — 60 allowed, 15 refused — and then did nothing whatsoever in
 * production, where 75 concurrent and 70 sequential requests were all answered 200, because
 * Vercel spreads requests across short-lived instances that each start with an empty Map.
 * `lib/waitlist/rate-limit.ts` had already said so in its own header. This is the same pattern.
 *
 * It sits at the top of the page rather than in middleware because the counter has to live in
 * Postgres, and reaching Postgres needs the service-role client, which belongs in the Node
 * runtime and not in an Edge bundle.
 *
 * WHAT IT COSTS AND WHAT IT BUYS. The check is itself one database round trip, so a flood still
 * touches the database once per request — that is inherent to any shared-state limiter and the
 * waitlist accepted the same trade. What it removes is the unbounded part: three reads plus a
 * full render per request, for as long as someone cares to keep going.
 */

const WINDOW_MS = 60 * 1000;

/**
 * Sixty a minute, per address, per family of link.
 *
 * Deliberately generous. Greek mobile carriers put many subscribers behind one address, so
 * several promoters opening their links from the same network must not collide. A real promoter
 * loads a handful of pages in a minute; a script loads thousands.
 */
const PER_MINUTE = 60;

export type PromoterBucket = "invitation" | "checkin" | "availability";

export type LimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

function hashIp(ip: string): string {
  const secret = process.env.TOKEN_SIGNING_SECRET;
  if (!secret) throw new Error("TOKEN_SIGNING_SECRET is not set");
  // Same salt and construction as the waitlist limiter: the hash is one-way to anyone without
  // the signing secret, and a raw address is never written down.
  return createHmac("sha256", secret).update(ip).digest("hex");
}

async function clientIp(): Promise<string> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  const first = forwardedFor?.split(",")[0]?.trim();
  if (first && first.length > 0) return first;
  return headerList.get("x-real-ip")?.trim() || "unknown";
}

function windowStart(now: number): { iso: string; endsAt: number } {
  const start = Math.floor(now / WINDOW_MS) * WINDOW_MS;
  return { iso: new Date(start).toISOString(), endsAt: start + WINDOW_MS };
}

/**
 * Counts one request against the caller's budget for this bucket.
 *
 * Fails OPEN if the counter itself cannot be reached. The page that follows talks to the same
 * database and will fail on its own if it is genuinely down, so failing closed here would only
 * add a second, silent way to keep a promoter out of their own shift during a hiccup — and
 * CLAUDE.md §3's rule, that infrastructure must never be the sole thing standing between someone
 * and their work, points the same way.
 */
export async function checkPromoterRateLimit(
  bucket: PromoterBucket,
  now: number = Date.now(),
): Promise<LimitResult> {
  const { iso, endsAt } = windowStart(now);
  const retryAfterSeconds = Math.max(1, Math.ceil((endsAt - now) / 1000));

  let ipHash: string;
  try {
    ipHash = hashIp(await clientIp());
  } catch {
    return { allowed: true };
  }

  const db = createAdminClient();
  const { data, error } = await db.rpc("increment_endpoint_rate_limit", {
    p_bucket: bucket,
    p_ip_hash: ipHash,
    p_window_start: iso,
  });

  if (error) {
    console.error("Promoter rate limit check failed", { code: error.code, bucket });
    return { allowed: true };
  }

  const count = typeof data === "number" ? data : Number(data ?? 0);
  if (count > PER_MINUTE) return { allowed: false, retryAfterSeconds };

  return { allowed: true };
}

/** Rows from windows that have closed. Swept daily; see app/api/cron/daily/route.ts. */
export async function sweepEndpointRateLimit(now: Date = new Date()): Promise<number | null> {
  const db = createAdminClient();
  const cutoff = new Date(now.getTime() - WINDOW_MS * 2).toISOString();

  const { data, error } = await db
    .from("endpoint_rate_limit")
    .delete()
    .lt("window_start", cutoff)
    .select("bucket");

  if (error) {
    console.error("Endpoint rate limit sweep failed", { code: error.code });
    return null;
  }
  return data?.length ?? 0;
}
