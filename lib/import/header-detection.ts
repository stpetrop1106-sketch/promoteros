/**
 * P37b — header row detection.
 *
 * NO `xlsx` import here. This must stay true so the server-side re-validation path (which only
 * needs `parseRows`/`validateRow`/`matchStores`, and sometimes this) never drags SheetJS into a
 * bundle that will never call `readWorkbook`.
 *
 * Approach: score each of the first ~15 rows by how many of its cells match a field synonym, and
 * how confidently. The best-scoring row wins. Scoring is tiered rather than binary because a wrong
 * *confident* guess is worse than an honest *unsure* one — the UI only interrupts the coordinator
 * for columns under 0.6, so inflating confidence would silently ship bad mappings.
 *
 *   1.0  — the whole header cell, normalised, equals a synonym exactly ("Ημ/νία" → "ημνια" → "date")
 *   0.8  — every token of a multi-word synonym appears among the header cell's tokens
 *   0.75 — one token of the header cell equals a single-word synonym exactly
 *   0.5  — substring containment either way (last resort, catches abbreviations we didn't list)
 *   0    — nothing matched → field "ignore"
 */

import type { Cell, ColumnMapping, HeaderDetection, ImportField, SheetGrid } from "./types";
import { FIELD_SYNONYMS } from "./field-synonyms";
import { normalizeKeyTokens, tokenize } from "./text";

const MAX_HEADER_SEARCH_ROWS = 15;

function cellDisplayText(cell: Cell): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) return cell.toISOString();
  return String(cell);
}

type CellGuess = { field: ImportField; confidence: number };

export function scoreHeaderCell(raw: string): CellGuess {
  const text = raw.trim();
  if (!text) return { field: "ignore", confidence: 0 };

  const collapsed = normalizeKeyTokens(text).replace(/\s+/g, "");
  const tokens = tokenize(text);

  let best: CellGuess = { field: "ignore", confidence: 0 };

  for (const { field, terms } of FIELD_SYNONYMS) {
    for (const term of terms) {
      const termTokens = term.split(" ").filter(Boolean);
      const termCollapsed = termTokens.join("");

      if (collapsed === termCollapsed && best.confidence < 1.0) {
        best = { field, confidence: 1.0 };
        continue;
      }
      if (termTokens.length > 1 && termTokens.every((t) => tokens.includes(t)) && best.confidence < 0.8) {
        best = { field, confidence: 0.8 };
        continue;
      }
      if (termTokens.length === 1 && tokens.includes(termTokens[0]!) && best.confidence < 0.75) {
        best = { field, confidence: 0.75 };
        continue;
      }
      if (
        termCollapsed.length >= 3 &&
        collapsed.length >= 3 &&
        (collapsed.includes(termCollapsed) || termCollapsed.includes(collapsed)) &&
        best.confidence < 0.5
      ) {
        best = { field, confidence: 0.5 };
      }
    }
  }

  return best;
}

export function detectHeader(grid: SheetGrid): HeaderDetection {
  const searchRows = Math.min(MAX_HEADER_SEARCH_ROWS, grid.rows.length);

  let bestIndex = 0;
  let bestScore = -1;
  let bestGuesses: CellGuess[] = [];

  for (let r = 0; r < searchRows; r++) {
    const row = grid.rows[r] ?? [];
    const guesses = row.map((cell) => scoreHeaderCell(cellDisplayText(cell)));
    const distinctFields = new Set(guesses.filter((g) => g.field !== "ignore").map((g) => g.field));
    const score =
      guesses.reduce((sum, g) => sum + (g.field === "ignore" ? 0 : g.confidence), 0) +
      distinctFields.size * 0.1;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = r;
      bestGuesses = guesses;
    }
  }

  const headerRow = grid.rows[bestIndex] ?? [];
  const headers = headerRow.map((cell) => cellDisplayText(cell));

  const mapping: ColumnMapping = {};
  const confidence: Record<number, number> = {};
  bestGuesses.forEach((guess, col) => {
    mapping[col] = guess.field;
    confidence[col] = guess.confidence;
  });

  const mappedFields = new Set(Object.values(mapping));
  const hasDate = mappedFields.has("date");
  const hasStore = mappedFields.has("store_name");
  const hasTime = mappedFields.has("time_range") || (mappedFields.has("start_time") && mappedFields.has("end_time"));
  const complete = bestScore > 0 && hasDate && hasStore && hasTime;

  return { headerRowIndex: bestIndex, headers, mapping, confidence, complete };
}
