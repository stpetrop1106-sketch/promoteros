import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLANS } from "./plans";
import { planFromPriceId } from "./plans";
import type { SubscriptionStatus } from "./subscription";
import {
  priceIdOf,
  retrieveSubscription,
  type StripeSubscription,
} from "./stripe";
import {
  readAgencyId,
  readString,
  readSubscriptionId,
  type StripeEventEnvelope,
} from "./webhook";

/**
 * Applying a verified Stripe event to an agency row.
 *
 * This is the *only* place subscription state is written. It runs on the service role, which
 * bypasses RLS, and it is reached from exactly one caller: `app/api/stripe/webhook/route.ts`,
 * after that route has verified Stripe's signature over the raw body. Nothing else in the
 * codebase may import it — `0012_billing.sql` removes the possibility of a browser session
 * writing these columns at all, and this file is the other half of that rule.
 *
 * Two habits run through everything below:
 *
 *   1. **Stripe is the source of truth, and we re-read it.** Webhook delivery is not ordered: an
 *      `updated` event can arrive after the `deleted` that superseded it. So an event is treated
 *      as a *notification that something changed*, and the state applied comes from a fresh
 *      `GET /v1/subscriptions/:id` wherever possible. The payload is the fallback, not the
 *      source.
 *   2. **Never log a payload.** These objects carry a customer's name, email and address. The
 *      log lines here carry an event id and a type, which is enough to find the row in
 *      `billing_events` — where the payload lives, readable only by that agency.
 */

type AdminClient = ReturnType<typeof createAdminClient>;

export type SyncOutcome =
  /** State written to an agency row. */
  | { result: "applied"; agencyId: string }
  /** A type we do not act on. Recorded, not an error. */
  | { result: "ignored"; agencyId: string | null }
  /** Verified and recorded, but it belongs to no agency we know — usually foreign test traffic. */
  | { result: "unattributed" }
  /** Something downstream failed. The route records this and still answers 200. */
  | { result: "failed"; agencyId: string | null; message: string };

/**
 * Stripe's subscription statuses are a superset of the five values
 * `agencies_subscription_status_check` accepts, so this mapping is what keeps a webhook from
 * failing on a constraint violation:
 *
 * - `unpaid` — Stripe has given up retrying. Still `past_due` for us: §3 says a billing failure
 *   never becomes a lockout, and `canceled` is a stronger claim than Stripe is making.
 * - `incomplete` — the very first payment has not completed. Mapped to `past_due`, so a customer
 *   whose card 3DS challenge failed keeps working while they retry, with a visible banner.
 * - `incomplete_expired` — the first payment never completed and Stripe closed it. Nothing was
 *   ever paid, so `canceled`.
 */
export function mapStripeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "past_due";
    case "paused":
      return "paused";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      // An unknown status is not a reason to change anything drastic. `past_due` shows a banner
      // and keeps access, which is the safe direction for a state we do not understand.
      return "past_due";
  }
}

function isoFromUnix(seconds: number | null | undefined): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

/**
 * Which agency does this event belong to?
 *
 * In order of trustworthiness: the `agency_id` we ourselves put in the metadata at Checkout, the
 * subscription id already on the row, then the customer id. All three are matched against our
 * own table — an id in a payload never becomes an agency id by assertion.
 */
export async function resolveAgencyId(
  db: AdminClient,
  candidates: { agencyId?: string | null; subscriptionId?: string | null; customerId?: string | null },
): Promise<string | null> {
  if (candidates.agencyId) {
    const { data } = await db
      .from("agencies")
      .select("id")
      .eq("id", candidates.agencyId)
      .maybeSingle<{ id: string }>();
    if (data) return data.id;
  }

  if (candidates.subscriptionId) {
    const { data } = await db
      .from("agencies")
      .select("id")
      .eq("stripe_subscription_id", candidates.subscriptionId)
      .maybeSingle<{ id: string }>();
    if (data) return data.id;
  }

  if (candidates.customerId) {
    const { data } = await db
      .from("agencies")
      .select("id")
      .eq("stripe_customer_id", candidates.customerId)
      .maybeSingle<{ id: string }>();
    if (data) return data.id;
  }

  return null;
}

