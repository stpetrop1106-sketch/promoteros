import "server-only";
import { requireUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEntitlement, checkBilling } from "@/lib/billing/subscription";
import {
  GRID_DAYS,
  athensToday,
  gridDates,
  isValidIsoDate,
  isoAsUtcDate,
  planRow,
  summariseDay,
  type AvailabilityRow,
  type DayState,
} from "@/lib/availability-links";
import type { BulkKind, SaveFailure } from "./state";

/**
 * P5 — the data layer for the coordinator's side of a promoter's availability.
 *
 * Unlike `app/a/[token]/data.ts`, which is anonymous and therefore reads through the admin
 * client with a signed token as the whole boundary, every function here runs behind
 * `requireUser()` and reads/writes through the RLS-scoped client (`createServerSupabase`), never
 * the admin one — `own_agency` (0002_rls.sql) is what makes a promoter id belonging to another
 * agency come back as no row at all, so tenant isolation is enforced by the database rather than
 * a filter this file could forget to write (CLAUDE.md §4, house rules in docs/status/README.md's
 * companion brief).
 *
 * Dates and the single-row-per-date contract are unchanged from P30: `lib/availability-links.ts`
 * is reused as-is (`gridDates`, `athensToday`, `planRow`, `summariseDay`), so the fortnight, the
 * Europe/Athens day arithmetic and the shape of a "day" are identical whether the promoter sets
 * her own availability or the coordinator sets it for her.
 */

export type PromoterStatus = "active" | "paused" | "archived" | "blocklisted";

export type PromoterHeader = { id: string; fullName: string; status: PromoterStatus };

export type AvailabilityView = {
  promoter: PromoterHeader;
  /** The fortnight, in order, starting with today in Athens. */
  days: { date: string; state: DayState }[];
};

export type LoadResult =
  | { ok: true; view: AvailabilityView }
  | { ok: false; reason: "not_found" | "load_failed" };

/**
 * A promoter row plus her fortnight, scoped to the signed-in coordinator's own agency.
 *
 * `notFound()` is the caller's job (the page component), so this returns a plain reason rather
 * than calling `next/navigation` itself — keeping this module free of anything but data access.
 */
export async function loadCoordinatorAvailability(promoterId: string): Promise<LoadResult> {
  await requireUser();
  const db = await createServerSupabase();

  const { data: promoter, error: promoterError } = await db
    .from("promoters")
    .select("id, full_name, status")
    .eq("id", promoterId)
    .maybeSingle<{ id: string; full_name: string; status: PromoterStatus }>();

  if (promoterError) return { ok: false, reason: "load_failed" };
  if (!promoter) return { ok: false, reason: "not_found" };

  const dates = gridDates(athensToday(), GRID_DAYS);
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (!first || !last) return { ok: false, reason: "load_failed" };

  const { data, error } = await db
    .from("availability")
    .select("on_date, status, from_time, to_time, source")
    .eq("promoter_id", promoterId)
    .gte("on_date", first)
    .lte("on_date", last);

  if (error) return { ok: false, reason: "load_failed" };

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
      promoter: { id: promoter.id, fullName: promoter.full_name, status: promoter.status },
      days: dates.map((date) => ({ date, state: summariseDay(byDate.get(date) ?? []) })),
    },
  };
}

/**
 * Writes are gated the same way every other mutation on a promoter's record is
 * (`app/promoters/actions.ts`'s `checkPromoterCreationAllowed`, `app/campaigns/[id]/brief/
 * actions.ts`'s `saveBrief`): a read-only agency (canceled, or past its 14-day grace) must not be
 * able to write, and this is the one place both the single-day and the bulk path call through.
 */
async function assertWritable(agencyId: string): Promise<SaveFailure | null> {
  const entitlement = await getEntitlement(agencyId);
  if (!entitlement) return null; // same fail-open posture as elsewhere: an impossible state, not a block.
  if (!checkBilling(entitlement, "write").allowed) return "blocked_read_only";
  return null;
}

/**
 * Confirms the id is a promoter the coordinator's own agency can see. RLS already scopes every
 * query to `own_agency`, so a tampered id belonging to another tenant simply finds no row — this
 * turns that into an honest `not_found` rather than a generic `save_failed`.
 */
async function findOwnPromoter(
  db: Awaited<ReturnType<typeof createServerSupabase>>,
  promoterId: string,
): Promise<boolean> {
  const { data, error } = await db.from("promoters").select("id").eq("id", promoterId).maybeSingle<{ id: string }>();
  return !error && Boolean(data);
}

export type SaveResult = { ok: true } | { ok: false; reason: SaveFailure };

/**
 * Set one day, replacing whatever was there — identical contract to
 * `app/a/[token]/data.ts`'s `saveAvailabilityDay`, with two differences: the write is
 * authenticated (`requireUser()`, billing-gated) rather than token-scoped, and the row is
 * stamped `source: 'coordinator'` instead of `'self'`, which is the whole point of this parcel —
 * a coordinator must be able to tell, months later, that she typed this in on a phone call and
 * the promoter never saw it.
 *
 * DELETE-THEN-INSERT, never an upsert. The unique key is `(promoter_id, on_date, from_time)`, so
 * an upsert keyed on it would happily leave a stale whole-day row sitting next to a new partial
 * one — two statements about the same date, which `0005_matching_fixes.sql` FIX 2 exists to let
 * the matching engine survive but which the UI must never be the one to create. `planRow` returns
 * at most one row, so after this runs the date holds either exactly one row or none.
 *
 * supabase-js cannot wrap the two statements in a transaction and this parcel adds no migration,
 * so the failure is arranged to fall the safe way: if the insert fails after the delete, the date
 * is left CLEARED rather than contradictory, and the coordinator is told the save failed. An
 * un-set day is a day the matching engine will not offer — conservative, and recoverable by
 * tapping again.
 */
