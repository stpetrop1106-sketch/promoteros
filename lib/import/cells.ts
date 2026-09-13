/**
 * P37b — small helpers for reading a `Cell[]` row against a `ColumnMapping`. Shared by header
 * detection and row parsing. No `xlsx` import.
 */

import type { Cell, ColumnMapping, ImportField } from "./types";

export function findColumn(mapping: ColumnMapping, field: ImportField): number | undefined {
  for (const key of Object.keys(mapping)) {
    const col = Number(key);
    if (mapping[col] === field) return col;
  }
  return undefined;
}

export function cellAt(row: readonly Cell[], col: number | undefined): Cell {
  if (col === undefined) return null;
  const value = row[col];
  return value === undefined ? null : value;
}

export function isCellBlank(value: Cell): boolean {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

/** Display text for a cell — used for header matching and for plain text fields (store, notes...). */
export function cellText(value: Cell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function isRowBlank(row: readonly Cell[]): boolean {
  return row.every((cell) => isCellBlank(cell));
}
