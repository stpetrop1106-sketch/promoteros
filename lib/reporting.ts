/**
 * P29 — campaign and client reporting.
 *
 * `docs/product-spec.md` §11: the campaign-level rollup — stores, promoters, completed shifts,
 * units, interactions, photos, feedback, observations, problems, per-store results. This is the
 * artefact the agency is actually paid to produce, so it is the one place in the product where a
 * wrong number is not an inconvenience but a lost client.
 *
 * Which is why this module exists at all, separate from the page. It is pure: no Supabase client,
 * no ambient clock, no `t()`. The page fetches rows, maps them to camelCase, and hands them here;
 * the route handler that emits the CSV calls the *same* function over the *same* rows, so the
 * screen and the export can never disagree. `tests/reporting.test.ts` drives it with hand-built
 * fixtures and no database.
 *
 * ## The one rule this file is built around
 *
 * **A total is never presented as complete unless it is.** A campaign with 30 worked shifts and
 * 12 field reports in has a real "units promoted" number, and that number is 40% of the truth. So
 * every derived figure travels with its `ReportBasis` — reports in, reports expected, reports
 * missing — and the UI is expected to render the two together. An agency that hands a client a
 * confident number built on 40% of the data gets found out, and it is our fault.
 *
 * There are two independent ways a figure can be partial, and they are counted separately:
 *   1. the field report was never submitted at all (`ReportBasis`), and
 *   2. the report was submitted but left that particular field blank — `null` is not `0`
 *      (`ReportedTotal.reportedCount`).
 *
 * No `server-only` marker, and no `"use server"`: this module exports types and sync functions,
 * which is exactly what an `actions.ts` may not do (CLAUDE.md, "the server/client boundary"). It
 * holds no secret and touches no cookie, so it is safe in either environment and under plain Node
 * in the test runner.
 */

import { athensNowMs, athensWallClockMs } from "@/lib/exceptions";

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

// -------------------------------------------------------------------------------------------
// Input shapes — camelCase, mapped from snake_case at the data-access boundary by the caller
// -------------------------------------------------------------------------------------------

export type ShiftStatus = "open" | "partially_filled" | "filled" | "completed" | "cancelled";
export type AssignmentStatus = "confirmed" | "cancelled" | "no_show" | "completed";
export type CheckInMethod = "geolocation" | "manual_override" | "coordinator";
export type CampaignStatus = "draft" | "active" | "completed" | "cancelled";

export type ReportCampaign = {
  id: string;
  name: string;
  clientName: string | null;
  campaignType: string | null;
  /** "YYYY-MM-DD" — a Postgres `date`, an Athens calendar day, never an instant. */
  startsOn: string;
  endsOn: string;
  status: CampaignStatus;
};

export type ReportStore = {
  id: string;
  name: string;
  chain: string | null;
  address: string | null;
};

export type ReportShift = {
  id: string;
  storeId: string;
  onDate: string;
  /** "HH:MM" or "HH:MM:SS" — a Postgres `time`, wall clock, no zone. */
  startTime: string;
  endTime: string;
  promotersRequired: number;
  status: ShiftStatus;
};

export type ReportAssignment = {
  id: string;
  shiftId: string;
  promoterId: string;
  promoterName: string;
  status: AssignmentStatus;
};

export type ReportCheckIn = {
  assignmentId: string;
  checkedInAt: string;
  distanceFromStoreM: number | null;
  withinGeofence: boolean | null;
  method: CheckInMethod;
};

export type ReportFieldReport = {
  id: string;
  assignmentId: string;
  shiftId: string;
  unitsPromoted: number | null;
  salesCount: number | null;
  interactionsCount: number | null;
  stockIssues: string | null;
  storeManagerName: string | null;
  notes: string | null;
  submittedAt: string;
};

export type ReportPhoto = {
  id: string;
  fieldReportId: string;
  /** The object key inside the private `field-report-photos` bucket. Signed by the caller. */
  storagePath: string;
  caption: string | null;
  takenAt: string | null;
};

