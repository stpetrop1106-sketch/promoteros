import { describe, expect, it } from "vitest";
import {
  formatMonthLabel,
  formatPaidHours,
  isWorkedShift,
  monthKeyOf,
  monthsWithWorkedShifts,
  priceShift,
  resolveEffectiveRateCents,
  resolveSelectedMonth,
  summariseMonth,
  type PromoterShiftRow,
} from "@/lib/promoters/earnings";
import { formatEuroCents } from "@/lib/shift-format";

/**
 * `Intl.NumberFormat` separates the amount from the € with a NARROW NO-BREAK SPACE (U+202F) on
 * some ICU versions and a plain one on others, so asserting on the formatted string directly makes
 * a test that passes on one machine and fails on another. Fold every kind of space to a plain one
 * and compare that. The assertion is about the amount, not about which space ICU chose.
 */
const normaliseEuro = (value: string): string => value.replace(/[s  ]+/g, " ").trim();

const TODAY = "2026-10-01";

/** A worked eight-hour shift at the campaign's 7,00 €/h, unless the caller says otherwise. */
function row(over: Partial<PromoterShiftRow> = {}): PromoterShiftRow {
  return {
    assignmentId: `a-${over.onDate ?? "x"}-${over.startTime ?? "10"}`,
    shiftId: "s-1",
    status: "confirmed",
    onDate: "2026-09-15",
    startTime: "10:00:00",
    endTime: "18:00:00",
    clientName: "Πελάτης ΑΕ",
    campaignName: "Δειγματισμός",
    storeName: "Κατάστημα Γλυφάδας",
    storeAddress: "Λεωφ. Βουλιαγμένης 1",
    campaignRateCents: 700,
    shiftRateOverrideCents: null,
    hasCheckIn: true,
    checkedInAt: "2026-09-15T07:02:00.000Z",
    ...over,
  };
}

describe("the one rate resolver", () => {
  it("falls back to the campaign's standing rate", () => {
    expect(resolveEffectiveRateCents({ campaignRateCents: 700, shiftRateOverrideCents: null })).toBe(700);
  });

  it("lets a shift-level override beat the campaign", () => {
    expect(resolveEffectiveRateCents({ campaignRateCents: 700, shiftRateOverrideCents: 950 })).toBe(950);
  });

  it("lets the frozen snapshot beat both — the column this is written for", () => {
    expect(
      resolveEffectiveRateCents({
        campaignRateCents: 1200,
        shiftRateOverrideCents: 950,
        rateSnapshotCents: 700,
      }),
    ).toBe(700);
  });

  it("ignores an absent snapshot rather than treating it as zero", () => {
    // This is the whole of today's behaviour: the field exists on the type, is never populated,
    // and must fall straight through to the live rate.
    expect(
      resolveEffectiveRateCents({
        campaignRateCents: 700,
        shiftRateOverrideCents: null,
        rateSnapshotCents: null,
      }),
    ).toBe(700);
    expect(
      resolveEffectiveRateCents({
        campaignRateCents: 700,
        shiftRateOverrideCents: null,
        rateSnapshotCents: undefined,
      }),
    ).toBe(700);
  });

  it("treats `rate_cents` 0 as 'nobody set a rate', not as a free day", () => {
    // `campaigns.rate_cents` is `not null default 0`, so 0 is the unset state and must become
    // null — a screen says "—", never "0,00 €".
    expect(resolveEffectiveRateCents({ campaignRateCents: 0, shiftRateOverrideCents: null })).toBeNull();
    expect(resolveEffectiveRateCents({ campaignRateCents: 0, shiftRateOverrideCents: 0 })).toBeNull();
    expect(resolveEffectiveRateCents({ campaignRateCents: -100, shiftRateOverrideCents: null })).toBeNull();
    expect(resolveEffectiveRateCents({ campaignRateCents: null, shiftRateOverrideCents: null })).toBeNull();
  });

  it("skips an unset override and keeps looking instead of stopping at it", () => {
    expect(resolveEffectiveRateCents({ campaignRateCents: 700, shiftRateOverrideCents: 0 })).toBe(700);
  });
});

