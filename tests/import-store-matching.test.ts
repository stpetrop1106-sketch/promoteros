import { describe, expect, it } from "vitest";
import { matchStores, normaliseStoreKey } from "@/lib/import/store-matching";
import type { KnownStore, ParsedRow } from "@/lib/import/types";

function row(overrides: Partial<ParsedRow>): ParsedRow {
  return {
    sourceRow: 1,
    date: "2026-09-20",
    startTime: "10:00",
    endTime: "18:00",
    storeName: null,
    storeAddress: null,
    city: null,
    chain: null,
    promotersRequired: 1,
    notes: null,
    issues: [],
    ...overrides,
  };
}

describe("normaliseStoreKey", () => {
  it("is case, accent, punctuation and whitespace insensitive", () => {
    const a = normaliseStoreKey("HYPER VEGA Γλυφάδα");
    const b = normaliseStoreKey("Hyper Vega - Γλυφάδα");
    const c = normaliseStoreKey("hyper vega γλυφαδα ");
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("gives different areas of the same chain different keys", () => {
    const glyfada = normaliseStoreKey("Hyper Vega Γλυφάδα");
    const kifisia = normaliseStoreKey("Hyper Vega Κηφισιά");
    expect(glyfada).not.toBe(kifisia);
  });
});

describe("matchStores — grouping within the file", () => {
  it("resolves three spellings of one store to a single StoreMatch", () => {
    const rows = [
      row({ storeName: "HYPER VEGA Γλυφάδα" }),
      row({ storeName: "Hyper Vega - Γλυφάδα" }),
      row({ storeName: "hyper vega γλυφαδα " }),
    ];
    const matches = matchStores(rows, []);
    expect(matches).toHaveLength(1);
    expect(matches[0]!.rowCount).toBe(3);
  });

  it("ignores rows with no store name", () => {
    const rows = [row({ storeName: null }), row({ storeName: "Acme Kiosk" })];
    const matches = matchStores(rows, []);
    expect(matches).toHaveLength(1);
    expect(matches[0]!.name).toBe("Acme Kiosk");
  });
});

describe("matchStores — against known stores", () => {
  const known: KnownStore[] = [
    { id: "store-1", name: "Hyper Vega Κηφισιά", address: null, chain: "Hyper Vega" },
    { id: "store-2", name: "Acme Kiosk", address: "1 Main St", chain: null },
  ];

  it("auto-accepts an exact match (score 1.0, confidence exact)", () => {
    const rows = [row({ storeName: "hyper vega  κηφισια" })];
    const matches = matchStores(rows, known);
    expect(matches[0]!.confidence).toBe("exact");
    expect(matches[0]!.match).toEqual({ storeId: "store-1", storeName: "Hyper Vega Κηφισιά", score: 1.0 });
  });

  it("does NOT match a different area of the same chain", () => {
    const rows = [row({ storeName: "Hyper Vega Γλυφάδα" })];
    const matches = matchStores(rows, known);
    expect(matches[0]!.confidence).toBe("none");
    expect(matches[0]!.match).toBeNull();
  });

  it("reports 'none' for a store with nothing similar in the known list", () => {
    const rows = [row({ storeName: "Something Completely Different" })];
    const matches = matchStores(rows, known);
    expect(matches[0]!.confidence).toBe("none");
    expect(matches[0]!.match).toBeNull();
  });
});
