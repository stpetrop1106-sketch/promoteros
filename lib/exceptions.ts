/**
 * P28 — exception detection.
 *
 * `docs/product-spec.md` §8: the system recognises late check-in, no response, cancellation,
 * absence — and surfaces **only the cases needing human attention**. This file is that
 * recognition, and nothing else.
 *
 * It is deliberately pure: no Supabase client, no `Date.now()`, no `t()`. The page fetches one
 * window of rows, hands them here, and renders what comes back. That is what makes the ranking —
 * which *is* the feature — testable without a database, and it is why the current instant is an
 * explicit `now` parameter on every entry point rather than something read from the ambient clock.
 *
 * No `server-only` marker on purpose: this module holds no secret, touches no cookie, and is
 * imported by `tests/exceptions.test.ts` under plain Node. It exports non-async values (types,
 * constants, sync functions), which is exactly why it must never become an `actions.ts` — see
 * CLAUDE.md's "server/client boundary" section.
 */

import type { TranslationKey } from "@/lib/i18n";

// ---------------------------------------------------------------------------------------------
// Europe/Athens wall-clock arithmetic
// ---------------------------------------------------------------------------------------------

/**
 * `shifts.on_date` is a `date` and `shifts.start_time` is a `time`. Neither carries a zone: they
 * are the agency's own wall clock (`agencies.timezone`, currently always `Europe/Athens`).
 *
 * The trap CLAUDE.md warns about is `new Date("2026-09-10")`, which parses as **UTC midnight**.
 * In Athens (UTC+2 in winter, UTC+3 in summer) that instant is still the 9th late in the evening
 * for a reader east of Greenwich and, worse, arithmetic against it silently lands an hour or two
 * out twice a year. So we never construct a `Date` from a bare date string anywhere in this file.
 *
 * Instead both sides of every comparison are put into the same representation: "Athens wall-clock
 * time, expressed as if it were UTC". `athensWallClockMs` builds it from explicit numeric parts;
 * `athensNowMs` re-expresses a real instant through `Intl.DateTimeFormat` with an explicit
 * `timeZone`, which is what applies the correct offset for that date, DST included. The two are
 * only ever subtracted from each other, never formatted as a real timestamp.
 *
 * (`app/shifts/[id]/time.ts` reaches the same conclusion for the shift status board. That file
 * belongs to another parcel's directory, so this one carries its own copy rather than importing
 * across an ownership line.)
 */
const ATHENS_TZ = "Europe/Athens";

const ATHENS_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: ATHENS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function athensParts(now: Date): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of ATHENS_PARTS.formatToParts(now)) {
    if (part.type !== "literal") out[part.type] = Number(part.value);
  }
  return out;
}

/** A real instant's Athens wall-clock time, in milliseconds "as if" UTC. */
export function athensNowMs(now: Date): number {
  const p = athensParts(now);
  return Date.UTC(p.year ?? 0, (p.month ?? 1) - 1, p.day ?? 1, p.hour ?? 0, p.minute ?? 0, p.second ?? 0);
}

/** The Athens calendar date of a real instant, as "YYYY-MM-DD". */
export function athensDate(now: Date): string {
  const p = athensParts(now);
  return `${String(p.year ?? 0).padStart(4, "0")}-${String(p.month ?? 1).padStart(2, "0")}-${String(
    p.day ?? 1,
  ).padStart(2, "0")}`;
}

/**
 * `on_date` ("YYYY-MM-DD") + `start_time`/`end_time` ("HH:MM" or "HH:MM:SS"), in the same
 * representation as `athensNowMs`, so the two are safe to subtract.
 */
export function athensWallClockMs(onDate: string, timeOfDay: string): number {
  const [y, mo, d] = onDate.split("-").map(Number);
  const [h, mi] = timeOfDay.split(":").map(Number);
  return Date.UTC(y ?? 0, (mo ?? 1) - 1, d ?? 1, h ?? 0, mi ?? 0, 0);
}

