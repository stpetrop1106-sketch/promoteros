/**
 * P37b — time-cell parsing. No `xlsx` import.
 *
 * Handles an Excel time fraction (a `number` cell, day fraction: 0.5 = noon), text in several
 * shapes ("10:00", "10.00", "10", with an optional Greek or English AM/PM marker attached with or
 * without a space: "10π.μ.", "18:00μμ"), and a single "range" cell such as "10:00-18:00".
 */

import type { Cell } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

function timeFromFraction(value: number): string | null {
  const frac = value - Math.floor(value);
  if (frac < 0) return null;
  let totalMinutes = Math.round(frac * 24 * 60);
  if (totalMinutes >= 24 * 60) totalMinutes -= 24 * 60;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${pad(h)}:${pad(m)}`;
}

// Matches a Greek or English AM/PM marker glued or spaced onto the end of a time string.
// "π.μ." / "πμ" = before noon, "μ.μ." / "μμ" = after noon.
const AMPM_SUFFIX = /(π\.?\s*μ\.?|μ\.?\s*μ\.?|am|pm)\s*$/i;

export function parseTimeText(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const lower = s.toLowerCase();

  const match = lower.match(AMPM_SUFFIX);
  let marker: "am" | "pm" | null = null;
  let rest = lower;
  if (match) {
    const normalized = match[1]!.replace(/[.\s]/g, "");
    marker = normalized === "μμ" || normalized === "pm" ? "pm" : normalized === "πμ" || normalized === "am" ? "am" : null;
    rest = lower.slice(0, match.index).trim();
  }

  const timeMatch = rest.match(/^(\d{1,2})(?:[:.,](\d{1,2}))?$/);
  if (!timeMatch) return null;

  let hour = Number(timeMatch[1]);
  const minute = timeMatch[2] !== undefined ? Number(timeMatch[2]) : 0;
  if (minute < 0 || minute > 59) return null;

  if (marker === "pm" && hour < 12) hour += 12;
  else if (marker === "am" && hour === 12) hour = 0;

  if (hour < 0 || hour > 23) return null;
  return `${pad(hour)}:${pad(minute)}`;
}

export function parseTimeCell(cell: Cell): string | null {
  if (cell === null || cell === undefined) return null;
  if (cell instanceof Date) return `${pad(cell.getUTCHours())}:${pad(cell.getUTCMinutes())}`;
  if (typeof cell === "number") return timeFromFraction(cell);
  if (typeof cell === "string") return parseTimeText(cell);
  return null;
}

// "-", en dash, em dash, "to", or Greek "έως" (accented or not), each with optional surrounding spaces.
const RANGE_SEPARATOR = /\s*(?:–|—|to|έως|εως|-)\s*/i;

export function parseTimeRangeText(raw: string): { start: string; end: string } | null {
  const s = raw.trim();
  if (!s) return null;
  const parts = s.split(RANGE_SEPARATOR).filter((p) => p.trim() !== "");
  if (parts.length !== 2) return null;
  const start = parseTimeText(parts[0]!);
  const end = parseTimeText(parts[1]!);
  if (!start || !end) return null;
  return { start, end };
}
