import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  GRID_DAYS,
  athensToday,
  gridDates,
  isValidIsoDate,
  planRow,
  summariseDay,
  verifyAvailabilityToken,
  type AvailabilityRow,
  type DayState,
} from "@/lib/availability-links";
import type { SaveFailure } from "./state";

/**
 * The data layer for `/a/[token]`, the promoter's own availability page.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS FILE IS ALLOWED TO SEE
 * ---------------------------------------------------------------------------
 * The link is long-lived and anonymous, so the blast radius of a forwarded URL is exactly the
 * set of columns named below and nothing else. Deliberately:
 *
 *   promoters   → id, full_name, status, agency_id
 *                 `full_name` is rendered so the promoter knows the link is theirs.
 *                 `status` decides whether the link still works. `agency_id` is required by the
 *                 `availability` insert (every tenant-scoped row carries one) and is NEVER
 *                 returned to the page or the client bundle.
 *   availability → on_date, status, from_time, to_time, source — for THIS promoter only, and only
 *                 inside the fortnight the page renders.
 *
 * Never selected, and this is the point: phone, email, birth_year, home coordinates,
 * reliability_score, rate, assignments, invitations, campaigns, clients, stores, the agency's
 * name, or any row belonging to a different promoter. There is no join out of this file that
 * could reach one. A promoter cannot learn from this page that another promoter exists.
 *
 * The service-role client bypasses RLS, so the verified token is the whole boundary — same
 * contract as `lib/invitations.ts` and `lib/checkins.ts`, and the reason every query below is
 * pinned to `promoter.id` taken from the signed payload rather than from anything the caller sent.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Promoter = { id: string; agencyId: string; fullName: string };

type Resolved = { ok: true; promoter: Promoter } | { ok: false; reason: SaveFailure };

/**
 * Token → promoter, with the status gate.
 *
 * Archived and blocklisted are the closest thing we have to revocation: cooperation has ended, so
 * the link stops working the moment the coordinator records that, without waiting out the TTL.
 * `paused` still works — a paused promoter declaring next month's availability is exactly how
 * they come back.
 */
async function resolvePromoter(token: string): Promise<Resolved> {
  const verified = verifyAvailabilityToken(token);
  if (!verified.ok) {
    return { ok: false, reason: verified.reason === "expired" ? "expired" : "bad_token" };
  }
  // Guard before the query: a non-uuid record id would make Postgres raise 22P02 rather than
  // simply returning no rows.
  if (!UUID.test(verified.promoterId)) return { ok: false, reason: "bad_token" };

  const db = createAdminClient();
  const { data, error } = await db
    .from("promoters")
    .select("id, full_name, status, agency_id")
    .eq("id", verified.promoterId)
    .maybeSingle<{ id: string; full_name: string; status: string; agency_id: string }>();

  if (error) return { ok: false, reason: "save_failed" };
  if (!data) return { ok: false, reason: "not_found" };
  if (data.status === "archived" || data.status === "blocklisted") {
    return { ok: false, reason: "inactive" };
  }

  return {
    ok: true,
    promoter: { id: data.id, agencyId: data.agency_id, fullName: data.full_name },
  };
}

export type AvailabilityView = {
  promoterName: string;
  /** The fortnight, in order, starting with today in Athens. */
  days: { date: string; state: DayState }[];
};

export type LoadResult =
  | { ok: true; view: AvailabilityView }
  | { ok: false; reason: SaveFailure };

export async function loadAvailability(token: string): Promise<LoadResult> {
  const resolved = await resolvePromoter(token);
  if (!resolved.ok) return { ok: false, reason: resolved.reason };

  const dates = gridDates(athensToday(), GRID_DAYS);
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (!first || !last) return { ok: false, reason: "save_failed" };

  const db = createAdminClient();
  const { data, error } = await db
    .from("availability")
    .select("on_date, status, from_time, to_time, source")
    .eq("promoter_id", resolved.promoter.id)
    .gte("on_date", first)
    .lte("on_date", last);

  if (error) return { ok: false, reason: "save_failed" };

  const rows = (data ?? []) as unknown as (AvailabilityRow & { on_date: string })[];
  const byDate = new Map<string, AvailabilityRow[]>();
  for (const row of rows) {
    const bucket = byDate.get(row.on_date);
    if (bucket) bucket.push(row);
    else byDate.set(row.on_date, [row]);
  }

  return {
    ok: true,
    view: {
      promoterName: resolved.promoter.fullName,
      days: dates.map((date) => ({ date, state: summariseDay(byDate.get(date) ?? []) })),
    },
  };
}

export type SaveResult = { ok: true } | { ok: false; reason: SaveFailure };

/**
 * Set one day, replacing whatever was there.
 *
 * DELETE-THEN-INSERT, and never an upsert. The unique key is
 * `(promoter_id, on_date, from_time)`, so an upsert keyed on it would happily leave yesterday's
 * whole-day `available` row sitting next to today's new partial `unavailable` one — two
 * statements about the same date, which `0005_matching_fixes.sql` FIX 2 had to teach the matching
 * engine to survive. `planRow` returns at most one row, so after this runs the date holds either
 * exactly one row or none.
 *
 * supabase-js cannot wrap the two statements in a transaction and this parcel adds no migration,
 * so the failure is arranged to fall the safe way: if the insert fails after the delete, the date
 * is left CLEARED rather than contradictory, and the promoter is told the save failed. An
 * un-set day is a day the matching engine will not offer — conservative, and recoverable by
 * tapping again.
 */
export async function saveAvailabilityDay(
  token: string,
  date: string,
  choice: string,
  fromTime: string | null,
  toTime: string | null,
): Promise<SaveResult> {
  const resolved = await resolvePromoter(token);
  if (!resolved.ok) return { ok: false, reason: resolved.reason };

  // The date must be one the page actually offered. Without this, a valid token would let anyone
  // rewrite any date in the promoter's history.
  if (!isValidIsoDate(date)) return { ok: false, reason: "bad_date" };
  if (!gridDates(athensToday(), GRID_DAYS).includes(date)) {
    return { ok: false, reason: "bad_date" };
  }

  const plan = planRow(choice, fromTime, toTime);
  if (!plan.ok) return { ok: false, reason: plan.reason };

  const db = createAdminClient();

  const { error: deleteError } = await db
    .from("availability")
    .delete()
    .eq("promoter_id", resolved.promoter.id)
    .eq("on_date", date);
  if (deleteError) return { ok: false, reason: "save_failed" };

  if (plan.row === null) return { ok: true };

  const { error: insertError } = await db.from("availability").insert({
    agency_id: resolved.promoter.agencyId,
    promoter_id: resolved.promoter.id,
    on_date: date,
    status: plan.row.status,
    from_time: plan.row.from_time,
    to_time: plan.row.to_time,
    // The point of the parcel. `source` is how a coordinator can tell, months later, that the
    // promoter said this herself and nobody typed it for her.
    source: "self",
  });
  if (insertError) return { ok: false, reason: "save_failed" };

  return { ok: true };
}
