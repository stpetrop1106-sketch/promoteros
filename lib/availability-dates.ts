/**
 * The pure half of the promoter availability model — A1-09.
 *
 * NO Supabase, no network, no `node:crypto`, no `server-only`. The clock and the locale are always
 * parameters with a default, so every rule below is unit-testable and every one of these functions
 * is safe in a client component.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS
 * ---------------------------------------------------------------------------
 * `lib/availability-links.ts` used to hold both halves: the date and time arithmetic below, and
 * the signed-link minting that reaches `lib/tokens.ts` and therefore `node:crypto` and
 * `TOKEN_SIGNING_SECRET`. That made the whole module untouchable from the browser, and both
 * availability grids carry a comment saying so — they pass the hour lists down as props rather
 * than import a single constant. Splitting the halves is what lets `lib/tokens.ts` take
 * `import "server-only"` without dragging a fortnight's worth of date maths behind the same wall.
 *
 * `lib/availability-links.ts` re-exports everything here, exactly as `lib/billing/subscription.ts`
 * re-exports `lib/billing/access.ts`, so no existing import had to change.
 *
 * ---------------------------------------------------------------------------
 * THE ONE DATE RULE
 * ---------------------------------------------------------------------------
 * `availability.on_date` is a naive `date`: it means "Tuesday the 15th in Athens", not an instant.
 * `new Date("2026-09-11")` parses as UTC midnight and prints as the previous day for anyone west
 * of Greenwich, so a bare date string is never handed to the `Date` constructor. Everything below
 * is built from explicit numeric parts and read back as UTC.
 */

export const ATHENS_TZ = "Europe/Athens";

/** The window the promoter sets. Two weeks is what a promoter can actually hold in their head. */
export const GRID_DAYS = 14;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Today, as the agency's wall clock sees it. Taking `new Date().toISOString()` would hand a
 * promoter tapping at 01:30 Athens time (22:30 UTC the day before) a grid starting yesterday.
 */
export function athensToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ATHENS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-");
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

/**
 * Whole-day arithmetic over UTC midnights. Athens' DST transitions never land on a UTC midnight,
 * so adding 86 400 000 ms always lands on the next calendar day — which is the trap CLAUDE.md
 * warns about, avoided by never parsing the string as a local instant.
 */
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-");
  const start = Date.UTC(Number(y), Number(m) - 1, Number(d));
  const next = new Date(start + days * 86_400_000);
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

/** The dates the page renders, and the only dates a save is allowed to touch. */
export function gridDates(startIso: string, days: number = GRID_DAYS): string[] {
  return Array.from({ length: days }, (_, i) => addDaysIso(startIso, i));
}

/** Safe to format: built from explicit numeric parts, read back as UTC. */
export function isoAsUtcDate(iso: string): Date {
  const [y, m, d] = iso.split("-");
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
}

// ---------------------------------------------------------------------------
// Times
// ---------------------------------------------------------------------------

/** Hourly is the granularity promoters actually speak in ("after five"). */
export const START_TIMES: readonly string[] = Array.from({ length: 17 }, (_, i) => `${pad(i + 6)}:00`);
export const END_TIMES: readonly string[] = Array.from({ length: 16 }, (_, i) => `${pad(i + 8)}:00`);

export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** `time` columns come back as "HH:MM:SS"; the UI speaks "HH:MM". */
export function toDisplayTime(value: string | null): string | null {
  return value === null ? null : value.slice(0, 5);
}

export function toDbTime(value: string): string {
  return `${value}:00`;
}

// ---------------------------------------------------------------------------
// A day's state
// ---------------------------------------------------------------------------

export type DayChoice = "available" | "unavailable" | "partial" | "clear";
export type AvailabilitySource = "self" | "coordinator" | "inferred";

export type AvailabilityRow = {
  status: "available" | "unavailable";
  from_time: string | null;
  to_time: string | null;
  source: AvailabilitySource;
};

/** What one row of the grid shows. Nothing here is agency data. */
export type DayState = {
  choice: Exclude<DayChoice, "clear"> | "clear";
  fromTime: string | null;
  toTime: string | null;
  source: AvailabilitySource | null;
  /** More than one row on this date — a contradiction we inherited, never one we can create. */
  contradictory: boolean;
};

export const EMPTY_DAY: DayState = {
  choice: "clear",
  fromTime: null,
  toTime: null,
  source: null,
  contradictory: false,
};

/**
 * Collapse whatever rows exist for one date into the single state the promoter sees.
 *
 * The unique key is `(promoter_id, on_date, from_time)`, so the table CAN hold a whole-day
 * `available` row and a partial `unavailable` row on the same date — `0005_matching_fixes.sql`
 * FIX 2 exists precisely because the matching engine has to resolve that. A promoter must never
 * be shown "you are both available and not available"; we show the whole-day row if there is one,
 * flag the date, and let the next save replace the lot.
 */
export function summariseDay(rows: readonly AvailabilityRow[]): DayState {
  if (rows.length === 0) return EMPTY_DAY;

  const wholeDay = rows.find((r) => r.from_time === null && r.to_time === null);
  const chosen = wholeDay ?? rows[0];
  if (!chosen) return EMPTY_DAY;

  const fromTime = toDisplayTime(chosen.from_time);
  const toTime = toDisplayTime(chosen.to_time);
  const isWholeDay = fromTime === null && toTime === null;

  return {
    choice: isWholeDay ? chosen.status : chosen.status === "available" ? "partial" : "unavailable",
    fromTime,
    toTime,
    source: chosen.source,
    contradictory: rows.length > 1,
  };
}

export type RowPlan =
  | { ok: true; row: null }
  | { ok: true; row: { status: "available" | "unavailable"; from_time: string | null; to_time: string | null } }
  | { ok: false; reason: "bad_choice" | "bad_time" | "bad_range" };

/**
 * One choice in, AT MOST ONE ROW out. This is the whole contradiction guarantee: the save action
 * deletes the date's rows and then writes this single row, so a date can never again hold two
 * statements about itself.
 *
 * A partial day is modelled as an `available` window rather than an `unavailable` one, because
 * that is the shape the matching filter reads: `from_time <= shift.start_time` and
 * `to_time >= shift.end_time` (`0007_match_radius.sql`). "Available after 17:00" with no end is
 * `from_time = 17:00, to_time = null`, and null already means "no bound on that side".
 */
export function planRow(choice: string, fromTime?: string | null, toTime?: string | null): RowPlan {
  switch (choice) {
    case "clear":
      return { ok: true, row: null };

    case "available":
      return { ok: true, row: { status: "available", from_time: null, to_time: null } };

    case "unavailable":
      return { ok: true, row: { status: "unavailable", from_time: null, to_time: null } };

    case "partial": {
      if (!fromTime || !isValidTime(fromTime)) return { ok: false, reason: "bad_time" };
      if (toTime !== null && toTime !== undefined && toTime !== "") {
        if (!isValidTime(toTime)) return { ok: false, reason: "bad_time" };
        if (toTime <= fromTime) return { ok: false, reason: "bad_range" };
        return {
          ok: true,
          row: { status: "available", from_time: toDbTime(fromTime), to_time: toDbTime(toTime) },
        };
      }
      return {
        ok: true,
        row: { status: "available", from_time: toDbTime(fromTime), to_time: null },
      };
    }

    default:
      return { ok: false, reason: "bad_choice" };
  }
}
