import { describe, expect, it } from "vitest";
import { detectHeader } from "@/lib/import/header-detection";
import type { SheetGrid } from "@/lib/import/types";

function grid(rows: (string | number | boolean | Date | null)[][]): SheetGrid {
  return { name: "Sheet1", rows };
}

describe("detectHeader — clean English file", () => {
  it("finds the header row and maps every column with high confidence", () => {
    const g = grid([
      ["Date", "Store", "Address", "City", "Start", "End", "Promoters", "Notes"],
      ["2026-09-15", "Acme Kiosk", "1 Main St", "Athens", "10:00", "18:00", 2, ""],
    ]);
    const result = detectHeader(g);
    expect(result.headerRowIndex).toBe(0);
    expect(result.complete).toBe(true);
    expect(result.mapping[0]).toBe("date");
    expect(result.mapping[1]).toBe("store_name");
    expect(result.mapping[2]).toBe("store_address");
    expect(result.mapping[3]).toBe("city");
    expect(result.mapping[4]).toBe("start_time");
    expect(result.mapping[5]).toBe("end_time");
    expect(result.mapping[6]).toBe("promoters_required");
    expect(result.mapping[7]).toBe("notes");
    for (const col of [0, 1, 4, 5, 6]) {
      expect(result.confidence[col]).toBeGreaterThanOrEqual(0.6);
    }
  });
});

describe("detectHeader — messy Greek file", () => {
  it("skips title rows, a blank row, and finds the real header despite accents/case", () => {
    const g = grid([
      ["ΠΡΟΓΡΑΜΜΑ ΔΕΙΓΜΑΤΙΣΜΟΥ ΣΕΠΤΕΜΒΡΙΟΣ 2026", "", "", "", ""],
      ["Καμπάνια: Φθινοπωρινό δειγματισμό", "", "", "", ""],
      ["", "", "", "", ""],
      ["Ημ/νία", "ΣΗΜΕΙΟ ΠΩΛΗΣΗΣ", "Περιοχή", "Ώρα Έναρξης", "Έως", "Άτομα"],
      ["15/09/2026", "hyper vega γλυφαδα", "Γλυφάδα", "10:00", "18:00", 2],
      ["16/09/2026", "hyper vega γλυφαδα", "Γλυφάδα", "10:00", "18:00", 2],
      ["ΣΥΝΟΛΟ", "", "", "", "", 4],
    ]);
    const result = detectHeader(g);
    expect(result.headerRowIndex).toBe(3);
    expect(result.complete).toBe(true);
    expect(result.mapping[0]).toBe("date");
    expect(result.mapping[1]).toBe("store_name");
    expect(result.mapping[2]).toBe("city");
    expect(result.mapping[3]).toBe("start_time");
    expect(result.mapping[4]).toBe("end_time");
    expect(result.mapping[5]).toBe("promoters_required");
  });

  it("handles a merged-looking title cell (value only in column 0, rest null)", () => {
    const g = grid([
      ["ΠΡΟΓΡΑΜΜΑ ΔΕΙΓΜΑΤΙΣΜΟΥ", null, null, null],
      ["Ημερομηνία", "Κατάστημα", "Ωράριο", "Πλήθος"],
      ["15/09/2026", "Καφέ Κεντρικό", "10:00-18:00", 3],
    ]);
    const result = detectHeader(g);
    expect(result.headerRowIndex).toBe(1);
    expect(result.mapping[0]).toBe("date");
    expect(result.mapping[1]).toBe("store_name");
    expect(result.mapping[2]).toBe("time_range");
    expect(result.mapping[3]).toBe("promoters_required");
    expect(result.complete).toBe(true);
  });
});

describe("detectHeader — no recognisable header", () => {
  it("returns complete: false instead of throwing", () => {
    const g = grid([
      ["random", "junk", "here"],
      ["more", "junk", "rows"],
      ["still", "nothing", "useful"],
    ]);
    expect(() => detectHeader(g)).not.toThrow();
    const result = detectHeader(g);
    expect(result.complete).toBe(false);
  });

  it("handles a completely empty sheet without throwing", () => {
    const g = grid([]);
    expect(() => detectHeader(g)).not.toThrow();
    const result = detectHeader(g);
    expect(result.complete).toBe(false);
    expect(result.headers).toEqual([]);
  });
});

describe("detectHeader — column confidence is honest", () => {
  it("gives a low score to an ambiguous/abbreviated header the UI should ask about", () => {
    // A column header that doesn't match any synonym should be `ignore` with confidence 0,
    // never a confident wrong guess.
    const g = grid([
      ["Ημερομηνία", "Κατάστημα", "Κωδικός Παραγγελίας"],
      ["15/09/2026", "Καφέ", "XZ-123"],
    ]);
    const result = detectHeader(g);
    expect(result.mapping[2]).toBe("ignore");
    expect(result.confidence[2]).toBe(0);
  });
});
