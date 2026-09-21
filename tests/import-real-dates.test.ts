import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { detectHeader, parseRows, readWorkbook } from "@/lib/import";

/**
 * Regression for the worst thing the round-3 audit found: every imported shift landed on the wrong
 * day, silently.
 *
 * Two independent causes, and the reason the original 32 import tests missed both:
 *
 *  1. Those fixtures build date cells with `Date.UTC(...)`. A real spreadsheet does not contain a
 *     UTC instant — SheetJS hands back midnight in the READER's timezone — so the fixtures were
 *     testing a value the product never sees. Every date below is built with the local `Date`
 *     constructor, which is what a workbook actually produces.
 *  2. CSV text never reached our day-first parser at all: SheetJS coerced "10/09/2026" itself,
 *     month-first, into 9 October.
 */

function sheetFromRows(rows: unknown[][]): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows, { cellDates: true }), "Πρόγραμμα");
  return XLSX.write(wb, { type: "array", bookType: "xlsx", cellDates: true }) as ArrayBuffer;
}

function datesOf(data: ArrayBuffer, today = "2026-09-01"): (string | null)[] {
  const [grid] = readWorkbook(data);
  const header = detectHeader(grid!);
  return parseRows(grid!, header.headerRowIndex, header.mapping, { today }).map((r) => r.date);
}

const HEADER = ["Ημερομηνία", "Κατάστημα", "Ώρα Έναρξης", "Ώρα Λήξης", "Άτομα"];

describe("dates that come out of a real file", () => {
  it("keeps the day of a genuine Excel date cell", () => {
    const data = sheetFromRows([
      HEADER,
      [new Date(2026, 8, 22), "Alfa Γλυφάδα", "10:00", "18:00", 2],
      [new Date(2026, 9, 5), "Alfa Κηφισιά", "11:00", "19:00", 1],
      [new Date(2026, 11, 31), "Alfa Κέντρο", "09:00", "17:00", 1],
    ]);
    expect(datesOf(data)).toEqual(["2026-09-22", "2026-10-05", "2026-12-31"]);
  });

  it("reads Greek CSV dates day-first, including the ones that look American", () => {
    // 10/09 is the trap: month-first reads it as 9 October, and it is a date a client really sends.
    const csv = `${HEADER.join(",")}\n10/09/2026,Alfa Γλυφάδα,10:00,18:00,2\n03/04/2026,Alfa Κηφισιά,11:00,19:00,1\n22/09/2026,Alfa Κέντρο,12:00,20:00,1\n`;
    const data = new TextEncoder().encode(csv).buffer as ArrayBuffer;
    expect(datesOf(data)).toEqual(["2026-09-10", "2026-04-03", "2026-09-22"]);
  });

  it("reads a semicolon CSV the same way", () => {
    const csv = `${HEADER.join(";")}\n10/09/2026;Alfa Γλυφάδα;10:00;18:00;2\n`;
    expect(datesOf(new TextEncoder().encode(csv).buffer as ArrayBuffer)).toEqual(["2026-09-10"]);
  });

  it("still accepts an ISO date and a two-digit year", () => {
    const csv = `${HEADER.join(",")}\n2026-09-22,Alfa Γλυφάδα,10:00,18:00,1\n05/03/26,Alfa Κηφισιά,10:00,18:00,1\n`;
    expect(datesOf(new TextEncoder().encode(csv).buffer as ArrayBuffer)).toEqual(["2026-09-22", "2026-03-05"]);
  });

  it("a past date is still recognised as past, which the wrong day defeated", () => {
    const data = sheetFromRows([HEADER, [new Date(2026, 7, 15), "Alfa Γλυφάδα", "10:00", "18:00", 1]]);
    const [grid] = readWorkbook(data);
    const header = detectHeader(grid!);
    const [row] = parseRows(grid!, header.headerRowIndex, header.mapping, { today: "2026-09-01" });
    expect(row!.date).toBe("2026-08-15");
    expect(row!.issues.map((i) => i.code)).toContain("past_date");
  });
});