export type ReportInput = {
  /** The current instant. Injected so the whole rollup is deterministic under test. */
  now: Date;
  campaign: ReportCampaign;
  stores: ReportStore[];
  shifts: ReportShift[];
  assignments: ReportAssignment[];
  checkIns: ReportCheckIn[];
  fieldReports: ReportFieldReport[];
  photos: ReportPhoto[];
};

// -------------------------------------------------------------------------------------------
// Output shapes
// -------------------------------------------------------------------------------------------

/**
 * How much of the field data a figure rests on.
 *
 * `reportsExpected` counts assignments that *should* have produced a report: one that is marked
 * `completed`, or one still `confirmed` on a shift that has already ended — plus, defensively,
 * any assignment that produced a report regardless of its status, so `reportsMissing` can never
 * go negative and a stray report is never silently dropped from a total it contributed to.
 */
export type ReportBasis = {
  reportsIn: number;
  reportsExpected: number;
  reportsMissing: number;
  /** True only when every expected report is in. */
  complete: boolean;
  /** `reportsIn / reportsExpected`, 0..1. 1 when nothing is expected — nothing is missing. */
  coverage: number;
};

/**
 * A summed field, and everything needed to say honestly what it is a sum *of*.
 *
 * `value` alone is meaningless. It is the sum over the reports that both arrived and filled this
 * field in; `reportedCount` says how many did, `basis` says how many were expected at all.
 */
export type ReportedTotal = {
  value: number;
  /** Reports that supplied a value for this field. A `null` column is not a zero. */
  reportedCount: number;
  basis: ReportBasis;
  /** True only when every expected report is in *and* every one of them filled this field. */
  complete: boolean;
};

export type FieldTotals = {
  basis: ReportBasis;
  unitsPromoted: ReportedTotal;
  salesCount: ReportedTotal;
  interactionsCount: ReportedTotal;
};

export type ReportCoverage = {
  /** Shifts that were actually meant to happen — cancelled shifts are excluded and counted below. */
  shifts: number;
  cancelledShifts: number;
  requiredSlots: number;
  /**
   * Slots covered by somebody who worked or is booked to work: assignment `confirmed` or
   * `completed`, capped at `promotersRequired` so an over-booked shift cannot inflate the total.
   * A cancelled assignment does not count. Neither does a no-show — the client did not get that
   * person in that store, and a client report that says otherwise is a lie by arithmetic.
   */
  filledSlots: number;
  /** `filledSlots / requiredSlots`, 0..1. 0 when nothing was required. */
  completionRate: number;
  cancelledAssignments: number;
  noShows: number;
};

/**
 * Attendance, reported along two axes that are deliberately **not merged**.
 *
 * The geofence axis (`withinGeofence` / `outsideGeofence` / `geofenceUnknown`) and the capture
 * axis (`byGeolocation` / `manualOverrides` / `recordedByCoordinator`) each partition the same
 * set of check-ins. Adding one to the other double-counts.
 *
 * A manual override is not a failure. CLAUDE.md §3: location is never the sole gate on someone
 * being paid, so the override path exists on purpose and is reported as its own fact rather than
 * folded into "outside the geofence" or quietly counted as a clean arrival.
 */
export type ReportAttendance = {
  /** Assignments that were meant to be worked on a shift that has already started. */
  expected: number;
  checkedIn: number;
  notCheckedIn: number;
  withinGeofence: number;
  outsideGeofence: number;
  geofenceUnknown: number;
  byGeolocation: number;
  manualOverrides: number;
  recordedByCoordinator: number;
};

export type StoreReport = {
  storeId: string;
  storeName: string;
  chain: string | null;
  coverage: ReportCoverage;
  attendance: ReportAttendance;
  totals: FieldTotals;
  photoCount: number;
};

