import { describe, expect, it } from "vitest";
import { parseRows, validateRow } from "@/lib/import/row-parser";
import type { Cell, ColumnMapping, ParseOptions, ParsedRow, RowIssueCode, SheetGrid } from "@/lib/import/types";

const TODAY = "2026-09-13";
const OPTIONS: ParseOptions = { today: TODAY };

const MAPPING: ColumnMapping = {
  0: "date",
  1: "store_name",
  2: "start_time",
  3: "end_time",
  4: "promoters_required",
  5: "notes",
};

function grid(rows: Cell[][]): SheetGrid {
  return { name: "Sheet1", rows };
}

function issueCodes(row: ParsedRow): RowIssueCode[] {
  return row.issues.map((i) => i.code);
}

describe("parseRows — a clean file", () => {
  it("produces one shift per data row with no issues", () => {
    const g = grid([
      ["Date", "Store", "Start", "End", "Promoters", "Notes"],
      ["2026-09-20", "Acme Kiosk", "10:00", "18:00", 2, "bring flyers"],
      ["2026-09-21", "Acme Kiosk", "10:00", "18:00", 2, ""],
    ]);
    const rows = parseRows(g, 0, MAPPING, OPTIONS);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      sourceRow: 2,
      date: "2026-09-20",
      startTime: "10:00",
      endTime: "18:00",
      storeName: "Acme Kiosk",
      promotersRequired: 2,
      notes: "bring flyers",
      issues: [],
    });
    expect(rows[1]!.notes).toBeNull();
  });
});

describe("parseRows — skips blank and footer rows", () => {
  it("does not emit a row for a blank spacer or a totals row", () => {
    const g = grid([
      ["Date", "Store", "Start", "End", "Promoters", "Notes"],
      ["2026-09-20", "Acme Kiosk", "10:00", "18:00", 2, ""],
      [null, null, null, null, null, null],
      ["ΣΥΝΟΛΟ", null, null, null, 2, null],
    ]);
    const rows = parseRows(g, 0, MAPPING, OPTIONS);
    expect(rows).toHaveLength(1);
  });
});

describe("parseRows — time_range wins over separate start/end", () => {
  const rangeMapping: ColumnMapping = { 0: "date", 1: "store_name", 2: "time_range", 3: "start_time", 4: "end_time" };

  it("uses the range cell when both are mapped and the range parses", () => {
    const g = grid([
      ["Date", "Store", "Range", "Start", "End"],
      ["2026-09-20", "Acme Kiosk", "11:00-19:00", "10:00", "18:00"],
    ]);
    const rows = parseRows(g, 0, rangeMapping, OPTIONS);
    expect(rows[0]!.startTime).toBe("11:00");
    expect(rows[0]!.endTime).toBe("19:00");
  });

  it("falls back to start/end when the range cell is blank", () => {
    const g = grid([
      ["Date", "Store", "Range", "Start", "End"],
      ["2026-09-20", "Acme Kiosk", "", "10:00", "18:00"],
    ]);
    const rows = parseRows(g, 0, rangeMapping, OPTIONS);
    expect(rows[0]!.startTime).toBe("10:00");
    expect(rows[0]!.endTime).toBe("18:00");
  });
});

describe("parseRows — end before start is an error, never an overnight shift", () => {
  it("flags end_before_start and does not wrap to the next day", () => {
    const g = grid([
      ["Date", "Store", "Start", "End", "Promoters", "Notes"],
      ["2026-09-20", "Acme Kiosk", "22:00", "06:00", 2, ""],
    ]);
    const rows = parseRows(g, 0, MAPPING, OPTIONS);
    expect(issueCodes(rows[0]!)).toContain("end_before_start");
  });
});

