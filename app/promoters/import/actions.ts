"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkBillingFor, lookupEntitlement } from "@/lib/billing/subscription";
import { athensDate } from "@/lib/exceptions";
import { MAX_IMPORT_ROWS } from "@/lib/import/constants";
import { normalizePhone } from "@/lib/promoters/phone";
import {
  planPromoterImport,
  summarisePromoterImport,
  validatePromoterRow,
  type ExistingPromoter,
  type ParsedPromoterRow,
  type PlannedPromoterRow,
  type PromoterRowReason,
} from "@/lib/promoters/import";
import type {
  PromoterCommitInput,
  PromoterCommitOutcome,
  PromoterCommitResult,
  PromoterImportContextResult,
} from "./types";

/**
 * S1 — the promoter import's server actions.
 *
 * This module exports async functions ONLY (CLAUDE.md's boundary rule); every type the wizard needs
 * is in `./types`. Everything goes through the RLS-scoped client, so an id from another agency is
 * simply not found — there is no `agency_id` filter to forget on a read.
 *
 * Writes are the place a bulk importer breaks tenant isolation (CLAUDE.md §4), so `agency_id` is
 * taken from `requireUser()` on every inserted row and never from the payload. The payload carries
 * no agency at all, by design: there is nothing to spoof.
 */

/** Rows above this are refused outright — same ceiling the shift importer uses. */
const MAX_ROWS = MAX_IMPORT_ROWS;

/** Insert in batches so one 500-row file is not one enormous statement. */
const INSERT_BATCH = 100;

export async function loadPromoterImportContext(): Promise<PromoterImportContextResult> {
  const user = await requireUser();
  const db = await createServerSupabase();

  const [areas, entitlement] = await Promise.all([
    db.from("areas").select("id, name").order("name", { ascending: true }),
    lookupEntitlement(user.agencyId),
  ]);

  if (areas.error) return { ok: false };

  const gate = await checkBillingFor(user.agencyId, "write");

  return {
    ok: true,
    context: {
      today: athensDate(new Date()),
      readOnly: !gate.allowed,
      areas: (areas.data ?? []).map((a) => ({ id: a.id as string, name: a.name as string })),
      remainingCapacity: entitlement.ok
        ? Math.max(0, entitlement.entitlement.promoterLimit - entitlement.entitlement.promotersUsed)
        : null,
      promoterLimit: entitlement.ok ? entitlement.entitlement.promoterLimit : null,
    },
  };
}

/**
 * Every promoter already on the roster, as the identity rule sees them. Only `phone` is compared,
 * because `unique (agency_id, phone)` is what the database enforces and `createPromoter`'s
 * `findDuplicate` is what the manual form uses — the importer must not invent a second rule.
 *
 * `archived` promoters are included on purpose: their row still holds the phone, so re-importing
 * one would hit the unique constraint. Better to report "already exists" than to fail the batch.
 */
async function loadExistingPromoters(
  db: Awaited<ReturnType<typeof createServerSupabase>>,
): Promise<ExistingPromoter[] | null> {
  const rows: ExistingPromoter[] = [];
  const PAGE = 1000;

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("promoters")
      .select("id, full_name, phone")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) return null;
    const page = (data ?? []) as { id: string; full_name: string; phone: string }[];
    for (const p of page) rows.push({ id: p.id, fullName: p.full_name, phone: p.phone });
    if (page.length < PAGE) break;
  }

  return rows;
}

/** The wizard needs this to show duplicates before the coordinator commits to anything. */
export async function loadExistingPromoterPhones(): Promise<ExistingPromoter[] | null> {
  await requireUser();
  const db = await createServerSupabase();
  return loadExistingPromoters(db);
}

/**
 * Rebuilds a row from an untrusted payload. Every field is coerced to its own type here rather than
 * spread from the request: a client that sends `{ areaIds: "' or 1=1" }` must not reach the insert
 * with it, and `validatePromoterRow` alone would not catch a wrong *type*.
 */