/** One row per shift — what the CSV export writes, and what the per-shift breakdown renders. */
export type ShiftReportRow = {
  shiftId: string;
  onDate: string;
  startTime: string;
  endTime: string;
  status: ShiftStatus;
  storeId: string;
  storeName: string;
  chain: string | null;
  promotersRequired: number;
  filledSlots: number;
  cancelledAssignments: number;
  noShows: number;
  promoterNames: string[];
  attendance: ReportAttendance;
  totals: FieldTotals;
  photoCount: number;
};

export type ReportPhotoEntry = {
  id: string;
  storagePath: string;
  caption: string | null;
  takenAt: string | null;
  storeId: string;
  storeName: string;
  shiftId: string;
  onDate: string;
  promoterName: string;
};

export type StorePhotoGroup = {
  storeId: string;
  storeName: string;
  photos: ReportPhotoEntry[];
};

/** A promoter's own words, always attributed to a store and a date — never floating free. */
export type ReportNoteEntry = {
  fieldReportId: string;
  storeId: string;
  storeName: string;
  shiftId: string;
  onDate: string;
  promoterName: string;
  submittedAt: string;
  notes: string | null;
  stockIssues: string | null;
  storeManagerName: string | null;
};

export type CampaignReport = {
  campaign: ReportCampaign;
  /** ISO instant the rollup was built. Printed on the report so a stale PDF is identifiable. */
  generatedAt: string;
  storeNames: string[];
  promoterNames: string[];
  storeCount: number;
  promoterCount: number;
  /**
   * The dates actually scheduled, which can be narrower than the campaign's own declared range.
   * Null when the campaign has no shifts yet.
   */
  period: { from: string; to: string } | null;
  coverage: ReportCoverage;
  attendance: ReportAttendance;
  totals: FieldTotals;
  stores: StoreReport[];
  shiftRows: ShiftReportRow[];
  photos: ReportPhotoEntry[];
  photosByStore: StorePhotoGroup[];
  notes: ReportNoteEntry[];
  /**
   * Whether anything at all has come back from the field. False means the honest empty state:
   * a campaign that is still running and has nothing to report yet, which is a legitimate answer
   * and must not be dressed up as a page full of zeroes.
   */
  hasFieldData: boolean;
};

// -------------------------------------------------------------------------------------------
// Internals
// -------------------------------------------------------------------------------------------

/** A seat is covered by somebody who worked it or is booked to work it. */
function coversASeat(status: AssignmentStatus): boolean {
  return status === "confirmed" || status === "completed";
}

/**
 * The shift's end as Athens wall-clock milliseconds, comparable with `athensNowMs`.
 *
 * `on_date` is a bare `date` and `start_time`/`end_time` are bare `time`s. Building a JS `Date`
 * from "2026-09-10" parses it as **UTC midnight** and shifts the day for anyone west of
 * Greenwich — the exact trap CLAUDE.md names — so no `Date` is ever constructed from a date
 * string here. An `end_time` at or before `start_time` is an overnight shift and ends tomorrow.
 */
function shiftBoundsMs(shift: ReportShift): { startMs: number; endMs: number } {
  const startMs = athensWallClockMs(shift.onDate, shift.startTime);
  let endMs = athensWallClockMs(shift.onDate, shift.endTime);
  if (endMs <= startMs) endMs += DAY_MS;
  return { startMs, endMs };
}

function groupBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const bucket = map.get(k);
    if (bucket) bucket.push(row);
    else map.set(k, [row]);
  }
  return map;
}

function basisOf(reportsIn: number, reportsExpected: number): ReportBasis {
  const missing = Math.max(0, reportsExpected - reportsIn);
  return {
    reportsIn,
    reportsExpected,
    reportsMissing: missing,
    complete: missing === 0,
    coverage: reportsExpected === 0 ? 1 : reportsIn / reportsExpected,
  };
}

function totalOf(values: Array<number | null>, basis: ReportBasis): ReportedTotal {
  let value = 0;
  let reportedCount = 0;
  for (const v of values) {
    if (v === null || v === undefined || Number.isNaN(v)) continue;
    value += v;
    reportedCount += 1;
  }
  return {
    value,
    reportedCount,
    basis,
    complete: basis.complete && reportedCount === basis.reportsIn,
  };
}

