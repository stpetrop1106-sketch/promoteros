/**
 * P38 — "Στείλε πρόσκληση" from a promoter's own profile, to any upcoming shift, whether or not
 * the matching engine would have suggested it.
 *
 * Deliberately pure and synchronous: no Supabase client, no `Date.now()`, no `t()`. The caller
 * (`app/promoters/[id]/invite/data.ts`) loads rows and hands them here as plain values; this file
 * only decides. That is what makes the decision testable without a database and what keeps the
 * data-loading and the policy from drifting into one big function — see CLAUDE.md's "Matching"
 * section, which asks for the same split for the ranking engine.
 *
 * This mirrors, deliberately, the hard filters `match_promoters` applies in
 * `supabase/migrations/0005_matching_fixes.sql` and `0007_match_radius.sql`. That engine's "no" is
 * invisible — an ineligible promoter simply never appears in the ranked list. This feature exists
 * so a coordinator can override the engine on purpose ("she worked this store last year and the
 * manager asked for her"), so the same "no" has to become a stated, overridable reason instead of
 * a silent exclusion. Four of the hard filters become BLOCKING here (they describe a shift that
 * genuinely cannot be given to this promoter — a double booking, a duplicate offer); the
 * remainder become WARNINGS the coordinator can see and send through anyway.
 *
 * Every date comparison below is a plain string comparison of "YYYY-MM-DD" — never
 * `new Date(dateString)`, which parses as UTC midnight and can print the wrong Athens day. Every
 * time comparison converts "HH:MM" / "HH:MM:SS" to seconds-since-midnight by splitting on ":",
 * never through a `Date` either. Two shifts are only ever compared for overlap when their
 * `onDate` strings are identical, so an Athens calendar day can never be silently merged with the
 * one before or after it here.
 */

export type BlockReason =
  | "archived"
  | "blocklisted"
  | "already_confirmed"
  | "pending_invitation"
  | "overlapping_confirmed_shift";

export type WarningReason =
  | "no_availability_declared"
  | "declared_unavailable"
  | "outside_travel_radius"
  | "brief_not_read";

export type EligibilityResult = {
  blocking: BlockReason[];
  warnings: WarningReason[];
  /** `true` iff `blocking` is empty — the UI's single "can this be sent" flag. */
  canSend: boolean;
};

export type PromoterStatusForInvite = "active" | "paused" | "archived" | "blocklisted";

/** One row of `availability`, already scoped by the caller to the shift's own `on_date`. */
export type AvailabilityWindow = {
  status: "available" | "unavailable";
  /** `null` means "the whole day", matching the `availability` table's own convention. */
  fromTime: string | null;
  toTime: string | null;
};

/** One other shift the promoter already holds a confirmed assignment on. */
export type ConfirmedShiftWindow = {
  onDate: string;
  startTime: string;
  endTime: string;
};

export type InviteEligibilityInput = {
  promoterStatus: PromoterStatusForInvite;
  /** A `blocklist` row matches this promoter agency-wide or for this shift's own client. */
  isBlocklistedForClient: boolean;
  /** The promoter already holds a `confirmed` assignment on this exact shift. */
  alreadyConfirmedOnThisShift: boolean;
  /** The promoter holds an unexpired `pending` invitation for this exact shift. The caller
   *  resolves "unexpired" against the current instant — this file never reads a clock. */
  hasPendingInvitationForThisShift: boolean;
  /** The candidate shift. */
  shift: { onDate: string; startTime: string; endTime: string };
  /** Every OTHER shift the promoter holds a confirmed assignment on. The caller excludes the
   *  candidate shift itself (and anything already `cancelled` or `no_show`) before calling in. */
  otherConfirmedShifts: ConfirmedShiftWindow[];
  /** The promoter's `availability` rows for the shift's own `on_date` only — the caller filters
   *  by date so this file never has to. */
  availabilityOnShiftDate: AvailabilityWindow[];
  /** Straight-line metres from the promoter's home to the shift's store, or `null` when the
   *  promoter has no geocode — the same "unknown, not far" reading `0007_match_radius.sql` gives
   *  a missing `home_lat`/`home_lng`, so an ungeocoded promoter is never warned about distance. */
  distanceM: number | null;
  /** The agency's configured travel ceiling in metres, or `null` when it could not be read. */
  travelRadiusM: number | null;
  /** Whether the shift's campaign has any published brief at all. A campaign with no published
   *  brief yet gives no warning — there is nothing to have read. */
  campaignHasPublishedBrief: boolean;
  /** Whether the promoter has acknowledged that brief. Ignored when the above is `false`. */
  briefAcknowledged: boolean;
};

