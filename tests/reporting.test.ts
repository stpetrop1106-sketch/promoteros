import { describe, expect, it } from "vitest";
import {
  buildCampaignReport,
  csvFileName,
  shiftCsvRows,
  storeCsvRows,
  toCsv,
  CSV_BOM,
  CSV_DELIMITER,
  type ReportAssignment,
  type ReportCampaign,
  type ReportCheckIn,
  type ReportFieldReport,
  type ReportInput,
  type ReportPhoto,
  type ReportShift,
  type ReportStore,
} from "@/lib/reporting";

// Hand-built fixtures only. `lib/reporting.ts` is pure and takes `now` as a parameter, which is
// what makes the whole rollup — including "has this shift ended yet" — assertable without a
// database and without the clock.

// -----------------------------------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------------------------------

/**
 * 15:00 Athens on 2026-06-15 (Greece is UTC+3 in June). Every fixture date below is chosen
 * relative to this instant: the 10th is comfortably over, the 20th has not happened.
 */
const NOW = new Date("2026-06-15T12:00:00Z");

const CAMPAIGN: ReportCampaign = {
  id: "camp-1",
  name: "Δοκιμαστική Καμπάνια",
  clientName: "Πελάτης ΑΕ",
  campaignType: "supermarket",
  startsOn: "2026-06-08",
  endsOn: "2026-06-21",
  status: "active",
};

const STORE_A: ReportStore = { id: "store-a", name: "Άλφα Γλυφάδα", chain: "Άλφα", address: null };
const STORE_B: ReportStore = { id: "store-b", name: "Βήτα Κηφισιά", chain: "Βήτα", address: null };

function shift(over: Partial<ReportShift> & { id: string }): ReportShift {
  return {
    storeId: "store-a",
    onDate: "2026-06-10",
    startTime: "10:00",
    endTime: "14:00",
    promotersRequired: 1,
    status: "completed",
    ...over,
  };
}

function assignment(over: Partial<ReportAssignment> & { id: string; shiftId: string }): ReportAssignment {
  return {
    promoterId: `promoter-${over.id}`,
    promoterName: `Promoter ${over.id}`,
    status: "completed",
    ...over,
  };
}

function checkIn(over: Partial<ReportCheckIn> & { assignmentId: string }): ReportCheckIn {
  return {
    checkedInAt: "2026-06-10T07:02:00.000Z",
    distanceFromStoreM: 40,
    withinGeofence: true,
    method: "geolocation",
    ...over,
  };
}

function fieldReport(
  over: Partial<ReportFieldReport> & { id: string; assignmentId: string; shiftId: string },
): ReportFieldReport {
  return {
    unitsPromoted: 10,
    salesCount: 3,
    interactionsCount: 50,
    stockIssues: null,
    storeManagerName: null,
    notes: null,
    submittedAt: "2026-06-10T12:00:00.000Z",
    ...over,
  };
}

function input(over: Partial<ReportInput> = {}): ReportInput {
  return {
    now: NOW,
    campaign: CAMPAIGN,
    stores: [STORE_A, STORE_B],
    shifts: [],
    assignments: [],
    checkIns: [],
    fieldReports: [],
    photos: [],
    ...over,
  };
}

// -----------------------------------------------------------------------------------------------
// An empty campaign
// -----------------------------------------------------------------------------------------------

describe("an empty campaign", () => {
  it("reports nothing rather than a page of confident zeroes", () => {
    const report = buildCampaignReport(input());

    expect(report.hasFieldData).toBe(false);
    expect(report.period).toBeNull();
    expect(report.storeCount).toBe(0);
    expect(report.promoterCount).toBe(0);
    expect(report.coverage.shifts).toBe(0);
    expect(report.coverage.requiredSlots).toBe(0);
    expect(report.coverage.completionRate).toBe(0);
    expect(report.stores).toEqual([]);
    expect(report.shiftRows).toEqual([]);
    expect(report.photos).toEqual([]);
    expect(report.notes).toEqual([]);
  });

  it("expects no reports, so nothing is missing", () => {
    const report = buildCampaignReport(input());

    expect(report.totals.basis.reportsExpected).toBe(0);
    expect(report.totals.basis.reportsIn).toBe(0);
    expect(report.totals.basis.reportsMissing).toBe(0);
    expect(report.totals.unitsPromoted.value).toBe(0);
  });

  it("does not treat a scheduled but unstarted shift as an attendance failure", () => {
    // A shift the day after `NOW`: nobody has checked in, and nobody was supposed to.
    const report = buildCampaignReport(
      input({
        shifts: [shift({ id: "s-future", onDate: "2026-06-20", status: "filled" })],
        assignments: [assignment({ id: "a1", shiftId: "s-future", status: "confirmed" })],
      }),
    );

    expect(report.coverage.requiredSlots).toBe(1);
    expect(report.coverage.filledSlots).toBe(1);
    expect(report.attendance.expected).toBe(0);
    expect(report.attendance.notCheckedIn).toBe(0);
    expect(report.totals.basis.reportsExpected).toBe(0);
    expect(report.hasFieldData).toBe(false);
  });
});

