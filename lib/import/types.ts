/**
 * FROZEN CONTRACT — Excel/CSV shift import. Written by the manager before P37b (engine) and P37c
 * (UI) start, so both can build in parallel. Changing a type here breaks the other parcel: raise it
 * in your status file instead.
 *
 * Everything in `lib/import/` is PURE and CLIENT-SAFE: no `server-only`, no database, no network,
 * no `node:` imports. The browser parses the file (so a 5 MB workbook never crosses a server
 * action), and the server action re-validates every row with the same functions — the client's
 * parse is never trusted.
 */

/** One cell as SheetJS hands it over with `cellDates: true`. */
export type Cell = string | number | boolean | Date | null;

/** One worksheet, as a rectangular-ish grid. Row 0 is the sheet's first row, whatever it holds. */
export type SheetGrid = {
  name: string;
  rows: Cell[][];
};

/**
 * What a column can mean. `time_range` is a single cell like "10:00-18:00" or "10.00 – 18.00",
 * which is how most client schedules actually write it. `ignore` is an explicit "not used".
 */
export type ImportField =
  | "date"
  | "store_name"
  | "store_address"
  | "city"
  | "chain"
  | "start_time"
  | "end_time"
  | "time_range"
  | "promoters_required"
  | "notes"
  | "ignore";

/** Column index (0-based, within the sheet) → meaning. Columns not present are ignored. */
export type ColumnMapping = Record<number, ImportField>;

export type HeaderDetection = {
  /** Index into `SheetGrid.rows` of the header row. Title rows above it are skipped. */
  headerRowIndex: number;
  /** The header row's cells as display text, one per column. */
  headers: string[];
  /** Best guess for each column. Every column gets an entry — `ignore` when nothing matched. */
  mapping: ColumnMapping;
  /** 0..1 per column: how sure the guess is. The UI highlights anything under 0.6 for review. */
  confidence: Record<number, number>;
  /** True when date + store + a time source were all found, i.e. an import is possible as-is. */
  complete: boolean;
};

export type RowIssueCode =
  | "missing_date"
  | "unparseable_date"
  | "missing_store"
  | "missing_time"
  | "unparseable_time"
  | "end_before_start"
  | "past_date"
  | "bad_headcount"
  | "duplicate_in_file";

export type RowIssue = {
  code: RowIssueCode;
  /** `error` rows are not imported. `warning` rows are imported and the reason is shown. */
  severity: "error" | "warning";
  field: ImportField;
};

/** One sheet row turned into a candidate shift. Every value is normalised or null. */
export type ParsedRow = {
  /** 1-based row number as Excel shows it, so a coordinator can find the row in the file. */
  sourceRow: number;
  /** "YYYY-MM-DD", the naive Athens calendar date — never a JS Date built from a bare date. */
  date: string | null;
  /** "HH:MM", 24-hour. */
  startTime: string | null;
  endTime: string | null;
  storeName: string | null;
  storeAddress: string | null;
  city: string | null;
  chain: string | null;
  /** Defaults to `ParseOptions.defaultPromoters` when the column is absent or empty. */
  promotersRequired: number;
  notes: string | null;
  issues: RowIssue[];
};

export type ParseOptions = {
  /** Today in Europe/Athens, "YYYY-MM-DD". Dates before it get a `past_date` warning. */
  today: string;
  /** Used when there is no headcount column, or the cell is empty. Default 1. */
  defaultPromoters?: number;
};

/** An existing store the agency already has, as the matcher needs it. */
export type KnownStore = {
  id: string;
  name: string;
  address: string | null;
  chain: string | null;
};

/**
 * How one DISTINCT store in the file resolves — resolved once per store, never once per row, so a
 * 120-row programme across six stores asks the coordinator at most six questions.
 */
export type StoreMatch = {
  /** `normaliseStoreKey(name, address)` — the join key back to the rows. */
  key: string;
  name: string;
  address: string | null;
  city: string | null;
  chain: string | null;
  rowCount: number;
  /** Best existing store, if any. */
  match: { storeId: string; storeName: string; score: number } | null;
  /** `exact` ≥ 0.95 is auto-accepted; `likely` is pre-selected but shown; `none` needs a decision. */
  confidence: "exact" | "likely" | "none";
};

/*
 * FUNCTIONS P37b MUST EXPORT from `lib/import/index.ts` (P37c imports only from there):
 *
 *   readWorkbook(data: ArrayBuffer): SheetGrid[]
 *     .xlsx, .xls, .ods and .csv (UTF-8 and Windows-1253 Greek). Empty sheets dropped.
 *     Throws ImportFileError (exported class, `code: "unreadable" | "empty" | "too_large"`).
 *
 *   detectHeader(grid: SheetGrid): HeaderDetection
 *
 *   parseRows(grid: SheetGrid, headerRowIndex: number, mapping: ColumnMapping, options: ParseOptions): ParsedRow[]
 *     Skips fully empty rows and obvious total/footer rows. Flags duplicates within the file.
 *
 *   validateRow(row: ParsedRow, options: ParseOptions): ParsedRow
 *     Recomputes `issues` from the values alone. The SERVER calls this on every row it receives.
 *
 *   normaliseStoreKey(name: string, address?: string | null): string
 *
 *   matchStores(rows: ParsedRow[], known: KnownStore[]): StoreMatch[]
 *
 *   MAX_IMPORT_ROWS: number   (2000)
 *   MAX_IMPORT_BYTES: number  (5 MB)
 */
