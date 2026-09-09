/**
 * The price list.
 *
 * Flat per-agency tiers in EUR, priced from `docs/commercial-architecture.md` §3. Deliberately
 * **not** per active promoter: variable pricing peaks the bill exactly when an agency is busiest
 * and most stressed, and "the same price in December and in August" is the pitch against Ubeya.
 *
 * Two things live here and nowhere else:
 *
 *   1. **What a plan includes.** `seat_limit` and `promoter_limit` on the agency row are the
 *      enforced values — the webhook writes them from this table when a subscription changes,
 *      so an agency downgrading really does lose the seats. This file is the source; the row is
 *      the cache the database can enforce against.
 *   2. **The mapping to Stripe price ids**, which come from the environment and are very often
 *      absent. Nothing here throws when they are: a missing price id means "cannot subscribe to
 *      that tier yet", which the UI renders as a disabled button and an explanation, never as a
 *      crash. See `lib/messaging/index.ts` for the same posture with WhatsApp credentials.
 *
 * No import in this file may pull in `server-only` — the plan table is rendered on the client
 * side of the billing screen too.
 */

export type PlanId = "starter" | "agency" | "multi_brand";

/** Monthly, or annual paid upfront. Greek SMEs expect an annual invoice (§3). */
export type BillingInterval = "month" | "year";

export const PLAN_IDS = ["starter", "agency", "multi_brand"] as const;
export const BILLING_INTERVALS = ["month", "year"] as const;

/**
 * Annual is priced at ten months, i.e. two months free. Kept as a constant rather than a second
 * hardcoded number per tier so the discount cannot drift between tiers.
 */
export const ANNUAL_MONTHS_CHARGED = 10;

export type Plan = {
  id: PlanId;
  /** All money in integer cents (CLAUDE.md conventions). €149 → 14900. */
  monthlyCents: number;
  /** Maximum active staff logins. `null` means unlimited (Multi-brand). */
  seatLimit: number | null;
  /** Maximum non-archived promoters on the roster. */
  promoterLimit: number;
  /**
   * The environment variables holding this tier's Stripe price ids. Names, not values: reading
   * `process.env` at module scope would bake the value into a build and make a key added later
   * invisible until a redeploy.
   */
  priceEnv: Record<BillingInterval, string>;
};

/**
 * `seat_limit`/`promoter_limit` here must stay identical to the defaults in `0011_accounts.sql`
 * for `starter`, which is what a self-serve signup gets before it ever reaches Stripe.
 */
export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: "starter",
    monthlyCents: 14_900,
    seatLimit: 3,
    promoterLimit: 150,
    priceEnv: {
      month: "STRIPE_PRICE_STARTER_MONTHLY",
      year: "STRIPE_PRICE_STARTER_ANNUAL",
    },
  },
  agency: {
    id: "agency",
    monthlyCents: 24_900,
    seatLimit: 10,
    promoterLimit: 500,
    priceEnv: {
      month: "STRIPE_PRICE_AGENCY_MONTHLY",
      year: "STRIPE_PRICE_AGENCY_ANNUAL",
    },
  },
  multi_brand: {
    id: "multi_brand",
    monthlyCents: 49_900,
    seatLimit: null,
    promoterLimit: 1_500,
    priceEnv: {
      month: "STRIPE_PRICE_MULTI_BRAND_MONTHLY",
      year: "STRIPE_PRICE_MULTI_BRAND_ANNUAL",
    },
  },
};

/** Cheapest first. The billing screen renders tiers in this order; so does the upgrade logic. */
export const PLAN_ORDER: readonly PlanId[] = ["starter", "agency", "multi_brand"];

export function isPlanId(value: string | null | undefined): value is PlanId {
  return typeof value === "string" && (PLAN_IDS as readonly string[]).includes(value);
}

export function isBillingInterval(value: string | null | undefined): value is BillingInterval {
  return typeof value === "string" && (BILLING_INTERVALS as readonly string[]).includes(value);
}

/** The plan for a stored `agencies.plan`, falling back to Starter rather than throwing. */
export function planFor(value: string | null | undefined): Plan {
  return isPlanId(value) ? PLANS[value] : PLANS.starter;
}

/** What one interval costs in total, in cents. Annual = ten months, paid upfront. */
export function priceCents(plan: Plan, interval: BillingInterval): number {
  return interval === "year" ? plan.monthlyCents * ANNUAL_MONTHS_CHARGED : plan.monthlyCents;
}

/** What an annual subscription works out to per month — the number the screen compares against. */
export function effectiveMonthlyCents(plan: Plan, interval: BillingInterval): number {
  return interval === "year" ? Math.round(priceCents(plan, "year") / 12) : plan.monthlyCents;
}

/**
 * The Stripe price id for a tier, or null when it has not been created yet.
 *
 * Read at call time, never at import time: an operator who adds the key and restarts should not
 * have to rebuild, and — more importantly — a module-scope read would run during the build,
 * where none of these exist, and bake in `undefined`.
 */
export function priceIdFor(planId: PlanId, interval: BillingInterval): string | null {
  const name = PLANS[planId].priceEnv[interval];
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : null;
}

/**
 * The reverse lookup, used by the webhook: Stripe hands us a price id on the subscription and we
 * have to decide which tier the customer is now on.
 *
 * Returns null for an unrecognised price — a price created in the Stripe dashboard but never put
 * in the environment, say. The webhook treats that as "record the subscription state, leave the
 * plan and its limits alone", which is the safe direction: it never silently downgrades an
 * agency's limits because of a configuration gap.
 */
export function planFromPriceId(
  priceId: string | null | undefined,
): { planId: PlanId; interval: BillingInterval } | null {
  if (!priceId) return null;

  for (const planId of PLAN_ORDER) {
    for (const interval of BILLING_INTERVALS) {
      if (priceIdFor(planId, interval) === priceId) return { planId, interval };
    }
  }

  return null;
}

/** True when at least one price id exists, i.e. anything can actually be bought. */
export function hasAnyPriceConfigured(): boolean {
  return PLAN_ORDER.some((planId) =>
    BILLING_INTERVALS.some((interval) => priceIdFor(planId, interval) !== null),
  );
}

/**
 * Formatted for display. `el-GR` puts the symbol after the amount with a non-breaking space,
 * which is what a Greek reader expects; the locale is passed in so the English UI can differ.
 */
export function formatEur(cents: number, locale: string = "el-GR"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