// -----------------------------------------------------------------------------------------------
// Partial reporting — the rule the whole module exists for
// -----------------------------------------------------------------------------------------------

describe("partial reporting", () => {
  /** Three worked shifts at store A, only two of which sent a report back. */
  const partial = () =>
    input({
      shifts: [
        shift({ id: "s1" }),
        shift({ id: "s2", onDate: "2026-06-11" }),
        shift({ id: "s3", onDate: "2026-06-12" }),
      ],
      assignments: [
        assignment({ id: "a1", shiftId: "s1" }),
        assignment({ id: "a2", shiftId: "s2" }),
        assignment({ id: "a3", shiftId: "s3" }),
      ],
      fieldReports: [
        fieldReport({ id: "r1", assignmentId: "a1", shiftId: "s1", unitsPromoted: 100 }),
        fieldReport({ id: "r2", assignmentId: "a2", shiftId: "s2", unitsPromoted: 50 }),
      ],
    });

  it("carries the basis of every total, and never claims to be complete", () => {
    const report = buildCampaignReport(partial());

    expect(report.totals.basis.reportsExpected).toBe(3);
    expect(report.totals.basis.reportsIn).toBe(2);
    expect(report.totals.basis.reportsMissing).toBe(1);
    expect(report.totals.basis.complete).toBe(false);
    expect(report.totals.basis.coverage).toBeCloseTo(2 / 3);

    expect(report.totals.unitsPromoted.value).toBe(150);
    expect(report.totals.unitsPromoted.complete).toBe(false);
  });

  it("marks a total complete only once every expected report is in", () => {
    const full = partial();
    full.fieldReports = [
      ...full.fieldReports,
      fieldReport({ id: "r3", assignmentId: "a3", shiftId: "s3", unitsPromoted: 25 }),
    ];

    const report = buildCampaignReport(full);

    expect(report.totals.basis.complete).toBe(true);
    expect(report.totals.basis.reportsMissing).toBe(0);
    expect(report.totals.basis.coverage).toBe(1);
    expect(report.totals.unitsPromoted.value).toBe(175);
    expect(report.totals.unitsPromoted.complete).toBe(true);
  });

  it("counts a blank field as unreported, not as a zero", () => {
    const withBlank = partial();
    withBlank.fieldReports = [
      fieldReport({ id: "r1", assignmentId: "a1", shiftId: "s1", unitsPromoted: 100 }),
      fieldReport({ id: "r2", assignmentId: "a2", shiftId: "s2", unitsPromoted: null }),
      fieldReport({ id: "r3", assignmentId: "a3", shiftId: "s3", unitsPromoted: 20 }),
    ];

    const report = buildCampaignReport(withBlank);

    // Every expected report arrived …
    expect(report.totals.basis.complete).toBe(true);
    // … but one of them left this column empty, so the sum is still not the whole story.
    expect(report.totals.unitsPromoted.value).toBe(120);
    expect(report.totals.unitsPromoted.reportedCount).toBe(2);
    expect(report.totals.unitsPromoted.complete).toBe(false);
    // A field every report *did* fill in stays complete — the two are tracked per field.
    expect(report.totals.salesCount.complete).toBe(true);
  });

  it("expects a report from a shift that ended while its assignment was still 'confirmed'", () => {
    const report = buildCampaignReport(
      input({
        shifts: [shift({ id: "s1", status: "filled" })],
        assignments: [assignment({ id: "a1", shiftId: "s1", status: "confirmed" })],
      }),
    );

    expect(report.totals.basis.reportsExpected).toBe(1);
    expect(report.totals.basis.reportsMissing).toBe(1);
  });

  it("never lets reports_missing go negative when a stray report arrives", () => {
    // A report against an assignment nobody would otherwise expect one from.
    const report = buildCampaignReport(
      input({
        shifts: [shift({ id: "s1", onDate: "2026-06-20", status: "filled" })],
        assignments: [assignment({ id: "a1", shiftId: "s1", status: "confirmed" })],
        fieldReports: [fieldReport({ id: "r1", assignmentId: "a1", shiftId: "s1" })],
      }),
    );

    expect(report.totals.basis.reportsExpected).toBe(1);
    expect(report.totals.basis.reportsIn).toBe(1);
    expect(report.totals.basis.reportsMissing).toBe(0);
  });
});

