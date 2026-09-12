/**
 * P5 — state shapes and labels shared between the coordinator's grid (a client component) and
 * the server actions that save a day or run a bulk edit.
 *
 * Same reason as `app/a/[token]/state.ts` (CLAUDE.md, "the server/client boundary"): a
 * `"use server"` module may export only async functions, so a type or a constant exported from
 * `actions.ts` is either a build error or, worse, silently `undefined` in the browser. Nothing
 * here imports `lib/availability-links.ts` either — that module reaches `lib/tokens.ts` and
 * `node:crypto`, and a client component pulling that in would drag the signing key's module into
 * the browser bundle for no reason; the hours and dates arrive as props, formatted on the server.
 */

/** Why a save failed. Each one gets its own sentence — never "something went wrong". */
export type SaveFailure =
  | "not_found"
  | "bad_date"
  | "bad_time"
  | "bad_range"
  | "bad_choice"
  | "save_failed"
  | "blocked_read_only";

export type SaveDayState =
  | { status: "idle" }
  | { status: "saved"; date: string }
  | { status: "error"; date: string; reason: SaveFailure };

export const SAVE_DAY_IDLE: SaveDayState = { status: "idle" };

export type DayChoiceValue = "available" | "unavailable" | "partial" | "clear";

/** One row of the fortnight, already formatted by the server. */
export type GridDay = {
  /** "YYYY-MM-DD" — the naive Athens calendar date, exactly as `availability.on_date` stores it. */
  date: string;
  /** e.g. "Πέμ" */
  weekday: string;
  /** e.g. "11/09" */
  dayLabel: string;
  isToday: boolean;
  isWeekend: boolean;
  choice: DayChoiceValue;
  fromTime: string | null;
  toTime: string | null;
  /** The sentence under the date ("Available from 17:00"), already translated. */
  summary: string;
  /**
   * `self` means the promoter said it, `coordinator` means a coordinator typed it for her.
   * `null` means the day carries no row at all — genuinely undeclared, not "unavailable" — and
   * the matching engine treats it as unusable exactly like an explicit `unavailable` row, so the
   * UI must never let the two look the same.
   */
  source: "self" | "coordinator" | "inferred" | null;
  contradictory: boolean;
};

/** Every string the grid renders, resolved through `t()` on the server and passed down. */
export type GridLabels = {
  available: string;
  unavailable: string;
  partial: string;
  clear: string;
  from: string;
  to: string;
  endOfDay: string;
  apply: string;
  cancel: string;
  saving: string;
  saved: string;
  bySelf: string;
  byCoordinator: string;
  contradiction: string;
  undeclared: string;
  errors: Record<SaveFailure, string>;
};

export type BulkKind = "weekdays" | "weekend" | "clear_all";

export type BulkState =
  | { status: "idle" }
  | { status: "done"; kind: BulkKind }
  | { status: "error"; kind: BulkKind; reason: SaveFailure };

export const BULK_IDLE: BulkState = { status: "idle" };

/** Every string the bulk-entry toolbar renders. */
export type BulkLabels = {
  title: string;
  weekdays: string;
  weekend: string;
  clearAll: string;
  /** Armed state of the destructive clear — see the two-step confirm in availability-grid.tsx. */
  clearAllConfirm: string;
  clearAllCancel: string;
  clearAllWarning: string;
  clearAllWarningSelf: string;
  running: string;
  done: Record<BulkKind, string>;
  errors: Record<SaveFailure, string>;
};
