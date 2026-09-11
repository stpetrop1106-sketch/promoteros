/**
 * P32 — retention selection logic.
 *
 * PURE ON PURPOSE. Nothing here touches Supabase, the network, the clock or `process.env`;
 * `today` is always a parameter. A bug in this file deletes real people's records, so it has
 * to be assertable without a database — see `tests/retention.test.ts`.
 *
 * The database side lives in `lib/erasure.ts`, the runnable side in
 * `scripts/retention-sweep.ts`. This file only decides *who is in scope* and *what happens to
 * each table*; it never performs an action.
 */

// -----------------------------------------------------------------------------------------------
// The erasure plan — the actual deliverable of this parcel
// -----------------------------------------------------------------------------------------------

/**
 * What happens to a table when a promoter is erased.
 *
 * - `delete` — the rows are about the person and only about the person. They go.
 * - `anonymise` — the row is the agency's business record. It stays, with every field that
 *   points at a human scrubbed.
 * - `keep` — the row carries no identifier of the erased person at all, so there is nothing
 *   to do. Listed anyway, because "we thought about this table and decided nothing" is a
 *   different statement from "we forgot this table exists".
 */
export type ErasureAction = "delete" | "anonymise" | "keep";

export type ErasureRule = {
  table: string;
  action: ErasureAction;
  /** How rows of this table are found from a promoter id. */
  reachedBy: string;
  /** Why this action and not the other one. This is the part a lawyer reads. */
  why: string;
  /** Set for `anonymise`: the columns that get scrubbed and what they become. */
  scrubs?: readonly string[];
};

/**
 * Every table that can hold something about a promoter, and what we do with it.
 *
 * The governing decision: **a completed shift is the agency's business record, a promoter's
 * profile is the promoter's personal data.** Erasure removes the second and preserves the
 * first, which is only possible because `check_ins` and `field_reports` hang off
 * `assignment_id` rather than `promoter_id` — once the promoter row is a scrubbed tombstone,
 * "shift 47 was covered and 312 samples went out" identifies nobody.
 *
 * The alternative — deleting the `promoters` row outright — was rejected. `assignments`,
 * `invitations`, `availability`, `brief_ack`, `promoter_skills`, `promoter_areas`,
 * `promoter_client_history` and `blocklist` all reference `promoters(id)` with
 * `on delete cascade`, and `check_ins` / `field_reports` / `report_photos` cascade from
 * `assignments`. One `delete from promoters` therefore takes the entire operational history of
 * every shift that person ever worked with it, including the client-facing numbers the agency
 * has already invoiced against. That is not erasure, it is data loss with a compliance excuse.
 */
