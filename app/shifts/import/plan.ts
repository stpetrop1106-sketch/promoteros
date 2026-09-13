import type { Cell, ColumnMapping, ImportField, ParsedRow, SheetGrid, StoreMatch } from "@/lib/import/types";
import { foldToken } from "@/lib/import/store-matching";
import { jaccard, normalizeLoose, tokenize } from "@/lib/import/text";
import type { PlannedRow, RowReason, RowStatus, StoreResolution, StoreTarget } from "./types";

/**
 * P37c — the import's decisions as pure functions, shared by the wizard (to show the preview) and
 * the commit action (to decide what is actually written). The browser and the server run the SAME
 * code over the SAME rows, so the preview is what gets created — and the server never takes the
 * browser's word for any of it.
 *
 * Imports only SheetJS-free engine modules (see lib/import/index.ts's header), so neither the
 * server action nor the wizard's own chunk pulls `xlsx` in through here.
 */

/** Shifts go to the database in batches this size — small enough that one failure loses little. */
export const SHIFT_INSERT_BATCH = 200;

export function hasError(row: ParsedRow): boolean {
  return row.issues.some((issue) => issue.severity === "error");
}

/**
 * The rows stores are grouped over: every row that could become a shift. A row broken on its own
 * (no date, no time) never asks the coordinator a store question it cannot use.
 */
export function rowsForStoreMatching(rows: readonly ParsedRow[]): ParsedRow[] {
  return rows.filter((row) => !hasError(row));
}

// ---------------------------------------------------------------------------------------------
// Store resolutions
// ---------------------------------------------------------------------------------------------

function sameRows(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((value, i) => value === sb[i]);
}

/**
 * The server's own `matchStores` output is the truth. Every StoreMatch must have exactly one
 * resolution with the same key and the same `sourceRows`, and no resolution may name a store group
 * the server did not find. Anything else means the browser's grouping differs from the server's —
 * a stale page, a changed engine, or a forged request — and nothing is written.
 */
export function verifyStoreResolutions(
  matches: readonly StoreMatch[],
  resolutions: readonly StoreResolution[],
): { ok: true; pairs: { match: StoreMatch; resolution: StoreResolution }[] } | { ok: false } {
  if (matches.length !== resolutions.length) return { ok: false };
  const byKey = new Map<string, StoreResolution>();
  for (const resolution of resolutions) {
    if (byKey.has(resolution.key)) return { ok: false };
    byKey.set(resolution.key, resolution);
  }
  const pairs: { match: StoreMatch; resolution: StoreResolution }[] = [];
  for (const match of matches) {
    const resolution = byKey.get(match.key);
    if (!resolution || !sameRows(match.sourceRows, resolution.sourceRows)) return { ok: false };
    pairs.push({ match, resolution });
  }
  return { ok: true, pairs };
}

/** `sourceRow` → where that row's shift goes. Joined through `sourceRows`, never a per-row key. */
export function storeTargetsBySourceRow(
  resolutions: readonly StoreResolution[],
): Map<number, StoreTarget | "skip"> {
  const map = new Map<number, StoreTarget | "skip">();
  for (const resolution of resolutions) {
    const target: StoreTarget | "skip" =
      resolution.action === "skip"
        ? "skip"
        : resolution.action === "existing"
          ? { kind: "existing", storeId: resolution.storeId }
          : { kind: "create", key: resolution.key };
    for (const sourceRow of resolution.sourceRows) map.set(sourceRow, target);
  }
  return map;
}

// ---------------------------------------------------------------------------------------------
// Duplicates and the row plan
// ---------------------------------------------------------------------------------------------

function hhmm(value: string): string {
  return value.slice(0, 5);
}

/** Identity of an existing shift for the duplicate check: same store, date and times. */
export function existingShiftKey(storeId: string, date: string, startTime: string, endTime: string): string {
  return `${storeId}|${date}|${hhmm(startTime)}|${hhmm(endTime)}`;
}

function targetId(target: StoreTarget): string {
  return target.kind === "existing" ? `s:${target.storeId}` : `n:${target.key}`;
}

export type PlanInput = {
  /** Rows with their issues already computed — `parseRows` in the browser, `validateRow` on the server. */
  rows: readonly ParsedRow[];
  targets: ReadonlyMap<number, StoreTarget | "skip">;
  /** `existingShiftKey`s of shifts already in the campaign. */
  existingKeys: ReadonlySet<string>;
  includeDuplicateRows: ReadonlySet<number>;
};

/**
 * What happens to every row. In-file duplicates are recomputed here, on RESOLVED stores — two
 * spellings of one store, or two file stores mapped to the same existing store, are the same place —
 * so whatever the parse flagged as `duplicate_in_file` is discarded first. `validateRow` cannot
 * produce that code at all (it sees one row), which is why this check exists on the server.
 *
 * Duplicates are left out unless the coordinator included them: nothing that doubles a shift is
 * created without them having seen it.
 */
