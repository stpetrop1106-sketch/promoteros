/**
 * S1 — bulk promoter import: the pure half.
 *
 * PURE and CLIENT-SAFE, exactly like `lib/import/` (P37b): no `server-only`, no database, no
 * network, no `node:` imports, and no `xlsx`. The browser parses the dropped file and shows the
 * coordinator what will happen; the server then re-parses and re-validates the same rows with the
 * same functions before writing anything. The client's conclusion is displayed, never trusted.
 *
 * Reads the workbook through the SHIFT importer's `readWorkbook` (`lib/import/workbook`) —
 * unchanged, not forked. That module already solves the parts an agency's real file breaks on:
 * SheetJS from the vendor CDN (D18), `raw: true` so Greek `10/09/2026` is not silently read as
 * 9 October, and Windows-1253 CSV from a Greek Excel. Text normalisation comes from
 * `lib/import/text` for the same reason. Nothing in `app/shifts/import/**` or `lib/import/**` is
 * modified by this parcel.
 *
 * What is deliberately NOT shared: the field vocabulary and the row shape. A shift row is a date,
 * a store and a time; a promoter row is a person. Forcing them through one generic parser would
 * make both harder to read and would put P37's frozen contract at risk for no gain.
 */

import type { Cell, SheetGrid } from "@/lib/import/types";
import { cellAt, cellText, isCellBlank, isRowBlank } from "@/lib/import/cells";
import { normalizeKeyTokens, tokenize } from "@/lib/import/text";
import { normalizePhone, isUsablePhone } from "./phone";

// -------------------------------------------------------------------------------------------
// Fields
// -------------------------------------------------------------------------------------------

/**
 * `first_name` / `last_name` exist because Greek agency rosters really are split that way about
 * half the time ("Όνομα" | "Επώνυμο"), and a file that has them has no `full_name` column at all.
 * They are combined into one name at parse time.
 */
export type PromoterField =
  | "full_name"
  | "first_name"
  | "last_name"
  | "phone"
  | "email"
  | "area"
  | "birth_year"
  | "has_car"
  | "has_licence"
  | "notes"
  | "ignore";

export const PROMOTER_FIELDS: readonly PromoterField[] = [
  "full_name",
  "first_name",
  "last_name",
  "phone",
  "email",
  "area",
  "birth_year",
  "has_car",
  "has_licence",
  "notes",
  "ignore",
];

/** Column index (0-based, within the sheet) -> meaning. Columns not present are ignored. */
export type PromoterColumnMapping = Record<number, PromoterField>;

/**
 * Header synonyms, written as readable Greek/English phrases. Both sides are normalised before
 * comparison (`lib/import/text`), so accents, case and punctuation in the real file never matter —
 * which is the whole point, since no two agencies spell "Ονοματεπώνυμο" the same way.
 */
type SynonymEntry = { field: PromoterField; terms: string[] };

export const PROMOTER_SYNONYMS: readonly SynonymEntry[] = [
  {
    field: "full_name",
    terms: ["ονοματεπωνυμο", "ονομα επωνυμο", "επωνυμο ονομα", "ονομ μο", "full name", "name", "promoter", "προμοτερ", "στελεχος"],
  },
  { field: "first_name", terms: ["ονομα", "μικρο ονομα", "first name", "given name", "firstname"] },
  { field: "last_name", terms: ["επωνυμο", "επιθετο", "last name", "surname", "family name", "lastname"] },
  { field: "phone", terms: ["τηλεφωνο", "τηλ", "κινητο", "phone", "mobile", "telephone", "επικοινωνια", "cell"] },
  { field: "email", terms: ["email", "e mail", "mail", "ηλεκτρονικο ταχυδρομειο"] },
  { field: "area", terms: ["περιοχη", "περιοχες", "area", "areas", "πολη", "city", "δημος", "ζωνη"] },
  {
    field: "birth_year",
    terms: ["ετος γεννησης", "ημερομηνια γεννησης", "γεννηση", "birth year", "year of birth", "date of birth", "dob", "birthday"],
  },
  { field: "has_car", terms: ["αυτοκινητο", "ιχ", "car", "vehicle", "οχημα", "μεταφορικο μεσο"] },
  { field: "has_licence", terms: ["διπλωμα", "αδεια οδηγησης", "licence", "license", "driving licence", "driver licence"] },
  { field: "notes", terms: ["σχολια", "παρατηρησεις", "σημειωσεις", "notes", "comments"] },
];