export const ERASURE_PLAN: readonly ErasureRule[] = [
  {
    table: "promoters",
    action: "anonymise",
    reachedBy: "id",
    why: "The row cannot be deleted without cascading away the agency's shift history (see above). Every identifying column is scrubbed instead, leaving an opaque id that references nothing about a human. `full_name` and `phone` are `not null` with `unique (agency_id, phone)`, so they get non-personal deterministic placeholders rather than nulls.",
    scrubs: [
      "full_name -> '[erased]'",
      "phone -> 'erased:<id>' (satisfies not-null and the unique constraint, identifies nobody)",
      "email -> null",
      "birth_year -> null",
      "gender -> null",
      "home_lat -> null",
      "home_lng -> null",
      "home_area_id -> null",
      "transport_notes -> null",
      "status -> 'archived'",
      "anonymised_at -> now()",
    ],
  },
  {
    table: "availability",
    action: "delete",
    reachedBy: "promoter_id",
    why: "A calendar of when a named person was free to work. Pure personal data, no business value once they are gone, and arguably the most intrusive thing we hold about them.",
  },
  {
    table: "promoter_areas",
    action: "delete",
    reachedBy: "promoter_id",
    why: "Where they are willing to travel. A profile attribute, not a record of work done.",
  },
  {
    table: "promoter_skills",
    action: "delete",
    reachedBy: "promoter_id",
    why: "A profile attribute. Only ever read by the matching engine, which must not rank a person who has been erased.",
  },
  {
    table: "promoter_client_history",
    action: "delete",
    reachedBy: "promoter_id",
    why: "Per-person, per-client aggregates (`shifts_completed`, `avg_rating`) exist to feed `brand_experience` in the score. They are a judgement about an individual and small enough to be re-identifying against a client's own records. The shift-level truth survives in `assignments`.",
  },
  {
    table: "brief_ack",
    action: "delete",
    reachedBy: "promoter_id",
    why: "Proof that a named person read a brief, with a quiz score. It is about the person's conduct, not the campaign's outcome.",
  },
  {
    table: "blocklist",
    action: "delete",
    reachedBy: "promoter_id",
    why: "A negative judgement about an individual, and the single record we would least want to keep about someone who asked to be erased. It also stops functioning the moment their profile is gone — a returning promoter would be a new row with a new id anyway.",
  },
  {
    table: "invitations",
    action: "delete",
    reachedBy: "promoter_id",
    why: "An invitation is an offer, not a booking. It carries `token_hash` (a live credential for a page that shows the promoter's shift), `match_breakdown` (why we ranked this specific person where we did) and `decline_reason` (their words). None of that is the agency's record of work performed; the coverage outcome lives in `assignments`.",
  },
  {
    table: "assignments",
    action: "anonymise",
    reachedBy: "promoter_id",
    why: "THIS is the business record. That a shift was staffed and completed is what the agency invoiced the client for. The row stays, still pointing at the tombstone; only `cancel_reason` is cleared, because it is coordinator free text about a person ('kept cancelling last minute') with no operational value once that person is gone.",
    scrubs: ["cancel_reason -> null"],
  },
  {
    table: "check_ins",
    action: "anonymise",
    reachedBy: "assignments.id (no promoter_id column)",
    why: "Proof that the shift was actually attended — the agency's evidence of delivery. There is no coordinate here to erase, by design (CLAUDE.md §3, D4): we never stored one. `override_reason` is cleared because it is free text that routinely names the person or their circumstances.",
    scrubs: ["override_reason -> null"],
  },
  {
    table: "field_reports",
    action: "keep",
    reachedBy: "assignments.id (no promoter_id column)",
    why: "The client deliverable: units promoted, sales, interactions, stock issues. Attached to an assignment, not a person, and already invoiced. NOTE the honest caveat — `notes`, `stock_issues` and `store_manager_name` are free text that a human wrote and can incidentally name the promoter or a third party. We do not blind-wipe them, because they are the substance of a report the agency has delivered; instead the erasure surfaces them for manual review. See `residualFreeTextTables` and docs/gdpr.md.",
  },
  {
    table: "report_photos",
    action: "keep",
    reachedBy: "field_reports.id",
    why: "Photographs of a shelf or a display stand, held as evidence for the client report. Same caveat as `field_reports`: a photo can incidentally contain a person, which no automated rule can detect. Flagged for review, not deleted.",
  },
  {
    table: "replacement_runs",
    action: "keep",
    reachedBy: "candidate_ids uuid[] may contain the promoter id",
    why: "A transient ranked shortlist for one shift. The ids in `candidate_ids` are unresolvable once the promoter row is a tombstone, so nothing identifying survives. Rewriting the array would corrupt `current_position`, which indexes into it.",
  },
] as const;

/** Tables whose surviving free text a human has to read after an erasure. */
export const RESIDUAL_FREE_TEXT_TABLES = ["field_reports", "report_photos"] as const;

/** The placeholder written into the not-null `full_name` column of a tombstone. */
export const ERASED_NAME = "[erased]";

/** The tables the sweep deletes from, in the order it deletes from them. */
export const DELETE_TABLES = ERASURE_PLAN.filter((r) => r.action === "delete").map(
  (r) => r.table,
);

