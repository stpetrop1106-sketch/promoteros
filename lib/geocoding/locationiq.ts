/**
 * LocationIQ geocoding — the commercial provider, used once `GEOCODING_API_KEY` is set.
 *
 * Same Nominatim-compatible response shape as the OpenStreetMap provider, so it shares the same
 * parsing and confidence logic. No in-process rate limiting here: LocationIQ's paid tiers permit
 * meaningfully higher throughput and enforce their own limits server-side — see
 * docs/keys-needed.md §4 before raising volume in production.
 */

import type { Coordinates, GeocodeResult, GeocodingProvider } from "./index";
import { confidenceFromImportance, isWithinGreeceBounds, normalizeAddress } from "./shared";

const LOCATIONIQ_ENDPOINT = "https://us1.locationiq.com/v1/search";

export class LocationIqProvider implements GeocodingProvider {
  readonly name = "locationiq";

  constructor(private readonly apiKey: string) {}

  async geocode(address: string, opts?: { country?: string }): Promise<GeocodeResult | null> {
    const normalized = normalizeAddress(address);
    if (!normalized) return null;

    const country = opts?.country ?? "gr";
    const params = new URLSearchParams({
      key: this.apiKey,
      q: normalized,
      countrycodes: country,
      format: "json",
      limit: "1",
    });

    try {
      const res = await fetch(`${LOCATIONIQ_ENDPOINT}?${params.toString()}`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) return null;

      let body: unknown;
      try {
        body = await res.json();
      } catch {
        return null;
      }

      if (!Array.isArray(body) || body.length === 0) return null;
      const first = body[0];
      if (typeof first !== "object" || first === null) return null;
      const record = first as Record<string, unknown>;

      const lat = Number(record.lat);
      const lng = Number(record.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      const coordinates: Coordinates = { lat, lng };
      if (country === "gr" && !isWithinGreeceBounds(coordinates)) return null;

      const formattedAddress =
        typeof record.display_name === "string" ? record.display_name : normalized;

      return {
        coordinates,
        formattedAddress,
        confidence: confidenceFromImportance(record.importance, record.type),
      };
    } catch {
      // Network error, transport failure, or AbortSignal.timeout firing — geocoding must never
      // throw, and never logs the API key. The caller falls back to manual lat/lng entry.
      return null;
    }
  }
}