function timeToSeconds(time: string): number {
  const [h = "0", m = "0", s = "0"] = time.split(":");
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

/**
 * Same half-open semantics as Postgres's `OVERLAPS`, as used by `match_promoters`'s own
 * double-booking filter: `(s1, e1) OVERLAPS (s2, e2)` iff `s1 < e2 AND s2 < e1`. Applied only to
 * two windows already known to sit on the same calendar day. Back-to-back — one ends exactly when
 * the other starts — is NOT an overlap under this rule, which is the point: a promoter finishing
 * one shift at 14:00 can start the next one at 14:00.
 */
function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return timeToSeconds(aStart) < timeToSeconds(bEnd) && timeToSeconds(bStart) < timeToSeconds(aEnd);
}

function shiftsOverlap(
  a: ConfirmedShiftWindow,
  b: { onDate: string; startTime: string; endTime: string },
): boolean {
  return a.onDate === b.onDate && timesOverlap(a.startTime, a.endTime, b.startTime, b.endTime);
}

/**
 * An `available` row that covers the whole shift window — the same "covering" test
 * `match_promoters` runs as a hard filter (0005_matching_fixes.sql), downgraded here to a
 * warning. No covering row at all — including no availability row for the date whatsoever — is
 * "no availability declared that day".
 */
function hasCoveringAvailability(
  rows: AvailabilityWindow[],
  shift: { startTime: string; endTime: string },
): boolean {
  const startSec = timeToSeconds(shift.startTime);
  const endSec = timeToSeconds(shift.endTime);
  return rows.some((r) => {
    if (r.status !== "available") return false;
    const fromOk = r.fromTime == null || timeToSeconds(r.fromTime) <= startSec;
    const toOk = r.toTime == null || timeToSeconds(r.toTime) >= endSec;
    return fromOk && toOk;
  });
}

/**
 * An `unavailable` row overlapping the shift's actual hours — the same overlap test
 * `0005_matching_fixes.sql` FIX 2 added as a hard filter, downgraded here to a warning. A partial
 * unavailable window elsewhere in the day that never touches the shift's hours is deliberately
 * NOT a warning: declaring "unavailable 08:00–09:00" says nothing about a 10:00–14:00 shift.
 */
function hasBlockingUnavailability(
  rows: AvailabilityWindow[],
  shift: { startTime: string; endTime: string },
): boolean {
  const startSec = timeToSeconds(shift.startTime);
  const endSec = timeToSeconds(shift.endTime);
  return rows.some((r) => {
    if (r.status !== "unavailable") return false;
    const fromOk = r.fromTime == null || timeToSeconds(r.fromTime) < endSec;
    const toOk = r.toTime == null || timeToSeconds(r.toTime) > startSec;
    return fromOk && toOk;
  });
}

export function checkInviteEligibility(input: InviteEligibilityInput): EligibilityResult {
  const blocking: BlockReason[] = [];
  const warnings: WarningReason[] = [];

  if (input.promoterStatus === "archived") blocking.push("archived");
  if (input.promoterStatus === "blocklisted" || input.isBlocklistedForClient) {
    blocking.push("blocklisted");
  }
  if (input.alreadyConfirmedOnThisShift) blocking.push("already_confirmed");
  if (input.hasPendingInvitationForThisShift) blocking.push("pending_invitation");
  if (input.otherConfirmedShifts.some((s) => shiftsOverlap(s, input.shift))) {
    blocking.push("overlapping_confirmed_shift");
  }

  if (!hasCoveringAvailability(input.availabilityOnShiftDate, input.shift)) {
    warnings.push("no_availability_declared");
  }
  if (hasBlockingUnavailability(input.availabilityOnShiftDate, input.shift)) {
    warnings.push("declared_unavailable");
  }
  if (input.distanceM != null && input.travelRadiusM != null && input.distanceM > input.travelRadiusM) {
    warnings.push("outside_travel_radius");
  }
  if (input.campaignHasPublishedBrief && !input.briefAcknowledged) {
    warnings.push("brief_not_read");
  }

  return { blocking, warnings, canSend: blocking.length === 0 };
}