// -------------------------------------------------------------------------------------------
// Header detection
// -------------------------------------------------------------------------------------------

export type PromoterHeaderDetection = {
  headerRowIndex: number;
  headers: string[];
  mapping: PromoterColumnMapping;
  /** 0..1 per column. The UI flags anything under 0.6 for the coordinator to look at. */
  confidence: Record<number, number>;
  /** True when a name source and a phone were both found, i.e. an import is possible as-is. */
  complete: boolean;
};

const MAX_HEADER_SEARCH_ROWS = 15;

/**
 * Tiered rather than binary, for the same reason P37b's is: a confidently WRONG guess is worse
 * than an honestly unsure one, because the UI only interrupts the coordinator below 0.6.
 */
export function scorePromoterHeaderCell(raw: string): { field: PromoterField; confidence: number } {
  const text = raw.trim();
  if (!text) return { field: "ignore", confidence: 0 };

  const collapsed = normalizeKeyTokens(text).replace(/\s+/g, "");
  const tokens = tokenize(text);

  let best: { field: PromoterField; confidence: number } = { field: "ignore", confidence: 0 };

  for (const { field, terms } of PROMOTER_SYNONYMS) {
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
      // Five characters, not P37b's three. A three-character substring match is far too eager on
      // this vocabulary: "Στήλη Β" ("column B") contains "τηλ" and was being mapped to the PHONE
      // column with 0.5 confidence — a wrong guess on the one field that decides identity. Short
      // abbreviations that genuinely matter ("Τηλ.", "ΙΧ") are caught by the exact and token tiers
      // above, which is where they belong.
      if (
        termCollapsed.length >= 5 &&
        collapsed.length >= 5 &&
        (collapsed.includes(termCollapsed) || termCollapsed.includes(collapsed)) &&
        best.confidence < 0.5
      ) {
        best = { field, confidence: 0.5 };
      }
    }
  }

  return best;
}

function cellDisplayText(cell: Cell): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) return cell.toISOString();
  return String(cell);
}

export function detectPromoterHeader(grid: SheetGrid): PromoterHeaderDetection {
  const searchRows = Math.min(MAX_HEADER_SEARCH_ROWS, grid.rows.length);

  let bestIndex = 0;
  let bestScore = -1;
  let bestGuesses: { field: PromoterField; confidence: number }[] = [];

  for (let r = 0; r < searchRows; r++) {
    const row = grid.rows[r] ?? [];
    const guesses = row.map((cell) => scorePromoterHeaderCell(cellDisplayText(cell)));
    const distinct = new Set(guesses.filter((g) => g.field !== "ignore").map((g) => g.field));
    const score = guesses.reduce((sum, g) => sum + (g.field === "ignore" ? 0 : g.confidence), 0) + distinct.size * 0.1;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = r;
      bestGuesses = guesses;
    }
  }

  const headers = (grid.rows[bestIndex] ?? []).map((cell) => cellDisplayText(cell));
  const mapping: PromoterColumnMapping = {};
  const confidence: Record<number, number> = {};
  bestGuesses.forEach((guess, col) => {
    mapping[col] = guess.field;
    confidence[col] = guess.confidence;
  });

  return {
    headerRowIndex: bestIndex,
    headers,
    mapping,
    confidence,
    complete: bestScore > 0 && missingPromoterFields(mapping).length === 0,
  };
}

/** A promoter needs a name and a way to reach them. Everything else is optional. */
export type RequiredPromoterField = "name" | "phone";