function sanitiseRow(raw: unknown, index: number): ParsedPromoterRow | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const sourceRow = Number(r.sourceRow);
  const fullName = typeof r.fullName === "string" ? r.fullName.trim().slice(0, 120) : null;
  const phoneRaw = typeof r.phoneRaw === "string" ? r.phoneRaw.slice(0, 60) : null;
  // Re-normalised from the raw value the file held, never taken on trust from the client.
  const phone = phoneRaw ? normalizePhone(phoneRaw) : typeof r.phone === "string" ? normalizePhone(r.phone) : null;
  const birthYear = Number.isFinite(Number(r.birthYear)) && r.birthYear !== null ? Math.trunc(Number(r.birthYear)) : null;

  return {
    sourceRow: Number.isFinite(sourceRow) ? sourceRow : index + 1,
    fullName: fullName || null,
    phone: phone || null,
    phoneRaw,
    email: typeof r.email === "string" ? r.email.trim().slice(0, 200) || null : null,
    birthYear,
    areaNames: Array.isArray(r.areaNames) ? r.areaNames.filter((a): a is string => typeof a === "string").slice(0, 20) : [],
    areaIds: Array.isArray(r.areaIds) ? r.areaIds.filter((a): a is string => typeof a === "string").slice(0, 20) : [],
    hasCar: r.hasCar === true,
    hasLicence: r.hasLicence === true,
    notes: typeof r.notes === "string" ? r.notes.trim().slice(0, 500) || null : null,
    issues: [],
  };
}

/** A row may not graft another agency's area onto a promoter — the join table has no agency of its own. */
async function keepOwnedAreaIds(
  db: Awaited<ReturnType<typeof createServerSupabase>>,
  ids: readonly string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { data } = await db.from("areas").select("id").in("id", [...ids]);
  return new Set((data ?? []).map((r) => (r as { id: string }).id));
}

function tallyLeftOut(planned: readonly PlannedPromoterRow[]): { reason: PromoterRowReason; count: number }[] {
  const counts = new Map<PromoterRowReason, number>();
  for (const p of planned) {
    if (p.status === "ready" || p.status === "warning") continue;
    // A row with several reasons counts once, under its first — otherwise the totals in the summary
    // add up to more than the number of rows, which reads as a bug.
    const first = p.reasons[0];
    if (first) counts.set(first, (counts.get(first) ?? 0) + 1);
  }
  return [...counts].map(([reason, count]) => ({ reason, count }));
}

