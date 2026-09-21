/**
 * P37b — reading the dropped file into `SheetGrid[]`.
 *
 * The ONLY module in `lib/import/` allowed to import `xlsx`. `detectHeader`, `parseRows`,
 * `validateRow` and `matchStores` must never transitively load this file — that is how the
 * server-side re-validation path avoids bundling SheetJS just to check a few numbers.
 *
 * `readWorkbook(data: ArrayBuffer)` has no filename or mime type to go on (the frozen contract is
 * exactly that signature), so binary vs. text is sniffed from the bytes themselves: a zip signature
 * (xlsx/ods) or an OLE2 signature (xls) goes straight to `XLSX.read`. Anything else is assumed to be
 * CSV text, and Greek Excel exports need two more guesses:
 *   - encoding: UTF-8 first; if decoding produced replacement characters, redecode as Windows-1253
 *     (the Greek code page classic Excel still writes).
 *   - delimiter: whichever of "," / ";" appears more often in the first handful of lines — Greek
 *     regional settings make Excel export CSV with ";" since "," is the decimal separator there.
 */

import { read, utils, type WorkBook } from "xlsx";
import type { Cell, SheetGrid } from "./types";
import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS } from "./constants";

export type ImportFileErrorCode = "unreadable" | "empty" | "too_large";

export class ImportFileError extends Error {
  code: ImportFileErrorCode;
  constructor(code: ImportFileErrorCode, message?: string) {
    super(message ?? code);
    this.name = "ImportFileError";
    this.code = code;
  }
}

function looksBinary(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  // ZIP local-file-header signature — xlsx and ods are zip containers.
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return true;
  // OLE2 compound-file signature — the legacy .xls binary format.
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) return true;
  return false;
}

function decodeCsvText(bytes: Uint8Array): string {
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  if (!utf8.includes("�")) return utf8;
  try {
    return new TextDecoder("windows-1253").decode(bytes);
  } catch {
    return utf8;
  }
}

function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 5).join("\n");
  const semicolons = (sample.match(/;/g) ?? []).length;
  const commas = (sample.match(/,/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

function toGrid(name: string, sheet: WorkBook["Sheets"][string]): SheetGrid {
  const rows = utils.sheet_to_json<Cell[]>(sheet, { header: 1, defval: null, raw: true }) as Cell[][];
  return { name, rows };
}

export function readWorkbook(data: ArrayBuffer): SheetGrid[] {
  if (data.byteLength === 0) throw new ImportFileError("empty", "The file is empty.");
  if (data.byteLength > MAX_IMPORT_BYTES) throw new ImportFileError("too_large", "The file is larger than the import limit.");

  const bytes = new Uint8Array(data);

  let workbook: WorkBook;
  try {
    if (looksBinary(bytes)) {
      workbook = read(data, { type: "array", cellDates: true });
    } else {
      const text = decodeCsvText(bytes);
      const delimiter = detectDelimiter(text);
      // `raw: true` keeps every CSV cell as the text the client typed. Without it SheetJS guesses
      // at date-shaped strings MONTH-FIRST: "10/09/2026" came back as 9 October, silently turning
      // a Greek 10 September into an October shift. Our own parser is day-first by design
      // (lib/import/dates.ts), so the text must reach it untouched.
      workbook = read(text, { type: "string", FS: delimiter, raw: true });
    }
  } catch (err) {
    throw new ImportFileError("unreadable", err instanceof Error ? err.message : "Could not read the file.");
  }

  const sheets: SheetGrid[] = [];
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const grid = toGrid(name, sheet);
    const hasContent = grid.rows.some((row) => row.some((cell) => cell !== null && cell !== undefined && cell !== ""));
    if (hasContent) sheets.push(grid);
  }

  if (sheets.length === 0) throw new ImportFileError("empty", "The workbook has no data.");

  for (const sheet of sheets) {
    if (sheet.rows.length > MAX_IMPORT_ROWS) {
      throw new ImportFileError("too_large", `Sheet "${sheet.name}" has more than ${MAX_IMPORT_ROWS} rows.`);
    }
  }

  return sheets;
}
