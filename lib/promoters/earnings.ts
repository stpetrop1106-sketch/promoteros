/**
 * What a promoter earned in a month, and which shifts that is made of.
 *
 * PURE and client-safe: no `server-only`, no database, no network. Everything here decides;
 * `app/promoters/[id]/earnings-data.ts` reaches Supabase. The money arithmetic itself is
 * `lib/shift-pay.ts` and is not repeated — there is exactly one pay calculation in this codebase
 * and this module calls it.
 *
 * ---------------------------------------------------------------------------------------------
 * WHAT COUNTS AS WORKED — D24, and why it is not `assignments.status`
 * ---------------------------------------------------------------------------------------------
 * `assignment_status` has had a `completed` value since the schema was written and **nothing in
 * the application has ever written it**. The live database holds confirmed and cancelled rows and
 * zero completed ones. So "payable = completed" would have produced €0 for everybody, for ever,
 * while looking like a working feature — a report that is confidently wrong is worse than one that
 * is missing.
 *
 * D24 is the owner's answer: **a shift is payable when the promoter declared arrival — a
 * `check_ins` row exists for the assignment — and the shift's date has passed.** The evidence
 * already exists, because the promoter taps "δήλωσα άφιξη" and `check_ins` records it, so nothing
 * new has to be remembered by a coordinator at the end of a long day. `cancelled` and `no_show`
 * are never payable, whatever a stray check-in row might say.
 *
 * ---------------------------------------------------------------------------------------------
 * THE RATE COMES FROM ONE PLACE
 * ---------------------------------------------------------------------------------------------
 * `resolveEffectiveRateCents()` below is the only function on this path that decides what a shift
 * paid. Today it resolves `shifts.rate_cents_override ?? campaigns.rate_cents`, which means
 * **history is mutable**: editing a campaign's rate today changes what the figures say somebody
 * earned in July. That is a real defect, it is the owner's §10 concern, and it needs a column that
 * freezes the rate on the assignment at the moment the work is recorded.
 *
 * The resolver is already written for that column — it reads `rateSnapshotCents` first and falls
 * through. The field is simply never populated yet, because the column does not exist. When the
 * migration lands, nothing in this file changes; the SELECT in `earnings-data.ts` names one more
 * column and the snapshot starts winning. See `docs/status/M1.md`.
 *
 * `shifts.rate_cents_override` is deliberately NOT reused as the snapshot. It means "this one
 * shift pays differently from its campaign", the shift-series form and the importer both write it,
 * and a coordinator editing it must keep meaning that. Overloading it would make a rate correction
 * indistinguishable from a historical record.
 *
 * ---------------------------------------------------------------------------------------------
 * NO UNPAID BREAKS
 * ---------------------------------------------------------------------------------------------
 * There is no break column anywhere in the schema. Paid duration is `end_time - start_time`, which
 * is what `lib/shift-pay.ts` computes and documents. Inventing a break here would underpay people
 * against a number the coordinator never entered.
 */

import { formatShiftHours, shiftDurationMinutes, shiftPayCents } from "@/lib/shift-pay";

const LOCALE = "el-GR";

/** The four values of the `assignment_status` enum, as they come out of Postgres. */
export type AssignmentStatusValue = "confirmed" | "cancelled" | "no_show" | "completed";

/**
 * Everything this module needs to know about one of a promoter's assignments.
 *
 * `camelCase` here, `snake_case` in the database; the mapping happens in `earnings-data.ts` at the
 * data-access boundary, as CLAUDE.md requires.
 */
export type PromoterShiftRow = {
  assignmentId: string;
  shiftId: string;
  status: AssignmentStatusValue;
  /** "YYYY-MM-DD", an Athens calendar date. */
  onDate: string;
  /** "HH:MM" or "HH:MM:SS". */
  startTime: string;
  endTime: string;
  clientName: string | null;
  campaignName: string | null;
  storeName: string | null;
  storeAddress: string | null;
  /** `campaigns.rate_cents`. `not null default 0` in the schema, so 0 means "never set". */
  campaignRateCents: number | null;
  /** `shifts.rate_cents_override` — this shift pays differently from its campaign. */
  shiftRateOverrideCents: number | null;
  /**
   * The rate frozen on the assignment when the work was recorded. **Always absent today** — the
   * column does not exist yet. Declared so the resolver below is already correct for the day it
   * does; see the file comment.
   */
  rateSnapshotCents?: number | null;
  /** True when a `check_ins` row exists for this assignment. The D24 evidence of arrival. */
  hasCheckIn: boolean;
  /** `check_ins.checked_in_at`, for the coordinator who wants to see when. */
  checkedInAt: string | null;
};