// -----------------------------------------------------------------------------------------------
// Coverage — what did and did not get delivered
// -----------------------------------------------------------------------------------------------

describe("coverage", () => {
  it("does not count a cancelled assignment as a filled slot", () => {
    const report = buildCampaignReport(
      input({
        shifts: [shift({ id: "s1", promotersRequired: 2, status: "partially_filled" })],
        assignments: [
          assignment({ id: "a1", shiftId: "s1", status: "completed" }),
          assignment({ id: "a2", shiftId: "s1", status: "cancelled" }),
        ],
      }),
    );

    expect(report.coverage.requiredSlots).toBe(2);
    expect(report.coverage.filledSlots).toBe(1);
    expect(report.coverage.cancelledAssignments).toBe(1);
    expect(report.coverage.completionRate).toBe(0.5);
    // A cancelled assignment owes no field report — nobody worked.
    expect(report.totals.basis.reportsExpected).toBe(1);
  });

  it("does not count a no-show as filled, attended, or owing a report", () => {
    const report = buildCampaignReport(
      input({
        shifts: [shift({ id: "s1", promotersRequired: 2, status: "completed" })],
        assignments: [
          assignment({ id: "a1", shiftId: "s1", status: "completed" }),
          assignment({ id: "a2", shiftId: "s1", status: "no_show" }),
        ],
        checkIns: [checkIn({ assignmentId: "a1" })],
      }),
    );

    expect(report.coverage.filledSlots).toBe(1);
    expect(report.coverage.noShows).toBe(1);
    expect(report.coverage.completionRate).toBe(0.5);

    expect(report.attendance.expected).toBe(1);
    expect(report.attendance.checkedIn).toBe(1);
    expect(report.attendance.notCheckedIn).toBe(0);
    expect(report.totals.basis.reportsExpected).toBe(1);
  });

  it("cannot be inflated past the number of slots the client paid for", () => {
    const report = buildCampaignReport(
      input({
        shifts: [shift({ id: "s1", promotersRequired: 1 })],
        assignments: [
          assignment({ id: "a1", shiftId: "s1" }),
          assignment({ id: "a2", shiftId: "s1" }),
        ],
      }),
    );

    expect(report.coverage.filledSlots).toBe(1);
    expect(report.coverage.completionRate).toBe(1);
  });

  it("excludes a cancelled shift from the denominator and counts it as a cancellation", () => {
    const report = buildCampaignReport(
      input({
        shifts: [
          shift({ id: "s1" }),
          shift({ id: "s2", onDate: "2026-06-11", status: "cancelled" }),
        ],
        assignments: [assignment({ id: "a1", shiftId: "s1" })],
      }),
    );

    expect(report.coverage.shifts).toBe(1);
    expect(report.coverage.cancelledShifts).toBe(1);
    expect(report.coverage.requiredSlots).toBe(1);
    expect(report.coverage.completionRate).toBe(1);
  });
});

// -----------------------------------------------------------------------------------------------
// Attendance — reported honestly, never merged
// -----------------------------------------------------------------------------------------------

describe("attendance", () => {
  it("keeps the geofence outcome and the capture method as separate axes", () => {
    const report = buildCampaignReport(
      input({
        shifts: [shift({ id: "s1", promotersRequired: 4, status: "completed" })],
        assignments: [
          assignment({ id: "a1", shiftId: "s1" }),
          assignment({ id: "a2", shiftId: "s1" }),
          assignment({ id: "a3", shiftId: "s1" }),
          assignment({ id: "a4", shiftId: "s1" }),
        ],
        checkIns: [
          checkIn({ assignmentId: "a1" }),
          checkIn({ assignmentId: "a2", withinGeofence: false, distanceFromStoreM: 900 }),
          checkIn({
            assignmentId: "a3",
            withinGeofence: null,
            distanceFromStoreM: null,
            method: "manual_override",
          }),
          // a4 never checked in at all.
        ],
      }),
    );

    expect(report.attendance.expected).toBe(4);
    expect(report.attendance.checkedIn).toBe(3);
    expect(report.attendance.notCheckedIn).toBe(1);

    // Axis one: where they were.
    expect(report.attendance.withinGeofence).toBe(1);
    expect(report.attendance.outsideGeofence).toBe(1);
    expect(report.attendance.geofenceUnknown).toBe(1);

    // Axis two: how it was captured. A manual override is its own fact, not folded into
    // "outside the geofence" and not quietly counted as a clean arrival (CLAUDE.md §3).
    expect(report.attendance.byGeolocation).toBe(2);
    expect(report.attendance.manualOverrides).toBe(1);
    expect(report.attendance.recordedByCoordinator).toBe(0);

    // Each axis partitions the same check-ins; they are never summed together.
    const geofenceAxis =
      report.attendance.withinGeofence +
      report.attendance.outsideGeofence +
      report.attendance.geofenceUnknown;
    const methodAxis =
      report.attendance.byGeolocation +
      report.attendance.manualOverrides +
      report.attendance.recordedByCoordinator;
    expect(geofenceAxis).toBe(report.attendance.checkedIn);
    expect(methodAxis).toBe(report.attendance.checkedIn);
  });
});