/**
 * The exact column patch that turns a promoter row into a tombstone.
 *
 * Deterministic and derived only from the id, so re-running it on an already-erased row is a
 * no-op rather than a second, different scrub.
 */
export function anonymisedPromoterPatch(promoterId: string, now: Date) {
  return {
    full_name: ERASED_NAME,
    // Not-null and unique (agency_id, phone). Derived from the id so it collides with nothing
    // and reveals nothing.
    phone: `erased:${promoterId}`,
    email: null,
    birth_year: null,
    gender: null,
    home_lat: null,
    home_lng: null,
    home_area_id: null,
    transport_notes: null,
    status: "archived" as const,
    anonymised_at: now.toISOString(),
  };
}

// -----------------------------------------------------------------------------------------------
// Selection — who is in scope for the sweep
// -----------------------------------------------------------------------------------------------

/** The minimum a candidate row must carry for the sweep to reason about it. */
export type RetentionCandidate = {
  id: string;
  agencyId: string;
  /** `promoters.retention_until`, a plain `YYYY-MM-DD` date. Null means "no date set". */
  retentionUntil: string | null;
  /** `promoters.anonymised_at`. Non-null means this row is already a tombstone. */
  anonymisedAt: string | null;
  /**
   * The most recent day this person did anything: last assignment, last availability entry,
   * or failing both, the day they were added. `YYYY-MM-DD`.
   */
  lastActivityOn: string;
};

export type SkipReason =
  | "already_anonymised"
  | "no_retention_date"
  | "not_yet_due";

export type RetentionDecision =
  | { promoterId: string; agencyId: string; inScope: true; dueOn: string }
  | { promoterId: string; agencyId: string; inScope: false; reason: SkipReason };

/**
 * A promoter the sweep will NOT touch, but whose retention date is missing while the agency's
 * declared policy says one is overdue. Reported so the gap is visible; never acted on.
 *
 * Inferring a date here would mean deleting someone because of a policy nobody explicitly
 * applied to them, which is exactly the failure mode this whole parcel exists to avoid.
 */
export type PolicyGap = {
  promoterId: string;
  agencyId: string;
  lastActivityOn: string;
  /** The date `retention_until` would hold if the agency's declared window were applied. */
  wouldHaveBeenDueOn: string;
};

/** `YYYY-MM-DD` for a date, in UTC. Dates in this schema are plain dates, not instants. */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** True for a well-formed `YYYY-MM-DD` that is also a real calendar date. */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && isoDate(parsed) === value;
}

/**
 * The date a promoter's identifying record falls due, given the agency's declared window.
 *
 * Month arithmetic clamps rather than rolling over: 31 January + 1 month is 28/29 February,
 * not 2/3 March. Rolling over would be a silent day of extra retention, which is the wrong
 * direction to be sloppy in.
 */
export function retentionUntilFor(lastActivityOn: string, months: number): string {
  if (!isValidIsoDate(lastActivityOn)) {
    throw new Error(`retentionUntilFor: not an ISO date: ${lastActivityOn}`);
  }
  if (!Number.isInteger(months) || months < 1) {
    throw new Error(`retentionUntilFor: months must be a positive integer, got ${months}`);
  }

  const base = new Date(`${lastActivityOn}T00:00:00.000Z`);
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth();
  const day = base.getUTCDate();

  const targetMonthIndex = month + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;

  // Day 0 of the following month is the last day of the target month.
  const lastDayOfTarget = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return isoDate(new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDayOfTarget))));
}

/**
 * Decide, for one promoter, whether the sweep erases them today.
 *
 * Three conditions, all required, all narrow:
 *   1. not already a tombstone (so the sweep is idempotent)
 *   2. `retention_until` is explicitly set (never inferred)
 *   3. `retention_until` is strictly in the past
 *
 * A promoter is due on the day AFTER their retention date, not on it. Boundary chosen
 * deliberately: `retention_until` reads as "kept until this date", so the whole of that day is
 * still inside the window. Erasing a day early is unrecoverable; erasing a day late is not.
 */
