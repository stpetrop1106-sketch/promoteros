import { describe, expect, it } from "vitest";
import { formatEuroCents, formatShiftDate, formatShiftTime, formatShiftWhen } from "@/lib/shift-format";

describe("shift formatting for people", () => {
  it("gives the weekday and the month in Greek", () => {
    expect(formatShiftDate("2026-09-15")).toBe("Τρίτη 15 Σεπτεμβρίου");
    expect(formatShiftDate("2026-01-01", { withYear: true })).toBe("Πέμπτη 1 Ιανουαρίου 2026");
  });

  it("never moves the day, whatever the device time zone", () => {
    // A Sunday stays a Sunday: the naive date is formatted in UTC, not local time.
    expect(formatShiftDate("2026-09-13")).toMatch(/^Κυριακή 13/);
  });

  it("leaves anything that is not a calendar date untouched", () => {
    expect(formatShiftDate("15/09")).toBe("15/09");
  });

  it("drops the seconds Postgres returns", () => {
    expect(formatShiftTime("10:00:00")).toBe("10:00");
    expect(formatShiftTime("18:30")).toBe("18:30");
  });

  it("reads as one line", () => {
    expect(formatShiftWhen("2026-09-15", "10:00:00", "20:00:00")).toBe("Τρίτη 15 Σεπτεμβρίου · 10:00–20:00");
  });

  it("writes money the Greek way", () => {
    // Intl inserts a no-break space before the symbol.
    expect(formatEuroCents(3800).replace(/\s/g, " ")).toBe("38,00 €");
    expect(formatEuroCents(125050).replace(/\s/g, " ")).toBe("1.250,50 €");
  });
});