export function planRows({ rows, targets, existingKeys, includeDuplicateRows }: PlanInput): PlannedRow[] {
  const seen = new Set<string>();

  return rows.map((row): PlannedRow => {
    const issues = row.issues.filter((issue) => issue.code !== "duplicate_in_file");
    const errors: RowReason[] = issues.filter((i) => i.severity === "error").map((i) => i.code);
    const warnings: RowReason[] = issues.filter((i) => i.severity === "warning").map((i) => i.code);

    if (errors.length > 0) {
      return { row, status: "error", reasons: [...errors, ...warnings], store: null, duplicate: null };
    }

    const target = targets.get(row.sourceRow);
    if (!target || target === "skip") {
      return { row, status: "skipped", reasons: ["store_skipped", ...warnings], store: null, duplicate: null };
    }

    // A row without errors always has a date and both times (computeIssues guarantees it).
    const key = `${targetId(target)}|${row.date}|${row.startTime}|${row.endTime}`;
    let duplicate: PlannedRow["duplicate"] = null;
    if (seen.has(key)) duplicate = "in_file";
    else if (
      target.kind === "existing" &&
      existingKeys.has(existingShiftKey(target.storeId, row.date!, row.startTime!, row.endTime!))
    ) {
      duplicate = "existing";
    }
    seen.add(key);

    if (duplicate) {
      const reason: RowReason = duplicate === "in_file" ? "duplicate_in_file" : "duplicate_existing";
      const included = includeDuplicateRows.has(row.sourceRow);
      return {
        row,
        status: included ? "warning" : "excluded",
        reasons: [reason, ...warnings],
        store: target,
        duplicate,
      };
    }

    return { row, status: warnings.length > 0 ? "warning" : "ready", reasons: warnings, store: target, duplicate: null };
  });
}

export function willCreate(planned: PlannedRow): boolean {
  return planned.status === "ready" || planned.status === "warning";
}

export type PlanSummary = {
  toCreate: number;
  notImported: number;
  withWarnings: number;
  counts: Record<RowStatus, number>;
  duplicatesInFile: number;
  duplicatesExisting: number;
  leftOut: { reason: RowReason; count: number }[];
};

export function summarisePlan(planned: readonly PlannedRow[]): PlanSummary {
  const counts: Record<RowStatus, number> = { ready: 0, warning: 0, error: 0, skipped: 0, excluded: 0 };
  const leftOut = new Map<RowReason, number>();
  let duplicatesInFile = 0;
  let duplicatesExisting = 0;
  for (const p of planned) {
    counts[p.status]++;
    if (p.duplicate === "in_file") duplicatesInFile++;
    if (p.duplicate === "existing") duplicatesExisting++;
    if (!willCreate(p)) {
      const reason = p.reasons[0] ?? "store_skipped";
      leftOut.set(reason, (leftOut.get(reason) ?? 0) + 1);
    }
  }
  return {
    toCreate: counts.ready + counts.warning,
    notImported: counts.error + counts.skipped + counts.excluded,
    withWarnings: counts.warning,
    counts,
    duplicatesInFile,
    duplicatesExisting,
    leftOut: [...leftOut.entries()].map(([reason, count]) => ({ reason, count })),
  };
}