/** Just the rate-bearing fields, so a caller can resolve a rate without a whole row. */
export type RateSource = Pick<
  PromoterShiftRow,
  "campaignRateCents" | "shiftRateOverrideCents" | "rateSnapshotCents"
>;

/**
 * **The one place that decides what a shift paid per hour.** Everything about earnings goes
 * through here — there is no second rate expression anywhere on this path.
 *
 * Order, most specific first:
 *
 *   1. `rateSnapshotCents` — the rate frozen on the assignment when the work was recorded. This
 *      is the only one of the three that cannot be rewritten afterwards. It is always absent
 *      today (no column), so today this branch never fires.
 *   2. `shiftRateOverrideCents` — this one shift pays differently from its campaign.
 *   3. `campaignRateCents` — the campaign's standing rate.
 *
 * A non-positive rate is `null`, not zero: `campaigns.rate_cents` is `not null default 0`, so 0
 * means "nobody has set a rate", and a screen must say "—" rather than claim the day paid nothing.
 * `lib/shift-pay.ts` makes the same distinction for the same reason.
 *
 * Because the snapshot is itself written from `override ?? campaign`, it already carries any
 * override that applied on the day — which is why it wins outright rather than being combined.
 */
export function resolveEffectiveRateCents(source: RateSource): number | null {
  const candidates = [
    source.rateSnapshotCents,
    source.shiftRateOverrideCents,
    source.campaignRateCents,
  ];

  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;
    if (!Number.isFinite(candidate)) continue;
    if (candidate <= 0) continue;
    return Math.round(candidate);
  }

  return null;
}

/**
 * Did this shift count as worked, as of `today`?
 *
 * `today` is the caller's Athens calendar date (`athensDate(new Date())`) rather than something
 * this function reads from the clock, so it is testable and so a shift is never "past" because the
 * server happens to sit in a different time zone from the promoter who worked it.
 *
 * A shift whose date *is* today is not yet worked, even with a check-in on it: the promoter
 * declared arrival this morning and the day is not over. "The shift's date has passed" is strict.
 */
export function isWorkedShift(
  row: Pick<PromoterShiftRow, "status" | "onDate" | "hasCheckIn">,
  today: string,
): boolean {
  // Cancelled and no_show are never payable — D24 says so explicitly, and a check-in row that
  // somehow survived a later cancellation must not resurrect the pay.
  if (row.status === "cancelled" || row.status === "no_show") return false;
  if (!row.hasCheckIn) return false;
  return row.onDate < today;
}

/** "2026-09-15" → "2026-09". Anything that is not a date comes back unchanged. */
export function monthKeyOf(onDate: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(onDate) ? onDate.slice(0, 7) : onDate;
}

/** "2026-09" → "Σεπτέμβριος 2026". Unparseable input is returned unchanged. */
export function formatMonthLabel(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return monthKey;
  const [, y, m] = match;
  const month = Number(m);
  if (month < 1 || month > 12) return monthKey;
  // UTC midnight on the 1st, formatted in UTC — never through the device's own zone, which is how
  // a September becomes an August on a phone set to another one. Same rule as lib/shift-format.ts.
  const date = new Date(Date.UTC(Number(y), month - 1, 1));
  const name = new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", month: "long" }).format(date);
  // Intl gives the genitive "Σεπτεμβρίου" in some combinations; standalone month + year reads as a
  // label, so capitalise whatever came back and leave the form Intl chose for this locale.
  return `${name.charAt(0).toLocaleUpperCase(LOCALE)}${name.slice(1)} ${y}`;
}

/**
 * The months that actually have worked shifts, newest first.
 *
 * Deliberately derived from the data rather than generated as "the last twelve months": an agency
 * whose promoter worked twice, in March and in September, should be offered two months and not ten
 * empty ones. A month with worked shifts but no resolvable rate is still a month with data — the
 * hours are real even when the money cannot be stated.
 */
export function monthsWithWorkedShifts(rows: PromoterShiftRow[], today: string): string[] {
  const keys = new Set<string>();
  for (const row of rows) {
    if (isWorkedShift(row, today)) keys.add(monthKeyOf(row.onDate));
  }
  return Array.from(keys).sort().reverse();
}

/**
 * Pick the month to show.
 *
 * The requested one when it has data; otherwise the most recent month that does; otherwise the
 * current month, so an empty state has something true to put in its heading rather than a blank.
 * Never silently shows a different month's figures under the requested month's name — the caller
 * renders whatever comes back out of here as the selected value.
 */
