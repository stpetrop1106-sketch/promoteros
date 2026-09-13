import { describe, expect, it } from "vitest";
import { utils, write } from "xlsx";
import { ImportFileError, readWorkbook } from "@/lib/import/workbook";
import { detectHeader } from "@/lib/import/header-detection";
import { parseRows } from "@/lib/import/row-parser";
import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS } from "@/lib/import/constants";

// All fixtures below are generated in-memory with SheetJS — no binary files are committed, and every
// name/date/value is invented for this test (CLAUDE.md constraint 1: no real agency data, ever).

function xlsxArrayBuffer(rows: unknown[][]): ArrayBuffer {
  const sheet = utils.aoa_to_sheet(rows);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, sheet, "Πρόγραμμα");
  const out = write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return out;
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Derived from the runtime's own windows-1253 decoder, so it stays correct for whatever it decodes. */
function encodeWindows1253(text: string): Uint8Array {
  const byteForChar = new Map<string, number>();
  for (let b = 0; b < 256; b++) {
    const decoded = new TextDecoder("windows-1253").decode(new Uint8Array([b]));
    if (!byteForChar.has(decoded)) byteForChar.set(decoded, b);
  }
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    const byte = byteForChar.get(ch);
    if (byte === undefined) throw new Error(`test fixture uses a character windows-1253 can't encode: ${ch}`);
    bytes[i] = byte;
  }
  return bytes;
}

describe("readWorkbook — a real xlsx file", () => {
  it("reads a clean workbook and the rows are importable end to end", () => {
    const buf = xlsxArrayBuffer([
      ["Date", "Store", "Start", "End", "Promoters"],
      [new Date(Date.UTC(2026, 8, 20)), "Acme Kiosk", "10:00", "18:00", 2],
    ]);
    const sheets = readWorkbook(buf);
    expect(sheets).toHaveLength(1);
    const header = detectHeader(sheets[0]!);
    expect(header.complete).toBe(true);
    const rows = parseRows(sheets[0]!, header.headerRowIndex, header.mapping, { today: "2026-09-13" });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.date).toBe("2026-09-20");
    expect(rows[0]!.issues).toEqual([]);
  });

  it("drops empty sheets", () => {
    const sheet1 = utils.aoa_to_sheet([
      ["Date", "Store"],
      [new Date(Date.UTC(2026, 8, 20)), "Acme Kiosk"],
    ]);
    const emptySheet = utils.aoa_to_sheet([[null, null], [null, null]]);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, emptySheet, "Empty");
    utils.book_append_sheet(wb, sheet1, "Data");
    const buf = write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const sheets = readWorkbook(buf);
    expect(sheets).toHaveLength(1);
    expect(sheets[0]!.name).toBe("Data");
  });
});

describe("readWorkbook — CSV", () => {
  it("reads a Windows-1253 CSV with ';' separators", () => {
    const csv = ["Ημερομηνία;Κατάστημα;Ώρα Έναρξης;Έως", "15/09/2026;Καφέ Κεντρικό;10:00;18:00"].join("\r\n");
    const buf = bytesToArrayBuffer(encodeWindows1253(csv));

    const sheets = readWorkbook(buf);
    expect(sheets).toHaveLength(1);
    const header = detectHeader(sheets[0]!);
    expect(header.complete).toBe(true);
    const rows = parseRows(sheets[0]!, header.headerRowIndex, header.mapping, { today: "2026-09-01" });
    expect(rows[0]!.date).toBe("2026-09-15");
    expect(rows[0]!.storeName).toBe("Καφέ Κεντρικό");
  });

  it("reads a UTF-8 CSV with ',' separators", () => {
    const csv = ["Date,Store,Start,End", "2026-09-20,Acme Kiosk,10:00,18:00"].join("\n");
    const buf = new TextEncoder().encode(csv).buffer;

    const sheets = readWorkbook(buf);
    const header = detectHeader(sheets[0]!);
    expect(header.complete).toBe(true);
    const rows = parseRows(sheets[0]!, header.headerRowIndex, header.mapping, { today: "2026-09-01" });
    expect(rows[0]!.storeName).toBe("Acme Kiosk");
  });
});

describe("readWorkbook — limits and errors", () => {
  it("throws ImportFileError('empty') for a zero-byte file", () => {
    expect(() => readWorkbook(new ArrayBuffer(0))).toThrow(ImportFileError);
    try {
      readWorkbook(new ArrayBuffer(0));
    } catch (e) {
      expect((e as ImportFileError).code).toBe("empty");
    }
  });

  it("throws ImportFileError('too_large') for a file over MAX_IMPORT_BYTES", () => {
    const big = new ArrayBuffer(MAX_IMPORT_BYTES + 1);
    try {
      readWorkbook(big);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ImportFileError);
      expect((e as ImportFileError).code).toBe("too_large");
    }
  });

  it("throws ImportFileError('too_large') when a sheet has more than MAX_IMPORT_ROWS rows", () => {
    const rows: unknown[][] = [["Date", "Store"]];
    for (let i = 0; i < MAX_IMPORT_ROWS + 5; i++) rows.push(["2026-09-20", "Acme Kiosk"]);
    const buf = xlsxArrayBuffer(rows);
    try {
      readWorkbook(buf);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ImportFileError);
      expect((e as ImportFileError).code).toBe("too_large");
    }
  });

  it("throws ImportFileError('unreadable') for corrupt binary data", () => {
    // A real zip signature followed by garbage: looks binary, fails to parse as a workbook.
    const bytes = new Uint8Array(64);
    bytes[0] = 0x50;
    bytes[1] = 0x4b;
    bytes[2] = 0x03;
    bytes[3] = 0x04;
    for (let i = 4; i < bytes.length; i++) bytes[i] = i % 256;
    try {
      readWorkbook(bytesToArrayBuffer(bytes));
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ImportFileError);
      expect((e as ImportFileError).code).toBe("unreadable");
    }
  });

  it("throws ImportFileError('empty') for a workbook with no data in any sheet", () => {
    const buf = xlsxArrayBuffer([[null, null], [null, null]]);
    try {
      readWorkbook(buf);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ImportFileError);
      expect((e as ImportFileError).code).toBe("empty");
    }
  });
});
