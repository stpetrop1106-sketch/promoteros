/**
 * Internal helpers shared by geocoding providers. Not part of the frozen contract
 * (`lib/geocoding/index.ts`) — providers only.
 */

import type { Coordinates } from "./index";

/** Trim and collapse internal whitespace. Providers should bail on an empty result. */
export function normalizeAddress(address: string): string {
  return address.trim().replace(/\s+/g, " ");
}

/**
 * Greece's rough bounding box. A geocode landing outside it is almost certainly a bad match —
 * wrong country, misparsed query, a provider guessing — and would silently corrupt distance
 * ranking for every shift the promoter appears in. Reject rather than trust it; the caller
 * falls back to manual lat/lng entry.
 */
export function isWithinGreeceBounds(coords: Coordinates): boolean {
  return coords.lat >= 34 && coords.lat <= 42 && coords.lng >= 19 && coords.lng <= 30;
}

/**
 * Nominatim and LocationIQ both return a Nominatim-shaped result: an `importance` float (roughly
 * 0..1) when available, and an OSM `type` string (e.g. "house", "residential", "administrative").
 * Prefer `importance` when present; fall back to `type` for responses that omit it.
 */
export function confidenceFromImportance(
  importance: unknown,
  type: unknown,
): "high" | "medium" | "low" {
  if (typeof importance === "number" && Number.isFinite(importance)) {
    if (importance >= 0.6) return "high";
    if (importance >= 0.35) return "medium";
    return "low";
  }

  const preciseTypes = new Set(["house", "building", "residential"]);
  if (typeof type === "string" && preciseTypes.has(type)) return "high";
  return "medium";
}
