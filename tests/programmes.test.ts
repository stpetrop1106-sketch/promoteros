import { describe, expect, it } from "vitest";
import {
  buildProgrammeSummaries,
  buildUnsectionedGroup,
  campaignOptionsFrom,
  clientOptionsFrom,
  filterProgrammeSummaries,
  filterUnsectionedGroup,
  sortProgrammeSummaries,
  type ProgrammeInput,
  type ProgrammeShiftInput,
  type ProgrammeSummary,
} from "@/lib/programmes";

// Hand-built fixtures only, same reasoning as tests/exceptions.test.ts: `lib/programmes.ts` is
// pure by design (every Supabase-touching function takes an already-created client as a
// parameter), which is what makes the aggregation, ordering and filtering assertable without a
// database at all.

const TODAY = "2026-09-13";

function programme(over: Partial<ProgrammeInput> = {}): ProgrammeInput {
  return {
    id: "prog-1",
    campaignId: "camp-1",
    campaignName: "Hyper Vega — Σεπτέμβριος",
    clientName: "Hyper Vega",
    name: "Καταστήματα Αττικής",
    source: "manual",
    sourceFilename: null,
    archivedAt: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

function shift(over: Partial<ProgrammeShiftInput> = {}): ProgrammeShiftInput {
  return {
    id: "shift-1",
    programmeId: "prog-1",
    campaignId: "camp-1",
    campaignName: "Hyper Vega — Σεπτέμβριος",
    clientName: "Hyper Vega",
    storeName: "Γλυφάδα",
    onDate: "2026-09-20",
    startTime: "10:00:00",
    endTime: "18:00:00",
    promotersRequired: 2,
    status: "open",
    confirmedCount: 1,
    ...over,
  };
}

describe("buildProgrammeSummaries", () => {
  it("aggregates coverage, date range and next-shift-date for one section", () => {
    const shifts = [
      shift({ id: "s1", onDate: "2026-09-20", promotersRequired: 2, confirmedCount: 1 }),
      shift({ id: "s2", onDate: "2026-09-25", promotersRequired: 3, confirmedCount: 3 }),
    ];
    const summary = buildProgrammeSummaries([programme()], shifts, TODAY)[0]!;

    expect(summary.shiftCount).toBe(2);
    expect(summary.requiredTotal).toBe(5);
    expect(summary.confirmedTotal).toBe(4);
    expect(summary.openShiftCount).toBe(1); // s1 is short, s2 is full
    expect(summary.fromDate).toBe("2026-09-20");
    expect(summary.toDate).toBe("2026-09-25");
    expect(summary.nextShiftDate).toBe("2026-09-20");
  });

  it("caps a section's own shifts to shifts carrying its programmeId, never another section's", () => {
    const shifts = [
      shift({ id: "s1", programmeId: "prog-1" }),
      shift({ id: "s2", programmeId: "prog-2" }),
    ];
    const summaries = buildProgrammeSummaries(
      [programme({ id: "prog-1" }), programme({ id: "prog-2", name: "Άλλη ενότητα" })],
      shifts,
      TODAY,
    );

    expect(summaries.find((s) => s.id === "prog-1")!.shiftCount).toBe(1);
    expect(summaries.find((s) => s.id === "prog-2")!.shiftCount).toBe(1);
  });

  it("excludes a cancelled shift from coverage totals and date range, but still counts it", () => {
    const shifts = [
      shift({ id: "s1", onDate: "2026-09-20", status: "cancelled", promotersRequired: 5, confirmedCount: 0 }),
      shift({ id: "s2", onDate: "2026-09-22", promotersRequired: 2, confirmedCount: 2 }),
    ];
    const summary = buildProgrammeSummaries([programme()], shifts, TODAY)[0]!;

    expect(summary.shiftCount).toBe(2);
    expect(summary.requiredTotal).toBe(2); // only s2
    expect(summary.openShiftCount).toBe(0);
    expect(summary.fromDate).toBe("2026-09-22"); // the cancelled shift does not widen the range
  });

  it("reports no next shift once every shift is in the past", () => {
    const shifts = [shift({ onDate: "2026-01-01" })];
    const summary = buildProgrammeSummaries([programme()], shifts, TODAY)[0]!;
    expect(summary.nextShiftDate).toBeNull();
  });

  it("returns zeroed aggregates for a brand-new section with no shifts yet", () => {
    const summary = buildProgrammeSummaries([programme()], [], TODAY)[0]!;
    expect(summary.shiftCount).toBe(0);
    expect(summary.fromDate).toBeNull();
    expect(summary.nextShiftDate).toBeNull();
  });
});

describe("buildUnsectionedGroup", () => {
  it("collects only shifts with no programmeId", () => {
    const shifts = [
      shift({ id: "s1", programmeId: "prog-1" }),
      shift({ id: "s2", programmeId: null, onDate: "2026-09-14" }),
      shift({ id: "s3", programmeId: null, onDate: "2026-09-12" }),
    ];
    const group = buildUnsectionedGroup(shifts, TODAY);
    expect(group.shifts.map((s) => s.id)).toEqual(["s3", "s2"]); // sorted by date
    expect(group.nextShiftDate).toBe("2026-09-14");
  });

  it("is empty when every shift belongs to a section", () => {
    const group = buildUnsectionedGroup([shift({ programmeId: "prog-1" })], TODAY);
    expect(group.shifts).toHaveLength(0);
  });
});

describe("sortProgrammeSummaries", () => {
  function summary(over: Partial<ProgrammeSummary>): ProgrammeSummary {
    return {
      id: "id",
      name: "Ενότητα",
      campaignId: "camp-1",
      campaignName: "Καμπάνια",
      clientName: "Πελάτης",
      source: "manual",
      sourceFilename: null,
      archived: false,
      shiftCount: 1,
      requiredTotal: 1,
      confirmedTotal: 1,
      openShiftCount: 0,
      fromDate: "2026-09-01",
      toDate: "2026-09-01",
      nextShiftDate: null,
      shifts: [],
      ...over,
    };
  }

  it("puts the soonest upcoming shift first among sections that have one", () => {
    const list = [
      summary({ id: "far", nextShiftDate: "2026-10-01" }),
      summary({ id: "near", nextShiftDate: "2026-09-15" }),
    ];
    expect(sortProgrammeSummaries(list).map((s) => s.id)).toEqual(["near", "far"]);
  });

  it("sinks a section whose shifts are all in the past below one with an upcoming shift", () => {
    const list = [
      summary({ id: "past", nextShiftDate: null, shiftCount: 3, toDate: "2026-08-01" }),
      summary({ id: "upcoming", nextShiftDate: "2026-12-01" }),
    ];
    expect(sortProgrammeSummaries(list).map((s) => s.id)).toEqual(["upcoming", "past"]);
  });

  it("keeps a brand-new empty section above the all-past sections, not below them", () => {
    const list = [
      summary({ id: "past", nextShiftDate: null, shiftCount: 2, toDate: "2026-01-01" }),
      summary({ id: "empty", nextShiftDate: null, shiftCount: 0, fromDate: null, toDate: null }),
    ];
    expect(sortProgrammeSummaries(list).map((s) => s.id)).toEqual(["empty", "past"]);
  });

  it("among past sections, sinks the longest-finished one furthest down", () => {
    const list = [
      summary({ id: "old", nextShiftDate: null, shiftCount: 1, toDate: "2026-01-01" }),
      summary({ id: "recent", nextShiftDate: null, shiftCount: 1, toDate: "2026-08-01" }),
    ];
    expect(sortProgrammeSummaries(list).map((s) => s.id)).toEqual(["recent", "old"]);
  });
});

describe("filterProgrammeSummaries", () => {
  function summary(over: Partial<ProgrammeSummary>): ProgrammeSummary {
    return {
      id: "id",
      name: "Ενότητα",
      campaignId: "camp-1",
      campaignName: "Καμπάνια",
      clientName: "Hyper Vega",
      source: "manual",
      sourceFilename: null,
      archived: false,
      shiftCount: 1,
      requiredTotal: 1,
      confirmedTotal: 1,
      openShiftCount: 0,
      fromDate: "2026-09-01",
      toDate: "2026-09-01",
      nextShiftDate: "2026-12-01",
      shifts: [],
      ...over,
    };
  }

  it("hides archived sections by default", () => {
    const list = [summary({ id: "a", archived: true }), summary({ id: "b", archived: false })];
    expect(filterProgrammeSummaries(list, { clientName: null, campaignId: null, when: "all", showArchived: false }).map((s) => s.id)).toEqual(["b"]);
  });

  it("shows archived sections when asked", () => {
    const list = [summary({ id: "a", archived: true }), summary({ id: "b", archived: false })];
    const result = filterProgrammeSummaries(list, { clientName: null, campaignId: null, when: "all", showArchived: true });
    expect(result.map((s) => s.id).sort()).toEqual(["a", "b"]);
  });

  it("filters by client name", () => {
    const list = [summary({ id: "a", clientName: "Hyper Vega" }), summary({ id: "b", clientName: "Άλλος πελάτης" })];
    const result = filterProgrammeSummaries(list, { clientName: "Hyper Vega", campaignId: null, when: "all", showArchived: false });
    expect(result.map((s) => s.id)).toEqual(["a"]);
  });

  it("filters by campaign id", () => {
    const list = [summary({ id: "a", campaignId: "camp-1" }), summary({ id: "b", campaignId: "camp-2" })];
    const result = filterProgrammeSummaries(list, { clientName: null, campaignId: "camp-2", when: "all", showArchived: false });
    expect(result.map((s) => s.id)).toEqual(["b"]);
  });

  it("'upcoming' excludes only sections that are entirely in the past", () => {
    const list = [
      summary({ id: "upcoming", nextShiftDate: "2026-12-01" }),
      summary({ id: "empty", nextShiftDate: null, shiftCount: 0 }),
      summary({ id: "past", nextShiftDate: null, shiftCount: 2 }),
    ];
    const result = filterProgrammeSummaries(list, { clientName: null, campaignId: null, when: "upcoming", showArchived: false });
    expect(result.map((s) => s.id).sort()).toEqual(["empty", "upcoming"]);
  });

  it("'past' keeps only sections that are entirely in the past", () => {
    const list = [
      summary({ id: "upcoming", nextShiftDate: "2026-12-01" }),
      summary({ id: "past", nextShiftDate: null, shiftCount: 2 }),
    ];
    const result = filterProgrammeSummaries(list, { clientName: null, campaignId: null, when: "past", showArchived: false });
    expect(result.map((s) => s.id)).toEqual(["past"]);
  });
});

describe("filterUnsectionedGroup", () => {
  it("narrows shifts by client and recomputes the date range and next-shift-date", () => {
    const group = buildUnsectionedGroup(
      [
        shift({ id: "s1", programmeId: null, clientName: "Hyper Vega", onDate: "2026-09-20" }),
        shift({ id: "s2", programmeId: null, clientName: "Άλλος", onDate: "2026-09-10" }),
      ],
      TODAY,
    );
    const result = filterUnsectionedGroup(group, { clientName: "Hyper Vega", campaignId: null, when: "all" }, TODAY);
    expect(result.shifts.map((s) => s.id)).toEqual(["s1"]);
    expect(result.nextShiftDate).toBe("2026-09-20");
  });

  it("empties the bucket under 'past' when its only shift is upcoming", () => {
    const group = buildUnsectionedGroup([shift({ programmeId: null, onDate: "2026-12-01" })], TODAY);
    const result = filterUnsectionedGroup(group, { clientName: null, campaignId: null, when: "past" }, TODAY);
    expect(result.shifts).toHaveLength(0);
  });

  it("keeps the bucket under 'upcoming' when its only shift is upcoming", () => {
    const group = buildUnsectionedGroup([shift({ programmeId: null, onDate: "2026-12-01" })], TODAY);
    const result = filterUnsectionedGroup(group, { clientName: null, campaignId: null, when: "upcoming" }, TODAY);
    expect(result.shifts).toHaveLength(1);
  });
});

describe("campaignOptionsFrom / clientOptionsFrom", () => {
  it("deduplicates and sorts alphabetically", () => {
    const programmes = [
      programme({ campaignId: "c2", campaignName: "Ζ καμπάνια", clientName: "Ω πελάτης" }),
      programme({ campaignId: "c1", campaignName: "Α καμπάνια", clientName: "Α πελάτης" }),
      programme({ campaignId: "c1", campaignName: "Α καμπάνια", clientName: "Α πελάτης" }),
    ];
    expect(campaignOptionsFrom(programmes).map((o) => o.value)).toEqual(["c1", "c2"]);
    expect(clientOptionsFrom(programmes).map((o) => o.value)).toEqual(["Α πελάτης", "Ω πελάτης"]);
  });

  it("omits a null client name rather than showing an empty option", () => {
    const programmes = [programme({ clientName: null })];
    expect(clientOptionsFrom(programmes)).toEqual([]);
  });
});
