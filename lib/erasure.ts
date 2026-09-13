/**
 * P32 — subject access and erasure.
 *
 * The database half of the retention work. `lib/retention.ts` decides *who* and *what happens
 * to each table*; this file carries it out, and does nothing the plan there does not describe.
 *
 * Deliberately NOT marked `server-only`: the only caller today is
 * `scripts/retention-sweep.ts`, which runs under `tsx` in plain Node, and importing
 * `server-only` from a Node script throws. The safety here comes from the client being passed
 * in — this module never constructs a service-role client of its own and never reads
 * `process.env`, so nothing can reach it from a browser bundle with credentials attached.
 *
 * Every function takes the Supabase client as a parameter for the same reason:
 * a caller must consciously hand it a privileged connection.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  anonymisedPromoterPatch,
  DELETE_TABLES,
  RESIDUAL_FREE_TEXT_TABLES,
} from "@/lib/retention";

/** A service-role client. Erasure crosses tables that no single RLS role can reach. */
export type ErasureDb = SupabaseClient;

// -----------------------------------------------------------------------------------------------
// Subject access — everything we hold about one person
// -----------------------------------------------------------------------------------------------

export type SubjectAccessRecord = {
  promoter: Record<string, unknown>;
  areas: Record<string, unknown>[];
  skills: Record<string, unknown>[];
  availability: Record<string, unknown>[];
  clientHistory: Record<string, unknown>[];
  briefAcknowledgements: Record<string, unknown>[];
  blocklistEntries: Record<string, unknown>[];
  invitations: Record<string, unknown>[];
  /** When automatic messages were sent to them and whether they arrived (0017). */
  messageDispatches: Record<string, unknown>[];
  assignments: Record<string, unknown>[];
  checkIns: Record<string, unknown>[];
  fieldReports: Record<string, unknown>[];
  reportPhotos: Record<string, unknown>[];
  /** Written into the export so the promoter is told what we deliberately do not hold. */
  notHeld: readonly string[];
  generatedAt: string;
};

/**
 * What we tell a promoter we do NOT have, unprompted.
 *
 * This is not padding. "You have no record of where I was" is the single most reassuring true
 * statement we can make, and an access request is the moment it matters most.
 */
export const NOT_HELD: readonly string[] = [
  "No location trail. Position is read once, at the instant you tap check in, converted to a distance in metres from the store, and discarded. `check_ins` has no latitude or longitude columns at all — see supabase/migrations/0001_init.sql.",
  "No background or continuous location of any kind, working or not.",
  "No message content. Invitations are links; we do not read or store WhatsApp, Viber, Telegram or SMS conversations.",
  "No identity documents, bank details, tax number or payroll record — payroll is not part of this system.",
  "No data shared with any other agency. Rosters do not cross tenant boundaries, ever.",
];

async function rows(
  db: ErasureDb,
  table: string,
  column: string,
  value: string | string[],
): Promise<Record<string, unknown>[]> {
  const query = Array.isArray(value)
    ? db.from(table).select("*").in(column, value)
    : db.from(table).select("*").eq(column, value);
  const { data, error } = await query;
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as Record<string, unknown>[];
}

/**
 * Assemble everything held about one promoter, for a subject access request.
 *
 * Raw rows rather than a prettified view, on purpose: an access request is answered with what
 * is actually stored, not with a summary of it. Turning this into something a person can read
 * is the coordinator's job today (see docs/gdpr.md); there is no UI for it in this parcel.
 */