/** Everything the aggregation needs, indexed once and reused by every slice. */
type Ctx = {
  nowMs: number;
  assignmentsByShift: Map<string, ReportAssignment[]>;
  checkInByAssignment: Map<string, ReportCheckIn>;
  reportByAssignment: Map<string, ReportFieldReport>;
  photosByReportId: Map<string, ReportPhoto[]>;
  /** Assignment ids that owe a field report, whether or not one arrived. */
  expectedReportAssignments: Set<string>;
};

const EMPTY_ASSIGNMENTS: ReportAssignment[] = [];

/**
 * The whole rollup for an arbitrary slice of shifts.
 *
 * The campaign totals, each store's block and each individual shift row all come from this one
 * function over a different slice, which is what guarantees the per-store table adds up to the
 * headline figures instead of drifting from them.
 */
function aggregate(shifts: readonly ReportShift[], ctx: Ctx) {
  const coverage: ReportCoverage = {
    shifts: 0,
    cancelledShifts: 0,
    requiredSlots: 0,
    filledSlots: 0,
    completionRate: 0,
    cancelledAssignments: 0,
    noShows: 0,
  };

  const attendance: ReportAttendance = {
    expected: 0,
    checkedIn: 0,
    notCheckedIn: 0,
    withinGeofence: 0,
    outsideGeofence: 0,
    geofenceUnknown: 0,
    byGeolocation: 0,
    manualOverrides: 0,
    recordedByCoordinator: 0,
  };

  let reportsExpected = 0;
  const reports: ReportFieldReport[] = [];
  let photoCount = 0;
  const promoterNames = new Set<string>();

  for (const shift of shifts) {
    const assignments = ctx.assignmentsByShift.get(shift.id) ?? EMPTY_ASSIGNMENTS;

    // A cancelled shift was never delivered. It is counted as a cancellation and contributes no
    // required slots — leaving it in the denominator would quietly depress every completion rate
    // for work the client itself called off.
    if (shift.status === "cancelled") {
      coverage.cancelledShifts += 1;
    } else {
      coverage.shifts += 1;
      coverage.requiredSlots += shift.promotersRequired;

      const covering = assignments.filter((a) => coversASeat(a.status));
      coverage.filledSlots += Math.min(covering.length, shift.promotersRequired);
      coverage.cancelledAssignments += assignments.filter((a) => a.status === "cancelled").length;
      coverage.noShows += assignments.filter((a) => a.status === "no_show").length;

      for (const a of covering) promoterNames.add(a.promoterName);

      const { startMs } = shiftBoundsMs(shift);
      if (ctx.nowMs >= startMs) {
        // Attendance is only a question once the shift has started. Before that, "nobody has
        // checked in" is not a fact about the campaign, it is a fact about the clock.
        for (const a of covering) {
          attendance.expected += 1;
          const checkIn = ctx.checkInByAssignment.get(a.id);
          if (!checkIn) {
            attendance.notCheckedIn += 1;
            continue;
          }
          attendance.checkedIn += 1;

          if (checkIn.withinGeofence === true) attendance.withinGeofence += 1;
          else if (checkIn.withinGeofence === false) attendance.outsideGeofence += 1;
          else attendance.geofenceUnknown += 1;

          if (checkIn.method === "geolocation") attendance.byGeolocation += 1;
          else if (checkIn.method === "manual_override") attendance.manualOverrides += 1;
          else attendance.recordedByCoordinator += 1;
        }
      }
    }

    for (const a of assignments) {
      if (ctx.expectedReportAssignments.has(a.id)) reportsExpected += 1;
      const report = ctx.reportByAssignment.get(a.id);
      if (!report) continue;
      reports.push(report);
      photoCount += (ctx.photosByReportId.get(report.id) ?? []).length;
    }
  }

  coverage.completionRate =
    coverage.requiredSlots === 0 ? 0 : coverage.filledSlots / coverage.requiredSlots;

  const basis = basisOf(reports.length, reportsExpected);
  const totals: FieldTotals = {
    basis,
    unitsPromoted: totalOf(
      reports.map((r) => r.unitsPromoted),
      basis,
    ),
    salesCount: totalOf(
      reports.map((r) => r.salesCount),
      basis,
    ),
    interactionsCount: totalOf(
      reports.map((r) => r.interactionsCount),
      basis,
    ),
  };

  return { coverage, attendance, totals, photoCount, promoterNames, reports };
}

