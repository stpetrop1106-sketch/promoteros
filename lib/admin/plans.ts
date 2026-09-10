/**
 * Plan values the admin console's client components need.
 *
 * `lib/admin/agencies.ts` is `server-only`, so importing `ASSIGNABLE_PLANS` from it in
 * `actions-panel.tsx` pulled the server module into the client bundle and failed the production
 * build. Shared values live here; the cross-tenant queries stay where they are.
 */
export const ASSIGNABLE_PLANS = ["starter", "agency", "multi_brand"] as const;
export type AssignablePlan = (typeof ASSIGNABLE_PLANS)[number];

export function isAssignablePlan(value: string): value is AssignablePlan {
  return (ASSIGNABLE_PLANS as readonly string[]).includes(value);
}
