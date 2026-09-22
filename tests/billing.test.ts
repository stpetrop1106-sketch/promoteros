import { describe, expect, it } from "vitest";
import {
  BILLING_GRACE_DAYS,
  checkBilling,
  entitlementFromRow,
  evaluateAccess,
  type Entitlement,
} from "@/lib/billing/access";

/**
 * The commercial promise in docs/commercial-architecture.md §3 — a cancelled subscription drops the
 * agency to read-only, after a grace period, without ever deleting anything — had no test at all.
 * It is pure logic, and it decides whether a paying customer can work, so it gets one.
 *
 * Every case below is written from the customer's side: what happens to someone whose card failed
 * on the 1st, someone whose trial ran out over a weekend, someone who cancelled but has paid
 * through the end of the month.
 */

const DAY = 24 * 3600_000;
const NOW = new Date("2026-09-22T12:00:00.000Z");
const at = (days: number) => new Date(NOW.getTime() + days * DAY).toISOString();

describe("evaluateAccess", () => {
  it("leaves an active subscription alone, with no banner", () => {
    const d = evaluateAccess({ status: "active", now: NOW });
    expect(d.access).toBe("full");
    expect(d.notice).toBeNull();
  });

  it("keeps a trial working, and only warns near the end", () => {
    expect(evaluateAccess({ status: "trialing", trialEndsAt: at(10), now: NOW }).notice).toBeNull();
    expect(evaluateAccess({ status: "trialing", trialEndsAt: at(2), now: NOW }).notice).toBe("trial_ending");
    expect(evaluateAccess({ status: "trialing", trialEndsAt: at(2), now: NOW }).access).toBe("full");
  });

  it("does not invent an expiry for a trial that never had a clock", () => {
    // A row predating the backfill. Inventing an end date would lock out someone who was never
    // told there was one.
    expect(evaluateAccess({ status: "trialing", trialEndsAt: null, now: NOW }).access).toBe("full");
  });

  it("still lets a failed payment work through the grace window", () => {
    const d = evaluateAccess({ status: "past_due", pastDueSince: at(-3), now: NOW });
    expect(d.access).toBe("grace");
    expect(d.notice).toBe("past_due");
    expect(d.graceDaysRemaining).toBe(BILLING_GRACE_DAYS - 3);
  });

  it("drops to read-only once the grace window has actually run out", () => {
    const d = evaluateAccess({ status: "past_due", pastDueSince: at(-(BILLING_GRACE_DAYS + 1)), now: NOW });
    expect(d.access).toBe("read_only");
    expect(d.notice).toBe("read_only_unpaid");
    expect(d.graceDaysRemaining).toBe(0);
  });

  it("treats the last day of grace as still working", () => {
    // The boundary is where a customer gets locked out a day early if this is wrong.
    const d = evaluateAccess({ status: "past_due", pastDueSince: at(-BILLING_GRACE_DAYS + 0.01), now: NOW });
    expect(d.access).toBe("grace");
  });

  it("gives an expired trial the same grace as a failed payment", () => {
    expect(evaluateAccess({ status: "trialing", trialEndsAt: at(-1), now: NOW }).access).toBe("grace");
    expect(evaluateAccess({ status: "trialing", trialEndsAt: at(-1), now: NOW }).notice).toBe("trial_expired");
    expect(
      evaluateAccess({ status: "trialing", trialEndsAt: at(-(BILLING_GRACE_DAYS + 1)), now: NOW }).access,
    ).toBe("read_only");
  });

  it("makes cancelled and paused read-only immediately, each with its own reason", () => {
    expect(evaluateAccess({ status: "canceled", now: NOW })).toMatchObject({
      access: "read_only",
      notice: "canceled",
    });
    expect(evaluateAccess({ status: "paused", now: NOW })).toMatchObject({
      access: "read_only",
      notice: "paused",
    });
  });
});

