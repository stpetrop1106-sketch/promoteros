import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * P37b — SheetJS must stay out of the server-safe validation path. `readWorkbook` is the only
 * function allowed to need it; `detectHeader`, `parseRows`/`validateRow` and `matchStores` (and
 * everything underneath them) must not import "xlsx", directly or transitively, so a server action
 * that only calls those never bundles SheetJS.
 *
 * This is a static check on the source text rather than a runtime module-graph check: Vite/Vitest's
 * ESM loader doesn't expose "what got imported" the way `require.cache` does for CJS, but a grep for
 * the literal import is exactly as reliable here, because the whole point is that these files must
 * never *write* that import in the first place.
 */

const importDir = join(dirname(fileURLToPath(import.meta.url)), "..", "lib", "import");

const SHEETJS_FREE_FILES = [
  "header-detection.ts",
  "row-parser.ts",
  "store-matching.ts",
  "text.ts",
  "cells.ts",
  "dates.ts",
  "times.ts",
  "field-synonyms.ts",
  "constants.ts",
];

const XLSX_IMPORT_PATTERN = /from\s+["']xlsx["']|require\(\s*["']xlsx["']\s*\)/;

describe("SheetJS stays out of the server-safe modules", () => {
  for (const file of SHEETJS_FREE_FILES) {
    it(`${file} does not import "xlsx"`, () => {
      const source = readFileSync(join(importDir, file), "utf8");
      expect(XLSX_IMPORT_PATTERN.test(source)).toBe(false);
    });
  }

  it("only workbook.ts imports xlsx", () => {
    const source = readFileSync(join(importDir, "workbook.ts"), "utf8");
    expect(XLSX_IMPORT_PATTERN.test(source)).toBe(true);
  });
});
