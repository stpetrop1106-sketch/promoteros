/**
 * State shapes and labels shared between the promoter's grid (a client component) and the server
 * action that saves a day.
 *
 * They live here and NOT in `actions.ts` on purpose — CLAUDE.md, "the server/client boundary": a
 * `"use server"` module may export only async functions, so a type or a constant exported from
 * `actions.ts` is either a build error or, worse, silently `undefined` in the browser.
 *
 * Nothing here imports `lib/availability-links.ts` either. That module reaches `lib/tokens.ts` and
 * therefore `node:crypto`; a client component importing it for so much as the list of hours would
 * drag the signing key's module into the browser bundle. The hours arrive as props instead.
 */

/** Why a save failed. Each one gets its own sentence — never "something went wrong". */
export type SaveFailure =
  | "bad_token"
  | "expired"
  | "inactive"
  | "not_found"
  | "bad_date"
  | "bad_time"
  | "bad_range"
  | "bad_choice"
  | "save_failed";

export type SaveDayState =
  | { status: "idle" }
  | { status: "saved"; date: string }
  | { status: "error"; date: string; reason: SaveFailure };

export const SAVE_DAY_IDLE: SaveDayState = { status: "idle" };

export type DayChoiceValue = "available" | "unavailable" | "partial" | "clear";

/** One row of the fortnight, already formatted by the server. Nothing agency-shaped in here. */
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
  /** `self` means the promoter said it. Anything else was entered for them. */
  source: "self" | "coordinator" | "inferred" | null;
  contradictory: boolean;
  /**
   * A3-10 — this date already carries a pending invitation, or a confirmed shift. A date-only
   * flag: `app/a/[token]/data.ts` explains why nothing about the campaign, client or store may
   * cross onto this page.
   */
  hasPendingInvitation: boolean;
  hasBookedShift: boolean;
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
  byCoordinator: string;
  contradiction: string;
  /** A3-10. */
  invitationPending: string;
  shiftBooked: string;
  errors: Record<SaveFailure, string>;
};