export function decide(candidate: RetentionCandidate, today: string): RetentionDecision {
  const base = { promoterId: candidate.id, agencyId: candidate.agencyId };

  if (candidate.anonymisedAt !== null) {
    return { ...base, inScope: false, reason: "already_anonymised" };
  }
  if (candidate.retentionUntil === null) {
    return { ...base, inScope: false, reason: "no_retention_date" };
  }
  if (!isValidIsoDate(candidate.retentionUntil)) {
    // A malformed date is not a licence to guess. Treat it as "no date" and leave the row alone.
    return { ...base, inScope: false, reason: "no_retention_date" };
  }
  if (candidate.retentionUntil >= today) {
    return { ...base, inScope: false, reason: "not_yet_due" };
  }
  return { ...base, inScope: true, dueOn: candidate.retentionUntil };
}

export type SweepPlan = {
  /** Promoters the sweep would erase. */
  due: RetentionDecision[];
  /** Everyone else, with the reason they were spared. */
  skipped: RetentionDecision[];
  /** Rows with no retention date whose activity is already past the agency's declared window. */
  policyGaps: PolicyGap[];
  /** Agencies with no `promoter_retention_months` set at all. */
  agenciesWithoutPolicy: string[];
};

/**
 * Build the whole plan for a sweep run.
 *
 * `retentionMonthsByAgency` maps `agency_id` to that agency's declared window. A missing or
 * null entry means the agency has declared no policy: it produces a warning and never a
 * deletion.
 */
export function planSweep(
  candidates: readonly RetentionCandidate[],
  today: string,
  retentionMonthsByAgency: ReadonlyMap<string, number | null>,
): SweepPlan {
  if (!isValidIsoDate(today)) {
    throw new Error(`planSweep: not an ISO date: ${today}`);
  }

  const due: RetentionDecision[] = [];
  const skipped: RetentionDecision[] = [];
  const policyGaps: PolicyGap[] = [];
  const agenciesSeen = new Set<string>();
  const agenciesWithoutPolicy = new Set<string>();

  for (const candidate of candidates) {
    const decision = decide(candidate, today);
    if (decision.inScope) due.push(decision);
    else skipped.push(decision);

    agenciesSeen.add(candidate.agencyId);
    const months = retentionMonthsByAgency.get(candidate.agencyId) ?? null;
    if (months === null) {
      agenciesWithoutPolicy.add(candidate.agencyId);
      continue;
    }

    // Only meaningful for rows the sweep is NOT going to act on for want of a date.
    if (
      candidate.anonymisedAt === null &&
      candidate.retentionUntil === null &&
      isValidIsoDate(candidate.lastActivityOn)
    ) {
      const wouldHaveBeenDueOn = retentionUntilFor(candidate.lastActivityOn, months);
      if (wouldHaveBeenDueOn < today) {
        policyGaps.push({
          promoterId: candidate.id,
          agencyId: candidate.agencyId,
          lastActivityOn: candidate.lastActivityOn,
          wouldHaveBeenDueOn,
        });
      }
    }
  }

  for (const agencyId of agenciesSeen) {
    if (!retentionMonthsByAgency.has(agencyId)) agenciesWithoutPolicy.add(agencyId);
  }

  return { due, skipped, policyGaps, agenciesWithoutPolicy: [...agenciesWithoutPolicy] };
}

/** The most recent of a set of `YYYY-MM-DD` dates. Used to derive `lastActivityOn`. */
export function latestDate(...dates: readonly (string | null | undefined)[]): string | null {
  let best: string | null = null;
  for (const d of dates) {
    if (!d) continue;
    const day = d.slice(0, 10);
    if (!isValidIsoDate(day)) continue;
    if (best === null || day > best) best = day;
  }
  return best;
}