export async function saveCoordinatorDay(
  promoterId: string,
  date: string,
  choice: string,
  fromTime: string | null,
  toTime: string | null,
): Promise<SaveResult> {
  const user = await requireUser();

  const blocked = await assertWritable(user.agencyId);
  if (blocked) return { ok: false, reason: blocked };

  const db = await createServerSupabase();
  if (!(await findOwnPromoter(db, promoterId))) return { ok: false, reason: "not_found" };

  // The date must be one the page actually offered. Without this, a request replaying an old
  // grid could rewrite a date outside the fortnight the coordinator is looking at.
  if (!isValidIsoDate(date)) return { ok: false, reason: "bad_date" };
  if (!gridDates(athensToday(), GRID_DAYS).includes(date)) {
    return { ok: false, reason: "bad_date" };
  }

  const plan = planRow(choice, fromTime, toTime);
  if (!plan.ok) return { ok: false, reason: plan.reason };

  const { error: deleteError } = await db
    .from("availability")
    .delete()
    .eq("promoter_id", promoterId)
    .eq("on_date", date);
  if (deleteError) return { ok: false, reason: "save_failed" };

  if (plan.row === null) return { ok: true };

  const { error: insertError } = await db.from("availability").insert({
    agency_id: user.agencyId,
    promoter_id: promoterId,
    on_date: date,
    status: plan.row.status,
    from_time: plan.row.from_time,
    to_time: plan.row.to_time,
    source: "coordinator",
  });
  if (insertError) return { ok: false, reason: "save_failed" };

  return { ok: true };
}

/** Every weekday (Mon–Fri) in the grid, in order. */
function weekdayDates(dates: readonly string[]): string[] {
  return dates.filter((d) => {
    const dow = isoAsUtcDate(d).getUTCDay();
    return dow !== 0 && dow !== 6;
  });
}

/**
 * The soonest Saturday/Sunday pair in the grid. "This weekend" means exactly that — the next one
 * coming up, not every weekend the fortnight happens to contain — so a coordinator clearing a
 * promoter for "the weekend" on a phone call never accidentally also touches the one ten days out.
 */
function nextWeekendDates(dates: readonly string[]): string[] {
  const satIndex = dates.findIndex((d) => isoAsUtcDate(d).getUTCDay() === 6);
  if (satIndex === -1) return [];
  const saturday = dates[satIndex];
  const following = dates[satIndex + 1];
  const result: string[] = saturday ? [saturday] : [];
  if (following && isoAsUtcDate(following).getUTCDay() === 0) result.push(following);
  return result;
}

function datesForBulk(kind: BulkKind, dates: readonly string[]): string[] {
  if (kind === "weekdays") return weekdayDates(dates);
  if (kind === "weekend") return nextWeekendDates(dates);
  return [...dates]; // "clear_all" — the whole visible fortnight.
}

export type BulkResult = { ok: true } | { ok: false; reason: SaveFailure };

/**
 * Fast bulk entry — product-spec.md §2's "the coordinator stops messaging dozens of people",
 * applied to the one-promoter-at-a-time case: setting fourteen days one tap at a time is exactly
 * the reason people stay in spreadsheets.
 *
 * Same delete-then-insert contract as the single day, batched: one DELETE over every target date,
 * then (for `weekdays`/`weekend`) one INSERT of one whole-day `available` row per date. Because
 * `from_time` is `null` on every row and `on_date` differs across the batch, no two rows in the
 * insert can collide on `(promoter_id, on_date, from_time)` — the batch is just N independent
 * single-day writes sent together, not a new kind of write. If the insert fails after the delete,
 * every targeted date is left cleared rather than holding a stale row next to nothing — the same
 * safe-by-construction failure mode as the single-day path, just applied date by date.
 */
export async function applyBulkAvailability(promoterId: string, kind: BulkKind): Promise<BulkResult> {
  const user = await requireUser();

  const blocked = await assertWritable(user.agencyId);
  if (blocked) return { ok: false, reason: blocked };

  const db = await createServerSupabase();
  if (!(await findOwnPromoter(db, promoterId))) return { ok: false, reason: "not_found" };

  const dates = gridDates(athensToday(), GRID_DAYS);
  const targets = datesForBulk(kind, dates);
  if (targets.length === 0) return { ok: true };

  const { error: deleteError } = await db
    .from("availability")
    .delete()
    .eq("promoter_id", promoterId)
    .in("on_date", targets);
  if (deleteError) return { ok: false, reason: "save_failed" };

  if (kind === "clear_all") return { ok: true };

  const rows = targets.map((on_date) => ({
    agency_id: user.agencyId,
    promoter_id: promoterId,
    on_date,
    status: "available" as const,
    from_time: null,
    to_time: null,
    source: "coordinator" as const,
  }));

  const { error: insertError } = await db.from("availability").insert(rows);
  if (insertError) return { ok: false, reason: "save_failed" };

  return { ok: true };
}