/** Shift a "YYYY-MM-DD" string by whole days without ever going through a parsed local `Date`. */
export function addDays(onDate: string, days: number): string {
  const [y, mo, d] = onDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(y ?? 0, (mo ?? 1) - 1, (d ?? 1) + days));
  return `${String(shifted.getUTCFullYear()).padStart(4, "0")}-${String(shifted.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

const MINUTE_MS = 60_000;

// ---------------------------------------------------------------------------------------------
// Input shapes — camelCase, mapped from snake_case at the data-access boundary by the page
// ---------------------------------------------------------------------------------------------

export type ShiftStatus = "open" | "partially_filled" | "filled" | "completed" | "cancelled";
export type AssignmentStatus = "confirmed" | "cancelled" | "no_show" | "completed";
export type InvitationStatus = "pending" | "accepted" | "declined" | "expired" | "superseded";
export type CheckInMethod = "geolocation" | "manual_override" | "coordinator";

export type ExceptionShift = {
  id: string;
  onDate: string;
  startTime: string;
  endTime: string;
  promotersRequired: number;
  status: ShiftStatus;
  storeName: string;
  campaignName: string;
};

export type ExceptionAssignment = {
  id: string;
  shiftId: string;
  promoterId: string;
  fullName: string;
  status: AssignmentStatus;
  cancelledAt: string | null;
};

export type ExceptionInvitation = {
  id: string;
  shiftId: string;
  promoterId: string;
  fullName: string;
  status: InvitationStatus;
  sentAt: string;
  expiresAt: string;
  respondedAt: string | null;
};

export type ExceptionCheckIn = {
  assignmentId: string;
  checkedInAt: string;
  distanceFromStoreM: number | null;
  withinGeofence: boolean | null;
  method: CheckInMethod;
};

export type ExceptionFieldReport = { assignmentId: string };

export type DetectionInput = {
  /** The current instant. Injected so the whole engine is deterministic under test. */
  now: Date;
  shifts: ExceptionShift[];
  assignments: ExceptionAssignment[];
  invitations: ExceptionInvitation[];
  checkIns: ExceptionCheckIn[];
  fieldReports: ExceptionFieldReport[];
};

// ---------------------------------------------------------------------------------------------
// Output shapes
// ---------------------------------------------------------------------------------------------

export type ExceptionType =
  | "under_covered"
  | "invitation_expiring"
  | "invitation_expired"
  | "declined_short"
  | "assignment_cancelled"
  | "no_check_in"
  | "checked_in_outside_geofence"
  | "checked_in_manual_override"
  | "missing_field_report";

/**
 * `critical` — it hurts now or within hours, and only a person can fix it.
 * `warning`  — it will hurt if nobody looks today.
 * `info`     — nothing is wrong; the coordinator should simply know. A manual-override check-in
 *              lives here and must never be coloured like a failure (CLAUDE.md §3: location is
 *              never the sole gate on someone getting paid, so overriding it is not a fault).
 */
export type ExceptionSeverity = "critical" | "warning" | "info";

/** Relative time, resolved to words by the page — `lib/` stays free of locale strings. */
export type RelativeWhen = {
  direction: "future" | "past" | "now";
  unit: "minute" | "hour" | "day";
  value: number;
};

export type ExceptionAction = { labelKey: TranslationKey; href: string };

export type DetectedException = {
  /** Stable across renders: type + shift + promoter. Used as the React key and for dedupe. */
  id: string;
  type: ExceptionType;
  severity: ExceptionSeverity;
  shiftId: string;
  promoterId: string | null;
  promoterName: string | null;
  storeName: string;
  campaignName: string;
  /**
   * Minutes from now until this becomes a real problem. Negative means the harm has already
   * landed. This is the ranking axis — "how soon it hurts", never the type or the date.
   */
  minutesUntilHarm: number;
  /** How long this has already been true, in minutes. 0 when it has not started hurting yet. */
  standingForMinutes: number;
  /** One sentence a coordinator would say out loud. `{when}` is filled in by the page. */
  messageKey: TranslationKey;
  messageParams: Record<string, string | number>;
  /** The relative time the sentence needs, or null when it needs none. */
  when: RelativeWhen | null;
  /** The action that resolves it. Every one of them lands on the screen where the fix happens. */
  action: ExceptionAction;
};

// ---------------------------------------------------------------------------------------------
// Thresholds — exported so the tests assert against the same numbers the engine uses
// ---------------------------------------------------------------------------------------------

export const THRESHOLDS = {
  /** An under-covered shift further out than this is the backlog, not a fire. */
  coverageHorizonMinutes: 72 * 60,
  /** Inside this window an uncovered seat is critical: there is no longer time to search calmly. */
  coverageCriticalMinutes: 4 * 60,
  /** A pending invitation is only worth surfacing once its expiry is this close. */
  invitationExpiryWarnMinutes: 12 * 60,
  /** A decline or cancellation older than this has become plain under-coverage, already reported. */
  recentResponseWindowMinutes: 48 * 60,
  /** §8 calls this "late check-in": a few minutes late is life, not an exception. */
  checkInGraceMinutes: 15,
  /** A field report is expected within a day of the shift ending. */
  fieldReportDueMinutes: 24 * 60,
  /** After a week a missing report is a housekeeping task, not something to open the day with. */
  fieldReportHorizonMinutes: 7 * 24 * 60,
  /** How long after a shift ends a missing check-in is still worth chasing. */
  missingCheckInHorizonMinutes: 24 * 60,
} as const;

// ---------------------------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------------------------

const SEVERITY_ORDER: Record<ExceptionSeverity, number> = { critical: 0, warning: 1, info: 2 };

/** Last-resort tiebreak so the order is total and stable, never dependent on fetch order. */
const TYPE_ORDER: Record<ExceptionType, number> = {
  under_covered: 0,
  no_check_in: 1,
  assignment_cancelled: 2,
  declined_short: 3,
  invitation_expired: 4,
  invitation_expiring: 5,
  checked_in_outside_geofence: 6,
  missing_field_report: 7,
  checked_in_manual_override: 8,
};

/**
 * Rank exceptions by urgency — how soon it hurts — not by type and not by date.
 *
 * The comparison, in order:
 *
 * 1. **Severity.** Note that severity is itself *derived from* urgency, not fixed per type: the
 *    same under-covered shift is `critical` four hours out and `warning` two days out. So leading
 *    with severity is still sorting by urgency; it just prevents a stale informational item from
 *    outranking a live one purely because its clock reads further into the past.
 * 2. **`minutesUntilHarm`, ascending.** Negative first, so something already going wrong in a
 *    store right now sorts above something that will go wrong in half an hour.
 * 3. **Type**, then **id** — only to make the order total and reproducible.
 *
 * The property this exists to guarantee: a shift starting in thirty minutes with nobody confirmed
 * appears above a shift yesterday that is missing its field report.
 */
export function rankExceptions(list: DetectedException[]): DetectedException[] {
  return [...list].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.minutesUntilHarm - b.minutesUntilHarm ||
      TYPE_ORDER[a.type] - TYPE_ORDER[b.type] ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/** Turn a signed minute count into the coarsest honest unit. The page renders it as words. */
export function relativeWhen(minutes: number): RelativeWhen {
  const rounded = Math.round(minutes);
  const magnitude = Math.abs(rounded);
  if (magnitude < 1) return { direction: "now", unit: "minute", value: 0 };

  const direction: "future" | "past" = rounded > 0 ? "future" : "past";
  if (magnitude < 60) return { direction, unit: "minute", value: magnitude };
  if (magnitude < 48 * 60) return { direction, unit: "hour", value: Math.round(magnitude / 60) };
  return { direction, unit: "day", value: Math.round(magnitude / (24 * 60)) };
}

// ---------------------------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------------------------

/** A seat is covered by an assignment that is confirmed or already worked. */
function coversASeat(status: AssignmentStatus): boolean {
  return status === "confirmed" || status === "completed";
}

function minutesBetween(fromMs: number, toMs: number): number {
  return Math.round((toMs - fromMs) / MINUTE_MS);
}

function shiftHref(shiftId: string): string {
  return `/shifts/${shiftId}`;
}

/**
 * The whole of §8, from one window of rows.
 *
 * Returns the ranked list. Everything not in it is, by construction, something the coordinator
 * does not have to look at — which is the actual promise of this screen.
 */
export function detectExceptions(input: DetectionInput): DetectedException[] {
  const nowMs = athensNowMs(input.now);
  const nowInstantMs = input.now.getTime();
  const out: DetectedException[] = [];

  const assignmentsByShift = groupBy(input.assignments, (a) => a.shiftId);
  const invitationsByShift = groupBy(input.invitations, (i) => i.shiftId);
  const checkInByAssignment = new Map(input.checkIns.map((c) => [c.assignmentId, c]));
  const reportedAssignments = new Set(input.fieldReports.map((r) => r.assignmentId));

  for (const shift of input.shifts) {
    // A cancelled shift needs nobody. It is the one status that removes work rather than creating it.
    if (shift.status === "cancelled") continue;

    const startMs = athensWallClockMs(shift.onDate, shift.startTime);
    let endMs = athensWallClockMs(shift.onDate, shift.endTime);
    if (endMs <= startMs) endMs += 24 * 60 * MINUTE_MS; // an overnight shift ends the next day

    const minutesToStart = minutesBetween(nowMs, startMs);
    const minutesSinceStart = -minutesToStart;
    const minutesSinceEnd = minutesBetween(endMs, nowMs);
    const running = nowMs >= startMs && nowMs < endMs;
    const ended = nowMs >= endMs;

    const assignments = assignmentsByShift.get(shift.id) ?? [];
    const invitations = invitationsByShift.get(shift.id) ?? [];
    const confirmed = assignments.filter((a) => coversASeat(a.status));
    const missing = Math.max(0, shift.promotersRequired - confirmed.length);

    // Severity for everything whose harm is "the shift begins short".
    const coverageSeverity: ExceptionSeverity =
      minutesToStart <= THRESHOLDS.coverageCriticalMinutes ? "critical" : "warning";
    // A shortfall is only live while the shift can still be filled.
    const shortfallLive =
      missing > 0 && !ended && minutesToStart <= THRESHOLDS.coverageHorizonMinutes;

    // --- Under-covered, and the shift starts soon -------------------------------------------
    if (shortfallLive) {
      const started = minutesToStart <= 0;
      out.push({
        id: `under_covered:${shift.id}`,
        type: "under_covered",
        severity: coverageSeverity,
        shiftId: shift.id,
        promoterId: null,
        promoterName: null,
        storeName: shift.storeName,
        campaignName: shift.campaignName,
        minutesUntilHarm: minutesToStart,
        standingForMinutes: started ? minutesSinceStart : 0,
        messageKey: underCoveredKey(started, missing),
        messageParams: { store: shift.storeName, missing },
        when: relativeWhen(minutesToStart),
        action: { labelKey: "dashboard.action.find_replacement", href: shiftHref(shift.id) },
      });
    }

    // --- Invitations: pending, expiring, expired, declined ------------------------------------
    for (const inv of invitations) {
      const expiresMs = Date.parse(inv.expiresAt);
      const treatedAsExpired =
        inv.status === "expired" || (inv.status === "pending" && expiresMs <= nowInstantMs);

      if (inv.status === "declined") {
        // A decline only deserves a human once it actually leaves the shift short, and only
        // while it is fresh. An old decline on a still-short shift is already reported above as
        // under-coverage; repeating it as a second row would be noise, not information.
        const respondedMs = inv.respondedAt ? Date.parse(inv.respondedAt) : null;
        const declineAgeMin =
          respondedMs === null ? Infinity : minutesBetween(respondedMs, nowInstantMs);
        if (!shortfallLive || declineAgeMin > THRESHOLDS.recentResponseWindowMinutes) continue;

        out.push({
          id: `declined_short:${shift.id}:${inv.promoterId}`,
          type: "declined_short",
          severity: coverageSeverity,
          shiftId: shift.id,
          promoterId: inv.promoterId,
          promoterName: inv.fullName,
          storeName: shift.storeName,
          campaignName: shift.campaignName,
          minutesUntilHarm: minutesToStart,
          standingForMinutes: declineAgeMin === Infinity ? 0 : declineAgeMin,
          messageKey: "dashboard.ex.declined",
          messageParams: { promoter: inv.fullName, store: shift.storeName },
          when: relativeWhen(declineAgeMin === Infinity ? 0 : -declineAgeMin),
          action: { labelKey: "dashboard.action.find_replacement", href: shiftHref(shift.id) },
        });
        continue;
      }

      if (inv.status === "accepted" || inv.status === "superseded") continue;
      // Both remaining branches are "a seat is still empty behind this invitation". If the shift
      // is already covered or already over, nobody needs to act.
      if (!shortfallLive) continue;

      if (treatedAsExpired) {
        out.push({
          id: `invitation_expired:${shift.id}:${inv.promoterId}`,
          type: "invitation_expired",
          severity: coverageSeverity,
          shiftId: shift.id,
          promoterId: inv.promoterId,
          promoterName: inv.fullName,
          storeName: shift.storeName,
          campaignName: shift.campaignName,
          minutesUntilHarm: minutesToStart,
          standingForMinutes: Math.max(0, minutesBetween(expiresMs, nowInstantMs)),
          messageKey: "dashboard.ex.invitation_expired",
          messageParams: { promoter: inv.fullName, store: shift.storeName },
          when: relativeWhen(-Math.max(0, minutesBetween(expiresMs, nowInstantMs))),
          action: { labelKey: "dashboard.action.find_replacement", href: shiftHref(shift.id) },
        });
        continue;
      }

      // Still pending and still valid: a live "no response" only once the clock is short.
      const minutesToExpiry = minutesBetween(nowInstantMs, expiresMs);
      if (minutesToExpiry > THRESHOLDS.invitationExpiryWarnMinutes) continue;

      out.push({
        id: `invitation_expiring:${shift.id}:${inv.promoterId}`,
        type: "invitation_expiring",
        severity: coverageSeverity,
        shiftId: shift.id,
        promoterId: inv.promoterId,
        promoterName: inv.fullName,
        storeName: shift.storeName,
        campaignName: shift.campaignName,
        // Whichever bites first: the invitation lapsing, or the shift starting.
        minutesUntilHarm: Math.min(minutesToExpiry, minutesToStart),
        standingForMinutes: Math.max(0, minutesBetween(Date.parse(inv.sentAt), nowInstantMs)),
        messageKey: "dashboard.ex.invitation_expiring",
        messageParams: { promoter: inv.fullName, store: shift.storeName },
        when: relativeWhen(minutesToExpiry),
        action: { labelKey: "dashboard.action.chase_reply", href: shiftHref(shift.id) },
      });
    }

    // --- Assignments: cancellations, check-ins, field reports ----------------------------------
    for (const a of assignments) {
      if (a.status === "cancelled") {
        // Same rule as a decline: only while fresh and only while the seat is genuinely open.
        const cancelledMs = a.cancelledAt ? Date.parse(a.cancelledAt) : null;
        const ageMin = cancelledMs === null ? Infinity : minutesBetween(cancelledMs, nowInstantMs);
        if (!shortfallLive || ageMin > THRESHOLDS.recentResponseWindowMinutes) continue;

        out.push({
          id: `assignment_cancelled:${shift.id}:${a.promoterId}`,
          type: "assignment_cancelled",
          severity: coverageSeverity,
          shiftId: shift.id,
          promoterId: a.promoterId,
          promoterName: a.fullName,
          storeName: shift.storeName,
          campaignName: shift.campaignName,
          minutesUntilHarm: minutesToStart,
          standingForMinutes: ageMin === Infinity ? 0 : ageMin,
          messageKey: "dashboard.ex.cancelled",
          messageParams: { promoter: a.fullName, store: shift.storeName },
          when: relativeWhen(ageMin === Infinity ? 0 : -ageMin),
          action: { labelKey: "dashboard.action.find_replacement", href: shiftHref(shift.id) },
        });
        continue;
      }

      // A no-show the coordinator has already marked is handled work, not an open exception —
      // the empty seat it leaves is reported once, above, as under-coverage.
      if (a.status === "no_show") continue;

      const checkIn = checkInByAssignment.get(a.id);

      if (!checkIn) {
        const lateBy = minutesSinceStart - THRESHOLDS.checkInGraceMinutes;
        if (
          lateBy > 0 &&
          minutesSinceEnd <= THRESHOLDS.missingCheckInHorizonMinutes
        ) {
          out.push({
            id: `no_check_in:${shift.id}:${a.promoterId}`,
            type: "no_check_in",
            severity: running ? "critical" : "warning",
            shiftId: shift.id,
            promoterId: a.promoterId,
            promoterName: a.fullName,
            storeName: shift.storeName,
            campaignName: shift.campaignName,
            // Already hurting: someone is expected in a store and has not confirmed arrival.
            minutesUntilHarm: -minutesSinceStart,
            standingForMinutes: lateBy,
            messageKey: "dashboard.ex.no_check_in",
            messageParams: { promoter: a.fullName, store: shift.storeName },
            when: relativeWhen(-minutesSinceStart),
            action: { labelKey: "dashboard.action.review_check_in", href: shiftHref(shift.id) },
          });
        }
      } else {
        const checkInAgeMin = Math.max(0, minutesBetween(Date.parse(checkIn.checkedInAt), nowInstantMs));

        if (checkIn.withinGeofence === false) {
          const known = checkIn.distanceFromStoreM !== null;
          out.push({
            id: `checked_in_outside_geofence:${shift.id}:${a.promoterId}`,
            type: "checked_in_outside_geofence",
            severity: "warning",
            shiftId: shift.id,
            promoterId: a.promoterId,
            promoterName: a.fullName,
            storeName: shift.storeName,
            campaignName: shift.campaignName,
            minutesUntilHarm: -checkInAgeMin,
            standingForMinutes: checkInAgeMin,
            messageKey: known
              ? "dashboard.ex.outside_geofence"
              : "dashboard.ex.outside_geofence_unknown",
            messageParams: known
              ? {
                  promoter: a.fullName,
                  store: shift.storeName,
                  distance: checkIn.distanceFromStoreM ?? 0,
                }
              : { promoter: a.fullName, store: shift.storeName },
            when: relativeWhen(-checkInAgeMin),
            action: { labelKey: "dashboard.action.review_check_in", href: shiftHref(shift.id) },
          });
        }

        if (checkIn.method === "manual_override") {
          // Informational, and phrased as such. CLAUDE.md §3: the manual path exists precisely so
          // that location is never the sole gate on someone being paid. Using it is not a fault,
          // and this row must never be coloured or worded like one.
          out.push({
            id: `checked_in_manual_override:${shift.id}:${a.promoterId}`,
            type: "checked_in_manual_override",
            severity: "info",
            shiftId: shift.id,
            promoterId: a.promoterId,
            promoterName: a.fullName,
            storeName: shift.storeName,
            campaignName: shift.campaignName,
            minutesUntilHarm: -checkInAgeMin,
            standingForMinutes: checkInAgeMin,
            messageKey: "dashboard.ex.manual_override",
            messageParams: { promoter: a.fullName, store: shift.storeName },
            when: relativeWhen(-checkInAgeMin),
            action: { labelKey: "dashboard.action.open_shift", href: shiftHref(shift.id) },
          });
        }
      }

      // --- A worked shift with nothing to show the client ------------------------------------
      if (
        a.status === "completed" &&
        ended &&
        !reportedAssignments.has(a.id) &&
        minutesSinceEnd <= THRESHOLDS.fieldReportHorizonMinutes
      ) {
        const overdueBy = minutesSinceEnd - THRESHOLDS.fieldReportDueMinutes;
        out.push({
          id: `missing_field_report:${shift.id}:${a.promoterId}`,
          type: "missing_field_report",
          severity: overdueBy > 0 ? "warning" : "info",
          shiftId: shift.id,
          promoterId: a.promoterId,
          promoterName: a.fullName,
          storeName: shift.storeName,
          campaignName: shift.campaignName,
          minutesUntilHarm: -overdueBy,
          standingForMinutes: Math.max(0, overdueBy),
          messageKey: "dashboard.ex.missing_report",
          messageParams: { promoter: a.fullName, store: shift.storeName },
          when: relativeWhen(-minutesSinceEnd),
          action: { labelKey: "dashboard.action.request_report", href: shiftHref(shift.id) },
        });
      }
    }
  }

  return rankExceptions(out);
}

function underCoveredKey(started: boolean, missing: number): TranslationKey {
  if (started) {
    return missing === 1 ? "dashboard.ex.under_covered_started_one" : "dashboard.ex.under_covered_started_many";
  }
  return missing === 1 ? "dashboard.ex.under_covered_one" : "dashboard.ex.under_covered_many";
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const bucket = map.get(k);
    if (bucket) bucket.push(row);
    else map.set(k, [row]);
  }
  return map;
}

// ---------------------------------------------------------------------------------------------
// The "today" summary under the exceptions
// ---------------------------------------------------------------------------------------------

export type TodaySummary = {
  /** The Athens calendar date this summarises, "YYYY-MM-DD". */
  date: string;
  shiftCount: number;
  requiredCount: number;
  confirmedCount: number;
  checkedInCount: number;
};

/**
 * Today's shifts only, by Athens calendar date — never by a UTC day boundary, which is one to
 * three hours off and silently reclassifies every late-evening shift.
 */
export function summariseToday(input: DetectionInput): TodaySummary {
  const date = athensDate(input.now);
  const todaysShifts = input.shifts.filter((s) => s.onDate === date && s.status !== "cancelled");
  const shiftIds = new Set(todaysShifts.map((s) => s.id));

  const todaysAssignments = input.assignments.filter(
    (a) => shiftIds.has(a.shiftId) && coversASeat(a.status),
  );
  const checkedIn = new Set(input.checkIns.map((c) => c.assignmentId));

  return {
    date,
    shiftCount: todaysShifts.length,
    requiredCount: todaysShifts.reduce((sum, s) => sum + s.promotersRequired, 0),
    confirmedCount: todaysAssignments.length,
    checkedInCount: todaysAssignments.filter((a) => checkedIn.has(a.id)).length,
  };
}

/** Group a ranked list for rendering, preserving rank inside each band. */
export function groupBySeverity(
  list: DetectedException[],
): Array<{ severity: ExceptionSeverity; items: DetectedException[] }> {
  const order: ExceptionSeverity[] = ["critical", "warning", "info"];
  return order
    .map((severity) => ({ severity, items: list.filter((e) => e.severity === severity) }))
    .filter((group) => group.items.length > 0);
}