describe("checkBilling", () => {
  const entitlement = (over: Partial<Entitlement>): Entitlement =>
    ({
      access: "full",
      overSeatLimit: false,
      overPromoterLimit: false,
      ...over,
    }) as Entitlement;

  it("never blocks a read, whatever the subscription is doing", () => {
    // The one promise that must survive every other rule: nobody is locked out of their own data.
    for (const access of ["full", "grace", "read_only"] as const) {
      expect(checkBilling(entitlement({ access }), "read").allowed).toBe(true);
    }
  });

  it("blocks every kind of write once the account is read-only", () => {
    for (const action of ["write", "add_staff", "add_promoter"] as const) {
      expect(checkBilling(entitlement({ access: "read_only" }), action)).toEqual({
        allowed: false,
        block: "subscription_read_only",
      });
    }
  });

  it("lets a customer in grace keep working", () => {
    expect(checkBilling(entitlement({ access: "grace" }), "write").allowed).toBe(true);
    expect(checkBilling(entitlement({ access: "grace" }), "add_promoter").allowed).toBe(true);
  });

  it("blocks growth at a limit without blocking ordinary work", () => {
    const atSeatLimit = entitlement({ overSeatLimit: true });
    expect(checkBilling(atSeatLimit, "add_staff")).toEqual({ allowed: false, block: "seat_limit_reached" });
    expect(checkBilling(atSeatLimit, "write").allowed).toBe(true);
    expect(checkBilling(atSeatLimit, "add_promoter").allowed).toBe(true);

    const atPromoterLimit = entitlement({ overPromoterLimit: true });
    expect(checkBilling(atPromoterLimit, "add_promoter")).toEqual({
      allowed: false,
      block: "promoter_limit_reached",
    });
    expect(checkBilling(atPromoterLimit, "write").allowed).toBe(true);
  });

  it("reports read-only rather than the limit when both are true", () => {
    // Telling someone to upgrade for more seats, when the real problem is an unpaid invoice,
    // sends them to the wrong screen.
    expect(checkBilling(entitlement({ access: "read_only", overSeatLimit: true }), "add_staff").allowed).toBe(false);
    expect(
      checkBilling(entitlement({ access: "read_only", overSeatLimit: true }), "add_staff"),
    ).toEqual({ allowed: false, block: "subscription_read_only" });
  });
});

describe("entitlementFromRow", () => {
  const row = (over: Record<string, unknown>) =>
    ({
      plan: "starter",
      subscription_status: "active",
      trial_ends_at: null,
      past_due_since: null,
      current_period_end: null,
      seat_limit: 3,
      ...over,
    }) as never;

  it("falls back to trialing when the stored status is not one we know", () => {
    // A status Stripe invented, or a typo in a manual fix: the customer keeps working.
    const e = entitlementFromRow(row({ subscription_status: "something_new" }), {
      seatsUsed: 1,
      promotersUsed: 1,
    }, NOW);
    expect(e.access).toBe("full");
  });

  it("flags the seat limit as soon as there is no room for another", () => {
    // `overSeatLimit` reads like "more seats than allowed", but it is computed with `>=` and
    // used only to answer "may one more be added?". Three seats used out of three means no, and
    // that is right — a plan sold as three logins must not silently become four. Asserted here
    // because the name invites the opposite assumption.
    const usage = (seatsUsed: number) => ({ seatsUsed, promotersUsed: 0 });
    expect(entitlementFromRow(row({}), usage(2), NOW).overSeatLimit).toBe(false);
    expect(entitlementFromRow(row({}), usage(3), NOW).overSeatLimit).toBe(true);
    expect(checkBilling(entitlementFromRow(row({}), usage(3), NOW), "add_staff").allowed).toBe(false);
    // …and being full does not stop the three people who are there from working.
    expect(checkBilling(entitlementFromRow(row({}), usage(3), NOW), "write").allowed).toBe(true);
  });

  it("carries a cancelled subscription straight through to read-only", () => {
    const e = entitlementFromRow(row({ subscription_status: "canceled" }), {
      seatsUsed: 1,
      promotersUsed: 1,
    }, NOW);
    expect(e.access).toBe("read_only");
    expect(checkBilling(e, "write").allowed).toBe(false);
    expect(checkBilling(e, "read").allowed).toBe(true);
  });
});
