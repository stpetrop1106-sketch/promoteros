import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { ORPHAN_GRACE_MS, selectOrphans, type StoredObject } from "@/lib/photo-orphans";

const PHOTO_BUCKET = "field-report-photos";
const PAGE = 100;

/**
 * Deletes stored photos that no `report_photos` row refers to.
 *
 * The decision of what counts as an orphan is in `lib/photo-orphans.ts` and is unit-tested
 * without a bucket; this file is only the plumbing that fetches and deletes.
 *
 * Runs from the daily cron. It is not wired into campaign deletion on purpose: a Postgres cascade
 * is what removes the rows, several different deletes reach it, and a sweep that reconciles the
 * bucket against the table catches every path — including the files already orphaned by deletes
 * that happened before this existed, which a hook on one code path never would.
 *
 * `budgetMs` and `maxDeletes` exist because the cron route has a hard ceiling it shares with the
 * work that actually sends people their links. A sweep that has not finished is not a problem:
 * it is a sweep, and tomorrow it starts again from whatever is left.
 */
export type SweepResult = {
  scanned: number;
  referenced: number;
  deleted: number;
  /** True when the sweep stopped early, so `scanned` is not the whole bucket. */
  truncated: boolean;
  errors: string[];
};

type Client = ReturnType<typeof createAdminClient>;

/** Every object under one prefix, following storage's pagination. */
async function listAll(
  db: Client,
  prefix: string,
): Promise<{ entries: { name: string; created_at?: string | null; id?: string | null }[]; error?: string }> {
  const entries: { name: string; created_at?: string | null; id?: string | null }[] = [];

  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await db.storage
      .from(PHOTO_BUCKET)
      .list(prefix, { limit: PAGE, offset });

    if (error) return { entries, error: error.message };
    if (!data || data.length === 0) return { entries };

    entries.push(...data);
    if (data.length < PAGE) return { entries };
  }
}

export async function sweepOrphanedPhotos({
  now = Date.now(),
  graceMs = ORPHAN_GRACE_MS,
  budgetMs = 30_000,
  maxDeletes = 500,
  dryRun = false,
}: {
  now?: number;
  graceMs?: number;
  budgetMs?: number;
  maxDeletes?: number;
  dryRun?: boolean;
} = {}): Promise<SweepResult> {
  const db = createAdminClient();
  const deadline = Date.now() + budgetMs;
  const result: SweepResult = { scanned: 0, referenced: 0, deleted: 0, truncated: false, errors: [] };

  // Every referenced path, read in one go. The table holds one row per photo, so this is small
  // next to the bucket, and reading it FIRST matters: a row inserted while the sweep walks the
  // bucket is a row the sweep has not seen, and the grace period is what covers that gap.
  const referenced = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("report_photos")
      .select("storage_path")
      .range(from, from + 999);

    if (error) {
      result.errors.push(`report_photos: ${error.message}`);
      // Never delete on a partial picture of what is referenced.
      return result;
    }
    for (const row of data ?? []) if (row.storage_path) referenced.add(String(row.storage_path));
    if (!data || data.length < 1000) break;
  }
  result.referenced = referenced.size;

  const objects: StoredObject[] = [];

  // `${agency_id}/${assignment_id}/${file}` — the layout lib/checkins.ts uploads into.
  const agencies = await listAll(db, "");
  if (agencies.error) result.errors.push(`list /: ${agencies.error}`);

  outer: for (const agency of agencies.entries) {
    if (agency.id) continue; // A file at the root: not ours, and not something to reason about.

    const assignments = await listAll(db, agency.name);
    if (assignments.error) {
      result.errors.push(`list ${agency.name}: ${assignments.error}`);
      continue;
    }

    for (const assignment of assignments.entries) {
      if (assignment.id) continue;

      if (Date.now() > deadline) {
        result.truncated = true;
        break outer;
      }

      const files = await listAll(db, `${agency.name}/${assignment.name}`);
      if (files.error) {
        result.errors.push(`list ${agency.name}/${assignment.name}: ${files.error}`);
        continue;
      }

      for (const file of files.entries) {
        objects.push({
          path: `${agency.name}/${assignment.name}/${file.name}`,
          createdAt: file.created_at ?? null,
        });
      }
    }
  }

  result.scanned = objects.length;

  const orphans = selectOrphans(objects, referenced, now, graceMs).slice(0, maxDeletes);
  if (orphans.length === 0 || dryRun) return result;

  const { error } = await db.storage.from(PHOTO_BUCKET).remove(orphans);
  if (error) {
    result.errors.push(`remove: ${error.message}`);
    return result;
  }

  result.deleted = orphans.length;
  return result;
}
