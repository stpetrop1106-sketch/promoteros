import { describe, expect, it } from "vitest";
import { ORPHAN_GRACE_MS, selectOrphans, type StoredObject } from "@/lib/photo-orphans";

const NOW = Date.parse("2026-09-22T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("selectOrphans", () => {
  it("keeps every file a row still points at, however old", () => {
    const objects: StoredObject[] = [
      { path: "agency/assignment/1.jpg", createdAt: ago(400 * 24 * 3600_000) },
    ];
    expect(selectOrphans(objects, new Set(["agency/assignment/1.jpg"]), NOW)).toEqual([]);
  });

  it("deletes a file no row points at once it is past the grace period", () => {
    const objects: StoredObject[] = [{ path: "a/b/old.jpg", createdAt: ago(ORPHAN_GRACE_MS + 1) }];
    expect(selectOrphans(objects, new Set(), NOW)).toEqual(["a/b/old.jpg"]);
  });

  it("does not touch a just-uploaded file whose row is not written yet", () => {
    // The real failure this guards: submitReport uploads, then inserts. A sweep in between must
    // not delete the photo a promoter is in the middle of submitting.
    const objects: StoredObject[] = [
      { path: "a/b/inflight.jpg", createdAt: ago(30_000) },
      { path: "a/b/edge.jpg", createdAt: ago(ORPHAN_GRACE_MS - 1) },
    ];
    expect(selectOrphans(objects, new Set(), NOW)).toEqual([]);
  });

  it("leaves a file it cannot date rather than guessing", () => {
    const objects: StoredObject[] = [
      { path: "a/b/undated.jpg", createdAt: null },
      { path: "a/b/unparseable.jpg", createdAt: "not a date" },
    ];
    expect(selectOrphans(objects, new Set(), NOW)).toEqual([]);
  });

  it("separates the referenced from the orphaned in one pass", () => {
    const objects: StoredObject[] = [
      { path: "a/1.jpg", createdAt: ago(ORPHAN_GRACE_MS * 2) },
      { path: "a/2.jpg", createdAt: ago(ORPHAN_GRACE_MS * 2) },
      { path: "a/3.jpg", createdAt: ago(ORPHAN_GRACE_MS * 2) },
    ];
    expect(selectOrphans(objects, new Set(["a/2.jpg"]), NOW)).toEqual(["a/1.jpg", "a/3.jpg"]);
  });
});