describe("what counts as worked — D24", () => {
  it("needs a check-in AND a date that has passed", () => {
    expect(isWorkedShift(row(), TODAY)).toBe(true);
  });

  it("does not count a shift with no check-in, whatever its status says", () => {
    // The point of D24. `confirmed` with no arrival declared is not evidence that anyone worked.
    expect(isWorkedShift(row({ hasCheckIn: false }), TODAY)).toBe(false);
  });

  it("does not count a `completed` status on its own", () => {
    // Nothing has ever written `completed`, but if something starts to, it must not become a
    // second source of truth — the check-in stays the evidence.
    expect(isWorkedShift(row({ status: "completed", hasCheckIn: false }), TODAY)).toBe(false);
  });

  it("counts a `completed` status that also has the arrival on record", () => {
    expect(isWorkedShift(row({ status: "completed", hasCheckIn: true }), TODAY)).toBe(true);
  });

  it("never counts cancelled or no_show, even with a check-in row", () => {
    expect(isWorkedShift(row({ status: "cancelled" }), TODAY)).toBe(false);
    expect(isWorkedShift(row({ status: "no_show" }), TODAY)).toBe(false);
  });

  it("does not count today's shift — the day is not over", () => {
    expect(isWorkedShift(row({ onDate: TODAY }), TODAY)).toBe(false);
  });

  it("does not count a future shift someone has already checked into", () => {
    expect(isWorkedShift(row({ onDate: "2026-11-02" }), TODAY)).toBe(false);
  });

  it("compares dates as strings, which is safe for ISO dates across a year boundary", () => {
    expect(isWorkedShift(row({ onDate: "2025-12-31" }), "2026-01-01")).toBe(true);
    expect(isWorkedShift(row({ onDate: "2026-01-01" }), "2026-01-01")).toBe(false);
  });
});

describe("months offered to the selector", () => {
  it("offers only months that have worked shifts, newest first", () => {
    const rows = [
      row({ onDate: "2026-09-15" }),
      row({ onDate: "2026-09-20" }),
      row({ onDate: "2026-03-02" }),
      row({ onDate: "2026-07-11" }),
    ];
    expect(monthsWithWorkedShifts(rows, TODAY)).toEqual(["2026-09", "2026-07", "2026-03"]);
  });

  it("leaves out a month whose only shifts were cancelled or never arrived at", () => {
    const rows = [
      row({ onDate: "2026-09-15" }),
      row({ onDate: "2026-08-10", status: "cancelled" }),
      row({ onDate: "2026-06-04", hasCheckIn: false }),
    ];
    expect(monthsWithWorkedShifts(rows, TODAY)).toEqual(["2026-09"]);
  });

  it("keeps a month whose shifts were worked but have no rate — the hours are still real", () => {
    const rows = [row({ onDate: "2026-05-06", campaignRateCents: 0 })];
    expect(monthsWithWorkedShifts(rows, TODAY)).toEqual(["2026-05"]);
  });

  it("offers nothing when nothing has been worked", () => {
    expect(monthsWithWorkedShifts([], TODAY)).toEqual([]);
    expect(monthsWithWorkedShifts([row({ hasCheckIn: false })], TODAY)).toEqual([]);
  });
});

describe("choosing which month to show", () => {
  const available = ["2026-09", "2026-07"];

  it("honours a requested month that has data", () => {
    expect(resolveSelectedMonth("2026-07", available, TODAY)).toBe("2026-07");
  });

  it("falls back to the newest month with data when the request has none", () => {
    expect(resolveSelectedMonth("2026-08", available, TODAY)).toBe("2026-09");
    expect(resolveSelectedMonth(null, available, TODAY)).toBe("2026-09");
    expect(resolveSelectedMonth("rubbish", available, TODAY)).toBe("2026-09");
  });

  it("falls back to the current month when there is no data at all", () => {
    expect(resolveSelectedMonth(null, [], TODAY)).toBe("2026-10");
    expect(resolveSelectedMonth("2026-04", [], TODAY)).toBe("2026-04");
  });
});