type AgencyStateRow = {
  subscription_status: string | null;
  past_due_since: string | null;
};

type AgencyUpdate = {
  subscription_status: SubscriptionStatus;
  current_period_end: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id?: string;
  past_due_since: string | null;
  plan?: string;
  seat_limit?: number;
  promoter_limit?: number;
};

/**
 * Write one subscription's state onto an agency.
 *
 * `past_due_since` is the only field with memory: it is stamped on the *transition* into
 * `past_due` and cleared on the way out. Re-stamping it on every subsequent `past_due` webhook
 * would silently restart the 14-day grace window each time Stripe retried the card, which turns
 * a two-week grace into an unbounded one.
 *
 * The plan and its limits are written only when the price id is one we recognise. An
 * unrecognised price (created in the dashboard, never added to the environment) leaves the plan
 * alone rather than downgrading an agency because of a configuration gap.
 */
export async function applySubscriptionState(
  db: AdminClient,
  agencyId: string,
  subscription: StripeSubscription,
  options: { customerId?: string | null } = {},
): Promise<void> {
  const status = mapStripeStatus(String(subscription.status));

  const { data: current } = await db
    .from("agencies")
    .select("subscription_status, past_due_since")
    .eq("id", agencyId)
    .maybeSingle<AgencyStateRow>();

  const wasPastDue = current?.subscription_status === "past_due";

  const update: AgencyUpdate = {
    subscription_status: status,
    current_period_end: isoFromUnix(subscription.current_period_end),
    stripe_subscription_id: subscription.id,
    past_due_since:
      status === "past_due"
        ? // Keep the original start if we already had one; otherwise this is the transition.
          ((wasPastDue ? current?.past_due_since : null) ?? new Date().toISOString())
        : null,
  };

  const customerId = options.customerId ?? subscription.customer;
  if (customerId) update.stripe_customer_id = customerId;

  const matched = planFromPriceId(priceIdOf(subscription));
  if (matched) {
    const plan = PLANS[matched.planId];
    update.plan = plan.id;
    // Unlimited seats has to be a number in the column. High enough that no agency reaches it,
    // low enough to stay an honest integer.
    update.seat_limit = plan.seatLimit ?? 9_999;
    update.promoter_limit = plan.promoterLimit;
  }

  const { error } = await db.from("agencies").update(update).eq("id", agencyId);
  if (error) throw new Error(`agency update failed: ${error.message}`);
}

/**
 * Build a `StripeSubscription` from the event payload, for when Stripe cannot be re-read —
 * no secret key configured, or the API call failed. Weaker than a fresh read, and used only as
 * a fallback so that a webhook is never simply dropped.
 */
function subscriptionFromPayload(object: Record<string, unknown>): StripeSubscription | null {
  const id = readString(object, "id");
  const status = object["status"];
  if (!id || typeof status !== "string") return null;

  const periodEnd = object["current_period_end"];
  const items = object["items"];

  return {
    id,
    status,
    customer: readString(object, "customer"),
    current_period_end: typeof periodEnd === "number" ? periodEnd : null,
    cancel_at_period_end:
      typeof object["cancel_at_period_end"] === "boolean"
        ? (object["cancel_at_period_end"] as boolean)
        : null,
    items: items && typeof items === "object" ? (items as StripeSubscription["items"]) : undefined,
  };
}

/**
 * Apply one verified event.
 *
 * Called only after the event has been recorded in `billing_events`, so a throw here becomes a
 * recorded failure and a 200, never a retry storm.
 */