// -------------------------------------------------------------------------------------------
// The rollup
// -------------------------------------------------------------------------------------------

/**
 * Build the client-facing report for one campaign from rows already scoped by RLS.
 *
 * Pure, total, and order-independent: the caller may hand the arrays in any order and gets the
 * same answer. Rows that reference a shift or store outside the campaign are ignored rather than
 * throwing — the page fetches them by `campaign_id` and by `shift_id`, so a mismatch means a
 * stale read, and a report that renders slightly short beats a report that 500s at midnight.
 */
export function buildCampaignReport(input: ReportInput): CampaignReport {
  const nowMs = athensNowMs(input.now);

  const storeById = new Map(input.stores.map((s) => [s.id, s]));
  const shiftById = new Map(input.shifts.map((s) => [s.id, s]));

  // Only rows that belong to this campaign's shifts take part.
  const assignments = input.assignments.filter((a) => shiftById.has(a.shiftId));
  const assignmentById = new Map(assignments.map((a) => [a.id, a]));
  const assignmentsByShift = groupBy(assignments, (a) => a.shiftId);

  const checkInByAssignment = new Map(
    input.checkIns.filter((c) => assignmentById.has(c.assignmentId)).map((c) => [c.assignmentId, c]),
  );

  const fieldReports = input.fieldReports.filter((r) => assignmentById.has(r.assignmentId));
  // `field_reports` carries `unique (assignment_id)`, so this map is lossless.
  const reportByAssignment = new Map(fieldReports.map((r) => [r.assignmentId, r]));
  const reportById = new Map(fieldReports.map((r) => [r.id, r]));

  const photos = input.photos.filter((p) => reportById.has(p.fieldReportId));
  const photosByReportId = groupBy(photos, (p) => p.fieldReportId);

  // Who owes a report. A `completed` assignment always does; a `confirmed` one does once its
  // shift has ended, because nobody marked it either way and the work still happened. Plus any
  // assignment that actually produced a report, so `reportsMissing` can never go negative.
  const expectedReportAssignments = new Set<string>();
  for (const a of assignments) {
    const shift = shiftById.get(a.shiftId);
    if (!shift) continue;
    if (reportByAssignment.has(a.id)) {
      expectedReportAssignments.add(a.id);
      continue;
    }
    if (shift.status === "cancelled") continue;
    if (a.status === "cancelled" || a.status === "no_show") continue;
    const ended = nowMs >= shiftBoundsMs(shift).endMs;
    if (a.status === "completed" || (a.status === "confirmed" && ended)) {
      expectedReportAssignments.add(a.id);
    }
  }

  const ctx: Ctx = {
    nowMs,
    assignmentsByShift,
    checkInByAssignment,
    reportByAssignment,
    photosByReportId,
    expectedReportAssignments,
  };

  const sortedShifts = [...input.shifts].sort(
    (a, b) =>
      (a.onDate < b.onDate ? -1 : a.onDate > b.onDate ? 1 : 0) ||
      (a.startTime < b.startTime ? -1 : a.startTime > b.startTime ? 1 : 0) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );

  const overall = aggregate(sortedShifts, ctx);

  // --- Per store ---------------------------------------------------------------------------
  const shiftsByStore = groupBy(sortedShifts, (s) => s.storeId);
  const stores: StoreReport[] = [];
  for (const [storeId, storeShifts] of shiftsByStore) {
    const store = storeById.get(storeId);
    const slice = aggregate(storeShifts, ctx);
    stores.push({
      storeId,
      storeName: store?.name ?? "—",
      chain: store?.chain ?? null,
      coverage: slice.coverage,
      attendance: slice.attendance,
      totals: slice.totals,
      photoCount: slice.photoCount,
    });
  }
  stores.sort((a, b) => a.storeName.localeCompare(b.storeName, "el"));

  // --- Per shift ---------------------------------------------------------------------------
  const shiftRows: ShiftReportRow[] = sortedShifts.map((shift) => {
    const slice = aggregate([shift], ctx);
    const store = storeById.get(shift.storeId);
    const names = (assignmentsByShift.get(shift.id) ?? EMPTY_ASSIGNMENTS)
      .filter((a) => coversASeat(a.status))
      .map((a) => a.promoterName)
      .sort((a, b) => a.localeCompare(b, "el"));

    return {
      shiftId: shift.id,
      onDate: shift.onDate,
      startTime: shift.startTime,
      endTime: shift.endTime,
      status: shift.status,
      storeId: shift.storeId,
      storeName: store?.name ?? "—",
      chain: store?.chain ?? null,
      promotersRequired: shift.promotersRequired,
      filledSlots: slice.coverage.filledSlots,
      cancelledAssignments: slice.coverage.cancelledAssignments,
      noShows: slice.coverage.noShows,
      promoterNames: names,
      attendance: slice.attendance,
      totals: slice.totals,
      photoCount: slice.photoCount,
    };
  });

  // --- Photos and notes, attributed ----------------------------------------------------------
  const contextOf = (report: ReportFieldReport) => {
    const assignment = assignmentById.get(report.assignmentId);
    const shift = assignment ? shiftById.get(assignment.shiftId) : undefined;
    const store = shift ? storeById.get(shift.storeId) : undefined;
    return {
      storeId: shift?.storeId ?? "",
      storeName: store?.name ?? "—",
      shiftId: shift?.id ?? "",
      onDate: shift?.onDate ?? "",
      promoterName: assignment?.promoterName ?? "—",
    };
  };

  const photoEntries: ReportPhotoEntry[] = [];
  for (const photo of photos) {
    const report = reportById.get(photo.fieldReportId);
    if (!report) continue;
    photoEntries.push({
      id: photo.id,
      storagePath: photo.storagePath,
      caption: photo.caption,
      takenAt: photo.takenAt,
      ...contextOf(report),
    });
  }
  photoEntries.sort(
    (a, b) =>
      (a.onDate < b.onDate ? -1 : a.onDate > b.onDate ? 1 : 0) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );

  const photosByStore: StorePhotoGroup[] = [];
  for (const [storeId, group] of groupBy(photoEntries, (p) => p.storeId)) {
    photosByStore.push({
      storeId,
      storeName: group[0]?.storeName ?? "—",
      photos: group,
    });
  }
  photosByStore.sort((a, b) => a.storeName.localeCompare(b.storeName, "el"));

  const notes: ReportNoteEntry[] = fieldReports
    .filter((r) => r.notes !== null || r.stockIssues !== null || r.storeManagerName !== null)
    .map((r) => ({
      fieldReportId: r.id,
      submittedAt: r.submittedAt,
      notes: r.notes,
      stockIssues: r.stockIssues,
      storeManagerName: r.storeManagerName,
      ...contextOf(r),
    }))
    .sort(
      (a, b) =>
        (a.onDate < b.onDate ? -1 : a.onDate > b.onDate ? 1 : 0) ||
        (a.storeName.localeCompare(b.storeName, "el")) ||
        (a.fieldReportId < b.fieldReportId ? -1 : a.fieldReportId > b.fieldReportId ? 1 : 0),
    );

  const dates = sortedShifts.map((s) => s.onDate).filter((d) => d.length > 0);
  const first = dates[0];
  const last = dates[dates.length - 1];

  const storeNames = stores.map((s) => s.storeName);
  const promoterNames = [...overall.promoterNames].sort((a, b) => a.localeCompare(b, "el"));

  return {
    campaign: input.campaign,
    generatedAt: input.now.toISOString(),
    storeNames,
    promoterNames,
    storeCount: stores.length,
    promoterCount: promoterNames.length,
    period: first !== undefined && last !== undefined ? { from: first, to: last } : null,
    coverage: overall.coverage,
    attendance: overall.attendance,
    totals: overall.totals,
    stores,
    shiftRows,
    photos: photoEntries,
    photosByStore,
    notes,
    hasFieldData: fieldReports.length > 0 || checkInByAssignment.size > 0,
  };
}

