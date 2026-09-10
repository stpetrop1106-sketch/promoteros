import { describe, expect, it } from "vitest";
import {
  addDays,
  athensDate,
  athensNowMs,
  athensWallClockMs,
  detectExceptions,
  groupBySeverity,
  rankExceptions,
  relativeWhen,
  summariseToday,
  THRESHOLDS,
  type DetectedException,
  type DetectionInput,
  type ExceptionAssignment,
  type ExceptionCheckIn,
  type ExceptionInvitation,
  type ExceptionShift,
  type ExceptionType,
} from "@/lib/exceptions";

// Hand-built fixtures only. Nothing here touches Supabase — `lib/exceptions.ts` is pure by
// design and takes `now` as a parameter, which is what makes the ranking assertable at all.

// -----------------------------------------------------------------------------------------------
// Fixture helpers
// -----------------------------------------------------------------------------------------------

/**
 * A real UTC instant for a given Athens wall-clock time.
 *
 * Athens is UTC+3 from late March to late October (EEST) and UTC+2 otherwise (EET). Written out
 * explicitly per test rather than derived, so a bug in the code under test cannot also "fix" the
 * fixture.
 */
function athensInstant(iso: string, offsetHours: 2 | 3): Date {
  return new Date(`${iso}:00.000${offsetHours === 3 ? "+03:00" : "+02:00"}`);
}

/** 2026-09-10 is inside EEST, so Athens is UTC+3 that day. */
const SUMMER = 3 as const;
/** 2026-01-15 is inside EET, so Athens is UTC+2 that day. */
const WINTER = 2 as const;

function shift(over: Partial<ExceptionShift> = {}): ExceptionShift {
  return {
    id: "shift-1",
    onDate: "2026-09-10",
    startTime: "10:00:00",
    endTime: "18:00:00",
    promotersRequired: 1,
    status: "open",
    storeName: "Χαλάνδρι",
    campaignName: "Καμπάνια δοκιμής",
    ...over,
  };
}

function assignment(over: Partial<ExceptionAssignment> = {}): ExceptionAssignment {
  return {
    id: "assignment-1",
    shiftId: "shift-1",
    promoterId: "promoter-1",
    fullName: "Ελένη Δοκιμή",
    status: "confirmed",
    cancelledAt: null,
    ...over,
  };
}

function invitation(over: Partial<ExceptionInvitation> = {}): ExceptionInvitation {
  return {
    id: "invitation-1",
    shiftId: "shift-1",
    promoterId: "promoter-2",
    fullName: "Νίκος Δοκιμή",
    status: "pending",
    sentAt: "2026-09-09T09:00:00.000Z",
    expiresAt: "2026-09-10T09:00:00.000Z",
    respondedAt: null,
    ...over,
  };
}

function checkIn(over: Partial<ExceptionCheckIn> = {}): ExceptionCheckIn {
  return {
    assignmentId: "assignment-1",
    checkedInAt: "2026-09-10T07:05:00.000Z",
    distanceFromStoreM: 40,
    withinGeofence: true,
    method: "geolocation",
    ...over,
  };
}

function input(over: Partial<DetectionInput> = {}): DetectionInput {
  return {
    now: athensInstant("2026-09-10T09:30", SUMMER),
    shifts: [],
    assignments: [],
    invitations: [],
    checkIns: [],
    fieldReports: [],
    ...over,
  };
}

function typesOf(list: DetectedException[]): ExceptionType[] {
  return list.map((e) => e.type);
}

/** `noUncheckedIndexedAccess` is on, and "the ranked list is shorter than expected" should fail
 *  as its own clear message rather than as a null-dereference three lines later. */
function at<T>(list: T[], index: number): T {
  const value = list[index];
  if (value === undefined) throw new Error(`expected an element at index ${index}, got ${list.length}`);
  return value;
}

// -----------------------------------------------------------------------------------------------
// Timezone — the one place a silent off-by-one-day bug would be invisible
// -----------------------------------------------------------------------------------------------

