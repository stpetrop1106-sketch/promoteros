import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { readWorkbook, detectHeader, parseRows, matchStores, normaliseStoreKey } from "@/lib/import";

// Manager's own probe, independent of the agent's tests: a file shaped the way I would expect a
// real client to send one, with traps the agent's brief named but I want to see handled end to end.
describe("import acceptance — a file shaped like a real client schedule", () => {
  it("reads a messy Greek programme end to end", () => {
    const aoa = [
      ["ΠΡΟΓΡΑΜΜΑ ΔΕΙΓΜΑΤΙΣΜΟΥ — ΣΕΠΤΕΜΒΡΙΟΣ"],
      [],
      ["Α/Α", "ΗΜ/ΝΙΑ", "ΣΗΜΕΙΟ ΠΩΛΗΣΗΣ", "Περιοχή", "Ωράριο", "Άτομα"],
      [1, "Τρίτη 15/09", "HYPER VEGA Γλυφάδα", "Γλυφάδα", "10.00 – 18.00", "2 άτομα"],
      [2, "16/9", "Hyper Vega - Γλυφάδα", "Γλυφάδα", "10:00-18:00", ""],
      [3, "17/09/2026", "Hyper Vega Κηφισιά", "Κηφισιά", "18:00-10:00", 1],
      ["ΣΥΝΟΛΟ", "", "", "", "", 3],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Σεπτ");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const [sheet] = readWorkbook(buf);
    const h = detectHeader(sheet!);
    expect(h.headerRowIndex).toBe(2);
    expect(h.complete).toBe(true);

    const rows = parseRows(sheet!, h.headerRowIndex, h.mapping, { today: "2026-09-13" });
    // The totals row must not become a shift.
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ date: "2026-09-15", startTime: "10:00", endTime: "18:00", promotersRequired: 2 });
    expect(rows[1]).toMatchObject({ date: "2026-09-16", promotersRequired: 1 });
    expect(rows[2]!.issues.map((i) => i.code)).toContain("end_before_start");

    // Two spellings of Glyfada are one store; Kifisia is a different store of the same chain.
    expect(normaliseStoreKey("HYPER VEGA Γλυφάδα")).toBe(normaliseStoreKey("Hyper Vega - Γλυφάδα"));
    const matches = matchStores(rows, [
      { id: "s1", name: "Hyper Vega Γλυφάδα", address: null, chain: "Hyper Vega" },
    ]);
    const kifisia = matches.find((m) => m.name.includes("Κηφισιά"));
    expect(kifisia?.match?.storeId ?? null).toBeNull();
    const glyfada = matches.find((m) => m.name.toLowerCase().includes("γλυφ"));
    expect(glyfada?.match?.storeId).toBe("s1");
    expect(glyfada?.rowCount).toBe(2);
  });
});