describe("pricing one shift", () => {
  it("states the hours and the day's pay", () => {
    const priced = priceShift(row({ startTime: "10:00:00", endTime: "18:00:00", campaignRateCents: 700 }));
    expect(priced.paidMinutes).toBe(480);
    expect(priced.rateCents).toBe(700);
    expect(priced.payCents).toBe(5600);
    expect(normaliseEuro(formatEuroCents(priced.payCents!))).toBe("56,00 €");
  });

  it("says nothing rather than zero when no rate has been set", () => {
    const priced = priceShift(row({ campaignRateCents: 0 }));
    expect(priced.rateCents).toBeNull();
    expect(priced.payCents).toBeNull();
    // The hours are still known — only the money is not.
    expect(priced.paidMinutes).toBe(480);
  });

  it("says nothing when the hours do not make sense", () => {
    const priced = priceShift(row({ startTime: "18:00:00", endTime: "10:00:00" }));
    expect(priced.paidMinutes).toBeNull();
    expect(priced.payCents).toBeNull();
  });

  it("does not invent an unpaid break", () => {
    // Twelve hours is twelve paid hours. There is no break column in the schema and inventing
    // one here would underpay a real person against a number nobody entered.
    const priced = priceShift(row({ startTime: "08:00:00", endTime: "20:00:00", campaignRateCents: 700 }));
    expect(priced.paidMinutes).toBe(720);
    expect(priced.payCents).toBe(8400);
  });
});

