/**
 * P37b — date-cell parsing. No `xlsx` import.
 *
 * Handles, in this order: a JS `Date` (SheetJS already resolved it with `cellDates: true`), an Excel
 * serial number (a cell SheetJS did not recognise as a date, e.g. plain "General" formatting), and
 * text in several shapes. Greek files are day-first, always — never month-first.
 *
 * All dates are read back as naive Athens calendar dates via UTC getters, matching the trap
 * `lib/availability-links.ts` documents: never build a `Date` from a bare date string and never let
 * a local-timezone read shift the day.
 */

import type { Cell } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

function isoFromParts(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, "0")}-${pad(month)}-${pad(day)}`;
}

function daysInMonth(year: number, month: number): number {
  // Day 0 of the *next* month is the last day of `month`.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isValidYmd(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(year, month);
}

/**
 * Excel's day-0 epoch is 1899-12-30 (it treats 1900 as a leap year, which it wasn't; 25569 is the
 * standard correction — the same constant SheetJS itself and most spreadsheet tooling use — mapping
 * serial day 25569 to 1970-01-01). Good for the modern dates this product ever sees.
 */
function excelSerialToUtcDate(serial: number): Date {
  const utcDays = Math.floor(serial) - 25569;
  return new Date(utcDays * 86_400_000);
}

export type DateParseResult = { ok: true; iso: string } | { ok: false };

function finalizeYmd(year: number, month: number, day: number): DateParseResult {
  if (!isValidYmd(year, month, day)) return { ok: false };
  return { ok: true, iso: isoFromParts(year, month, day) };
}

/** No year in the text: the next occurrence of that month/day on or after `todayIso`. */
function finalizeNoYear(month: number, day: number, todayIso: string): DateParseResult {
  if (month < 1 || month > 12 || day < 1 || day > 31) return { ok: false };
  const todayYear = Number(todayIso.slice(0, 4));

  for (const year of [todayYear, todayYear + 1]) {
    if (!isValidYmd(year, month, day)) continue;
    const candidate = isoFromParts(year, month, day);
    if (candidate >= todayIso) return { ok: true, iso: candidate };
  }
  // Both candidates land before today (shouldn't normally happen since year+1 always clears it)
  // or the date is a leap-only day in a non-leap year — fall back to next year regardless.
  if (isValidYmd(todayYear + 1, month, day)) return { ok: true, iso: isoFromParts(todayYear + 1, month, day) };
  return { ok: false };
}

function parseDateText(raw: string, todayIso: string): DateParseResult {
  let s = raw.trim();
  if (!s) return { ok: false };

  // Strip a leading weekday word ("Τρίτη 15/09" -> "15/09"). Keep stripping non-numeric leading
  // tokens in case of "Την Τρίτη 15/09" style phrasing.
  const tokens = s.split(/\s+/);
  while (tokens.length > 1 && !/\d/.test(tokens[0]!)) tokens.shift();
  s = tokens.join(" ");

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return finalizeYmd(Number(m[1]), Number(m[2]), Number(m[3]));

  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const yearText = m[3];
    if (yearText) {
      let year = Number(yearText);
      if (yearText.length === 2) year += 2000;
      return finalizeYmd(year, month, day);
    }
    return finalizeNoYear(month, day, todayIso);
  }

  return { ok: false };
}

export function parseDateCell(cell: Cell, todayIso: string): DateParseResult {
  if (cell === null || cell === undefined) return { ok: false };

  if (cell instanceof Date) {
    if (Number.isNaN(cell.getTime())) return { ok: false };
    return finalizeYmd(cell.getUTCFullYear(), cell.getUTCMonth() + 1, cell.getUTCDate());
  }

  if (typeof cell === "number") {
    if (!Number.isFinite(cell) || cell <= 0) return { ok: false };
    const d = excelSerialToUtcDate(cell);
    return finalizeYmd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }

  if (typeof cell === "string") return parseDateText(cell, todayIso);

  return { ok: false };
}
