/**
 * Nominatim (OpenStreetMap) geocoding — the default, free provider for development.
 *
 * Nominatim's usage policy requires a descriptive User-Agent identifying the calling application
 * and permits at most one request per second. Both are enforced here: the header is always set,
 * and every request is serialised through an in-process queue that waits out the minimum interval
 * before the next one fires. A commercial product that gets IP-banned from OpenStreetMap during a
 * customer demo is the failure mode this exists to prevent.
 *
 * Not for commercial volume — see docs/keys-needed.md §4. `LocationIqProvider` replaces this
 * before the first paying customer; nothing in feature code needs to change, only
 * `GEOCODING_PROVIDER`.
 */

import type { Coordinates, GeocodeResult, GeocodingProvider } from "./index";
import { confidenceFromImportance, isWithinGreeceBounds, normalizeAddress } from "./shared";

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";

// Nominatim's policy asks the User-Agent identify the application (ideally with a contact).
// Override via env once a real one exists (see docs/keys-needed.md §4) — never hardcode a
// personal address into a header sent to a third-party service.
const USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ?? "PromoterOS/1.0 (development build; no contact configured)";

const MIN_INTERVAL_MS = 1000;

let queue: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Serialises geocode calls through a single queue enforcing Nominatim's 1-req/sec limit. */
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = Math.max(0, lastRequestAt + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    return task();
  });
  // Keep the chain alive for the next caller even if this task rejects.
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** Test-only: clears the shared rate-limiter clock so unit tests don't pay a real ~1s delay. */
export function __resetRateLimiterForTests(): void {
  queue = Promise.resolve();
  lastRequestAt = 0;
}

export class NominatimProvider implements GeocodingProvider {
  readonly name = "nominatim";

  async geocode(address: string, opts?: { country?: string }): Promise<GeocodeResult | null> {
    const normalized = normalizeAddress(address);
    if (!normalized) return null;

    const country = opts?.country ?? "gr";
    const params = new URLSearchParams({
      format: "json",
      q: normalized,
      countrycodes: country,
      limit: "1",
    });

    try {
      return await enqueue(async () => {
        const res = await fetch(`${NOMINATIM_ENDPOINT}?${params.toString()}`, {
          headers: { "User-Agent": USER_AGENT },
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
      });
    } catch {
      // Network error, transport failure, or AbortSignal.timeout firing — geocoding must never
      // throw. The caller (promoter creation) falls back to manual lat/lng entry.
      return null;
    }
  }
}
