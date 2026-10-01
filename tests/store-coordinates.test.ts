import { describe, expect, it } from "vitest";
import {
  isSaneCoordinate,
  parseCoordinate,
  readCoordinates,
} from "@/app/campaigns/[id]/shifts/new/coordinates";

describe("parsing a coordinate a coordinator typed", () => {
  it("takes the dot Google Maps gives and the comma a Greek keyboard gives", () => {
    expect(parseCoordinate("37.9838")).toBeCloseTo(37.9838, 6);
    expect(parseCoordinate("37,9838")).toBeCloseTo(37.9838, 6);
    expect(parseCoordinate("  23.7275  ")).toBeCloseTo(23.7275, 6);
    expect(parseCoordinate("-0.1276")).toBeCloseTo(-0.1276, 6);
  });

  it("treats blank as absent, not as zero", () => {
    // `Number("")` is 0, which is exactly how a store ends up on Null Island.
    expect(parseCoordinate("")).toBeNull();
    expect(parseCoordinate("   ")).toBeNull();
    expect(parseCoordinate(undefined)).toBeNull();
    expect(parseCoordinate(null)).toBeNull();
  });

  it("rejects anything that is not a number", () => {
    expect(parseCoordinate("Glyfada")).toBeNull();
    expect(parseCoordinate("37.98N")).toBeNull();
  });
});

describe("a coordinate that could be a real place", () => {
  it("accepts a point in Attica", () => {
    expect(isSaneCoordinate(37.9838, 23.7275)).toBe(true);
  });

  it("accepts a point outside Greece - the geocoder polices that, this does not", () => {
    expect(isSaneCoordinate(51.5072, -0.1276)).toBe(true);
  });

  it("rejects a point that is not on the globe", () => {
    expect(isSaneCoordinate(91, 23)).toBe(false);
    expect(isSaneCoordinate(-91, 23)).toBe(false);
    expect(isSaneCoordinate(37, 181)).toBe(false);
    expect(isSaneCoordinate(37, -181)).toBe(false);
    // A transposed Attica pair: 23.7 as a latitude is fine, 237.275 as a longitude is not.
    expect(isSaneCoordinate(23.7275, 237.275)).toBe(false);
  });

  it("rejects Null Island, which is what a default coordinate looks like", () => {
    expect(isSaneCoordinate(0, 0)).toBe(false);
    expect(isSaneCoordinate(0.00001, -0.00001)).toBe(false);
    // A real coordinate that happens to have a zero component is still fine.
    expect(isSaneCoordinate(0, 23.7275)).toBe(true);
    expect(isSaneCoordinate(37.9838, 0)).toBe(true);
  });

  it("rejects NaN and Infinity", () => {
    expect(isSaneCoordinate(Number.NaN, 23)).toBe(false);
    expect(isSaneCoordinate(37, Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe("what the two coordinate boxes say", () => {
  it("is absent when both are empty - the normal case, the address gets geocoded", () => {
    expect(readCoordinates("", "")).toEqual({ kind: "absent" });
    expect(readCoordinates(undefined, undefined)).toEqual({ kind: "absent" });
    expect(readCoordinates("  ", "\t")).toEqual({ kind: "absent" });
  });

  it("is the manual override when both are filled and sane", () => {
    expect(readCoordinates("37.9838", "23.7275")).toEqual({
      kind: "ok",
      lat: 37.9838,
      lng: 23.7275,
    });
    expect(readCoordinates("37,9838", "23,7275")).toEqual({
      kind: "ok",
      lat: 37.9838,
      lng: 23.7275,
    });
  });

  it("is invalid when only one of the pair was typed", () => {
    // Not "absent": someone who typed one number meant to type two. Geocoding over it silently
    // would be the surprising move.
    expect(readCoordinates("37.9838", "")).toEqual({ kind: "invalid" });
    expect(readCoordinates("", "23.7275")).toEqual({ kind: "invalid" });
  });

  it("is invalid for a pair that is not a place", () => {
    expect(readCoordinates("0", "0")).toEqual({ kind: "invalid" });
    expect(readCoordinates("923.7", "23.7")).toEqual({ kind: "invalid" });
    expect(readCoordinates("abc", "def")).toEqual({ kind: "invalid" });
  });
});
