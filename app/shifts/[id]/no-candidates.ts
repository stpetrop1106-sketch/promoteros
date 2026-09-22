import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A2 finding 9 — why the ranked list is empty.
 *
 * `match_promoters` (0007_match_radius.sql) makes a promoter a candidate only if she has an
 * explicit `availability` row covering the *whole* shift window. So for any date nobody has
 * declared on, every shift showed "Κανένας διαθέσιμος promoter για αυτή τη βάρδια" — which reads
 * as "your roster does not fit this shift" when the truth is "nobody has told us about that day
 * yet". Verified in the audit on three shifts of one campaign, same store, same times: 22/09 →
 * 5 candidates, 23/09 → 0, 08/10 → 0, the only difference being where the seeded availability
 * stops. This is the first thing a new agency sees after importing a month of shifts, and it gave
 * them no next step.
 *
 * The right fix is for the RPC to report its own exclusions, but this parcel may not write a
 * migration — so the counts are recomputed here, from the same tables, through the caller's
 * RLS-scoped client. Cheap: it only runs when the list came back empty.
 *
 * Deliberately only the two cases a coordinator can act on differently. "Nobody declared" sends
 * them to the availability link; anything else means the roster was considered and ruled out, and
 * the honest thing is to say how many were considered rather than to guess which filter bit.
 */
export type NoCandidatesReason =
  /** The agency has no active promoters at all. */
  | "no_promoters"
  /** Active promoters exist, but none declared availability covering this shift. */
  | "nobody_declared"
  /** People did declare, and every one of them was excluded by another hard filter. */
  | "all_excluded";

export type NoCandidatesDiagnosis = {
  reason: NoCandidatesReason;
  /** Active promoters in the agency. */
  activeCount: number;
  /** Of those, how many declared availability covering this shift's whole window. */
  declaredCount: number;
};

type AvailabilityRow = {
  promoter_id: string;
  status: string;
  from_time: string | null;
  to_time: string | null;
};

/** "10:00:00" and "10:00" compare correctly against each other once both are "HH:MM". */
function hhmm(value: string | null): string | null {
  return value === null ? null : String(value).slice(0, 5);
}

/**
 * Mirrors the RPC's availability filter exactly: an `available` row covering the whole window,
 * and no overlapping `unavailable` row (a whole-day one — both times null — blocks the date).
 */
function coversShift(rows: AvailabilityRow[], startTime: string, endTime: string): boolean {
  const start = hhmm(startTime)!;
  const end = hhmm(endTime)!;

  const available = rows.some((r) => {
    if (r.status !== "available") return false;
    const from = hhmm(r.from_time);
    const to = hhmm(r.to_time);
    return (from === null || from <= start) && (to === null || to >= end);
  });
  if (!available) return false;

  const blocked = rows.some((r) => {
    if (r.status !== "unavailable") return false;
    const from = hhmm(r.from_time);
    const to = hhmm(r.to_time);
    return (from === null || from < end) && (to === null || to > start);
  });
  return !blocked;
}

export async function diagnoseNoCandidates(
  db: SupabaseClient,
  shift: { onDate: string; startTime: string; endTime: string },
): Promise<NoCandidatesDiagnosis> {
  const [{ count: activeCount }, { data: availabilityRows }] = await Promise.all([
    db.from("promoters").select("id", { count: "exact", head: true }).eq("status", "active"),
    db
      .from("availability")
      .select("promoter_id, status, from_time, to_time")
      .eq("on_date", shift.onDate),
  ]);

  const active = activeCount ?? 0;
  if (active === 0) {
    return { reason: "no_promoters", activeCount: 0, declaredCount: 0 };
  }

  const byPromoter = new Map<string, AvailabilityRow[]>();
  for (const row of (availabilityRows ?? []) as AvailabilityRow[]) {
    const list = byPromoter.get(row.promoter_id);
    if (list) list.push(row);
    else byPromoter.set(row.promoter_id, [row]);
  }

  let declaredCount = 0;
  for (const rows of byPromoter.values()) {
    if (coversShift(rows, shift.startTime, shift.endTime)) declaredCount += 1;
  }

  return {
    reason: declaredCount === 0 ? "nobody_declared" : "all_excluded",
    activeCount: active,
    declaredCount,
  };
}
