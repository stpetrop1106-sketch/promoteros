/**
 * Reading the two coordinate boxes on the new-store form.
 *
 * A sibling module rather than part of `actions.ts` for the reason CLAUDE.md gives: a `"use server"`
 * module may export only async functions, so a pure helper cannot live there and be tested. Nothing
 * here touches the database, the network or the request — it is arithmetic on two strings.
 */

/** Coordinates copy-pasted from Google Maps use a dot, but tolerate a Greek comma decimal too. */
export function parseCoordinate(value: string | undefined | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  // `Number("")` is 0 and `Number(" 12 ")` is 12 — the empty case is handled above, and anything
  // with a stray letter in it becomes NaN and is rejected here.
  const n = Number(trimmed.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * A coordinate that could be a real place on Earth.
 *
 * Distance decay is the first term of the matching score (CLAUDE.md § Matching), so a nonsense
 * lat/lng does not fail loudly — it quietly ranks the wrong people first for every shift at this
 * store, for as long as the store exists. Two things get caught: a value outside the globe (a
 * transposed pair, an extra digit, a stray minus) and Null Island, which is what a "default
 * coordinate" looks like when some layer decided a missing number should be zero.
 *
 * Deliberately not narrowed to Greece. `lib/geocoding/shared.ts` already rejects an out-of-Greece
 * *geocode*; second-guessing a coordinator who typed a coordinate in by hand is not this
 * function's job, and an agency working a border town or a ferry route would be the one to suffer.
 */
export function isSaneCoordinate(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  // Null Island. ~11 m of the Gulf of Guinea is not a store in Attica.
  return Math.abs(lat) > 0.0001 || Math.abs(lng) > 0.0001;
}

export type CoordinateInput =
  | { kind: "absent" }
  | { kind: "ok"; lat: number; lng: number }
  | { kind: "invalid" };

/**
 * What the two coordinate boxes say.
 *
 * `absent` is the normal case now: the coordinator types an address and the server geocodes it.
 * A half-filled pair is `invalid` rather than `absent` on purpose — someone who typed one number
 * meant to type two, and silently geocoding over the one they typed would be the surprising move.
 */
export function readCoordinates(
  latRaw: string | undefined | null,
  lngRaw: string | undefined | null,
): CoordinateInput {
  if (!latRaw?.trim() && !lngRaw?.trim()) return { kind: "absent" };

  const lat = parseCoordinate(latRaw);
  const lng = parseCoordinate(lngRaw);
  if (lat === null || lng === null || !isSaneCoordinate(lat, lng)) return { kind: "invalid" };
  return { kind: "ok", lat, lng };
}
