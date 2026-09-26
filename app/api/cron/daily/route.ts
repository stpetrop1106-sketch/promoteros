import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/dispatch/cron-auth";
import { periodKeyFor } from "@/lib/dispatch/period";
import { runAvailabilityLinks, runCheckinLinks, type RunSummary } from "@/lib/dispatch/run";
import { automaticDeliveryConfigured } from "@/lib/messaging";
import { athensToday } from "@/lib/availability-links";
import { sweepOrphanedPhotos, type SweepResult } from "@/lib/photo-sweep";
import { sweepWaitlistRateLimit } from "@/lib/waitlist/rate-limit";
import { sweepEndpointRateLimit } from "@/lib/promoter-rate-limit";

/**
 * P39 — the one daily job.
 *
 * Vercel's Hobby plan runs a cron job at most once a day, so every piece of daily work lives
 * behind this one route. Schedule (`vercel.json`): `0 4 * * *`, 04:00 UTC — 07:00 in Athens in
 * summer, 06:00 in winter. Early enough that a promoter has today's check-in link before a
 * morning shift, and safely past midnight in Athens in both seasons, so "today" and "the 15th"
 * are never read off the wrong side of a date line. (Hobby cron fires somewhere inside the hour.)
 *
 *   every day        check-in links for today's confirmed assignments
 *   1st and 15th     availability links to every active promoter (Athens dates)
 *
 * Authorization is `Bearer ${CRON_SECRET}`, compared in constant time; with `CRON_SECRET` unset
 * every request is refused. Idempotent: `message_dispatches`' unique key means calling this twice
 * — a manual re-trigger, an overlapping run — emails nobody twice.
 *
 * The response is counts only. No names, no addresses, no ids.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/**
 * Seconds. 300 is the Hobby ceiling with Fluid compute (the default for new projects). The run
 * stops STARTING new sends at `BUDGET_MS`, leaving room to record the last ones and respond.
 */
export const maxDuration = 300;

const BUDGET_MS = 240_000;

/**
 * The photo sweep's share of the run. Small and fixed: it is housekeeping, and it must never be
 * the reason a promoter's check-in link for this morning did not go out.
 */
const SWEEP_BUDGET_MS = 25_000;

type Section = { ran: boolean; periodKey?: string | null; counts?: RunSummary; error?: string };

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  const deadline = startedAt.getTime() + BUDGET_MS;
  const todayIso = athensToday(startedAt);
  const periodKey = periodKeyFor(startedAt);

  // Housekeeping first, and deliberately outside the email branch below: orphaned photo files
  // accumulate whether or not a messaging channel is configured. Failures are reported, never
  // thrown — a bucket problem must not stop the links going out.
  let photoSweep: SweepResult | { error: string };
  try {
    photoSweep = await sweepOrphanedPhotos({ budgetMs: SWEEP_BUDGET_MS });
  } catch (err) {
    photoSweep = { error: err instanceof Error ? err.message : "failed" };
  }

  // A1-11. The waitlist limiter sweeps itself, but only while the form is being used; with no
  // traffic its rows sit there indefinitely, and it is the same table an anonymous caller could
  // inflate. Null means the delete failed and said so in the log.
  const waitlistRowsSwept = await sweepWaitlistRateLimit(startedAt);

  // The promoter endpoints' own counter (0019). One-minute windows, so this table turns over fast
  // and would otherwise keep every closed window forever.
  const endpointRowsSwept = await sweepEndpointRateLimit(startedAt);

  if (!automaticDeliveryConfigured()) {
    // Today's behaviour, unchanged: no channel can send unattended, so nothing is attempted and
    // nothing is recorded. Said plainly so a manager reading the cron log knows why.
    return NextResponse.json({
      ok: true,
      emailConfigured: false,
      athensDate: todayIso,
      checkinLinks: { ran: false },
      availabilityLinks: { ran: false, periodKey },
      photoSweep,
      waitlistRowsSwept,
      endpointRowsSwept,
    });
  }

  // Check-in links first: they are about today, and a long availability run must never be the
  // reason someone's check-in link for this morning did not go out.
  const checkinLinks: Section = { ran: true };
  try {
    checkinLinks.counts = await runCheckinLinks({ todayIso, deadline });
  } catch (err) {
    checkinLinks.error = err instanceof Error ? err.message : "failed";
  }

  const availabilityLinks: Section = { ran: periodKey !== null, periodKey };
  if (periodKey) {
    try {
      availabilityLinks.counts = await runAvailabilityLinks({
        periodKey,
        respectAutoSwitch: true,
        deadline,
      });
    } catch (err) {
      availabilityLinks.error = err instanceof Error ? err.message : "failed";
    }
  }

  const ok = !checkinLinks.error && !availabilityLinks.error;

  return NextResponse.json(
    {
      ok,
      emailConfigured: true,
      athensDate: todayIso,
      durationMs: Date.now() - startedAt.getTime(),
      checkinLinks,
      availabilityLinks,
      photoSweep,
      waitlistRowsSwept,
      endpointRowsSwept,
    },
    { status: ok ? 200 : 500 },
  );
}
