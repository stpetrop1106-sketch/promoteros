import { describe, expect, it } from "vitest";
import {
  formatShiftHours,
  parseTimeToMinutes,
  payCentsForMinutes,
  shiftDurationMinutes,
  shiftPayCents,
} from "@/lib/shift-pay";
import { formatEuroCents } from "@/lib/shift-format";

describe("reading a shift's clock", () => {
  it("takes what Postgres returns and what a form posts", () => {
    expect(parseTimeToMinutes("10:00")).toBe(600);
    expect(parseTimeToMinutes("10:00:00")).toBe(600);
    expect(parseTimeToMinutes("23:00:00+03")).toBe(1380);
    expect(parseTimeToMinutes(" 09:30 ")).toBe(570);
  });

  it("refuses anything that is not a time", () => {
    expect(parseTimeToMinutes("")).toBeNull();
    expect(parseTimeToMinutes(null)).toBeNull();
    expect(parseTimeToMinutes(undefined)).toBeNull();
    expect(parseTimeToMinutes("evening")).toBeNull();
    expect(parseTimeToMinutes("24:00")).toBeNull();
    expect(parseTimeToMinutes("10:70")).toBeNull();
  });
});

describe("paid duration", () => {
  it("is end minus start, with no break deducted — there is no break column in the schema", () => {
    expect(shiftDurationMinutes("10:00", "20:00")).toBe(600);
    expect(shiftDurationMinutes("09:30", "13:00")).toBe(210);
  });

  it("handles the late shift that runs to 23:00", () => {
    expect(shiftDurationMinutes("16:00:00", "23:00:00")).toBe(420);
    expect(shiftDurationMinutes("18:45", "23:00")).toBe(255);
  });

  it("returns null rather than guessing an overnight wrap", () => {
    // Neither the series form nor the importer can produce this, so it is bad data, not a shift
    // that runs past midnight. Guessing would turn a typo into a 12-hour pay quote.
    expect(shiftDurationMinutes("22:00", "02:00")).toBeNull();
    expect(shiftDurationMinutes("10:00", "10:00")).toBeNull();
  });
});

describe("the money arithmetic", () => {
  it("is exact on the half-hour case that floating point gets wrong", () => {
    // 7,00 €/h × 7,5 h = 52,50 €, to the cent.
    expect(payCentsForMinutes(700, 450)).toBe(5250);
    expect(formatEuroCents(payCentsForMinutes(700, 450)!).replace(/\s/g, " ")).toBe("52,50 €");
  });

  it("rounds the half cent up, not down and not sideways", () => {
    // 10,00 €/h × 50 min = 8,3333… € → 833 cents.
    expect(payCentsForMinutes(1000, 50)).toBe(833);
    // 1,00 €/h × 30 min = exactly 50 cents, no rounding involved.
    expect(payCentsForMinutes(100, 30)).toBe(50);
    // 1,00 €/h × 45 min = 75 cents.
    expect(payCentsForMinutes(100, 45)).toBe(75);
    // 1,01 €/h × 10 min = 16,833… → 17 cents (up).
    expect(payCentsForMinutes(101, 10)).toBe(17);
    // 1,00 €/h × 1 min = 1,666… → 2 cents (up).
    expect(payCentsForMinutes(100, 1)).toBe(2);
    // A genuine half: 1,00 €/h × 27 min = 45,0 exactly; 0,50 €/h × 9 min = 7,5 → 8 (half up).
    expect(payCentsForMinutes(50, 9)).toBe(8);
  });

  it("never returns a fraction of a cent", () => {
    for (let minutes = 1; minutes <= 1440; minutes += 7) {
      for (const rate of [1, 99, 450, 700, 1237]) {
        const cents = payCentsForMinutes(rate, minutes)!;
        expect(Number.isInteger(cents)).toBe(true);
      }
    }
  });

  it("refuses nonsense instead of rounding it", () => {
    expect(payCentsForMinutes(-100, 60)).toBeNull();
    expect(payCentsForMinutes(700, -60)).toBeNull();
    expect(payCentsForMinutes(7.5, 60)).toBeNull();
  });
});

describe("what the promoter is told the shift pays", () => {
  it("is the rate times the hours", () => {
    expect(shiftPayCents(700, "10:00:00", "17:30:00")).toBe(5250);
    expect(shiftPayCents(500, "10:00", "20:00")).toBe(5000);
  });

  it("uses whatever effective rate it is handed — the override is resolved by the caller", () => {
    // campaigns.rate_cents = 500, shifts.rate_cents_override = 800: the caller passes 800.
    expect(shiftPayCents(500, "10:00", "14:00")).toBe(2000);
    expect(shiftPayCents(800, "10:00", "14:00")).toBe(3200);
  });

  it("says nothing when there is no rate — zero pay is a statement, null is silence", () => {
    expect(shiftPayCents(0, "10:00", "20:00")).toBeNull();
    expect(shiftPayCents(null, "10:00", "20:00")).toBeNull();
    expect(shiftPayCents(undefined, "10:00", "20:00")).toBeNull();
  });

  it("says nothing when the hours do not make sense", () => {
    expect(shiftPayCents(700, "22:00", "02:00")).toBeNull();
    expect(shiftPayCents(700, "", "20:00")).toBeNull();
    expect(shiftPayCents(700, "10:00", null)).toBeNull();
  });

  it("covers the late shift end to end", () => {
    // 16:00–23:00 at 6,50 €/h = 7 h × 650 = 45,50 €.
    const cents = shiftPayCents(650, "16:00:00", "23:00:00");
    expect(cents).toBe(4550);
    expect(formatEuroCents(cents!).replace(/\s/g, " ")).toBe("45,50 €");
  });
});

describe("how the hours read", () => {
  it("drops a trailing zero decimal", () => {
    expect(formatShiftHours(480)).toBe("8");
    expect(formatShiftHours(60)).toBe("1");
  });

  it("uses the Greek decimal comma", () => {
    expect(formatShiftHours(450)).toBe("7,5");
    expect(formatShiftHours(210)).toBe("3,5");
    expect(formatShiftHours(255)).toBe("4,25");
  });

  it("returns null for a duration it cannot state", () => {
    expect(formatShiftHours(null)).toBeNull();
    expect(formatShiftHours(undefined)).toBeNull();
    expect(formatShiftHours(0)).toBeNull();
    expect(formatShiftHours(-60)).toBeNull();
  });
});
