const EARTH_RADIUS_M = 6_371_000;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export type Coordinates = { lat: number; lng: number };

/**
 * Great-circle distance in metres.
 *
 * Straight-line distance is deliberate for v1: it is free, has no rate limit, and ranks
 * candidates within a metro area well enough. Real travel time is a later decision — see
 * docs/decisions.md before reaching for a routing API.
 */
export function distanceMetres(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h)));
}

/**
 * Distance as a 0..1 desirability score.
 *
 * Having a car widens the radius rather than removing the penalty — a promoter with a car
 * still prefers a nearby store, and coordinators expect that to show in the ranking.
 */
export function distanceScore(metres: number, hasCar: boolean): number {
  const halfLife = hasCar ? 15_000 : 5_000;
  return 1 / (1 + metres / halfLife);
}
