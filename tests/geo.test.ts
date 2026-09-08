import { describe, expect, it } from "vitest";
import { distanceMetres, distanceScore, type Coordinates } from "@/lib/geo";

// Real-world reference points, picked because their true separation is well known and
// the coordinates are public (no agency data — see CLAUDE.md §1).
const SYNTAGMA: Coordinates = { lat: 37.9755, lng: 23.7348 };
const PIRAEUS: Coordinates = { lat: 37.9475, lng: 23.6367 };

describe("distanceMetres", () => {
  it("returns roughly 8-9 km for Syntagma -> Piraeus", () => {
    const metres = distanceMetres(SYNTAGMA, PIRAEUS);
    expect(metres).toBeGreaterThan(7_500);
    expect(metres).toBeLessThan(9_500);
  });

  it("is symmetric: A->B equals B->A", () => {
    expect(distanceMetres(SYNTAGMA, PIRAEUS)).toBe(distanceMetres(PIRAEUS, SYNTAGMA));
  });

  it("is zero for identical points", () => {
    expect(distanceMetres(SYNTAGMA, SYNTAGMA)).toBe(0);
    expect(distanceMetres(PIRAEUS, PIRAEUS)).toBe(0);
  });

  it("is symmetric and consistent for an arbitrary pair too", () => {
    const a: Coordinates = { lat: 40.6401, lng: 22.9444 }; // Thessaloniki
    const b: Coordinates = { lat: 38.2466, lng: 21.7346 }; // Patras
    expect(distanceMetres(a, b)).toBe(distanceMetres(b, a));
    expect(distanceMetres(a, b)).toBeGreaterThan(0);
  });
});

describe("distanceScore", () => {
  it("is 1.0 at zero distance regardless of car", () => {
    expect(distanceScore(0, true)).toBe(1);
    expect(distanceScore(0, false)).toBe(1);
  });

  it("is strictly decreasing as distance grows", () => {
    const distances = [0, 1_000, 2_000, 5_000, 10_000, 20_000, 50_000];
    for (const hasCar of [true, false]) {
      const scores = distances.map((d) => distanceScore(d, hasCar));
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]!).toBeLessThan(scores[i - 1]!);
      }
    }
  });

  it("is always in (0, 1]", () => {
    for (const metres of [0, 1, 100, 1_000, 50_000, 1_000_000]) {
      for (const hasCar of [true, false]) {
        const score = distanceScore(metres, hasCar);
        expect(score).toBeGreaterThan(0);
        expect(score).toBeLessThanOrEqual(1);
      }
    }
  });

  it("scores a promoter with a car higher than one without, at the same distance", () => {
    for (const metres of [1_000, 5_000, 10_000, 20_000]) {
      expect(distanceScore(metres, true)).toBeGreaterThan(distanceScore(metres, false));
    }
  });

  // distanceScore is h/(h+metres) with a longer half-life (h) for a car. The car-vs-no-car
  // gap widens only up to metres = sqrt(hasCarHalfLife * noCarHalfLife) (~8.66km for the
  // current 15000/5000 constants) and narrows beyond that, because both scores are bounded
  // in (0,1] and converge back toward 0 together at extreme distances. Test the widening
  // within that range, which covers any realistic promoter search radius.
  it("widens the car-vs-no-car gap as distance grows, within the realistic search radius", () => {
    const gapAt = (metres: number) => distanceScore(metres, true) - distanceScore(metres, false);
    const near = gapAt(500);
    const mid = gapAt(2_000);
    const far = gapAt(6_000);
    expect(mid).toBeGreaterThan(near);
    expect(far).toBeGreaterThan(mid);
  });
});