// -----------------------------------------------------------------------------------------------
// Per-store grouping
// -----------------------------------------------------------------------------------------------

describe("per-store grouping", () => {
  const twoStores = () =>
    input({
      shifts: [
        shift({ id: "s1", storeId: "store-a" }),
        shift({ id: "s2", storeId: "store-a", onDate: "2026-06-11" }),
        shift({ id: "s3", storeId: "store-b", onDate: "2026-06-12", promotersRequired: 2 }),
      ],
      assignments: [
        assignment({ id: "a1", shiftId: "s1", promoterName: "Άννα" }),
        assignment({ id: "a2", shiftId: "s2", promoterName: "Βασιλική" }),
        assignment({ id: "a3", shiftId: "s3", promoterName: "Άννα" }),
        assignment({ id: "a4", shiftId: "s3", promoterName: "Γιώργος", status: "no_show" }),
      ],
      fieldReports: [
        fieldReport({ id: "r1", assignmentId: "a1", shiftId: "s1", unitsPromoted: 10, salesCount: 1 }),
        fieldReport({ id: "r2", assignmentId: "a2", shiftId: "s2", unitsPromoted: 20, salesCount: 2 }),
        fieldReport({
          id: "r3",
          assignmentId: "a3",
          shiftId: "s3",
          unitsPromoted: 5,
          salesCount: 4,
          notes: "Το ράφι ήταν άδειο το πρωί.",
        }),
      ],
      photos: [
        { id: "p1", fieldReportId: "r1", storagePath: "ag/a1/1.jpg", caption: null, takenAt: null },
        { id: "p2", fieldReportId: "r3", storagePath: "ag/a3/1.jpg", caption: "Stand", takenAt: null },
      ],
    });

  it("breaks the same figures down per store, and they add up to the headline", () => {
    const report = buildCampaignReport(twoStores());

    expect(report.stores.map((s) => s.storeId)).toEqual(["store-a", "store-b"]);

    const a = report.stores.find((s) => s.storeId === "store-a");
    const b = report.stores.find((s) => s.storeId === "store-b");
    expect(a?.storeName).toBe("Άλφα Γλυφάδα");
    expect(a?.coverage.shifts).toBe(2);
    expect(a?.coverage.requiredSlots).toBe(2);
    expect(a?.coverage.filledSlots).toBe(2);
    expect(a?.totals.unitsPromoted.value).toBe(30);

    // The store that underperformed: two slots asked for, one delivered, one no-show.
    expect(b?.coverage.requiredSlots).toBe(2);
    expect(b?.coverage.filledSlots).toBe(1);
    expect(b?.coverage.noShows).toBe(1);
    expect(b?.coverage.completionRate).toBe(0.5);
    expect(b?.totals.unitsPromoted.value).toBe(5);

    const summed =
      (a?.totals.unitsPromoted.value ?? 0) + (b?.totals.unitsPromoted.value ?? 0);
    expect(summed).toBe(report.totals.unitsPromoted.value);
    expect((a?.coverage.requiredSlots ?? 0) + (b?.coverage.requiredSlots ?? 0)).toBe(
      report.coverage.requiredSlots,
    );
  });

  it("counts a promoter working two stores once", () => {
    const report = buildCampaignReport(twoStores());
    expect(report.promoterNames).toEqual(["Άννα", "Βασιλική"]);
    expect(report.promoterCount).toBe(2);
    expect(report.storeCount).toBe(2);
    expect(report.period).toEqual({ from: "2026-06-10", to: "2026-06-12" });
  });

  it("attributes every photo and note to its store and date", () => {
    const report = buildCampaignReport(twoStores());

    expect(report.photos).toHaveLength(2);
    expect(report.photosByStore.map((g) => g.storeId)).toEqual(["store-a", "store-b"]);
    const first = report.photos[0];
    expect(first?.storeName).toBe("Άλφα Γλυφάδα");
    expect(first?.onDate).toBe("2026-06-10");
    expect(first?.promoterName).toBe("Άννα");

    expect(report.notes).toHaveLength(1);
    expect(report.notes[0]?.storeName).toBe("Βήτα Κηφισιά");
    expect(report.notes[0]?.onDate).toBe("2026-06-12");
    expect(report.notes[0]?.promoterName).toBe("Άννα");
  });

  it("emits one shift row per shift, in date order", () => {
    const report = buildCampaignReport(twoStores());
    expect(report.shiftRows.map((r) => r.shiftId)).toEqual(["s1", "s2", "s3"]);
    const last = report.shiftRows[2];
    expect(last?.promotersRequired).toBe(2);
    expect(last?.filledSlots).toBe(1);
    expect(last?.noShows).toBe(1);
    expect(last?.promoterNames).toEqual(["Άννα"]);
    expect(last?.photoCount).toBe(1);
  });

  it("is order-independent", () => {
    const forward = buildCampaignReport(twoStores());
    const scrambled = twoStores();
    scrambled.shifts = [...scrambled.shifts].reverse();
    scrambled.assignments = [...scrambled.assignments].reverse();
    scrambled.fieldReports = [...scrambled.fieldReports].reverse();

    expect(buildCampaignReport(scrambled)).toEqual(forward);
  });
});