// -------------------------------------------------------------------------------------------
// CSV
// -------------------------------------------------------------------------------------------

/**
 * Semicolon, not comma.
 *
 * `commercial-architecture.md` §4 sells "export your data without asking us", and an export that
 * needs a support call to open is not that. Excel splits a CSV on the operating system's list
 * separator, which on a Greek Windows install is `;`. A comma-delimited file lands in a single
 * column on the machines of every customer we are selling to. RFC 4180 is the loser here and it
 * is the right trade for this market — the same reason the BOM below is not optional.
 */
export const CSV_DELIMITER = ";";

/**
 * The UTF-8 byte-order mark. Written as an escape on purpose — as a literal it is an invisible
 * character that the next person to touch this file would delete without noticing.
 *
 * Excel does not detect UTF-8 without it: every Greek name in the export comes out as mojibake,
 * and the customer's first experience of "get your data out whenever you like" is a support email.
 */
export const CSV_BOM = "\uFEFF";

/** CRLF, because that is what Excel expects and what RFC 4180 specifies. */
const CSV_EOL = "\r\n";

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (text === "") return "";
  // A leading =, +, - or @ makes Excel treat the cell as a formula. Prefixing a single quote is
  // the standard neutralisation; without it a promoter's note beginning with "-" is a live
  // formula in the client's spreadsheet.
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  if (
    guarded.includes(CSV_DELIMITER) ||
    guarded.includes('"') ||
    guarded.includes("\n") ||
    guarded.includes("\r")
  ) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return guarded;
}