export async function collectSubjectAccess(
  db: ErasureDb,
  promoterId: string,
): Promise<SubjectAccessRecord> {
  const { data: promoter, error } = await db
    .from("promoters")
    .select("*")
    .eq("id", promoterId)
    .maybeSingle();

  if (error) throw new Error(`promoters: ${error.message}`);
  if (!promoter) throw new Error(`No promoter with id ${promoterId}`);

  const assignments = await rows(db, "assignments", "promoter_id", promoterId);
  const assignmentIds = assignments
    .map((a) => a["id"])
    .filter((id): id is string => typeof id === "string");

  const [
    areas,
    skills,
    availability,
    clientHistory,
    briefAcknowledgements,
    blocklistEntries,
    invitations,
    messageDispatches,
  ] = await Promise.all([
    rows(db, "promoter_areas", "promoter_id", promoterId),
    rows(db, "promoter_skills", "promoter_id", promoterId),
    rows(db, "availability", "promoter_id", promoterId),
    rows(db, "promoter_client_history", "promoter_id", promoterId),
    rows(db, "brief_ack", "promoter_id", promoterId),
    rows(db, "blocklist", "promoter_id", promoterId),
    rows(db, "invitations", "promoter_id", promoterId),
    rows(db, "message_dispatches", "promoter_id", promoterId),
  ]);

  const checkIns = assignmentIds.length
    ? await rows(db, "check_ins", "assignment_id", assignmentIds)
    : [];
  const fieldReports = assignmentIds.length
    ? await rows(db, "field_reports", "assignment_id", assignmentIds)
    : [];
  const reportIds = fieldReports
    .map((r) => r["id"])
    .filter((id): id is string => typeof id === "string");
  const reportPhotos = reportIds.length
    ? await rows(db, "report_photos", "field_report_id", reportIds)
    : [];

  return {
    promoter: promoter as Record<string, unknown>,
    areas,
    skills,
    availability,
    clientHistory,
    briefAcknowledgements,
    blocklistEntries,
    invitations,
    messageDispatches,
    assignments,
    checkIns,
    fieldReports,
    reportPhotos,
    notHeld: NOT_HELD,
    generatedAt: new Date().toISOString(),
  };
}

// -----------------------------------------------------------------------------------------------
// Erasure
// -----------------------------------------------------------------------------------------------

export type ErasureReason = "retention_sweep" | "subject_request" | "manual";

export type ErasureOutcome = {
  promoterId: string;
  agencyId: string;
  /** True when the row was already a tombstone and nothing was done. */
  alreadyErased: boolean;
  /** Rows removed per table. In a dry run, rows that WOULD be removed. */
  deletedCounts: Record<string, number>;
  /** Rows scrubbed in place per table. In a dry run, rows that WOULD be scrubbed. */
  anonymisedCounts: Record<string, number>;
  /**
   * Free text and files that survive and need a human to read them. Never zero-risk, never
   * auto-deleted — see the `field_reports` entry in ERASURE_PLAN.
   */
  residual: { table: string; count: number }[];
  dryRun: boolean;
};

async function countRows(
  db: ErasureDb,
  table: string,
  column: string,
  value: string | string[],
): Promise<number> {
  const base = db.from(table).select("*", { count: "exact", head: true });
  const query = Array.isArray(value) ? base.in(column, value) : base.eq(column, value);
  const { count, error } = await query;
  if (error) throw new Error(`${table} count: ${error.message}`);
  return count ?? 0;
}

/**
 * Erase one promoter.
 *
 * Ordering is chosen so that a crash halfway through is recoverable: the personal rows go
 * first and the `promoters` row is scrubbed LAST. If the process dies in the middle, the row
 * still carries its name and its retention date, so the next sweep picks it up and finishes
 * the job. Scrubbing first would leave orphaned personal data behind a row that now looks
 * done — the one failure mode that would silently defeat the whole mechanism.
 *
 * Safe to call twice: the second call sees `anonymised_at` and returns `alreadyErased`.
 */
