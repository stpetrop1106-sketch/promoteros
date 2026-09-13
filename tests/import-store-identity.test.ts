import { describe, expect, it } from "vitest";
import { foldToken, matchStores, normaliseStoreKey } from "@/lib/import";
import type { KnownStore, ParsedRow } from "@/lib/import/types";

// Regression tests for the three ways the first store matcher created duplicate stores on files
// shaped like real client schedules. Each case below failed before the fix.

const row = (sourceRow: number, storeName: string, storeAddress: string | null = null): ParsedRow => ({
  sourceRow,
  date: "2026-09-20",
  startTime: "10:00",
  endTime: "18:00",
  storeName,
  storeAddress,
  city: null,
  chain: null,
  promotersRequired: 1,
  notes: null,
  issues: [],
});

const known = (id: string, name: string, address: string | null = null): KnownStore => ({
  id,
  name,
  address,
  chain: null,
});

describe("store identity", () => {
  it("keeps a store whose address is only on its first row as ONE store", () => {
    const ms = matchStores(
      [row(2, "Hyper Vega Γλυφάδα", "Λαζαράκη 12"), row(3, "Hyper Vega Γλυφάδα"), row(4, "HYPER VEGA - Γλυφάδα")],
      [],
    );
    expect(ms).toHaveLength(1);
    expect(ms[0]).toMatchObject({ address: "Λαζαράκη 12", rowCount: 3, sourceRows: [2, 3, 4] });
  });

  it("splits one name into branches when the file carries different addresses", () => {
    const ms = matchStores(
      [row(2, "Σκλαβενίτης", "Κηφισίας 100"), row(3, "Σκλαβενίτης", "Βουλιαγμένης 5"), row(4, "Σκλαβενίτης", "Κηφισίας 100")],
      [],
    );
    expect(ms).toHaveLength(2);
    expect(ms.map((m) => m.rowCount).sort()).toEqual([1, 2]);
  });

  it("asks rather than guesses for blank-address rows of a name with several branches", () => {
    const ms = matchStores(
      [row(2, "Σκλαβενίτης", "Κηφισίας 100"), row(3, "Σκλαβενίτης", "Βουλιαγμένης 5"), row(4, "Σκλαβενίτης")],
      [],
    );
    expect(ms).toHaveLength(3);
    const blank = ms.find((m) => m.sourceRows.includes(4));
    expect(blank?.sourceRows).toEqual([4]);
    expect(blank?.address).toBeNull();
  });

  it("puts every named row in exactly one store", () => {
    const rows = [row(2, "A Γλυφάδα", "x 1"), row(3, "A Γλυφάδας"), row(4, "B"), row(5, "B", "y 2"), row(6, "B", "z 3")];
    const all = matchStores(rows, []).flatMap((m) => m.sourceRows).sort((a, b) => a - b);
    expect(all).toEqual([2, 3, 4, 5, 6]);
  });

  it("matches a Greek genitive to the known nominative", () => {
    const [m] = matchStores([row(2, "Hyper Vega Γλυφάδας")], [known("s1", "Hyper Vega Γλυφάδα")]);
    expect(m?.confidence).toBe("exact");
    expect(m?.match?.storeId).toBe("s1");
  });

  it("matches a known store that has an address from a file row that has none", () => {
    const [m] = matchStores([row(2, "Hyper Vega Γλυφάδα")], [known("s1", "Hyper Vega Γλυφάδα", "Λαζαράκη 12")]);
    expect(m?.match?.storeId).toBe("s1");
    expect(m?.confidence).toBe("exact");
  });

  it("uses the address to choose between known branches that share a name", () => {
    const [m] = matchStores(
      [row(2, "Σκλαβενίτης", "Βουλιαγμένης 5")],
      [known("k", "Σκλαβενίτης", "Κηφισίας 100"), known("v", "Σκλαβενίτης", "Βουλιαγμένης 5")],
    );
    expect(m?.match?.storeId).toBe("v");
  });

  it("still never matches the same chain in a different area", () => {
    const [m] = matchStores([row(2, "Hyper Vega Κηφισιάς")], [known("s1", "Hyper Vega Γλυφάδα")]);
    expect(m?.match).toBeNull();
    expect(m?.confidence).toBe("none");
    expect(normaliseStoreKey("Hyper Vega Γλυφάδα")).not.toBe(normaliseStoreKey("Hyper Vega Κηφισιά"));
  });
});

describe("foldToken", () => {
  it("folds inflected Greek forms together", () => {
    expect(foldToken("γλυφαδας")).toBe(foldToken("γλυφαδα"));
    expect(foldToken("κηφισιας")).toBe(foldToken("κηφισια"));
    expect(foldToken("αμαρουσιου")).toBe(foldToken("αμαρουσιο"));
  });

  it("leaves short words and numbers alone", () => {
    expect(foldToken("νεα")).toBe("νεα");
    expect(foldToken("12")).toBe("12");
    expect(foldToken("2026")).toBe("2026");
  });

  it("never folds a word below three letters", () => {
    expect(foldToken("aeio")).toBe("aeio");
  });
});
