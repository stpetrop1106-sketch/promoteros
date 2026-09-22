import { PLANS, planFor, type Plan, type PlanId } from "./plans";

/**
 * The billing rules themselves: what a subscription state means, and what it allows.
 *
 * Split out of `subscription.ts` because that module is `server-only` — it reads the database —
 * and `server-only` throws the moment anything imports it outside a server component, including a
 * test runner. So the promise in docs/commercial-architecture.md §3 that a cancelled subscription
 * drops an agency to read-only after a grace period had **no test at all**, not because it was
 * thought unimportant but because it was unreachable. `lib/retention.ts` already made exactly this
 * split for the erasure rules, and for the same stated reason: a bug in here decides whether a
 * paying customer can work.
 *
 * PURE. Nothing below touches Supabase, the network, or the clock — `now` is always a parameter.
 * The two functions that read the database stay in `subscription.ts`, which re-exports everything
 * here so no existing import has to change.
 */


/**
 * What an agency is entitled to, and — the part that matters — **what happens when it is not
 * entitled to anything any more.**
 *
 * Every enforcement decision in the product is made by `evaluateAccess()` below and nowhere
 * else. That is not tidiness: an access rule copied into a page, a server action and a
 * middleware drifts, and the direction it drifts is unpredictable. One of the three ends up
 * locking a coordinator out of a shift board at 08:40 with promoters standing in stores, which
 * turns our billing problem into their client's incident. That is the failure this file exists
 * to make impossible.
 *
 * The policy, from `docs/commercial-architecture.md` §3:
 *
 * | State | Access |
 * |---|---|
 * | `trialing`, `active` | Full |
 * | `past_due` | **Full, for 14 days**, with a banner. Dunning is deliberately gentle |
 * | `paused` | Read-only plus export |
 * | `canceled` | Read-only plus export. **We never delete a customer's data for non-payment** |
 * | Over seat / promoter limit | Blocks *adding more*. Never blocks using what already exists |
 *
 * Read the last row twice. An agency at 151 promoters on a 150 plan can still run every shift it
 * has; it just cannot add promoter 152. A limit that retroactively disabled existing data would
 * be a data-loss event dressed as an upsell.
 */

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "paused";

const STATUSES: readonly SubscriptionStatus[] = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "paused",
];