describe("Europe/Athens wall-clock arithmetic", () => {
  it("never shifts the day by parsing a bare date string as UTC", () => {
    // `new Date("2026-09-10")` is UTC midnight, which is 03:00 Athens on the 10th — and, for a
    // machine running west of Greenwich, prints as the 9th. Nothing in the engine may do that.
    const naive = new Date("2026-09-10").getTime();
    const correct = athensWallClockMs("2026-09-10", "00:00");
    expect(naive).toBe(correct); // both land on the same *number*…

    // …but the comparison that matters is against `now`, and that is where the naive route breaks.
    // At 01:00 Athens on the 10th the real instant is 22:00 UTC on the *9th*.
    const oneAmAthens = athensInstant("2026-09-10T01:00", SUMMER);
    expect(oneAmAthens.toISOString()).toBe("2026-09-09T22:00:00.000Z");
    expect(oneAmAthens.getUTCDate()).toBe(9); // a UTC-based "today" would say the 9th
    expect(athensDate(oneAmAthens)).toBe("2026-09-10"); // the engine says the 10th, correctly
  });

  it("measures minutes to a shift start correctly in summer time (UTC+3)", () => {
    const now = athensInstant("2026-09-10T09:30", SUMMER);
    expect(now.toISOString()).toBe("2026-09-10T06:30:00.000Z");
    expect(Math.round((athensWallClockMs("2026-09-10", "10:00") - athensNowMs(now)) / 60_000)).toBe(30);
  });

  it("measures minutes to a shift start correctly in winter time (UTC+2)", () => {
    const now = athensInstant("2026-01-15T09:30", WINTER);
    expect(now.toISOString()).toBe("2026-01-15T07:30:00.000Z");
    // The same wall-clock gap, one hour of offset later in the year. A fixed offset would be wrong
    // for one of these two tests; `Intl` with an explicit timeZone is right for both.
    expect(Math.round((athensWallClockMs("2026-01-15", "10:00") - athensNowMs(now)) / 60_000)).toBe(30);
  });

  it("treats a late-evening shift as today, not tomorrow", () => {
    // 23:00 Athens on the 10th is 20:00 UTC on the 10th; a 23:30 shift is 30 minutes away and
    // still belongs to the 10th.
    const now = athensInstant("2026-09-10T23:00", SUMMER);
    expect(athensDate(now)).toBe("2026-09-10");

    const detected = detectExceptions(
      input({ now, shifts: [shift({ startTime: "23:30:00", endTime: "02:00:00" })] }),
    );
    expect(typesOf(detected)).toContain("under_covered");
    expect(at(detected, 0).minutesUntilHarm).toBe(30);
  });

  it("adds days to a date string without a timezone round trip", () => {
    expect(addDays("2026-09-10", -7)).toBe("2026-09-03");
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28"); // and across a month boundary
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

// -----------------------------------------------------------------------------------------------
// One test per exception type
// -----------------------------------------------------------------------------------------------

describe("detectExceptions — the cases from product-spec §8", () => {
  it("flags a shift starting soon with nobody confirmed", () => {
    const detected = detectExceptions(input({ shifts: [shift()] }));
    expect(typesOf(detected)).toEqual(["under_covered"]);
    expect(at(detected, 0).severity).toBe("critical");
    expect(at(detected, 0).minutesUntilHarm).toBe(30);
    expect(at(detected, 0).messageParams.missing).toBe(1);
    expect(at(detected, 0).action.href).toBe("/shifts/shift-1");
  });

  it("uses the plural sentence when more than one seat is empty", () => {
    const detected = detectExceptions(input({ shifts: [shift({ promotersRequired: 3 })] }));
    expect(at(detected, 0).messageKey).toBe("dashboard.ex.under_covered_many");
    expect(at(detected, 0).messageParams.missing).toBe(3);
  });

  it("does not flag a fully covered shift", () => {
    const detected = detectExceptions(input({ shifts: [shift()], assignments: [assignment()] }));
    expect(detected).toEqual([]);
  });

  it("does not flag an under-covered shift beyond the coverage horizon", () => {
    const far = addDays("2026-09-10", 10); // well past the 72-hour horizon
    expect(detectExceptions(input({ shifts: [shift({ onDate: far })] }))).toEqual([]);
  });

  it("flags a pending invitation that is about to expire", () => {
    const detected = detectExceptions(
      input({
        shifts: [shift()],
        // Expires 09:50 Athens = 06:50Z, twenty minutes out.
        invitations: [invitation({ expiresAt: "2026-09-10T06:50:00.000Z" })],
      }),
    );
    expect(typesOf(detected)).toContain("invitation_expiring");
    const expiring = detected.find((e) => e.type === "invitation_expiring")!;
    expect(expiring.minutesUntilHarm).toBe(20); // the invitation bites before the shift does
    expect(expiring.promoterName).toBe("Νίκος Δοκιμή");
  });

  it("flags an invitation that has already expired with no reply", () => {
    const detected = detectExceptions(
      input({
        shifts: [shift()],
        invitations: [invitation({ expiresAt: "2026-09-10T05:30:00.000Z" })], // an hour ago
      }),
    );
    const expired = detected.find((e) => e.type === "invitation_expired");
    expect(expired).toBeDefined();
    expect(expired!.standingForMinutes).toBe(60);
  });

  it("flags a decline that leaves the shift short, but not one that does not", () => {
    const declined = invitation({
      status: "declined",
      respondedAt: "2026-09-10T05:00:00.000Z",
    });

    const short = detectExceptions(input({ shifts: [shift()], invitations: [declined] }));
    expect(typesOf(short)).toContain("declined_short");

    // Same decline, but somebody else has since been confirmed: nothing for a human to do.
    const covered = detectExceptions(
      input({ shifts: [shift()], invitations: [declined], assignments: [assignment()] }),
    );
    expect(typesOf(covered)).not.toContain("declined_short");
  });

  it("flags a cancelled assignment that needs replacing", () => {
    const detected = detectExceptions(
      input({
        shifts: [shift()],
        assignments: [
          assignment({ status: "cancelled", cancelledAt: "2026-09-10T04:30:00.000Z" }),
        ],
      }),
    );
    expect(typesOf(detected)).toContain("assignment_cancelled");
    expect(detected.find((e) => e.type === "assignment_cancelled")!.standingForMinutes).toBe(120);
  });

  it("flags a started shift whose promoter has not checked in, after the grace period", () => {
    // 10:20 Athens: the shift started 20 minutes ago, past the 15-minute grace.
    const now = athensInstant("2026-09-10T10:20", SUMMER);
    const detected = detectExceptions(input({ now, shifts: [shift()], assignments: [assignment()] }));

    expect(typesOf(detected)).toEqual(["no_check_in"]);
    expect(at(detected, 0).severity).toBe("critical");
    expect(at(detected, 0).minutesUntilHarm).toBe(-20); // already hurting
    expect(at(detected, 0).standingForMinutes).toBe(20 - THRESHOLDS.checkInGraceMinutes);
  });

  it("does not flag a promoter who is merely a few minutes late", () => {
    const now = athensInstant("2026-09-10T10:10", SUMMER); // inside the grace period
    const detected = detectExceptions(input({ now, shifts: [shift()], assignments: [assignment()] }));
    expect(detected).toEqual([]);
  });

  it("flags a check-in taken outside the geofence", () => {
    const now = athensInstant("2026-09-10T10:30", SUMMER);
    const detected = detectExceptions(
      input({
        now,
        shifts: [shift()],
        assignments: [assignment()],
        checkIns: [checkIn({ withinGeofence: false, distanceFromStoreM: 850 })],
      }),
    );
    const geofence = detected.find((e) => e.type === "checked_in_outside_geofence");
    expect(geofence).toBeDefined();
    expect(geofence!.severity).toBe("warning");
    expect(geofence!.messageParams.distance).toBe(850);
  });

  it("treats a manual-override check-in as information, never as a failure", () => {
    const now = athensInstant("2026-09-10T10:30", SUMMER);
    const detected = detectExceptions(
      input({
        now,
        shifts: [shift()],
        assignments: [assignment()],
        // A manual override records no position at all, so `within_geofence` is null — it must
        // not be read as "outside the geofence" (CLAUDE.md §3).
        checkIns: [checkIn({ method: "manual_override", withinGeofence: null, distanceFromStoreM: null })],
      }),
    );

    expect(typesOf(detected)).toEqual(["checked_in_manual_override"]);
    expect(at(detected, 0).severity).toBe("info");
    expect(typesOf(detected)).not.toContain("checked_in_outside_geofence");
  });

  it("flags a completed shift with no field report", () => {
    // Two days after a shift that ended at 18:00 on the 10th.
    const now = athensInstant("2026-09-12T18:00", SUMMER);
    const detected = detectExceptions(
      input({
        now,
        shifts: [shift({ status: "completed" })],
        assignments: [assignment({ status: "completed" })],
        checkIns: [checkIn()],
      }),
    );
    const missing = detected.find((e) => e.type === "missing_field_report");
    expect(missing).toBeDefined();
    expect(missing!.severity).toBe("warning"); // past the 24-hour reporting window

    const withReport = detectExceptions(
      input({
        now,
        shifts: [shift({ status: "completed" })],
        assignments: [assignment({ status: "completed" })],
        checkIns: [checkIn()],
        fieldReports: [{ assignmentId: "assignment-1" }],
      }),
    );
    expect(typesOf(withReport)).not.toContain("missing_field_report");
  });

  it("ignores a cancelled shift entirely — it needs nobody", () => {
    expect(detectExceptions(input({ shifts: [shift({ status: "cancelled" })] }))).toEqual([]);
  });
});

// -----------------------------------------------------------------------------------------------
// Ranking — the actual feature
// -----------------------------------------------------------------------------------------------

describe("ranking by urgency", () => {
  it("puts a shift starting in 30 minutes with nobody confirmed above a missing field report", () => {
    const now = athensInstant("2026-09-10T09:30", SUMMER);

    const detected = detectExceptions(
      input({
        now,
        shifts: [
          // Yesterday's shift, worked, no report filed.
          shift({ id: "shift-yesterday", onDate: "2026-09-09", status: "completed" }),
          // Today's shift, starting in 30 minutes, nobody confirmed.
          shift({ id: "shift-now" }),
        ],
        assignments: [
          assignment({ id: "assignment-yesterday", shiftId: "shift-yesterday", status: "completed" }),
        ],
        checkIns: [checkIn({ assignmentId: "assignment-yesterday", checkedInAt: "2026-09-09T07:05:00.000Z" })],
      }),
    );

    expect(at(detected, 0).type).toBe("under_covered");
    expect(at(detected, 0).shiftId).toBe("shift-now");
    expect(typesOf(detected)).toContain("missing_field_report");
    expect(detected.findIndex((e) => e.type === "under_covered")).toBeLessThan(
      detected.findIndex((e) => e.type === "missing_field_report"),
    );
  });

  it("ranks by urgency rather than by date order", () => {
    const now = athensInstant("2026-09-10T09:30", SUMMER);
    const detected = detectExceptions(
      input({
        now,
        shifts: [
          // Fetched first and earlier in the list, but two days out.
          shift({ id: "shift-later", onDate: "2026-09-12" }),
          shift({ id: "shift-soon" }),
        ],
      }),
    );

    expect(detected.map((e) => e.shiftId)).toEqual(["shift-soon", "shift-later"]);
    expect(at(detected, 0).severity).toBe("critical");
    expect(at(detected, 1).severity).toBe("warning");
  });

  it("puts something already going wrong above something about to go wrong", () => {
    const now = athensInstant("2026-09-10T09:30", SUMMER);
    const detected = detectExceptions(
      input({
        now,
        shifts: [
          shift({ id: "shift-running", startTime: "08:00:00", endTime: "16:00:00" }),
          shift({ id: "shift-soon" }),
        ],
        // Confirmed on the running shift, never checked in — 90 minutes late.
        assignments: [assignment({ id: "assignment-running", shiftId: "shift-running" })],
      }),
    );

    expect(at(detected, 0).type).toBe("no_check_in");
    expect(at(detected, 0).minutesUntilHarm).toBeLessThan(0);
    expect(at(detected, 1).type).toBe("under_covered");
    expect(at(detected, 1).minutesUntilHarm).toBeGreaterThan(0);
  });

  it("never lets an informational item outrank a live one, however old it is", () => {
    const stale: DetectedException = {
      id: "checked_in_manual_override:a:b",
      type: "checked_in_manual_override",
      severity: "info",
      shiftId: "a",
      promoterId: "b",
      promoterName: "X",
      storeName: "S",
      campaignName: "C",
      minutesUntilHarm: -10_000, // hours in the past
      standingForMinutes: 10_000,
      messageKey: "dashboard.ex.manual_override",
      messageParams: {},
      when: relativeWhen(-10_000),
      action: { labelKey: "dashboard.action.open_shift", href: "/shifts/a" },
    };
    const live: DetectedException = {
      ...stale,
      id: "under_covered:c",
      type: "under_covered",
      severity: "critical",
      minutesUntilHarm: 30,
      standingForMinutes: 0,
      messageKey: "dashboard.ex.under_covered_one",
    };

    expect(typesOf(rankExceptions([stale, live]))).toEqual(["under_covered", "checked_in_manual_override"]);
  });

  it("is a total order — the same input always ranks the same way", () => {
    const now = athensInstant("2026-09-10T09:30", SUMMER);
    const built = () =>
      detectExceptions(
        input({
          now,
          shifts: [shift({ id: "s1" }), shift({ id: "s2" }), shift({ id: "s3" })],
        }),
      ).map((e) => e.id);

    expect(built()).toEqual(built());
    expect(new Set(built()).size).toBe(3); // ids are unique, so nothing renders twice
  });
});

// -----------------------------------------------------------------------------------------------
// Presentation helpers
// -----------------------------------------------------------------------------------------------

describe("relativeWhen", () => {
  it("picks the coarsest honest unit and keeps the direction", () => {
    expect(relativeWhen(0)).toEqual({ direction: "now", unit: "minute", value: 0 });
    expect(relativeWhen(30)).toEqual({ direction: "future", unit: "minute", value: 30 });
    expect(relativeWhen(-30)).toEqual({ direction: "past", unit: "minute", value: 30 });
    expect(relativeWhen(180)).toEqual({ direction: "future", unit: "hour", value: 3 });
    expect(relativeWhen(-4 * 24 * 60)).toEqual({ direction: "past", unit: "day", value: 4 });
  });
});

describe("groupBySeverity", () => {
  it("keeps rank order inside each band and drops empty bands", () => {
    const now = athensInstant("2026-09-10T09:30", SUMMER);
    const groups = groupBySeverity(
      detectExceptions(
        input({ now, shifts: [shift({ id: "s-soon" }), shift({ id: "s-later", onDate: "2026-09-12" })] }),
      ),
    );

    expect(groups.map((g) => g.severity)).toEqual(["critical", "warning"]);
    expect(at(at(groups, 0).items, 0).shiftId).toBe("s-soon");
  });
});

describe("summariseToday", () => {
  it("counts by the Athens calendar day, not the UTC one", () => {
    // 01:00 Athens on the 10th is still 2026-09-09 in UTC.
    const now = athensInstant("2026-09-10T01:00", SUMMER);
    const summary = summariseToday(
      input({
        now,
        shifts: [shift({ id: "today", onDate: "2026-09-10" }), shift({ id: "yesterday", onDate: "2026-09-09" })],
      }),
    );

    expect(summary.date).toBe("2026-09-10");
    expect(summary.shiftCount).toBe(1);
  });

  it("counts confirmed seats and check-ins against today's shifts only", () => {
    const now = athensInstant("2026-09-10T12:00", SUMMER);
    const summary = summariseToday(
      input({
        now,
        shifts: [shift({ promotersRequired: 2 })],
        assignments: [
          assignment({ id: "a1", promoterId: "p1" }),
          assignment({ id: "a2", promoterId: "p2" }),
          // A cancelled row covers no seat.
          assignment({ id: "a3", promoterId: "p3", status: "cancelled", cancelledAt: "2026-09-09T10:00:00.000Z" }),
        ],
        checkIns: [checkIn({ assignmentId: "a1" })],
      }),
    );

    expect(summary).toEqual({
      date: "2026-09-10",
      shiftCount: 1,
      requiredCount: 2,
      confirmedCount: 2,
      checkedInCount: 1,
    });
  });
});
