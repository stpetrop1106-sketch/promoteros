/**
 * P39 — which automatic send is due, by the agency's wall clock.
 *
 * PURE: `now` is always a parameter. Every date here is an Athens calendar date, never a UTC one.
 * The owner said "on the 1st and the 15th", and a promoter in Athens reads those as Athens dates —
 * at 23:30 UTC on the 14th it is already 02:30 on the 15th in Athens (01:30 in winter), and that
 * is the 15th.
 */

import { athensToday, addDaysIso } from "@/lib/availability-links";

export const WELCOME_PERIOD_KEY = "welcome";

/** The Athens days of the month on which every active promoter gets their link again. */
export const AVAILABILITY_DAYS = [1, 15] as const;

/**
 * `"YYYY-MM-01"` or `"YYYY-MM-15"` when it is the 1st or the 15th in Athens, otherwise null.
 * The key names the occurrence, so a second run on the same Athens day claims the same rows and
 * sends nothing new.
 */
export function periodKeyFor(now: Date = new Date()): string | null {
  const today = athensToday(now);
  const day = Number(today.slice(8, 10));
  return (AVAILABILITY_DAYS as readonly number[]).includes(day) ? today : null;
}

/**
 * The owner's "send now" — at most once per Athens day. A second press the same day claims the
 * same rows, so it re-tries only the people who were skipped or failed, never someone already sent.
 */
export function manualPeriodKey(now: Date = new Date()): string {
  return `manual-${athensToday(now)}`;
}

/** The next Athens date (today included) on which the automatic send runs. `YYYY-MM-DD`. */
export function nextAvailabilityDate(now: Date = new Date()): string {
  const today = athensToday(now);
  const day = Number(today.slice(8, 10));
  const month = today.slice(0, 7);
  if (day <= 1) return `${month}-01`;
  if (day <= 15) return `${month}-15`;
  // First of next month: step past the month's last day from the 28th, which every month has.
  const nextMonth = addDaysIso(`${month}-28`, 4).slice(0, 7);
  return `${nextMonth}-01`;
}

/** True for a period key produced by the cron or the manual send, not the welcome. */
export function isRunPeriodKey(key: string): boolean {
  return /^\d{4}-\d{2}-(01|15)$/.test(key) || /^manual-\d{4}-\d{2}-\d{2}$/.test(key);
}
