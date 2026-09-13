/**
 * P37b — turning a mapped sheet into candidate shifts. No `xlsx` import.
 *
 * `parseRows` sees raw cells and so can tell "blank" from "present but unparseable" apart —
 * `missing_date` vs `unparseable_date`, `missing_time` vs `unparseable_time`. `validateRow` only
 * ever receives the already-parsed `ParsedRow` (that is the frozen contract: the server re-validates
 * with the SAME values it was sent, not the original cells), and a null field is consistent with
 * either origin — so `validateRow` reports the honest, values-only conclusion (`missing_*`) rather
 * than guessing "unparseable". Both call the same `computeIssues` core so every other code
 * (`missing_store`, `end_before_start`, `past_date`) is byte-for-byte identical between the two.
 * See `docs/status/P37b.md` for why this is a deliberate, documented gap rather than an oversight.
 *
 * Duplicate detection (`duplicate_in_file`) needs sibling rows, which `validateRow`'s signature does
 * not receive either — so it is only ever produced by `parseRows`.
 */

import type { Cell, ColumnMapping, ImportField, ParseOptions, ParsedRow, RowIssue, RowIssueCode, SheetGrid } from "./types";
import { cellAt, cellText, findColumn, isCellBlank, isRowBlank } from "./cells";
import { normalizeKeyTokens } from "./text";
import { parseDateCell } from "./dates";
import { parseTimeCell, parseTimeRangeText } from "./times";

const FOOTER_KEYWORDS = ["συνολο", "total", "totals", "sum", "γενικο συνολο"];

/**
 * A totals row often puts its label in the very first (date-like) column: "ΣΥΝΟΛΟ" with a headcount
 * sum trailing after it, everything else blank. So this checks every column except `notes` — a
 * legitimate row's free-text notes might mention "σύνολο" in passing, and that should never nuke an
 * otherwise-valid shift.
 */
function looksLikeFooterRow(row: readonly Cell[], notesCol: number | undefined): boolean {
  const text = row
    .filter((cell, idx): cell is string => typeof cell === "string" && idx !== notesCol)
    .map((c) => normalizeKeyTokens(c))
    .join(" ");
  return FOOTER_KEYWORDS.some((keyword) => text.includes(keyword));
}

function parseHeadcount(cell: Cell, fallback: number): { value: number; bad: boolean } {
  if (isCellBlank(cell)) return { value: fallback, bad: false };

  if (typeof cell === "number") {
    if (Number.isFinite(cell) && cell > 0) return { value: Math.round(cell), bad: false };
    return { value: fallback, bad: true };
  }

  const text = cellText(cell);
  const match = text.match(/\d+/);
  if (match) {
    const n = Number(match[0]);
    if (n > 0) return { value: n, bad: false };
  }
  return { value: fallback, bad: true };
}

type TimeResolution = { startTime: string | null; endTime: string | null; unparseable: boolean };

function resolveTime(
  row: readonly Cell[],
  cols: { startCol: number | undefined; endCol: number | undefined; rangeCol: number | undefined },
): TimeResolution {
  const { startCol, endCol, rangeCol } = cols;

  if (rangeCol !== undefined) {
    const rangeCell = cellAt(row, rangeCol);
    if (!isCellBlank(rangeCell)) {
      const parsed = parseTimeRangeText(cellText(rangeCell));
      if (parsed) return { startTime: parsed.start, endTime: parsed.end, unparseable: false };
      return { startTime: null, endTime: null, unparseable: true };
    }
  }

  let startTime: string | null = null;
  let endTime: string | null = null;
  let unparseable = false;

  if (startCol !== undefined) {
    const cell = cellAt(row, startCol);
    if (!isCellBlank(cell)) {
      const t = parseTimeCell(cell);
      if (t) startTime = t;
      else unparseable = true;
    }
  }
  if (endCol !== undefined) {
    const cell = cellAt(row, endCol);
    if (!isCellBlank(cell)) {
      const t = parseTimeCell(cell);
      if (t) endTime = t;
      else unparseable = true;
    }
  }

  return { startTime, endTime, unparseable };
}

type IssueFields = Pick<ParsedRow, "date" | "startTime" | "endTime" | "storeName" | "promotersRequired">;
type IssueContext = { dateUnparseable?: boolean; timeUnparseable?: boolean; headcountBad?: boolean };

