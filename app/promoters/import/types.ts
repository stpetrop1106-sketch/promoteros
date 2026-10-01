import type { ParsedPromoterRow, PromoterRowReason } from "@/lib/promoters/import";

/**
 * S1 — shapes shared by the promoter import wizard (browser) and its commit action (server).
 *
 * Types only, and deliberately NOT `"use server"`: CLAUDE.md's boundary rule. `actions.ts` may
 * export nothing but async functions, so everything a client component needs to *name* lives here,
 * and every `*_IDLE` constant with it. The same split as `app/shifts/import/types.ts`.
 */

export type ImportAreaOption = { id: string; name: string };

export type PromoterImportContext = {
  /** Europe/Athens "YYYY-MM-DD", from the server's clock, so a birth year is bounded consistently. */
  today: string;
  /** The agency cannot write (billing). The wizard still reads the file; the commit is refused. */
  readOnly: boolean;
  /** The agency's own areas, for matching the "Περιοχή" column. Never another agency's. */
  areas: ImportAreaOption[];
  /**
   * How many more promoters this plan allows. `null` means the limit could not be read, in which
   * case the commit does not pretend to know — it simply lets the existing per-write gate decide.
   */
  remainingCapacity: number | null;
  promoterLimit: number | null;
};

export type PromoterImportContextResult = { ok: true; context: PromoterImportContext } | { ok: false };

/**
 * The rows the wizard sends. `issues` is left out on purpose: the server recomputes it with
 * `validatePromoterRow`, so sending it would be sending something that is about to be thrown away —
 * and trusting it would be trusting the browser about which rows are valid.
 */
export type CommitPromoterRow = Omit<ParsedPromoterRow, "issues">;

export type PromoterCommitInput = {
  filename: string;
  rows: CommitPromoterRow[];
};

export type PromoterCommitErrorCode =
  | "read_only"
  | "invalid_payload"
  | "too_many_rows"
  | "nothing_to_import"
  | "over_promoter_limit"
  | "load_failed";

export type PromoterCommitOutcome = {
  created: number;
  /** Rows that should have become promoters but did not, because the write failed. */
  notCreated: number;
  /** Already on the roster. Skipped, never updated. */
  duplicates: number;
  /** Broken rows, left out. */
  errors: number;
  /** Left out because the plan's promoter limit was reached partway through. */
  overLimit: number;
  /** Rows left out on purpose, by reason. A row with several reasons counts once, under its first. */
  leftOut: { reason: PromoterRowReason; count: number }[];
};

export type PromoterCommitResult =
  | { status: "idle" }
  | { status: "error"; error: PromoterCommitErrorCode; details?: string[] }
  | { status: "done"; outcome: PromoterCommitOutcome };

export const PROMOTER_COMMIT_IDLE: PromoterCommitResult = { status: "idle" };