export function isSubscriptionStatus(value: string | null | undefined): value is SubscriptionStatus {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

/**
 * Grace after a failed payment, and after a trial runs out. Fourteen days is the number in §3
 * and it is chosen to be longer than a campaign, so no shift is ever half-run when access
 * changes.
 */
export const BILLING_GRACE_DAYS = 14;

/** How close to the end of a trial the screen starts saying so. */
export const TRIAL_WARNING_DAYS = 3;

export type AccessLevel =
  /** Everything works. */
  | "full"
  /** Everything still works, and the customer is being told something is wrong. */
  | "grace"
  /** Reads and exports only. Nothing is deleted, ever. */
  | "read_only";

/**
 * Why the banner is up. One kind, one sentence, in both locales — never a generic warning.
 * `null` is the normal, quiet state.
 */
export type BillingNotice =
  | "trial_ending"
  | "trial_expired"
  | "past_due"
  | "grace_ending"
  | "read_only_unpaid"
  | "paused"
  | "canceled";

export type AccessDecision = {
  access: AccessLevel;
  notice: BillingNotice | null;
  /** When grace runs out and access drops to read-only. Null when not in grace. */
  graceEndsAt: Date | null;
  /** Whole days left of grace, rounded up. 0 on the last day. */
  graceDaysRemaining: number | null;
  /** Whole days until the trial ends. Negative once it has passed, null when there is no trial. */
  trialDaysRemaining: number | null;
};

const DAY_MS = 86_400_000;

function daysUntil(target: Date, now: Date): number {
  return Math.ceil((target.getTime() - now.getTime()) / DAY_MS);
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The single access rule. Pure, so it can be unit-tested against every state without a database.
 *
 * Deliberate choices worth knowing before changing one:
 *
 * - **An expired trial gets the same 14-day grace as a failed card.** §3 specifies the dunning
 *   window for `past_due` and does not say what an unconverted trial gets. Treating it as the
 *   harsher case would mean a customer who forgot to subscribe loses access the morning after,
 *   which is the exact scenario the gentle-dunning rule exists to prevent. Fourteen days, a
 *   banner, then read-only — never deletion.
 * - **`paused` is read-only rather than blocked.** Pausing is usually deliberate (Stripe's pause
 *   collection); the customer's data stays theirs and stays visible.
 * - **Read-only is never a lockout.** Nothing here can produce "no access". The lowest level
 *   still reads and exports, because §4 makes export a right the customer exercises without us.
 */
export function evaluateAccess(input: {
  status: SubscriptionStatus;
  trialEndsAt?: string | Date | null;
  pastDueSince?: string | Date | null;
  currentPeriodEnd?: string | Date | null;
  now?: Date;
}): AccessDecision {
  const now = input.now ?? new Date();
  const trialEndsAt = toDate(input.trialEndsAt);
  const trialDaysRemaining = trialEndsAt ? daysUntil(trialEndsAt, now) : null;

  switch (input.status) {
    case "active":
      return { access: "full", notice: null, graceEndsAt: null, graceDaysRemaining: null, trialDaysRemaining };

    case "trialing": {
      // No trial clock at all (a row that predates 0011's backfill): treat as full access rather
      // than inventing an expiry the customer was never told about.
      if (!trialEndsAt) {
        return { access: "full", notice: null, graceEndsAt: null, graceDaysRemaining: null, trialDaysRemaining };
      }

      if (trialEndsAt.getTime() > now.getTime()) {
        return {
          access: "full",
          notice:
            trialDaysRemaining !== null && trialDaysRemaining <= TRIAL_WARNING_DAYS
              ? "trial_ending"
              : null,
          graceEndsAt: null,
          graceDaysRemaining: null,
          trialDaysRemaining,
        };
      }

      return graceFrom(trialEndsAt, now, "trial_expired", trialDaysRemaining);
    }

    case "past_due": {
      // `past_due_since` is written by the webhook on the transition. The period end is the
      // fallback for a row that went past_due before 0012 was applied; `now` is the last resort,
      // and it errs towards giving the customer the full window rather than none of it.
      const start = toDate(input.pastDueSince) ?? toDate(input.currentPeriodEnd) ?? now;
      return graceFrom(start, now, "past_due", trialDaysRemaining);
    }

    case "paused":
      return {
        access: "read_only",
        notice: "paused",
        graceEndsAt: null,
        graceDaysRemaining: null,
        trialDaysRemaining,
      };

    case "canceled":
      return {
        access: "read_only",
        notice: "canceled",
        graceEndsAt: null,
        graceDaysRemaining: null,
        trialDaysRemaining,
      };
  }
}

function graceFrom(
  start: Date,
  now: Date,
  notice: Extract<BillingNotice, "past_due" | "trial_expired">,
  trialDaysRemaining: number | null,
): AccessDecision {
  const graceEndsAt = new Date(start.getTime() + BILLING_GRACE_DAYS * DAY_MS);
  const graceDaysRemaining = Math.max(0, daysUntil(graceEndsAt, now));

  if (graceEndsAt.getTime() <= now.getTime()) {
    return {
      access: "read_only",
      notice: "read_only_unpaid",
      graceEndsAt,
      graceDaysRemaining: 0,
      trialDaysRemaining,
    };
  }

  return {
    access: "grace",
    // The last three days get their own, louder sentence.
    notice: graceDaysRemaining <= 3 ? "grace_ending" : notice,
    graceEndsAt,
    graceDaysRemaining,
    trialDaysRemaining,
  };
}

// ---------------------------------------------------------------------------
// Entitlement — the access decision plus what the agency is actually using
// ---------------------------------------------------------------------------

export type Entitlement = {
  agencyId: string;
  agencyName: string;
  plan: Plan;
  planId: PlanId;
  status: SubscriptionStatus;

  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  pastDueSince: string | null;
  /** Whether this agency has ever reached Stripe. Null means "never subscribed". */
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;

  /** The enforced limits, read from the agency row rather than from `PLANS` — see below. */
  seatLimit: number;
  promoterLimit: number;
  seatsUsed: number;
  promotersUsed: number;
  overSeatLimit: boolean;
  overPromoterLimit: boolean;

  access: AccessLevel;
  notice: BillingNotice | null;
  graceEndsAt: string | null;
  graceDaysRemaining: number | null;
  trialDaysRemaining: number | null;
};

export type AgencyBillingRow = {
  id: string;
  name: string;
  plan: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  past_due_since: string | null;
  seat_limit: number | null;
  promoter_limit: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

export const BILLING_COLUMNS =
  "id, name, plan, subscription_status, trial_ends_at, current_period_end, past_due_since, " +
  "seat_limit, promoter_limit, stripe_customer_id, stripe_subscription_id";

/** Same fallbacks as `lib/team.ts`: never fail open on a limit. */
const FALLBACK_SEAT_LIMIT = 3;
const FALLBACK_PROMOTER_LIMIT = 150;


/**
 * The pure half of `getEntitlement`, split out so the shape can be built from a row that was
 * read somewhere else (the webhook has one in hand, and a test has one made up).
 */
export function entitlementFromRow(
  row: AgencyBillingRow,
  usage: { seatsUsed: number; promotersUsed: number },
  now: Date = new Date(),
): Entitlement {
  const plan = planFor(row.plan);
  const status: SubscriptionStatus = isSubscriptionStatus(row.subscription_status)
    ? row.subscription_status
    : "trialing";

  const decision = evaluateAccess({
    status,
    trialEndsAt: row.trial_ends_at,
    pastDueSince: row.past_due_since,
    currentPeriodEnd: row.current_period_end,
    now,
  });

  const seatLimit = row.seat_limit ?? FALLBACK_SEAT_LIMIT;
  const promoterLimit = row.promoter_limit ?? FALLBACK_PROMOTER_LIMIT;

  return {
    agencyId: row.id,
    agencyName: row.name,
    plan,
    planId: plan.id,
    status,
    trialEndsAt: row.trial_ends_at,
    currentPeriodEnd: row.current_period_end,
    pastDueSince: row.past_due_since,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    seatLimit,
    promoterLimit,
    seatsUsed: usage.seatsUsed,
    promotersUsed: usage.promotersUsed,
    overSeatLimit: usage.seatsUsed >= seatLimit,
    overPromoterLimit: usage.promotersUsed >= promoterLimit,
    access: decision.access,
    notice: decision.notice,
    graceEndsAt: decision.graceEndsAt?.toISOString() ?? null,
    graceDaysRemaining: decision.graceDaysRemaining,
    trialDaysRemaining: decision.trialDaysRemaining,
  };
}

// ---------------------------------------------------------------------------
// The gate other parcels call
// ---------------------------------------------------------------------------

export type BillingAction =
  /** Looking at data, and exporting it. Always allowed. */
  | "read"
  /** Any change to operational data: create a shift, send an invitation, edit a campaign. */
  | "write"
  /** Inviting or activating a staff login. Consumes a seat. */
  | "add_staff"
  /** Adding a promoter to the roster. Consumes a promoter slot. */
  | "add_promoter";

export type BillingBlock =
  | "subscription_read_only"
  | "seat_limit_reached"
  | "promoter_limit_reached";

export type GateResult = { allowed: true } | { allowed: false; block: BillingBlock };

const ALLOWED: GateResult = { allowed: true };

/**
 * May this agency do this, right now?
 *
 * The one function every caller should use. Reading is never blocked; writing is blocked only
 * once grace has actually run out; the limits block growth and nothing else.
 */
export function checkBilling(entitlement: Entitlement, action: BillingAction): GateResult {
  if (action === "read") return ALLOWED;

  if (entitlement.access === "read_only") {
    return { allowed: false, block: "subscription_read_only" };
  }

  if (action === "add_staff" && entitlement.overSeatLimit) {
    return { allowed: false, block: "seat_limit_reached" };
  }

  if (action === "add_promoter" && entitlement.overPromoterLimit) {
    return { allowed: false, block: "promoter_limit_reached" };
  }

  return ALLOWED;
}

/** True when the customer should see a banner. The banner text is keyed off `notice`. */
export function shouldShowBanner(entitlement: Entitlement): boolean {
  return entitlement.notice !== null;
}

/**
 * The limits a plan carries, for the upgrade table on the billing screen. Reads from `PLANS`
 * rather than the agency row on purpose: this is what the customer would be buying.
 */
export function limitsFor(planId: PlanId): { seatLimit: number | null; promoterLimit: number } {
  const plan = PLANS[planId];
  return { seatLimit: plan.seatLimit, promoterLimit: plan.promoterLimit };
}