/** The shared core both `parseRows` and `validateRow` call. See the file header for the contract. */
export function computeIssues(fields: IssueFields, options: ParseOptions, context: IssueContext = {}): RowIssue[] {
  const issues: RowIssue[] = [];
  const push = (code: RowIssueCode, severity: RowIssue["severity"], field: ImportField) =>
    issues.push({ code, severity, field });

  if (fields.date === null) {
    push(context.dateUnparseable ? "unparseable_date" : "missing_date", "error", "date");
  } else if (fields.date < options.today) {
    push("past_date", "warning", "date");
  }

  const hasStart = fields.startTime !== null;
  const hasEnd = fields.endTime !== null;
  if (context.timeUnparseable) {
    push("unparseable_time", "error", "time_range");
  } else if (!hasStart || !hasEnd) {
    push("missing_time", "error", hasStart ? "end_time" : "start_time");
  } else if (fields.endTime! <= fields.startTime!) {
    push("end_before_start", "error", "end_time");
  }

  if (!fields.storeName || fields.storeName.trim() === "") {
    push("missing_store", "error", "store_name");
  }

  if (context.headcountBad) {
    push("bad_headcount", "warning", "promoters_required");
  }

  return issues;
}

export function parseRows(
  grid: SheetGrid,
  headerRowIndex: number,
  mapping: ColumnMapping,
  options: ParseOptions,
): ParsedRow[] {
  const dateCol = findColumn(mapping, "date");
  const storeCol = findColumn(mapping, "store_name");
  const addressCol = findColumn(mapping, "store_address");
  const cityCol = findColumn(mapping, "city");
  const chainCol = findColumn(mapping, "chain");
  const startCol = findColumn(mapping, "start_time");
  const endCol = findColumn(mapping, "end_time");
  const rangeCol = findColumn(mapping, "time_range");
  const headcountCol = findColumn(mapping, "promoters_required");
  const notesCol = findColumn(mapping, "notes");

  const defaultPromoters = options.defaultPromoters ?? 1;
  const results: ParsedRow[] = [];

  for (let r = headerRowIndex + 1; r < grid.rows.length; r++) {
    const raw = grid.rows[r] ?? [];
    if (isRowBlank(raw)) continue;

    const dateCellRaw = cellAt(raw, dateCol);
    const storeCellRaw = cellAt(raw, storeCol);
    const dateBlank = isCellBlank(dateCellRaw);
    const storeBlank = isCellBlank(storeCellRaw);

    if (storeBlank && looksLikeFooterRow(raw, notesCol)) continue;

    let dateIso: string | null = null;
    let dateUnparseable = false;
    if (!dateBlank) {
      const parsed = parseDateCell(dateCellRaw, options.today);
      if (parsed.ok) dateIso = parsed.iso;
      else dateUnparseable = true;
    }

    const timeResult = resolveTime(raw, { startCol, endCol, rangeCol });

    const storeName = storeBlank ? null : cellText(storeCellRaw) || null;
    const storeAddress = addressCol !== undefined ? cellText(cellAt(raw, addressCol)) || null : null;
    const city = cityCol !== undefined ? cellText(cellAt(raw, cityCol)) || null : null;
    const chain = chainCol !== undefined ? cellText(cellAt(raw, chainCol)) || null : null;
    const notes = notesCol !== undefined ? cellText(cellAt(raw, notesCol)) || null : null;

    const headcountCell = headcountCol !== undefined ? cellAt(raw, headcountCol) : null;
    const headcount = parseHeadcount(headcountCell, defaultPromoters);

    const fields: IssueFields = {
      date: dateIso,
      startTime: timeResult.startTime,
      endTime: timeResult.endTime,
      storeName,
      promotersRequired: headcount.value,
    };

    const issues = computeIssues(fields, options, {
      dateUnparseable,
      timeUnparseable: timeResult.unparseable,
      headcountBad: headcount.bad,
    });

    results.push({
      sourceRow: r + 1,
      date: dateIso,
      startTime: timeResult.startTime,
      endTime: timeResult.endTime,
      storeName,
      storeAddress,
      city,
      chain,
      promotersRequired: headcount.value,
      notes,
      issues,
    });
  }

  markDuplicates(results);
  return results;
}

function markDuplicates(rows: ParsedRow[]): void {
  const seen = new Map<string, number>();
  for (const row of rows) {
    const key = [
      row.date ?? "",
      row.storeName ? normalizeKeyTokens(row.storeName) : "",
      row.startTime ?? "",
      row.endTime ?? "",
    ].join("|");
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    if (count > 1) {
      row.issues.push({ code: "duplicate_in_file", severity: "warning", field: "date" });
    }
  }
}

/**
 * Recomputes `issues` from `row`'s own fields alone — no raw cells, no sibling rows. See the file
 * header for exactly which codes this can and cannot reproduce.
 */
export function validateRow(row: ParsedRow, options: ParseOptions): ParsedRow {
  const issues = computeIssues(row, options);
  return { ...row, issues };
}