export function missingPromoterFields(mapping: PromoterColumnMapping): RequiredPromoterField[] {
  const present = new Set(Object.values(mapping));
  const missing: RequiredPromoterField[] = [];
  if (!present.has("full_name") && !(present.has("first_name") && present.has("last_name"))) missing.push("name");
  if (!present.has("phone")) missing.push("phone");
  return missing;
}

/** Assigning a field to a column takes it away from whichever column had it — except `ignore`. */
export function assignPromoterColumn(
  mapping: PromoterColumnMapping,
  column: number,
  field: PromoterField,
): PromoterColumnMapping {
  const next: PromoterColumnMapping = { ...mapping };
  if (field !== "ignore") {
    for (const key of Object.keys(next)) {
      const col = Number(key);
      if (col !== column && next[col] === field) next[col] = "ignore";
    }
  }
  next[column] = field;
  return next;
}

function findColumn(mapping: PromoterColumnMapping, field: PromoterField): number | undefined {
  for (const key of Object.keys(mapping)) {
    const col = Number(key);
    if (mapping[col] === field) return col;
  }
  return undefined;
}

// -------------------------------------------------------------------------------------------
// Rows
// -------------------------------------------------------------------------------------------

export type PromoterRowIssueCode =
  | "missing_name"
  | "name_too_short"
  | "missing_phone"
  | "phone_invalid"
  | "duplicate_in_file"
  | "email_invalid"
  | "birth_year_invalid"
  | "unknown_area";

export type PromoterRowIssue = {
  code: PromoterRowIssueCode;
  /** `error` rows are never imported. `warning` rows are imported with that value dropped. */
  severity: "error" | "warning";
  field: PromoterField;
};

export type ParsedPromoterRow = {
  /** 1-based row number as Excel shows it, so the coordinator can find it in their file. */
  sourceRow: number;
  fullName: string | null;
  /** Normalised by `normalizePhone` — this is the value the duplicate check compares. */
  phone: string | null;
  /** As written in the file, for showing the coordinator what they typed. */
  phoneRaw: string | null;
  email: string | null;
  birthYear: number | null;
  /** Area names as written in the file, whether or not the agency has them. */
  areaNames: string[];
  /** Ids of the areas that resolved. Unresolved names become an `unknown_area` warning. */
  areaIds: string[];
  hasCar: boolean;
  hasLicence: boolean;
  notes: string | null;
  issues: PromoterRowIssue[];
};

export type KnownArea = { id: string; name: string };