export async function erasePromoter(
  db: ErasureDb,
  promoterId: string,
  options: { reason: ErasureReason; dryRun: boolean; actorUserId?: string | null },
): Promise<ErasureOutcome> {
  const { data: promoter, error } = await db
    .from("promoters")
    .select("id, agency_id, anonymised_at")
    .eq("id", promoterId)
    .maybeSingle();

  if (error) throw new Error(`promoters: ${error.message}`);
  if (!promoter) throw new Error(`No promoter with id ${promoterId}`);

  const agencyId = String((promoter as Record<string, unknown>)["agency_id"]);

  if ((promoter as Record<string, unknown>)["anonymised_at"] != null) {
    return {
      promoterId,
      agencyId,
      alreadyErased: true,
      deletedCounts: {},
      anonymisedCounts: {},
      residual: [],
      dryRun: options.dryRun,
    };
  }

  const assignments = await rows(db, "assignments", "promoter_id", promoterId);
  const assignmentIds = assignments
    .map((a) => a["id"])
    .filter((id): id is string => typeof id === "string");

  const deletedCounts: Record<string, number> = {};
  const anonymisedCounts: Record<string, number> = {};

  // ---- 1. Tables that go entirely. ----------------------------------------------------------
  for (const table of DELETE_TABLES) {
    if (options.dryRun) {
      deletedCounts[table] = await countRows(db, table, "promoter_id", promoterId);
      continue;
    }
    const { data, error: delError } = await db
      .from(table)
      .delete()
      .eq("promoter_id", promoterId)
      .select("promoter_id");
    if (delError) throw new Error(`delete ${table}: ${delError.message}`);
    deletedCounts[table] = (data ?? []).length;
  }

  // ---- 2. Business records that stay, with their free text cleared. --------------------------
  anonymisedCounts["assignments"] = assignments.length;
  if (!options.dryRun && assignments.length > 0) {
    const { error: aError } = await db
      .from("assignments")
      .update({ cancel_reason: null })
      .eq("promoter_id", promoterId);
    if (aError) throw new Error(`assignments: ${aError.message}`);
  }

  const checkInCount = assignmentIds.length
    ? await countRows(db, "check_ins", "assignment_id", assignmentIds)
    : 0;
  anonymisedCounts["check_ins"] = checkInCount;
  if (!options.dryRun && assignmentIds.length > 0) {
    const { error: cError } = await db
      .from("check_ins")
      .update({ override_reason: null })
      .in("assignment_id", assignmentIds);
    if (cError) throw new Error(`check_ins: ${cError.message}`);
  }

  // ---- 3. What survives and needs a human. --------------------------------------------------
  const residual: { table: string; count: number }[] = [];
  const fieldReports = assignmentIds.length
    ? await rows(db, "field_reports", "assignment_id", assignmentIds)
    : [];
  const reportIds = fieldReports
    .map((r) => r["id"])
    .filter((id): id is string => typeof id === "string");
  const withFreeText = fieldReports.filter(
    (r) => r["notes"] != null || r["stock_issues"] != null || r["store_manager_name"] != null,
  ).length;
  const photoCount = reportIds.length
    ? await countRows(db, "report_photos", "field_report_id", reportIds)
    : 0;

  for (const table of RESIDUAL_FREE_TEXT_TABLES) {
    residual.push({ table, count: table === "field_reports" ? withFreeText : photoCount });
  }

  // ---- 4. The promoter row itself, last. ----------------------------------------------------
  anonymisedCounts["promoters"] = 1;
  if (!options.dryRun) {
    const { error: pError } = await db
      .from("promoters")
      .update(anonymisedPromoterPatch(promoterId, new Date()))
      .eq("id", promoterId)
      // Belt and braces: if a concurrent run got here first, do nothing rather than scrub twice.
      .is("anonymised_at", null);
    if (pError) throw new Error(`promoters: ${pError.message}`);

    // ---- 5. The receipt. --------------------------------------------------------------------
    const { error: logError } = await db.from("promoter_erasures").upsert(
      {
        agency_id: agencyId,
        promoter_id: promoterId,
        reason: options.reason,
        actor_user_id: options.actorUserId ?? null,
        deleted_counts: { ...deletedCounts, ...anonymisedCounts },
        residual_notes: residual.some((r) => r.count > 0)
          ? `Manual review needed: ${residual
              .filter((r) => r.count > 0)
              .map((r) => `${r.table}=${r.count}`)
              .join(", ")}`
          : null,
      },
      { onConflict: "promoter_id" },
    );
    if (logError) throw new Error(`promoter_erasures: ${logError.message}`);
  }

  return {
    promoterId,
    agencyId,
    alreadyErased: false,
    deletedCounts,
    anonymisedCounts,
    residual,
    dryRun: options.dryRun,
  };
}