describe("the month's three numbers", () => {
  it("reproduces the owner's own example: 12 shifts, 96 hours, 672,00 €", () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      row({
        onDate: `2026-09-${String(i + 1).padStart(2, "0")}`,
        startTime: "10:00:00",
        endTime: "18:00:00",
        campaignRateCents: 700,
      }),
    );
    const summary = summariseMonth(rows, "2026-09", TODAY);
    expect(summary.shiftCount).toBe(12);
    expect(summary.paidMinutes).toBe(5760);
    expect(formatPaidHours(summary.paidMinutes)).toBe("96");
    expect(summary.totalCents).toBe(67200);
    expect(normaliseEuro(formatEuroCents(summary.totalCents))).toBe("672,00 €");
    expect(summary.partial).toBe(false);
  });

  it("counts only the chosen month", () => {
    const rows = [
      row({ onDate: "2026-09-15" }),
      row({ onDate: "2026-08-15" }),
      row({ onDate: "2026-09-16" }),
    ];
    expect(summariseMonth(rows, "2026-09", TODAY).shiftCount).toBe(2);
    expect(summariseMonth(rows, "2026-08", TODAY).shiftCount).toBe(1);
    expect(summariseMonth(rows, "2026-07", TODAY).shiftCount).toBe(0);
  });

  it("excludes cancelled, no_show and never-arrived shifts from all three numbers", () => {
    const rows = [
      row({ onDate: "2026-09-01" }),
      row({ onDate: "2026-09-02", status: "cancelled" }),
      row({ onDate: "2026-09-03", status: "no_show" }),
      row({ onDate: "2026-09-04", hasCheckIn: false }),
    ];
    const summary = summariseMonth(rows, "2026-09", TODAY);
    expect(summary.shiftCount).toBe(1);
    expect(summary.paidMinutes).toBe(480);
    expect(summary.totalCents).toBe(5600);
  });

  it("flags a partial total instead of quietly reporting a short one", () => {
    const rows = [
      row({ onDate: "2026-09-01", campaignRateCents: 700 }),
      row({ onDate: "2026-09-02", campaignRateCents: 0 }),
    ];
    const summary = summariseMonth(rows, "2026-09", TODAY);
    expect(summary.shiftCount).toBe(2);
    // Both days' hours are counted — the work happened.
    expect(summary.paidMinutes).toBe(960);
    // Only the priced day is in the money.
    expect(summary.totalCents).toBe(5600);
    expect(summary.unpricedShiftCount).toBe(1);
    expect(summary.partial).toBe(true);
  });

  it("is empty and honest for a month with nothing in it", () => {
    const summary = summariseMonth([], "2026-09", TODAY);
    expect(summary.shiftCount).toBe(0);
    expect(summary.paidMinutes).toBe(0);
    expect(summary.totalCents).toBe(0);
    expect(summary.partial).toBe(false);
    expect(summary.shifts).toEqual([]);
  });

  it("stays exact over half-hour shifts — no floating point in the total", () => {
    const rows = Array.from({ length: 3 }, (_, i) =>
      row({ onDate: `2026-09-0${i + 1}`, startTime: "10:00", endTime: "17:30", campaignRateCents: 700 }),
    );
    const summary = summariseMonth(rows, "2026-09", TODAY);
    expect(summary.totalCents).toBe(15750);
    expect(normaliseEuro(formatEuroCents(summary.totalCents))).toBe("157,50 €");
  });

  it("honours a shift-level override inside the total", () => {
    const rows = [
      row({ onDate: "2026-09-01", campaignRateCents: 700 }),
      row({ onDate: "2026-09-02", campaignRateCents: 700, shiftRateOverrideCents: 1000 }),
    ];
    expect(summariseMonth(rows, "2026-09", TODAY).totalCents).toBe(5600 + 8000);
  });

  it("lists the month's shifts newest first", () => {
    const rows = [
      row({ onDate: "2026-09-01" }),
      row({ onDate: "2026-09-20" }),
      row({ onDate: "2026-09-10" }),
    ];
    expect(summariseMonth(rows, "2026-09", TODAY).shifts.map((s) => s.onDate)).toEqual([
      "2026-09-20",
      "2026-09-10",
      "2026-09-01",
    ]);
  });

  it("orders two shifts on the same day by their start time, latest first", () => {
    const rows = [
      row({ onDate: "2026-09-05", startTime: "09:00", endTime: "13:00" }),
      row({ onDate: "2026-09-05", startTime: "15:00", endTime: "19:00" }),
    ];
    expect(summariseMonth(rows, "2026-09", TODAY).shifts.map((s) => s.startTime)).toEqual([
      "15:00",
      "09:00",
    ]);
  });
});

describe("how a month and its hours read", () => {
  it("names the month in Greek with its year", () => {
    expect(formatMonthLabel("2026-09")).toContain("2026");
    expect(formatMonthLabel("2026-01")).toContain("2026");
    // Whatever form Intl chooses for el-GR, it starts capitalised and is not the raw key.
    expect(formatMonthLabel("2026-09")).not.toBe("2026-09");
    const label = formatMonthLabel("2026-09");
    expect(label.charAt(0)).toBe(label.charAt(0).toLocaleUpperCase("el-GR"));
  });

  it("returns anything unparseable unchanged rather than inventing a month", () => {
    expect(formatMonthLabel("")).toBe("");
    expect(formatMonthLabel("2026-13")).toBe("2026-13");
    expect(formatMonthLabel("nonsense")).toBe("nonsense");
  });

  it("writes hours the way a person says them", () => {
    expect(formatPaidHours(5760)).toBe("96");
    expect(formatPaidHours(480)).toBe("8");
    expect(formatPaidHours(450)).toBe("7,5");
    expect(formatPaidHours(0)).toBe("0");
  });
});

describe("monthKeyOf", () => {
  it("takes the month off a date", () => {
    expect(monthKeyOf("2026-09-15")).toBe("2026-09");
  });

  it("leaves anything that is not a date alone", () => {
    expect(monthKeyOf("")).toBe("");
    expect(monthKeyOf("2026-09")).toBe("2026-09");
  });
});
