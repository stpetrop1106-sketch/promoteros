/**
 * Which stored photo files no longer have a row pointing at them.
 *
 * PURE ON PURPOSE, in the same spirit as `lib/retention.ts`: this file decides what to delete and
 * never deletes anything. A mistake here destroys a client deliverable that has already been
 * invoiced, so it has to be assertable without a database or a bucket — see
 * `tests/photo-orphans.test.ts`.
 *
 * ---------------------------------------------------------------------------
 * WHY THERE ARE ORPHANS AT ALL
 * ---------------------------------------------------------------------------
 * A field report's photos are uploaded to `field-report-photos` and recorded as rows in
 * `report_photos`. Deleting a campaign cascades in Postgres — shifts, assignments, field_reports,
 * report_photos — and Postgres knows nothing about object storage, so the files stay. Forever.
 * Nothing in the product has ever removed one: the audit found a single storage call in the whole
 * tree and it is the upload (`lib/checkins.ts`).
 *
 * That is two problems in one. The cheap one is the bill. The one that matters is that a
 * photograph taken inside a shop, which can incidentally contain a promoter or a customer,
 * outlives the record that justified keeping it — and it outlives it invisibly, because there is
 * no longer a row anywhere that says it exists.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS DELIBERATELY DOES NOT DO
 * ---------------------------------------------------------------------------
 * It does not implement a retention period for photos that still have rows. `lib/retention.ts`
 * keeps `report_photos` on an erasure on purpose — the photo is the agency's evidence for a
 * delivered client report, and a photo that incidentally shows a person is surfaced for human
 * review rather than blind-wiped (docs/gdpr.md). That decision stands. This only removes files
 * that no row refers to, which is a different statement: not "we decided to keep this", but
 * "nothing in the database knows this is here".
 */

export type StoredObject = { path: string; createdAt: string | null };

/**
 * A file must be this old before it can be called an orphan.
 *
 * `submitReport` uploads each photo and then inserts its row. Between those two moments the file
 * is real and unreferenced, and on a bad connection that gap can be long. A sweep that ran in
 * that window would delete the photo out from under a promoter who is still submitting. One day
 * is far longer than any submission and far shorter than any retention question.
 */
export const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * Objects safe to delete: unreferenced, and older than the grace period.
 *
 * An object with no `createdAt` is treated as too new to judge and is left alone. Storage is
 * supposed to give us one; if it ever does not, the failure mode must be "keep a file we could
 * have deleted", never "delete a file we could not date".
 */
export function selectOrphans(
  objects: readonly StoredObject[],
  referencedPaths: ReadonlySet<string>,
  now: number,
  graceMs: number = ORPHAN_GRACE_MS,
): string[] {
  const orphans: string[] = [];

  for (const object of objects) {
    if (referencedPaths.has(object.path)) continue;
    if (!object.createdAt) continue;

    const age = now - Date.parse(object.createdAt);
    if (!Number.isFinite(age) || age < graceMs) continue;

    orphans.push(object.path);
  }

  return orphans;
}
