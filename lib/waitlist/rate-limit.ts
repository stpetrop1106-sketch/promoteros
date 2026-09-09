import { headers } from "next/headers";
import { createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Database-backed rate limiting for the public waitlist endpoint.
 *
 * `joinWaitlist` is unauthenticated and writes to the database. Posted to a community, it
 * meets bots. An in-memory counter would be per-process and reset on every deploy or cold
 * start — on serverless that is effectively no limit at all — so this is backed by
 * `waitlist_rate_limit` (supabase/migrations/0010_waitlist_hardening.sql).
 *
 * Keyed by a HASHED ip, never a raw one: an IP address is personal data under GDPR and we
 * have no product reason to retain it. The hash uses `TOKEN_SIGNING_SECRET` as salt so it
 * cannot be reversed by anyone without that secret, and is not reused for anything else.
 */

const WINDOW_MS = 60 * 60 * 1000; // one hour, fixed window
const PER_IP_LIMIT = 3; // roughly 3 submissions per IP per hour
const GLOBAL_LIMIT = 200; // circuit breaker: a flood spread across many IPs at once
const CLEANUP_AGE_MS = WINDOW_MS * 2; // keep the current and previous window only

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: "per_ip" | "global" };

function hashIp(ip: string): string {
  const secret = process.env.TOKEN_SIGNING_SECRET;
  if (!secret) throw new Error("TOKEN_SIGNING_SECRET is not set");
  return createHmac("sha256", secret).update(ip).digest("hex");
}

async function clientIp(): Promise<string> {
  const headerList = await headers();
  // x-forwarded-for can carry a chain (client, proxy, proxy...); the first entry is the
  // original client as seen by the edge. Vercel sets this on every request.
  const forwardedFor = headerList.get("x-forwarded-for");
  const first = forwardedFor?.split(",")[0]?.trim();
  return first && first.length > 0 ? first : "unknown";
}

function currentWindowStart(): string {
  const windowMs = Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS;
  return new Date(windowMs).toISOString();
}

/**
 * Checks and records one submission attempt. Call this once, after basic validation and the
 * honeypot check, and before writing to `waitlist_signups`.
 *
 * Fails OPEN on any infrastructure error reaching the rate-limit table itself: the signup
 * insert that follows hits the same database and will fail on its own if it is genuinely
 * unreachable, so failing closed here would only add a second, silent way to block a real
 * signup during a database hiccup.
 */
export async function checkWaitlistRateLimit(): Promise<RateLimitResult> {
  const ip = await clientIp();
  const ipHash = hashIp(ip);
  const windowStart = currentWindowStart();
  const db = createAdminClient();

  // Opportunistic cleanup so the table cannot grow without bound. A cheap, indexed range
  // delete; running it on every check keeps the table small without a scheduled job. Never
  // allowed to block or fail a submission.
  const cutoff = new Date(Date.now() - CLEANUP_AGE_MS).toISOString();
  const { error: cleanupError } = await db
    .from("waitlist_rate_limit")
    .delete()
    .lt("window_start", cutoff);
  if (cleanupError) {
    console.error("Waitlist rate limit cleanup failed", { code: cleanupError.code });
  }

  // Atomic increment-and-read via the SQL function in the migration. A plain
  // select-then-insert-or-update from application code would race: two concurrent requests
  // from the same IP could both read "0" and both be let through.
  const { data: ipCount, error: incrementError } = await db.rpc(
    "increment_waitlist_rate_limit",
    { p_ip_hash: ipHash, p_window_start: windowStart },
  );

  if (incrementError) {
    console.error("Waitlist rate limit check failed", { code: incrementError.code });
    return { allowed: true };
  }

  if (typeof ipCount === "number" && ipCount > PER_IP_LIMIT) {
    return { allowed: false, reason: "per_ip" };
  }

  // Global circuit breaker: sum every ip_hash's counter for the current window. Read-only,
  // so a race here at worst lets a handful of extra requests through in the same window —
  // acceptable for a breaker whose job is to catch a flood, not to be exact.
  const { data: windowRows, error: globalError } = await db
    .from("waitlist_rate_limit")
    .select("request_count")
    .eq("window_start", windowStart);

  if (globalError) {
    console.error("Waitlist global rate limit check failed", { code: globalError.code });
    return { allowed: true };
  }

  const total = (windowRows ?? []).reduce((sum, row) => sum + row.request_count, 0);
  if (total > GLOBAL_LIMIT) {
    return { allowed: false, reason: "global" };
  }

  return { allowed: true };
}
