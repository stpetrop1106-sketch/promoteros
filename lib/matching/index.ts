import { createAdminClient } from "@/lib/supabase/admin";

export const MATCH_FACTORS = [
  "distance",
  "brand_experience",
  "category_experience",
  "skill_overlap",
  "brief_completed",
  "reliability",
] as const;

export type MatchFactor = (typeof MATCH_FACTORS)[number];

export type FactorScore = {
  /** 0..1, before weighting */
  value: number;
  weight: number;
  /** Raw figure behind the score — metres, shift count, skill hits */
  detail?: number;
};

export type Candidate = {
  promoterId: string;
  fullName: string;
  phone: string;
  distanceM: number;
  hasCar: boolean;
  briefCompleted: boolean;
  brandShifts: number;
  skillHits: number;
  reliability: number;
  /** 0..1, weighted and normalised — render as a percentage */
  score: number;
  breakdown: Record<MatchFactor, FactorScore>;
};

type MatchRow = {
  promoter_id: string;
  full_name: string;
  phone: string;
  distance_m: number;
  has_car: boolean;
  brief_completed: boolean;
  brand_shifts: number;
  skill_hits: number;
  reliability: number;
  score: number;
  breakdown: Record<MatchFactor, FactorScore>;
};

/**
 * Ranked candidates for a shift.
 *
 * The ranking lives in SQL (see supabase/migrations/0003_matching.sql) so that filtering and
 * scoring happen next to the data rather than by pulling every promoter into the app.
 */
export async function matchPromoters(
  shiftId: string,
  limit = 20,
): Promise<Candidate[]> {
  const db = createAdminClient();

  const { data, error } = await db.rpc("match_promoters", {
    p_shift_id: shiftId,
    p_limit: limit,
  });

  if (error) throw new Error(`match_promoters failed: ${error.message}`);

  return (data as MatchRow[]).map((r) => ({
    promoterId: r.promoter_id,
    fullName: r.full_name,
    phone: r.phone,
    distanceM: r.distance_m,
    hasCar: r.has_car,
    briefCompleted: r.brief_completed,
    brandShifts: r.brand_shifts,
    skillHits: r.skill_hits,
    reliability: r.reliability,
    score: r.score,
    breakdown: r.breakdown,
  }));
}

/**
 * The factors that actually pushed this candidate up, strongest first.
 * Used for the one-line "why" under each name — a coordinator reads reasons, not numbers.
 */
export function topReasons(candidate: Candidate, n = 3): MatchFactor[] {
  return MATCH_FACTORS.filter((f) => (candidate.breakdown[f]?.value ?? 0) > 0)
    .sort((a, b) => {
      const sa = candidate.breakdown[a]!;
      const sb = candidate.breakdown[b]!;
      return sb.value * sb.weight - sa.value * sa.weight;
    })
    .slice(0, n);
}
