"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ownerContext } from "@/lib/team";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEntitlement } from "@/lib/billing/subscription";
import { isBillingInterval, isPlanId, priceIdFor } from "@/lib/billing/plans";
import {
  createBillingPortalSession,
  createCheckoutSession,
  createCustomer,
  isConfigured,
} from "@/lib/billing/stripe";

/**
 * The two buttons on the billing screen: "subscribe / change plan" and "manage billing".
 *
 * Both end in a redirect to a Stripe-hosted page. That is the whole design
 * (`docs/commercial-architecture.md` §3): **card details never touch our servers**, so there is
 * no card form in this repo and there must never be one. Cancellation, invoices, VAT id and card
 * updates are the Billing Portal's job, which is also why §4 lists them as things the customer
 * does without asking us.
 *
 * Every action re-derives the caller as an owner from the database (`ownerContext()`), exactly
 * like the team actions. A server action is a public HTTP endpoint; the fact that the page hides
 * the button from a coordinator stops a mistake, not an attacker.
 *
 * Note what is *not* gated: subscribing works in every subscription state, including read-only.
 * Paying is how a customer leaves read-only, so blocking the payment path when access is
 * restricted would be a trap with no way out.
 */

export type BillingErrorCode =
  | "not_owner"
  | "no_agency"
  | "not_configured"
  | "price_missing"
  | "plan_invalid"
  | "no_customer"
  | "stripe_unavailable"
  | "unknown";

export type BillingActionState = {
  status: "idle" | "error";
  code?: BillingErrorCode;
};

export const BILLING_IDLE: BillingActionState = { status: "idle" };

function fail(code: BillingErrorCode): BillingActionState {
  return { status: "error", code };
}

/** The public origin. Stripe needs absolute URLs to send the browser back to. */
function appOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Start a Checkout session for a tier.
 *
 * The Stripe customer is created lazily, on the first attempt to subscribe, rather than at
 * signup: an agency that never subscribes should not exist in Stripe at all, and creating a
 * customer per trial would fill the dashboard with rows that never become anything.
 */
export async function startCheckout(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const user = await requireUser();
  const owner = await ownerContext();
  if (!owner) return fail("not_owner");

  const planId = String(formData.get("plan") ?? "");
  const interval = String(formData.get("interval") ?? "month");
  if (!isPlanId(planId) || !isBillingInterval(interval)) return fail("plan_invalid");

  if (!isConfigured()) return fail("not_configured");

  const priceId = priceIdFor(planId, interval);
  if (!priceId) return fail("price_missing");

  const entitlement = await getEntitlement(owner.agencyId);
  if (!entitlement) return fail("no_agency");

  let customerId = entitlement.stripeCustomerId;

  if (!customerId) {
    const created = await createCustomer({
      agencyId: owner.agencyId,
      name: entitlement.agencyName,
      email: user.email,
    });
    if (!created.ok) return fail("stripe_unavailable");
    customerId = created.data.id;

    // Written on the service role because `0012_billing.sql` denies `authenticated` any write to
    // `agencies` — the same rule that stops a customer granting themselves a subscription. This
    // is a narrow, owner-gated exception writing one identifier, and it is stored before the
    // redirect so a customer who abandons Checkout and returns does not get a second customer.
    const db = createAdminClient();
    const { error } = await db
      .from("agencies")
      .update({ stripe_customer_id: customerId })
      .eq("id", owner.agencyId);
    if (error) return fail("unknown");
  }

  const trialEndsAt = entitlement.trialEndsAt ? new Date(entitlement.trialEndsAt) : null;
  const trialEnd =
    trialEndsAt && !Number.isNaN(trialEndsAt.getTime())
      ? Math.floor(trialEndsAt.getTime() / 1000)
      : null;

  const session = await createCheckoutSession({
    customerId,
    priceId,
    agencyId: owner.agencyId,
    successUrl: `${appOrigin()}/settings/billing?checkout=success`,
    cancelUrl: `${appOrigin()}/settings/billing?checkout=cancelled`,
    // An unfinished free trial is carried into the paid subscription rather than cut short. A
    // customer who subscribes on day 3 of 14 keeps the other 11 days.
    trialEnd,
  });

  if (!session.ok) return fail("stripe_unavailable");
  if (!session.data.url) return fail("stripe_unavailable");

  // `redirect` throws to unwind, so nothing after it runs. It must stay outside any try/catch.
  // The cast is because `typedRoutes` types this parameter as one of *our* routes; the
  // destination here is deliberately an absolute Stripe URL, which no route type can describe.
  redirect(session.data.url as Route);
}

/**
 * Send the owner to the Billing Portal: card, invoices, VAT id, cancellation.
 *
 * There is no cancel button in our UI, deliberately. Cancellation there is Stripe's flow, with
 * Stripe's confirmation and Stripe's record of it — one less irreversible action for us to get
 * wrong, and it satisfies §4's "anything they can do themselves is support we do not provide".
 */
export async function openBillingPortal(
  _prev: BillingActionState,
  _formData: FormData,
): Promise<BillingActionState> {
  const owner = await ownerContext();
  if (!owner) return fail("not_owner");

  if (!isConfigured()) return fail("not_configured");

  const entitlement = await getEntitlement(owner.agencyId);
  if (!entitlement) return fail("no_agency");
  if (!entitlement.stripeCustomerId) return fail("no_customer");

  const session = await createBillingPortalSession({
    customerId: entitlement.stripeCustomerId,
    returnUrl: `${appOrigin()}/settings/billing`,
  });

  if (!session.ok) return fail("stripe_unavailable");

  redirect(session.data.url as Route);
}
