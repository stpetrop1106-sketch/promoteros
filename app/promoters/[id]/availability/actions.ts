"use server";

import { revalidatePath } from "next/cache";
import { saveCoordinatorDay, applyBulkAvailability } from "./data";
import type { BulkKind, BulkState, SaveDayState } from "./state";

/**
 * P5 — the coordinator's write path for a promoter's availability.
 *
 * Authenticated, unlike `app/a/[token]/actions.ts`'s anonymous `saveDay`: `saveCoordinatorDay`
 * and `applyBulkAvailability` (`./data.ts`) both call `requireUser()` first and are billing-gated,
 * so these are unreachable for a signed-out request or a read-only agency.
 *
 * Only async functions are exported from this module — CLAUDE.md, "the server/client boundary".
 * `SaveDayState`/`BulkState` and their `*_IDLE` constants live in `./state.ts` for that reason.
 */
export async function saveDay(
  promoterId: string,
  date: string,
  choice: string,
  fromTime: string | null,
  toTime: string | null,
): Promise<SaveDayState> {
  const result = await saveCoordinatorDay(promoterId, date, choice, fromTime, toTime);
  if (!result.ok) return { status: "error", date, reason: result.reason };

  revalidatePath(`/promoters/${promoterId}/availability`);
  return { status: "saved", date };
}

export async function runBulkAvailability(promoterId: string, kind: BulkKind): Promise<BulkState> {
  const result = await applyBulkAvailability(promoterId, kind);
  if (!result.ok) return { status: "error", kind, reason: result.reason };

  revalidatePath(`/promoters/${promoterId}/availability`);
  return { status: "done", kind };
}