export function resolveSelectedMonth(
  requested: string | null | undefined,
  available: string[],
  today: string,
): string {
  if (requested && available.includes(requested)) return requested;
  if (requested && /^\d{4}-\d{2}$/.test(requested) && available.length === 0) return requested;
  return available[0] ?? monthKeyOf(today);
}

/** One row of the shift-history table, with its hours and its pay already worked out. */
export type WorkedShift = {
  assignmentId: string;
  shiftId: string;
  status: AssignmentStatusValue;
  onDate: string;
  startTime: string;
  endTime: string;
  clientName: string | null;
  campaignName: string | null;
  storeName: string | null;
  storeAddress: string | null;
  checkedInAt: string | null;
  /** Paid minutes, `end_time − start_time`. `null` when the times do not make sense. */
  paidMinutes: number | null;
  /** The resolved hourly rate in cents, or `null` when no rate has ever been set. */
  rateCents: number | null;
  /** What the day paid, in cents. `null` means "we cannot state a total" — never show zero. */
  payCents: number | null;
};

/**
 * The three numbers the profile leads with, plus the honesty flags that stop them lying.
 *
 * `totalCents` is the sum of the shifts whose pay could be stated. `unpricedShiftCount` counts the
 * worked shifts that had to be left out of it — no rate on the campaign, or hours that do not
 * parse. They are still counted in `shiftCount` and `paidMinutes`, because the day was worked and
 * the hours are known; only the money is unknown. A screen showing `totalCents` while
 * `unpricedShiftCount > 0` must say so, or it is quietly reporting a short total as a complete one.
 */
export type MonthlyEarnings = {
  monthKey: string;
  shiftCount: number;
  paidMinutes: number;
  totalCents: number;
  unpricedShiftCount: number;
  /** True when at least one worked shift's pay could not be stated. */
  partial: boolean;
  /** The month's worked shifts, soonest-last (newest first), each already priced. */
  shifts: WorkedShift[];
};

/** `row` → the history row, pricing it through `lib/shift-pay.ts`. */
export function priceShift(row: PromoterShiftRow): WorkedShift {
  const rateCents = resolveEffectiveRateCents(row);
  return {
    assignmentId: row.assignmentId,
    shiftId: row.shiftId,
    status: row.status,
    onDate: row.onDate,
    startTime: row.startTime,
    endTime: row.endTime,
    clientName: row.clientName,
    campaignName: row.campaignName,
    storeName: row.storeName,
    storeAddress: row.storeAddress,
    checkedInAt: row.checkedInAt,
    paidMinutes: shiftDurationMinutes(row.startTime, row.endTime),
    rateCents,
    payCents: shiftPayCents(rateCents, row.startTime, row.endTime),
  };
}

/**
 * Everything the "This month" block and the shift history need, for one month.
 *
 * Filters to that month's worked shifts (D24), prices each one, and sums. Integer cents and
 * integer minutes throughout — no floating point touches the total, so 7,00 €/h over 8 hours
 * twelve times is exactly 672,00 € and not 671,9999999.
 */
export function summariseMonth(
  rows: PromoterShiftRow[],
  monthKey: string,
  today: string,
): MonthlyEarnings {
  const worked = rows
    .filter((row) => isWorkedShift(row, today) && monthKeyOf(row.onDate) === monthKey)
    .map(priceShift)
    .sort((a, b) => (a.onDate === b.onDate ? b.startTime.localeCompare(a.startTime) : b.onDate.localeCompare(a.onDate)));

  let paidMinutes = 0;
  let totalCents = 0;
  let unpricedShiftCount = 0;

  for (const shift of worked) {
    paidMinutes += shift.paidMinutes ?? 0;
    if (shift.payCents === null) unpricedShiftCount += 1;
    else totalCents += shift.payCents;
  }

  return {
    monthKey,
    shiftCount: worked.length,
    paidMinutes,
    totalCents,
    unpricedShiftCount,
    partial: unpricedShiftCount > 0,
    shifts: worked,
  };
}

/**
 * 5760 → "96". Reuses `formatShiftHours` so a month's hours read the same way one shift's hours
 * do, with the Greek decimal comma and no ",0" on a whole number. Zero minutes is "0" rather than
 * `null` here, because a month with no worked shifts has genuinely zero paid hours — unlike a
 * single shift, where unparseable times mean "we do not know".
 */
export function formatPaidHours(minutes: number): string {
  if (minutes <= 0) return "0";
  return formatShiftHours(minutes) ?? "0";
}