describe("parseRows — every RowIssueCode", () => {
  it("missing_date: blank date cell", () => {
    const g = grid([
      ["Date", "Store", "Start", "End", "Promoters", "Notes"],
      ["", "Acme Kiosk", "10:00", "18:00", 2, ""],
    ]);
    expect(issueCodes(parseRows(g, 0, MAPPING, OPTIONS)[0]!)).toContain("missing_date");
  });

  it("unparseable_date: garbage text in the date cell", () => {
    const g = grid([
      ["Date", "Store", "Start", "End", "Promoters", "Notes"],
      ["not-a-date", "Acme Kiosk", "10:00", "18:00", 2, ""],
    ]);
    const row = parseRows(g, 0, MAPPING, OPTIONS)[0]!;
    expect(issueCodes(row)).toContain("unparseable_date");
    expect(issueCodes(row)).not.toContain("missing_date");
  });

  it("missing_store: blank store cell", () => {
    const g = grid([
      ["Date", "Store", "Start", "End", "Promoters", "Notes"],
      ["2026-09-20", "", "10:00", "18:00", 2, ""],
    ]);
    expect(issueCodes(parseRows(g, 0, MAPPING, OPTIONS)[0]!)).toContain("missing_store");
  });

  it("missing_time: both time cells blank", () => {
    const g = grid([
      ["Date", "Store", "Start", "End", "Promoters", "Notes"],
      ["2026-09-20", "Acme Kiosk", "", "", 2, ""],
    ]);
    expect(issueCodes(parseRows(g, 0, MAPPING, OPTIONS)[0]!)).toContain("missing_time");
  });

  it("unparseable_time: time cell has content that doesn't parse", () => {
    const g = grid([
      ["Date", "Store", "Start", "End", "Promoters", "Notes"],
      ["2026-09-20", "Acme Kiosk", "whenever", "18:00", 2, ""],
    ]);
    const row = parseRows(g, 0, MAPPING, OPTIONS)[0]!;
    expect(issueCodes(row)).toContain("unparseable_time");
    expect(issueCodes(row)).not.toContain("missing_time");
  });

  it("end_before_start", () => {
    const g = grid([
      ["Date", "Store", "Start", "End", "Promoters", "Notes"],
      ["2026-09-20", "Acme Kiosk", "18:00", "10:00", 2, ""],
    ]);
    expect(issueCodes(parseRows(g, 0, MAPPING, OPTIONS)[0]!)).toContain("end_before_start");
  });

  it("past_date: a date before today is a warning, not an error, and still imports", () => {
    const g = grid([
      ["Date", "Store", "Start", "End", "Promoters", "Notes"],
      ["2026-01-01", "Acme Kiosk", "10:00", "18:00", 2, ""],
    ]);
    const row = parseRows(g, 0, MAPPING, OPTIONS)[0]!;
    expect(issueCodes(row)).toContain("past_date");
    const pastDateIssue = row.issues.find((i) => i.code === "past_date")!;
    expect(pastDateIssue.severity).toBe("warning");
  });

  it("bad_headcount: unparseable headcount falls back to the default and warns", () => {
    const g = grid([
      ["Date", "Store", "Start", "End", "Promoters", "Notes"],
      ["2026-09-20", "Acme Kiosk", "10:00", "18:00", "πολλά", ""],
    ]);
    const row = parseRows(g, 0, MAPPING, { ...OPTIONS, defaultPromoters: 3 })[0]!;
    expect(issueCodes(row)).toContain("bad_headcount");
    expect(row.promotersRequired).toBe(3);
  });

  it("duplicate_in_file: two identical rows are both flagged", () => {
    const g = grid([
      ["Date", "Store", "Start", "End", "Promoters", "Notes"],
      ["2026-09-20", "Acme Kiosk", "10:00", "18:00", 2, ""],
      ["2026-09-20", "Acme Kiosk", "10:00", "18:00", 2, "same shift again"],
    ]);
    const rows = parseRows(g, 0, MAPPING, OPTIONS);
    expect(issueCodes(rows[0]!)).not.toContain("duplicate_in_file");
    expect(issueCodes(rows[1]!)).toContain("duplicate_in_file");
  });
});

