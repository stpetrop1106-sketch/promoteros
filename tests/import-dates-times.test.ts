import { describe, expect, it } from "vitest";
import { parseDateCell } from "@/lib/import/dates";
import { parseTimeCell, parseTimeRangeText, parseTimeText } from "@/lib/import/times";

const TODAY = "2026-09-13";

describe("parseDateCell — real Excel dates and serials", () => {
  it("reads a JS Date the way SheetJS hands it over, by UTC parts", () => {
    // SheetJS with cellDates:true builds this from the serial via Date.UTC, so UTC getters are safe.
    const cell = new Date(Date.UTC(2026, 8, 15));
    expect(parseDateCell(cell, TODAY)).toEqual({ ok: true, iso: "2026-09-15" });
  });

  it("converts an Excel serial number (cell not formatted as a date)", () => {
    // Serial 46280 = 2026-09-15 (25569 correction, verified against a real spreadsheet).
    expect(parseDateCell(46280, TODAY)).toEqual({ ok: true, iso: "2026-09-15" });
  });

  it("rejects a non-finite or non-positive serial", () => {
    expect(parseDateCell(0, TODAY)).toEqual({ ok: false });
    expect(parseDateCell(Number.NaN, TODAY)).toEqual({ ok: false });
  });
});

describe("parseDateCell — text formats", () => {
  it("parses ISO yyyy-mm-dd", () => {
    expect(parseDateCell("2026-09-15", TODAY)).toEqual({ ok: true, iso: "2026-09-15" });
  });

  it("parses day-first dd/mm/yyyy", () => {
    expect(parseDateCell("15/09/2026", TODAY)).toEqual({ ok: true, iso: "2026-09-15" });
  });

  it("parses day-first with dashes and a 2-digit year", () => {
    expect(parseDateCell("15-9-26", TODAY)).toEqual({ ok: true, iso: "2026-09-15" });
  });

  it("parses day-first with dots", () => {
    expect(parseDateCell("15.09.2026", TODAY)).toEqual({ ok: true, iso: "2026-09-15" });
  });

  it("strips a leading weekday name", () => {
    expect(parseDateCell("Τρίτη 15/09/2026", TODAY)).toEqual({ ok: true, iso: "2026-09-15" });
  });

  it("resolves a bare dd/mm with no year to the next occurrence on or after today", () => {
    // today is 2026-09-13; 15/09 with no year should resolve to this year (still ahead).
    expect(parseDateCell("15/09", TODAY)).toEqual({ ok: true, iso: "2026-09-15" });
    // 01/01 with no year, today 2026-09-13, should roll to next year.
    expect(parseDateCell("01/01", TODAY)).toEqual({ ok: true, iso: "2027-01-01" });
  });

  it("crosses the New Year boundary correctly from the other side", () => {
    const lateDecToday = "2026-12-20";
    // 05/01 with no year, asked from Dec 20 2026, must resolve forward into January 2027.
    expect(parseDateCell("05/01", lateDecToday)).toEqual({ ok: true, iso: "2027-01-05" });
  });

  it("rejects garbage and out-of-range day/month", () => {
    expect(parseDateCell("not a date", TODAY)).toEqual({ ok: false });
    expect(parseDateCell("32/13/2026", TODAY)).toEqual({ ok: false });
  });
});

describe("parseTimeCell — fractions and text", () => {
  it("converts an Excel day-fraction to HH:MM", () => {
    expect(parseTimeCell(10 / 24)).toBe("10:00");
    expect(parseTimeCell(0.75)).toBe("18:00");
  });

  it("parses HH:MM", () => {
    expect(parseTimeCell("10:00")).toBe("10:00");
  });

  it("parses HH.MM", () => {
    expect(parseTimeCell("10.00")).toBe("10:00");
  });

  it("parses a bare hour", () => {
    expect(parseTimeCell("10")).toBe("10:00");
  });

  it("parses a Greek AM marker glued to the number", () => {
    expect(parseTimeCell("10π.μ.")).toBe("10:00");
  });

  it("parses a Greek PM marker glued with no separator", () => {
    expect(parseTimeCell("18:00μμ")).toBe("18:00");
    expect(parseTimeCell("6μμ")).toBe("18:00");
  });

  it("returns null for unparseable text", () => {
    expect(parseTimeCell("whenever")).toBeNull();
    expect(parseTimeCell("25:00")).toBeNull();
  });
});

describe("parseTimeRangeText — a single cell for both times", () => {
  it("parses a colon dash range", () => {
    expect(parseTimeRangeText("10:00-18:00")).toEqual({ start: "10:00", end: "18:00" });
  });

  it("parses a dotted en-dash range with spaces", () => {
    expect(parseTimeRangeText("10.00 – 18.00")).toEqual({ start: "10:00", end: "18:00" });
  });

  it("parses a Greek 'έως' range", () => {
    expect(parseTimeRangeText("10:00 έως 18:00")).toEqual({ start: "10:00", end: "18:00" });
  });

  it("returns null when either side fails to parse", () => {
    expect(parseTimeRangeText("10:00-whenever")).toBeNull();
    expect(parseTimeRangeText("just one time")).toBeNull();
  });
});

describe("parseTimeText edge cases", () => {
  it("treats 12 with pm marker as noon, and 12 with am marker as midnight", () => {
    expect(parseTimeText("12pm")).toBe("12:00");
    expect(parseTimeText("12am")).toBe("00:00");
  });
});
