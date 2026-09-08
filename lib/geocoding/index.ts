/**
 * Geocoding adapters.
 *
 * Promoter addresses must become coordinates so the matching engine can rank by distance —
 * `lib/geo.ts` already computes haversine distance from lat/lng, this module's only job is to
 * produce that lat/lng. Nominatim (OpenStreetMap) is free and fine for development, but its usage
 * policy does not permit commercial volume (see docs/keys-needed.md §4); a paid provider
 * (LocationIQ) replaces it before the first paying customer. Feature code calls
 * `getGeocoder().geocode(...)` and never touches a provider's HTTP API directly.
 *
 * Same adapter shape as `lib/messaging/index.ts`, for the same reason: the dev provider and the
 * commercial provider are different, and feature code must not care. Add adapters, not
 * conditionals. See build-plan.md §6 (frozen contract) and CLAUDE.md's "Messaging" section for
 * the pattern this mirrors.
 */

import { NominatimProvider } from "./nominatim";
import { LocationIqProvider } from "./locationiq";
import { NullProvider } from "./null-provider";

export type Coordinates = { lat: number; lng: number };

export type GeocodeResult = {
  coordinates: Coordinates;
  formattedAddress: string;
  confidence: "high" | "medium" | "low";
};

export interface GeocodingProvider {
  readonly name: string;
  /**
   * Resolves an address to coordinates, or `null` on any failure (network error, non-200,
   * empty result, malformed body, timeout, or an out-of-bounds sanity-check rejection).
   * Never throws — a geocoding outage must not break promoter creation; the UI falls back to
   * manual lat/lng entry.
   */
  geocode(address: string, opts?: { country?: string }): Promise<GeocodeResult | null>;
}

export function getGeocoder(): GeocodingProvider {
  const configured = process.env.GEOCODING_PROVIDER ?? "nominatim";

  if (configured === "none") {
    return new NullProvider();
  }

  if (configured === "locationiq") {
    const key = process.env.GEOCODING_API_KEY;
    if (key) return new LocationIqProvider(key);
    // Misconfiguration must not silently disable geocoding for every promoter.
    console.warn(
      "GEOCODING_PROVIDER=locationiq but GEOCODING_API_KEY is unset; falling back to nominatim",
    );
  }

  return new NominatimProvider();
}