/** Earliest and latest date among rows that can become shifts — the new campaign's default span. */
export function dateSpan(rows: readonly ParsedRow[]): { from: string; to: string } | null {
  const dates = rows.filter((r) => !hasError(r) && r.date).map((r) => r.date!);
  if (dates.length === 0) return null;
  return { from: dates.reduce((a, b) => (b < a ? b : a)), to: dates.reduce((a, b) => (b > a ? b : a)) };
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------------------------------------
// Stores: geocoding queries and "the right one on top"
// ---------------------------------------------------------------------------------------------

const STREET_TYPE_PREFIX = /^(λεωφόρος|λεωφορος|λεωφ\.?|οδός|οδος|οδ\.|πλατεία|πλατεια|πλ\.)\s+/iu;

/**
 * What to ask the geocoder, most precise first. Never the city alone: a city centre is not a store,
 * and a wrong store position silently breaks every check-in geofence there.
 */
export function geocodeQueries(store: Pick<StoreMatch, "name" | "address" | "city">): string[] {
  const queries: string[] = [];
  const address = store.address?.trim();
  const city = store.city?.trim();
  if (address) {
    queries.push([address, city].filter(Boolean).join(", "));
    // OpenStreetMap names the street, not its type: "Λεωφόρος Βουλιαγμένης 100" finds nothing where
    // "Βουλιαγμένης 100" is found. Client files almost always write the type.
    const bare = address.replace(STREET_TYPE_PREFIX, "").trim();
    if (bare && bare !== address) queries.push([bare, city].filter(Boolean).join(", "));
  }
  queries.push([store.name.trim(), city].filter(Boolean).join(", "));
  return [...new Set(queries.filter((q) => q.length > 0))];
}

/** Address to keep on a new store: the file's address, with the city when the file has one. */
export function storeAddressFor(store: Pick<StoreMatch, "address" | "city">): string | null {
  const parts = [store.address?.trim(), store.city?.trim()].filter((p): p is string => Boolean(p));
  if (parts.length === 0) return null;
  if (parts.length === 2 && normalizeLoose(parts[0]!).includes(normalizeLoose(parts[1]!))) return parts[0]!;
  return parts.join(", ");
}

function folded(value: string): string[] {
  return [...new Set(tokenize(value).map(foldToken))];
}

/** The agency's stores, most similar name first, so the right one is at the top of the select. */
export function rankStoresBySimilarity<T extends { name: string }>(name: string, stores: readonly T[]): T[] {
  const tokens = folded(name);
  return stores
    .map((store) => ({ store, score: jaccard(tokens, folded(store.name)) }))
    .sort((a, b) => b.score - a.score || a.store.name.localeCompare(b.store.name, "el"))
    .map((entry) => entry.store);
}

// ---------------------------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------------------------

export type RequiredField = "date" | "store_name" | "time";

/** What an import cannot run without. Time is either a range column or both start and end. */
export function missingRequiredFields(mapping: ColumnMapping): RequiredField[] {
  const fields = new Set(Object.values(mapping));
  const missing: RequiredField[] = [];
  if (!fields.has("date")) missing.push("date");
  if (!fields.has("store_name")) missing.push("store_name");
  if (!fields.has("time_range") && !(fields.has("start_time") && fields.has("end_time"))) missing.push("time");
  return missing;
}

/**
 * Give one column a meaning. A meaning belongs to one column: the engine reads the first column it
 * finds for a field, so a second "date" column would be silently ignored. The column that held it
 * before becomes `ignore`, and the select shows that.
 */
export function assignColumn(mapping: ColumnMapping, column: number, field: ImportField): ColumnMapping {
  const next: ColumnMapping = {};
  for (const [col, value] of Object.entries(mapping)) {
    const index = Number(col);
    next[index] = field !== "ignore" && value === field && index !== column ? "ignore" : value;
  }
  next[column] = field;
  return next;
}

/** Header row → a stable signature, so the same client's next file finds its mapping again. */
export function headerSignature(headers: readonly string[]): string {
  const text = headers.map((h) => normalizeLoose(h)).join("␟");
  // FNV-1a, 32-bit. Collisions only cost a wrong suggestion the coordinator still sees and can change.
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${headers.length}-${hash.toString(16).padStart(8, "0")}`;
}

/** A remembered mapping is usable only if it still fits this header and still makes an import possible. */
export function restoreMapping(saved: unknown, headers: readonly string[]): ColumnMapping | null {
  if (!saved || typeof saved !== "object") return null;
  const allowed: ReadonlySet<string> = new Set<ImportField>([
    "date",
    "store_name",
    "store_address",
    "city",
    "chain",
    "start_time",
    "end_time",
    "time_range",
    "promoters_required",
    "notes",
    "ignore",
  ]);
  const mapping: ColumnMapping = {};
  for (let col = 0; col < headers.length; col++) mapping[col] = "ignore";
  for (const [col, field] of Object.entries(saved as Record<string, unknown>)) {
    const index = Number(col);
    if (!Number.isInteger(index) || index < 0 || index >= headers.length) return null;
    if (typeof field !== "string" || !allowed.has(field)) return null;
    mapping[index] = field as ImportField;
  }
  return missingRequiredFields(mapping).length === 0 ? mapping : null;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** A cell as a coordinator would recognise it in their spreadsheet — not an ISO string or a day fraction. */
export function displayCell(cell: Cell): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) {
    const date = `${pad(cell.getUTCDate())}/${pad(cell.getUTCMonth() + 1)}/${cell.getUTCFullYear()}`;
    const time = `${pad(cell.getUTCHours())}:${pad(cell.getUTCMinutes())}`;
    if (cell.getUTCFullYear() <= 1900) return time;
    return time === "00:00" ? date : `${date} ${time}`;
  }
  if (typeof cell === "number" && cell > 0 && cell < 1) {
    const minutes = Math.round(cell * 24 * 60);
    return `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
  }
  if (typeof cell === "boolean") return cell ? "✓" : "";
  return String(cell).trim();
}

/** Up to `count` non-blank values under the header in one column. */
export function sampleValues(grid: SheetGrid, headerRowIndex: number, column: number, count = 3): string[] {
  const out: string[] = [];
  for (let r = headerRowIndex + 1; r < grid.rows.length && out.length < count; r++) {
    const text = displayCell(grid.rows[r]?.[column] ?? null);
    if (text) out.push(text);
  }
  return out;
}

/** "Σεπτέμβριος — Hyper Vega.xlsx" → "Σεπτέμβριος — Hyper Vega", capped to a section name's length. */
export function sectionNameFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim();
  return (base || filename).slice(0, 120);
}