export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return CSV_BOM + rows.map((row) => row.map(csvCell).join(CSV_DELIMITER)).join(CSV_EOL) + CSV_EOL;
}

/** A percentage as a whole number, so no decimal separator can be misread by a locale. */
function pct(ratio: number): number {
  return Math.round(ratio * 100);
}

/**
 * A total for a spreadsheet: the number in one column and its basis in the next two, never a
 * lone figure. The same honesty rule as the screen — a reader who sorts by "units" must still be
 * able to see the total was built on 12 of 30 reports.
 */
function totalCells(total: ReportedTotal): Array<string | number> {
  return [total.value, total.reportedCount, total.basis.reportsExpected];
}

export const SHIFT_CSV_HEADER = [
  "campaign",
  "client",
  "store",
  "chain",
  "date",
  "start_time",
  "end_time",
  "shift_status",
  "promoters_required",
  "slots_filled",
  "cancelled_assignments",
  "no_shows",
  "promoters",
  "attendance_expected",
  "checked_in",
  "not_checked_in",
  "within_geofence",
  "outside_geofence",
  "geofence_unknown",
  "manual_overrides",
  "reports_expected",
  "reports_in",
  "reports_missing",
  "units_promoted",
  "units_reported_by",
  "units_expected_from",
  "sales",
  "sales_reported_by",
  "sales_expected_from",
  "interactions",
  "interactions_reported_by",
  "interactions_expected_from",
  "photos",
] as const;

