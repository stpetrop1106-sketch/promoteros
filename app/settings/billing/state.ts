/**
 * Action state for the billing screen's checkout / portal buttons.
 *
 * This lives outside `app/settings/billing/actions.ts` deliberately. A module carrying the
 * `"use server"` directive may only export async functions — every other export is replaced by
 * `undefined` on the client rather than rejected at build time. `billing-controls.tsx` passes
 * `BILLING_IDLE` to `useActionState` twice, so exporting it from the actions module made the
 * initial state `undefined` and the component crashed on its first render.
 *
 * Same failure as `app/waitlist-state.ts` documents. Keep plain values and types here; keep
 * server actions there.
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
