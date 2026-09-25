import { describe, expect, it } from "vitest";
import { isActivePromoterStatus } from "@/lib/promoter-status";

/**
 * A3-06. The rule that decides whether an invitation can still be accepted and an arrival can
 * still be recorded, so it is worth a test rather than four copies of a string comparison.
 */
describe("isActivePromoterStatus", () => {
  it("revokes archived and blocklisted promoters", () => {
    expect(isActivePromoterStatus("archived")).toBe(false);
    expect(isActivePromoterStatus("blocklisted")).toBe(false);
  });

  it("leaves active and paused promoters working", () => {
    expect(isActivePromoterStatus("active")).toBe(true);
    // Deliberate: a paused promoter answering an invitation already sent is how they come back.
    expect(isActivePromoterStatus("paused")).toBe(true);
  });

  it("treats a missing status as active, so a broken join never reads as a blocklisting", () => {
    expect(isActivePromoterStatus(null)).toBe(true);
    expect(isActivePromoterStatus(undefined)).toBe(true);
  });

  it("does not guess at an unknown status", () => {
    expect(isActivePromoterStatus("something_new")).toBe(true);
  });
});