export type PromoterParseOptions = {
  knownAreas: readonly KnownArea[];
  /** Europe/Athens "YYYY-MM-DD" — only its year is used, to bound a plausible birth year. */
  today: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_BIRTH_YEAR = 1940;
/** Nobody under 14 works a promotion shift; mirrors the promoter form's own bound. */
const MIN_WORKING_AGE = 14;

/** Anything a person might put in a yes/no column, in either language. */
const TRUTHY = new Set(["ναι", "ν", "yes", "y", "true", "1", "v", "ok", "εχει"]);
const FALSY = new Set(["οχι", "ο", "no", "n", "false", "0", "δεν εχει"]);

/**
 * Checked against the RAW cell, before normalisation. `normalizeKeyTokens` keeps only letters and
 * numbers, so every one of these would otherwise be erased to an empty string and read as "no" —
 * turning a ticked column into a roster where nobody has a car.
 */
const TICKS = new Set(["✓", "✔", "☑", "√", "x", "X", "χ", "Χ", "*", "+", "●", "•"]);

export function parseBoolean(cell: Cell): boolean {
  if (typeof cell === "boolean") return cell;
  if (typeof cell === "number") return cell !== 0;

  const raw = cellText(cell).trim();
  if (!raw) return false;
  if (TICKS.has(raw)) return true;

  const text = normalizeKeyTokens(raw);
  // Punctuation only — "-", "—", "n/a" written as "--". That is a blank, i.e. no.
  if (!text) return false;
  if (TRUTHY.has(text)) return true;
  if (FALSY.has(text)) return false;

  // An unrecognised non-empty value in a yes/no column is far more likely to mean "yes, and here
  // is a detail" ("ΝΑΙ - μηχανάκι") than "no". A blank cell is the way to say no.
  return true;
}

export function parseBirthYear(cell: Cell, currentYear: number): number | null | "invalid" {
  if (isCellBlank(cell)) return null;
  if (cell instanceof Date) return cell.getFullYear();

  const text = cellText(cell);
  // A four-digit year anywhere in the cell: "1994", "12/05/1994", "γενν. 1994".
  const match = text.match(/(18|19|20)\d{2}/);
  const year = match ? Number(match[0]) : Number(text);
  if (!Number.isFinite(year)) return "invalid";
  if (year < MIN_BIRTH_YEAR || year > currentYear - MIN_WORKING_AGE) return "invalid";
  return Math.trunc(year);
}

/** One cell may hold several areas: "Γλυφάδα, Ελληνικό" or "Κέντρο / Νέα Σμύρνη". */
export function splitAreas(raw: string): string[] {
  return raw
    .split(/[,;/|]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parsePromoterRows(
  grid: SheetGrid,
  headerRowIndex: number,
  mapping: PromoterColumnMapping,
  options: PromoterParseOptions,
): ParsedPromoterRow[] {
  const fullNameCol = findColumn(mapping, "full_name");
  const firstNameCol = findColumn(mapping, "first_name");
  const lastNameCol = findColumn(mapping, "last_name");
  const phoneCol = findColumn(mapping, "phone");
  const emailCol = findColumn(mapping, "email");
  const areaCol = findColumn(mapping, "area");
  const birthCol = findColumn(mapping, "birth_year");
  const carCol = findColumn(mapping, "has_car");
  const licenceCol = findColumn(mapping, "has_licence");
  const notesCol = findColumn(mapping, "notes");

  const currentYear = Number(options.today.slice(0, 4)) || new Date().getFullYear();
  const areasByKey = new Map(options.knownAreas.map((a) => [normalizeKeyTokens(a.name), a]));

  const rows: ParsedPromoterRow[] = [];

  for (let r = headerRowIndex + 1; r < grid.rows.length; r++) {
    const raw = grid.rows[r] ?? [];
    if (isRowBlank(raw)) continue;

    // --- name ---------------------------------------------------------------------------------
    const issues: PromoterRowIssue[] = [];
    const direct = cellText(cellAt(raw, fullNameCol));
    const first = cellText(cellAt(raw, firstNameCol));
    const last = cellText(cellAt(raw, lastNameCol));
    // "Επώνυμο Όνομα" is how a Greek roster is normally ordered, so last-then-first when both
    // columns exist. It only affects display: search tokenises, so either order is findable.
    const combined = [last, first].filter(Boolean).join(" ").trim();
    const name = (direct || combined).replace(/\s+/g, " ").trim();

    if (!name) issues.push({ code: "missing_name", severity: "error", field: "full_name" });
    else if (name.length < 2) issues.push({ code: "name_too_short", severity: "error", field: "full_name" });

    // --- phone --------------------------------------------------------------------------------
    const phoneRaw = cellText(cellAt(raw, phoneCol));
    let phone: string | null = null;
    if (!phoneRaw) {
      issues.push({ code: "missing_phone", severity: "error", field: "phone" });
    } else if (!isUsablePhone(phoneRaw)) {
      issues.push({ code: "phone_invalid", severity: "error", field: "phone" });
    } else {
      phone = normalizePhone(phoneRaw);
      if (phone.replace(/\D/g, "").length < 6) {
        issues.push({ code: "phone_invalid", severity: "error", field: "phone" });
        phone = null;
      }
    }

    // --- email --------------------------------------------------------------------------------
    // A typo'd email is a warning, never an error: losing a whole promoter over a stray character
    // in an optional field would be a worse outcome than importing them without it.
    const emailRaw = cellText(cellAt(raw, emailCol));
    let email: string | null = null;
    if (emailRaw) {
      if (EMAIL_RE.test(emailRaw)) email = emailRaw;
      else issues.push({ code: "email_invalid", severity: "warning", field: "email" });
    }

    // --- birth year ---------------------------------------------------------------------------
    const birthParsed = birthCol === undefined ? null : parseBirthYear(cellAt(raw, birthCol), currentYear);
    let birthYear: number | null = null;
    if (birthParsed === "invalid") issues.push({ code: "birth_year_invalid", severity: "warning", field: "birth_year" });
    else birthYear = birthParsed;

    // --- areas --------------------------------------------------------------------------------
    // Unknown areas are reported, not created. An `areas` row needs a name, a city AND a
    // non-null centroid lat/lng (0001_init.sql); inventing coordinates for a place-name typed in a
    // spreadsheet would put a made-up point into the distance scoring that ranks who gets offered
    // a shift. The promoter is still imported — just without that area.
    const areaNames = areaCol === undefined ? [] : splitAreas(cellText(cellAt(raw, areaCol)));
    const areaIds: string[] = [];
    let unknownArea = false;
    for (const areaName of areaNames) {
      const found = areasByKey.get(normalizeKeyTokens(areaName));
      if (found) {
        if (!areaIds.includes(found.id)) areaIds.push(found.id);
      } else {
        unknownArea = true;
      }
    }
    if (unknownArea) issues.push({ code: "unknown_area", severity: "warning", field: "area" });

    rows.push({
      sourceRow: r + 1,
      fullName: name || null,
      phone,
      phoneRaw: phoneRaw || null,
      email,
      birthYear,
      areaNames,
      areaIds,
      hasCar: carCol === undefined ? false : parseBoolean(cellAt(raw, carCol)),
      hasLicence: licenceCol === undefined ? false : parseBoolean(cellAt(raw, licenceCol)),
      notes: notesCol === undefined ? null : cellText(cellAt(raw, notesCol)) || null,
      issues,
    });
  }

  markDuplicatesInFile(rows);
  return rows;
}

/**
 * Two rows with the same normalised phone are the same person. The FIRST one is kept and the rest
 * are flagged — silently importing both would create exactly the duplicate the unique constraint
 * exists to prevent, and fail the whole batch at the database.
 */
function markDuplicatesInFile(rows: ParsedPromoterRow[]): void {
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.phone) continue;
    if (seen.has(row.phone)) {
      row.issues.push({ code: "duplicate_in_file", severity: "error", field: "phone" });
    } else {
      seen.add(row.phone);
    }
  }
}

/**
 * Recomputes `issues` from a row's own values. The server calls this on every row it is sent, so a
 * tampered or stale client payload cannot smuggle in a row the preview said was broken.
 *
 * It cannot reproduce `duplicate_in_file` (that needs the sibling rows — `planPromoterImport`
 * handles it) or `unknown_area` (the ids were already resolved). Same deliberate, documented gap
 * as `validateRow` in `lib/import/row-parser.ts`.
 */
export function validatePromoterRow(row: ParsedPromoterRow, options: PromoterParseOptions): ParsedPromoterRow {
  const currentYear = Number(options.today.slice(0, 4)) || new Date().getFullYear();
  const issues: PromoterRowIssue[] = [];

  const name = (row.fullName ?? "").trim();
  if (!name) issues.push({ code: "missing_name", severity: "error", field: "full_name" });
  else if (name.length < 2) issues.push({ code: "name_too_short", severity: "error", field: "full_name" });

  if (!row.phone) issues.push({ code: "missing_phone", severity: "error", field: "phone" });
  else if (row.phone.replace(/\D/g, "").length < 6) issues.push({ code: "phone_invalid", severity: "error", field: "phone" });

  if (row.email && !EMAIL_RE.test(row.email)) issues.push({ code: "email_invalid", severity: "warning", field: "email" });

  if (row.birthYear !== null && (row.birthYear < MIN_BIRTH_YEAR || row.birthYear > currentYear - MIN_WORKING_AGE)) {
    issues.push({ code: "birth_year_invalid", severity: "warning", field: "birth_year" });
  }

  return { ...row, issues };
}

// -------------------------------------------------------------------------------------------
// The plan
// -------------------------------------------------------------------------------------------

export type PromoterRowReason = PromoterRowIssueCode | "duplicate_existing";

/**
 * - `ready`     imported, nothing to say
 * - `warning`   imported, a value was dropped and the reason is shown
 * - `error`     not imported: the row itself is broken
 * - `duplicate` not imported: this promoter is already on the roster
 */
export type PromoterRowStatus = "ready" | "warning" | "error" | "duplicate";

export type PlannedPromoterRow = {
  row: ParsedPromoterRow;
  status: PromoterRowStatus;
  reasons: PromoterRowReason[];
  /** The existing promoter this row duplicates, when it does. */
  existing: { id: string; fullName: string } | null;
};

export type PromoterImportSummary = {
  total: number;
  /** Rows that will be created. The number on the import button. */
  valid: number;
  duplicates: number;
  errors: number;
  /** A subset of `valid`: imported, but something was dropped. */
  warnings: number;
};

export type ExistingPromoter = { id: string; fullName: string; phone: string };

/**
 * Decides what happens to every row. Duplicates are SKIPPED, never updated — the owner's call, and
 * the right one: `updatePromoter` resynchronises `promoter_areas`/`promoter_skills` by
 * delete-then-insert, so "updating" from a spreadsheet with no skills column would silently erase
 * a promoter's skills. There is no way to tell a blank column meaning "leave it alone" from one
 * meaning "clear it", so the importer does not guess.
 */
export function planPromoterImport(
  rows: readonly ParsedPromoterRow[],
  existing: readonly ExistingPromoter[],
): PlannedPromoterRow[] {
  const byPhone = new Map(existing.map((p) => [p.phone, p]));

  return rows.map((row) => {
    const reasons: PromoterRowReason[] = row.issues.map((i) => i.code);
    const hasError = row.issues.some((i) => i.severity === "error");

    if (hasError) return { row, status: "error", reasons, existing: null };

    const match = row.phone ? byPhone.get(row.phone) : undefined;
    if (match) {
      return {
        row,
        status: "duplicate",
        reasons: [...reasons, "duplicate_existing"],
        existing: { id: match.id, fullName: match.fullName },
      };
    }

    return { row, status: reasons.length > 0 ? "warning" : "ready", reasons, existing: null };
  });
}

/** "221 valid / 12 duplicates / 5 errors", which is the sentence the owner asked to see. */
export function summarisePromoterImport(planned: readonly PlannedPromoterRow[]): PromoterImportSummary {
  let valid = 0;
  let duplicates = 0;
  let errors = 0;
  let warnings = 0;

  for (const p of planned) {
    if (p.status === "error") errors++;
    else if (p.status === "duplicate") duplicates++;
    else {
      valid++;
      if (p.status === "warning") warnings++;
    }
  }

  return { total: planned.length, valid, duplicates, errors, warnings };
}

/** The rows that will actually be written. */
export function rowsToCreate(planned: readonly PlannedPromoterRow[]): ParsedPromoterRow[] {
  return planned.filter((p) => p.status === "ready" || p.status === "warning").map((p) => p.row);
}

/** First few non-empty values under a column, so the coordinator can see what they are mapping. */
export function samplePromoterValues(grid: SheetGrid, headerRowIndex: number, col: number, limit = 3): string[] {
  const out: string[] = [];
  for (let r = headerRowIndex + 1; r < grid.rows.length && out.length < limit; r++) {
    const value = cellText(cellAt(grid.rows[r] ?? [], col));
    if (value) out.push(value.slice(0, 40));
  }
  return out;
}
