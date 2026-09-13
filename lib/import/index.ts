/**
 * P37b — the only module P37c (and any server action re-validating an import) may import from.
 *
 * `readWorkbook` pulls in `xlsx` (see `workbook.ts`); everything else here is SheetJS-free. A
 * consumer that only needs `detectHeader`/`parseRows`/`validateRow`/`matchStores` and wants to avoid
 * bundling SheetJS at all should import those directly from their own files
 * (`lib/import/header-detection`, `lib/import/row-parser`, `lib/import/store-matching`) instead of
 * this barrel — importing from here pulls in `readWorkbook`'s module graph too. See
 * `docs/status/P37b.md` for the "does not pull in xlsx" verification, which checks the individual
 * modules, not this barrel.
 */

export type {
  Cell,
  SheetGrid,
  ImportField,
  ColumnMapping,
  HeaderDetection,
  RowIssueCode,
  RowIssue,
  ParsedRow,
  ParseOptions,
  KnownStore,
  StoreMatch,
} from "./types";

export { readWorkbook, ImportFileError, type ImportFileErrorCode } from "./workbook";
export { detectHeader } from "./header-detection";
export { parseRows, validateRow } from "./row-parser";
export { normaliseStoreKey, matchStores, foldToken } from "./store-matching";
export { MAX_IMPORT_ROWS, MAX_IMPORT_BYTES } from "./constants";
