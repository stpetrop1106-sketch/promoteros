import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  BILLING_COLUMNS,
  checkBilling,
  entitlementFromRow,
  type AgencyBillingRow,
  type BillingAction,
  type Entitlement,
  type GateResult,
} from "./access";

/**
 * The database half of billing: the two reads, and the write gate built on them.
 *
 * Everything else — what each subscription state means, and which actions it allows — is in
 * `./access.ts`, which is pure and therefore testable. This module re-exports all of it, so
 * `@/lib/billing/subscription` remains the single import every caller already uses.
 */
export * from "./access";

const ALLOWED: GateResult = { allowed: true };


/**
 * Everything the billing screen and every enforcement point needs, for one agency.
 *
 * Read through the RLS-scoped client, so passing another agency's id returns null rather than
 * their subscription — the isolation is Postgres's, not this function's.
 *
 * The limits come from the **agency row**, not from `PLANS[planId]`. The row is what a customer
 * has actually been sold: a plan grandfathered at an old limit, or an extra seat granted by
 * support, must not be silently revoked because this file's table says otherwise. The webhook
 * writes the row from `PLANS` when a subscription changes; from then on the row is the truth.
 */
export async function getEntitlement(agencyId: string): Promise<Entitlement | null> {
  const db = await createServerSupabase();

  const [agencyResult, seatsResult, promotersResult] = await Promise.all([
    db.from("agencies").select(BILLING_COLUMNS).eq("id", agencyId).maybeSingle<AgencyBillingRow>(),
    db.from("app_users").select("id", { count: "exact", head: true }).eq("active", true),
    db.from("promoters").select("id", { count: "exact", head: true }).neq("status", "archived"),
  ]);

  const row = agencyResult.data;
  if (!row) return null;

  return entitlementFromRow(row, {
    seatsUsed: seatsResult.count ?? 0,
    promotersUsed: promotersResult.count ?? 0,
  });
}

// ------------------------------------------------------------------------------------------------
// The write gate, with the "no entitlement" case decided once
// ------------------------------------------------------------------------------------------------

/**
 * Why there is no entitlement, when there is none.
 *
 * `getEntitlement()` collapses two very different situations into `null`, and every caller then
 * wrote `if (entitlement && !checkBilling(...))` — which lets the write through whenever the
 * lookup came back empty (audit A1-06). Today that is latent rather than exploitable: the
 * `own_agency` RLS policy is `id = current_agency_id()`, so a signed-in coordinator always sees
 * their own row, and `requireUser()` has already redirected anyone without one. It matters for
 * the caller that does not exist yet — a cron, a webhook, an admin client — which would bypass
 * billing in silence.
 *
 * The two cases deserve opposite answers:
 *
 *  - **`no_agency`** — the row is not there. A write against an agency that does not exist is
 *    nonsense, so it is refused.
 *  - **`unavailable`** — the lookup itself failed. Refusing here would lock a paying customer out
 *    of their own product because Postgres hiccuped, which is a worse failure than the one this
 *    guard exists to prevent. It is allowed, and said out loud in the server log.
 */
export type EntitlementLookup =
  | { ok: true; entitlement: Entitlement }
  | { ok: false; reason: "no_agency" | "unavailable" };

export async function lookupEntitlement(agencyId: string): Promise<EntitlementLookup> {
  const db = await createServerSupabase();

  const [agencyResult, seatsResult, promotersResult] = await Promise.all([
    db.from("agencies").select(BILLING_COLUMNS).eq("id", agencyId).maybeSingle<AgencyBillingRow>(),
    db.from("app_users").select("id", { count: "exact", head: true }).eq("active", true),
    db.from("promoters").select("id", { count: "exact", head: true }).neq("status", "archived"),
  ]);

  if (agencyResult.error) return { ok: false, reason: "unavailable" };
  if (!agencyResult.data) return { ok: false, reason: "no_agency" };

  return {
    ok: true,
    entitlement: entitlementFromRow(agencyResult.data, {
      seatsUsed: seatsResult.count ?? 0,
      promotersUsed: promotersResult.count ?? 0,
    }),
  };
}

/**
 * May this agency perform this write, right now? The one call a write path should make.
 *
 * Replaces the `entitlement && !checkBilling(...)` idiom everywhere, so the decision about a
 * missing entitlement is made here rather than re-made, differently, at each call site.
 */
export async function checkBillingFor(
  agencyId: string,
  action: BillingAction,
): Promise<GateResult> {
  if (action === "read") return ALLOWED;

  const lookup = await lookupEntitlement(agencyId);
  if (lookup.ok) return checkBilling(lookup.entitlement, action);

  if (lookup.reason === "no_agency") return { allowed: false, block: "subscription_read_only" };

  console.warn(
    `[billing] entitlement lookup failed for agency ${agencyId}; allowing "${action}" rather than locking the customer out`,
  );
  return ALLOWED;
}

