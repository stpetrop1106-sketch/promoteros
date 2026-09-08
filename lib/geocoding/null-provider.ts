/**
 * Always returns `null`. Selected with `GEOCODING_PROVIDER=none` to disable geocoding entirely
 * (e.g. offline development, or a deliberate cost-zero mode) so callers never have to
 * special-case an absent provider — they already handle a `null` geocode result by falling back
 * to manual lat/lng entry.
 */

import type { GeocodeResult, GeocodingProvider } from "./index";

export class NullProvider implements GeocodingProvider {
  readonly name = "none";

  async geocode(_address: string, _opts?: { country?: string }): Promise<GeocodeResult | null> {
    return null;
  }
}