export async function handleStripeEvent(envelope: StripeEventEnvelope): Promise<SyncOutcome> {
  const object = envelope.data.object;
  const type = envelope.type;

  const db = createAdminClient();

  const customerId = readString(object, "customer");
  const subscriptionId = readSubscriptionId(type, object);
  const metadataAgencyId = readAgencyId(object);

  const agencyId = await resolveAgencyId(db, {
    agencyId: metadataAgencyId,
    subscriptionId,
    customerId,
  });

  if (!agencyId) return { result: "unattributed" };

  try {
    switch (type) {
      case "checkout.session.completed": {
        // The customer id is worth storing even if the rest fails: it is what makes the Billing
        // Portal reachable, which is how a customer fixes most problems without us.
        if (customerId) {
          await db.from("agencies").update({ stripe_customer_id: customerId }).eq("id", agencyId);
        }
        if (!subscriptionId) return { result: "ignored", agencyId };
        await syncFromStripe(db, agencyId, subscriptionId, object, customerId);
        return { result: "applied", agencyId };
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        if (!subscriptionId) return { result: "ignored", agencyId };
        await syncFromStripe(db, agencyId, subscriptionId, object, customerId);
        return { result: "applied", agencyId };
      }

      case "customer.subscription.deleted": {
        // Terminal and unambiguous, so it is applied from the event rather than re-read: a
        // deleted subscription may already be gone from the API.
        const { error } = await db
          .from("agencies")
          .update({
            subscription_status: "canceled",
            past_due_since: null,
            current_period_end: isoFromUnix(
              typeof object["current_period_end"] === "number"
                ? (object["current_period_end"] as number)
                : null,
            ),
          })
          .eq("id", agencyId);
        if (error) throw new Error(`agency update failed: ${error.message}`);

        // The row keeps `stripe_customer_id` and `stripe_subscription_id`: the customer's
        // invoices stay reachable through the portal, and re-subscribing reuses the customer.
        // And we never delete a customer's data for non-payment (§3).
        return { result: "applied", agencyId };
      }

      case "invoice.paid":
      case "invoice.payment_failed": {
        if (!subscriptionId) return { result: "ignored", agencyId };

        const fresh = await retrieveSubscription(subscriptionId);
        if (fresh.ok) {
          await applySubscriptionState(db, agencyId, fresh.data, { customerId });
          return { result: "applied", agencyId };
        }

        // Could not re-read (no key, or Stripe unreachable). A failed payment must still become
        // visible to the customer, so it is applied from the event — in the gentle direction:
        // `past_due` keeps full access for 14 days and raises a banner.
        if (type === "invoice.payment_failed") {
          const { data: current } = await db
            .from("agencies")
            .select("subscription_status, past_due_since")
            .eq("id", agencyId)
            .maybeSingle<AgencyStateRow>();

          const { error } = await db
            .from("agencies")
            .update({
              subscription_status: "past_due",
              past_due_since:
                current?.subscription_status === "past_due" && current.past_due_since
                  ? current.past_due_since
                  : new Date().toISOString(),
            })
            .eq("id", agencyId);
          if (error) throw new Error(`agency update failed: ${error.message}`);
          return { result: "applied", agencyId };
        }

        return {
          result: "failed",
          agencyId,
          message: `invoice.paid could not be applied: ${fresh.error.code} ${fresh.error.message}`,
        };
      }

      default:
        return { result: "ignored", agencyId };
    }
  } catch (cause) {
    return {
      result: "failed",
      agencyId,
      message: cause instanceof Error ? cause.message : "unknown failure",
    };
  }
}

/** Re-read the subscription and apply it; fall back to the payload when the API is unavailable. */
async function syncFromStripe(
  db: AdminClient,
  agencyId: string,
  subscriptionId: string,
  object: Record<string, unknown>,
  customerId: string | null,
): Promise<void> {
  const fresh = await retrieveSubscription(subscriptionId);
  if (fresh.ok) {
    await applySubscriptionState(db, agencyId, fresh.data, { customerId });
    return;
  }

  const fallback = subscriptionFromPayload(object);
  if (fallback) {
    await applySubscriptionState(db, agencyId, fallback, { customerId });
    return;
  }

  throw new Error(
    `could not read subscription ${subscriptionId}: ${fresh.error.code} ${fresh.error.message}`,
  );
}