// -----------------------------------------------------------------------------------------------
// CSV
// -----------------------------------------------------------------------------------------------

describe("CSV export", () => {
  const report = () =>
    buildCampaignReport(
      input({
        shifts: [shift({ id: "s1", storeId: "store-a" })],
        assignments: [assignment({ id: "a1", shiftId: "s1", promoterName: "Άννα" })],
        fieldReports: [
          fieldReport({
            id: "r1",
            assignmentId: "a1",
            shiftId: "s1",
            notes: "Καλά; ναι",
          }),
        ],
      }),
    );

  it("starts with a UTF-8 BOM so Excel opens Greek text correctly", () => {
    const csv = toCsv(shiftCsvRows(report()));
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv.codePointAt(0)).toBe(0xfeff);
    expect(csv).toContain("Άννα");
  });

  it("uses the Greek Excel list separator and quotes anything containing it", () => {
    expect(CSV_DELIMITER).toBe(";");
    const csv = toCsv([
      ["plain", "has;delimiter", 'has"quote', "line\nbreak"],
    ]);
    expect(csv).toContain('"has;delimiter"');
    expect(csv).toContain('"has""quote"');
    expect(csv).toContain('"line\nbreak"');
  });

  it("neutralises a cell that would otherwise be read as a formula", () => {
    expect(toCsv([["=1+1", "-5", "+A1", "@ref"]])).toContain("'=1+1");
    expect(toCsv([["=1+1"]])).not.toContain(`${CSV_BOM}=`);
  });

  it("puts every total next to the basis it rests on", () => {
    const rows = shiftCsvRows(report());
    const header = rows[0] as string[];
    expect(header).toContain("units_promoted");
    expect(header.indexOf("units_reported_by")).toBe(header.indexOf("units_promoted") + 1);
    expect(header.indexOf("units_expected_from")).toBe(header.indexOf("units_promoted") + 2);
    expect(header).toContain("reports_missing");
    expect(rows).toHaveLength(2);
  });

  it("closes the per-store export with a TOTAL row that matches the rollup", () => {
    const built = report();
    const rows = storeCsvRows(built);
    const header = rows[0] as string[];
    const total = rows[rows.length - 1] as Array<string | number | null>;

    expect(total[header.indexOf("store")]).toBe("TOTAL");
    expect(total[header.indexOf("slots_filled")]).toBe(built.coverage.filledSlots);
    expect(total[header.indexOf("completion_rate_pct")]).toBe(100);
  });

  it("builds a header-safe ASCII filename from a Greek campaign name", () => {
    expect(csvFileName("Δοκιμαστική Καμπάνια", "shifts", "2026-06-15")).toBe(
      "campaign-shifts-2026-06-15.csv",
    );
    expect(csvFileName("Coca-Cola Summer", "stores", "2026-06-15")).toBe(
      "coca-cola-summer-stores-2026-06-15.csv",
    );
  });
});