export async function commitPromoterImport(input: PromoterCommitInput): Promise<PromoterCommitResult> {
  const user = await requireUser();

  // Checked before anything is parsed: there is no reason to validate rows that are going to be
  // refused anyway, and it gives the coordinator the real reason immediately.
  const gate = await checkBillingFor(user.agencyId, "write");
  if (!gate.allowed) return { status: "error", error: "read_only" };

  if (typeof input !== "object" || input === null || !Array.isArray(input.rows)) {
    return { status: "error", error: "invalid_payload" };
  }
  if (input.rows.length > MAX_ROWS) return { status: "error", error: "too_many_rows" };

  const db = await createServerSupabase();
  const today = athensDate(new Date());

  const existing = await loadExistingPromoters(db);
  if (!existing) return { status: "error", error: "load_failed" };

  // Re-parse, re-validate, re-plan. The browser's conclusion is not consulted at any point.
  const rows = input.rows
    .map((raw, i) => sanitiseRow(raw, i))
    .filter((r): r is ParsedPromoterRow => r !== null)
    .map((r) => validatePromoterRow(r, { knownAreas: [], today }));

  // `validatePromoterRow` cannot see sibling rows, so within-file duplicates are re-derived here —
  // otherwise two identical rows in one file would race each other into the unique constraint.
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.phone) continue;
    if (seen.has(row.phone)) row.issues.push({ code: "duplicate_in_file", severity: "error", field: "phone" });
    else seen.add(row.phone);
  }

  const planned = planPromoterImport(rows, existing);
  const summary = summarisePromoterImport(planned);
  const toCreate = planned.filter((p) => p.status === "ready" || p.status === "warning");

  if (toCreate.length === 0) return { status: "error", error: "nothing_to_import" };

  // The plan's promoter limit. `createPromoter` refuses the ONE promoter that would cross it; a
  // bulk import has to decide what to do with the other 400, so it imports up to the limit and
  // reports exactly how many it could not take, rather than failing the whole file.
  const entitlement = await lookupEntitlement(user.agencyId);
  let capacity = Number.POSITIVE_INFINITY;
  if (entitlement.ok) {
    capacity = Math.max(0, entitlement.entitlement.promoterLimit - entitlement.entitlement.promotersUsed);
    if (capacity === 0) return { status: "error", error: "over_promoter_limit" };
  }

  const accepted = toCreate.slice(0, capacity === Number.POSITIVE_INFINITY ? toCreate.length : capacity);
  const overLimit = toCreate.length - accepted.length;

  const ownedAreas = await keepOwnedAreaIds(db, [...new Set(accepted.flatMap((p) => p.row.areaIds))]);

  let created = 0;
  let notCreated = 0;

  for (let i = 0; i < accepted.length; i += INSERT_BATCH) {
    const batch = accepted.slice(i, i + INSERT_BATCH);
    const { data, error } = await db
      .from("promoters")
      .insert(
        batch.map((p) => ({
          // CLAUDE.md §4 — from the session, never from the payload.
          agency_id: user.agencyId,
          full_name: p.row.fullName,
          phone: p.row.phone,
          email: p.row.email,
          birth_year: p.row.birthYear,
          has_car: p.row.hasCar,
          has_licence: p.row.hasLicence,
          transport_notes: p.row.notes,
          status: "active",
        })),
      )
      .select("id, phone");

    if (error || !data) {
      // A batch that fails as a whole (most likely a unique-violation race with another tab) is
      // retried one row at a time, so one bad row costs one promoter rather than ninety-nine.
      for (const p of batch) {
        const single = await db
          .from("promoters")
          .insert({
            agency_id: user.agencyId,
            full_name: p.row.fullName,
            phone: p.row.phone,
            email: p.row.email,
            birth_year: p.row.birthYear,
            has_car: p.row.hasCar,
            has_licence: p.row.hasLicence,
            transport_notes: p.row.notes,
            status: "active",
          })
          .select("id, phone")
          .maybeSingle();
        if (single.error || !single.data) {
          notCreated++;
          continue;
        }
        created++;
        await linkAreas(db, single.data.id as string, p.row.areaIds, ownedAreas);
      }
      continue;
    }

    created += data.length;
    const idByPhone = new Map((data as { id: string; phone: string }[]).map((r) => [r.phone, r.id]));
    for (const p of batch) {
      const id = p.row.phone ? idByPhone.get(p.row.phone) : undefined;
      if (id) await linkAreas(db, id, p.row.areaIds, ownedAreas);
    }
  }

  const outcome: PromoterCommitOutcome = {
    created,
    notCreated,
    duplicates: summary.duplicates,
    errors: summary.errors,
    overLimit,
    leftOut: tallyLeftOut(planned),
  };

  revalidatePath("/promoters");
  return { status: "done", outcome };
}

async function linkAreas(
  db: Awaited<ReturnType<typeof createServerSupabase>>,
  promoterId: string,
  areaIds: readonly string[],
  owned: ReadonlySet<string>,
): Promise<void> {
  const keep = areaIds.filter((id) => owned.has(id));
  if (keep.length === 0) return;
  await db.from("promoter_areas").insert(keep.map((area_id) => ({ promoter_id: promoterId, area_id })));
}
