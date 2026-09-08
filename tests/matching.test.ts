import { describe, expect, it } from "vitest";
import {
  MATCH_FACTORS,
  topReasons,
  type Candidate,
  type FactorScore,
  type MatchFactor,
} from "@/lib/matching";

// Hand-built fixtures only — matchPromoters() hits Supabase via createAdminClient() and is
// out of scope for a unit test (no network, no database). See tests/README.md.

function zeroBreakdown(): Record<MatchFactor, FactorScore> {
  const breakdown = {} as Record<MatchFactor, FactorScore>;
  for (const factor of MATCH_FACTORS) {
    breakdown[factor] = { value: 0, weight: 1 };
  }
  return breakdown;
}

function candidate(overrides: Partial<Record<MatchFactor, FactorScore>> = {}): Candidate {
  const breakdown = { ...zeroBreakdown(), ...overrides };
  return {
    promoterId: "promoter-1",
    fullName: "Fixture Promoter",
    phone: "+30 690 000 0000",
    distanceM: 1000,
    hasCar: false,
    briefCompleted: false,
    brandShifts: 0,
    skillHits: 0,
    reliability: 0,
    score: 0.5,
    breakdown,
  };
}

describe("topReasons", () => {
  it("orders factors by value * weight, descending", () => {
    const c = candidate({
      distance: { value: 0.5, weight: 1 }, // 0.5
      brand_experience: { value: 0.9, weight: 1 }, // 0.9
      category_experience: { value: 0.2, weight: 2 }, // 0.4
      skill_overlap: { value: 0.1, weight: 1 }, // 0.1
    });

    expect(topReasons(c, 4)).toEqual([
      "brand_experience", // 0.9 * 1 = 0.9
      "distance", // 0.5 * 1 = 0.5
      "category_experience", // 0.2 * 2 = 0.4
      "skill_overlap", // 0.1 * 1 = 0.1
    ]);
  });

  it("excludes factors whose value is 0", () => {
    const c = candidate({
      distance: { value: 0.7, weight: 1 },
      brand_experience: { value: 0, weight: 5 }, // zero value, must be excluded even with a big weight
      skill_overlap: { value: 0.3, weight: 1 },
    });

    const reasons = topReasons(c, 10);
    expect(reasons).not.toContain("brand_experience");
    expect(reasons.sort()).toEqual(["distance", "skill_overlap"].sort());
  });

  it("respects the n limit", () => {
    const c = candidate({
      distance: { value: 0.9, weight: 1 },
      brand_experience: { value: 0.8, weight: 1 },
      category_experience: { value: 0.7, weight: 1 },
      skill_overlap: { value: 0.6, weight: 1 },
      brief_completed: { value: 0.5, weight: 1 },
      reliability: { value: 0.4, weight: 1 },
    });

    expect(topReasons(c, 2)).toEqual(["distance", "brand_experience"]);
    expect(topReasons(c, 0)).toEqual([]);
  });

  it("defaults n to 3 when not given", () => {
    const c = candidate({
      distance: { value: 0.9, weight: 1 },
      brand_experience: { value: 0.8, weight: 1 },
      category_experience: { value: 0.7, weight: 1 },
      skill_overlap: { value: 0.6, weight: 1 },
    });

    expect(topReasons(c)).toHaveLength(3);
  });

  it("handles a candidate with all-zero factors without throwing", () => {
    const c = candidate(); // every factor value 0 via zeroBreakdown()
    expect(() => topReasons(c)).not.toThrow();
    expect(topReasons(c)).toEqual([]);
  });

  it("handles a breakdown missing some factor keys entirely without throwing", () => {
    const breakdown = {
      distance: { value: 0.6, weight: 1 },
    } as Record<MatchFactor, FactorScore>; // deliberately partial, as if a row came back incomplete
    const c = candidate();
    c.breakdown = breakdown;

    expect(() => topReasons(c)).not.toThrow();
    expect(topReasons(c)).toEqual(["distance"]);
  });
});