describe("headcount defaults", () => {
  it("uses the default when the column is absent from the mapping", () => {
    const mappingNoHeadcount: ColumnMapping = { 0: "date", 1: "store_name", 2: "start_time", 3: "end_time" };
    const g = grid([
      ["Date", "Store", "Start", "End"],
      ["2026-09-20", "Acme Kiosk", "10:00", "18:00"],
    ]);
    const rows = parseRows(g, 0, mappingNoHeadcount, { today: TODAY, defaultPromoters: 5 });
    expect(rows[0]!.promotersRequired).toBe(5);
    expect(rows[0]!.issues.map((i) => i.code)).not.toContain("bad_headcount");
  });

  it("defaults to 1 when defaultPromoters is not given", () => {
    const mappingNoHeadcount: ColumnMapping = { 0: "date", 1: "store_name", 2: "start_time", 3: "end_time" };
    const g = grid([
      ["Date", "Store", "Start", "End"],
      ["2026-09-20", "Acme Kiosk", "10:00", "18:00"],
    ]);
    const rows = parseRows(g, 0, mappingNoHeadcount, { today: TODAY });
    expect(rows[0]!.promotersRequired).toBe(1);
  });

  it("parses headcount with trailing text like '2 άτομα'", () => {
    const g = grid([
      ["Date", "Store", "Start", "End", "Promoters", "Notes"],
      ["2026-09-20", "Acme Kiosk", "10:00", "18:00", "2 άτομα", ""],
    ]);
    const rows = parseRows(g, 0, MAPPING, OPTIONS);
    expect(rows[0]!.promotersRequired).toBe(2);
    expect(rows[0]!.issues.map((i) => i.code)).not.toContain("bad_headcount");
  });
});

describe("validateRow — same issues as parseRows for the same values", () => {
  const codesToCheck: RowIssueCode[] = ["missing_date", "past_date", "missing_time", "end_before_start", "missing_store"];

  it("agrees with parseRows for a row with a genuinely blank date and store", () => {
    const g = grid([
      ["Date", "Store", "Start", "End", "Promoters", "Notes"],
      ["", "", "10:00", "18:00", 2, ""],
    ]);
    const parsed = parseRows(g, 0, MAPPING, OPTIONS)[0]!;
    const revalidated = validateRow({ ...parsed, issues: [] }, OPTIONS);
    const parsedRelevant = parsed.issues.map((i) => i.code).filter((c) => codesToCheck.includes(c)).sort();
    const revalidatedRelevant = revalidated.issues.map((i) => i.code).filter((c) => codesToCheck.includes(c)).sort();
    expect(revalidatedRelevant).toEqual(parsedRelevant);
    expect(revalidatedRelevant).toEqual(["missing_date", "missing_store"]);
  });

  it("agrees with parseRows for end-before-start", () => {
    const g = grid([
      ["Date", "Store", "Start", "End", "Promoters", "Notes"],
      ["2026-09-20", "Acme Kiosk", "18:00", "10:00", 2, ""],
    ]);
    const parsed = parseRows(g, 0, MAPPING, OPTIONS)[0]!;
    const revalidated = validateRow(parsed, OPTIONS);
    expect(revalidated.issues.map((i) => i.code)).toEqual(parsed.issues.map((i) => i.code));
  });

  it("agrees with parseRows for a past date", () => {
    const g = grid([
      ["Date", "Store", "Start", "End", "Promoters", "Notes"],
      ["2020-01-01", "Acme Kiosk", "10:00", "18:00", 2, ""],
    ]);
    const parsed = parseRows(g, 0, MAPPING, OPTIONS)[0]!;
    const revalidated = validateRow(parsed, OPTIONS);
    expect(revalidated.issues.map((i) => i.code)).toEqual(parsed.issues.map((i) => i.code));
  });

  it("does not throw and returns a well-formed row for a fully valid input", () => {
    const g = grid([
      ["Date", "Store", "Start", "End", "Promoters", "Notes"],
      ["2026-09-20", "Acme Kiosk", "10:00", "18:00", 2, ""],
    ]);
    const parsed = parseRows(g, 0, MAPPING, OPTIONS)[0]!;
    expect(validateRow(parsed, OPTIONS).issues).toEqual([]);
  });
});