/** One row per shift, with every derived figure and the basis it rests on. */
export function shiftCsvRows(report: CampaignReport): Array<Array<string | number | null>> {
  const rows: Array<Array<string | number | null>> = [[...SHIFT_CSV_HEADER]];
  for (const row of report.shiftRows) {
    rows.push([
      report.campaign.name,
      report.campaign.clientName,
      row.storeName,
      row.chain,
      row.onDate,
      row.startTime,
      row.endTime,
      row.status,
      row.promotersRequired,
      row.filledSlots,
      row.cancelledAssignments,
      row.noShows,
      row.promoterNames.join(", "),
      row.attendance.expected,
      row.attendance.checkedIn,
      row.attendance.notCheckedIn,
      row.attendance.withinGeofence,
      row.attendance.outsideGeofence,
      row.attendance.geofenceUnknown,
      row.attendance.manualOverrides,
      row.totals.basis.reportsExpected,
      row.totals.basis.reportsIn,
      row.totals.basis.reportsMissing,
      ...totalCells(row.totals.unitsPromoted),
      ...totalCells(row.totals.salesCount),
      ...totalCells(row.totals.interactionsCount),
      row.photoCount,
    ]);
  }
  return rows;
}

export const STORE_CSV_HEADER = [
  "campaign",
  "client",
  "store",
  "chain",
  "shifts",
  "cancelled_shifts",
  "slots_required",
  "slots_filled",
  "completion_rate_pct",
  "cancelled_assignments",
  "no_shows",
  "attendance_expected",
  "checked_in",
  "not_checked_in",
  "within_geofence",
  "outside_geofence",
  "geofence_unknown",
  "manual_overrides",
  "reports_expected",
  "reports_in",
  "reports_missing",
  "reporting_coverage_pct",
  "units_promoted",
  "units_reported_by",
  "units_expected_from",
  "sales",
  "sales_reported_by",
  "sales_expected_from",
  "interactions",
  "interactions_reported_by",
  "interactions_expected_from",
  "photos",
] as const;

/**
 * One row per store, plus a final `TOTAL` row.
 *
 * The total row is the campaign rollup, not a spreadsheet `SUM()` of the rows above it — the two
 * agree by construction because both come from `aggregate()`, and shipping a literal total means
 * a client who deletes a row cannot accidentally publish a wrong headline.
 */
export function storeCsvRows(report: CampaignReport): Array<Array<string | number | null>> {
  const line = (
    label: string,
    chain: string | null,
    coverage: ReportCoverage,
    attendance: ReportAttendance,
    totals: FieldTotals,
    photoCount: number,
  ): Array<string | number | null> => [
    report.campaign.name,
    report.campaign.clientName,
    label,
    chain,
    coverage.shifts,
    coverage.cancelledShifts,
    coverage.requiredSlots,
    coverage.filledSlots,
    pct(coverage.completionRate),
    coverage.cancelledAssignments,
    coverage.noShows,
    attendance.expected,
    attendance.checkedIn,
    attendance.notCheckedIn,
    attendance.withinGeofence,
    attendance.outsideGeofence,
    attendance.geofenceUnknown,
    attendance.manualOverrides,
    totals.basis.reportsExpected,
    totals.basis.reportsIn,
    totals.basis.reportsMissing,
    pct(totals.basis.coverage),
    ...totalCells(totals.unitsPromoted),
    ...totalCells(totals.salesCount),
    ...totalCells(totals.interactionsCount),
    photoCount,
  ];

  const rows: Array<Array<string | number | null>> = [[...STORE_CSV_HEADER]];
  for (const store of report.stores) {
    rows.push(
      line(
        store.storeName,
        store.chain,
        store.coverage,
        store.attendance,
        store.totals,
        store.photoCount,
      ),
    );
  }
  rows.push(
    line(
      "TOTAL",
      null,
      report.coverage,
      report.attendance,
      report.totals,
      report.photos.length,
    ),
  );
  return rows;
}

/**
 * A filename safe for a `Content-Disposition` header on any platform.
 *
 * Greek letters are stripped rather than transliterated, because the header's ASCII `filename`
 * parameter cannot carry them; the caller sends the real name in `filename*` alongside, which is
 * what a modern browser actually uses.
 */
export function csvFileName(campaignName: string, mode: string, onDate: string): string {
  const slug = campaignName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${slug || "campaign"}-${mode}-${onDate}.csv`;
}
