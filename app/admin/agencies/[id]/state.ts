import type { AdminErrorCode } from "@/lib/admin/errors";
import type { AgencyActivity } from "@/lib/admin/agencies";

/**
 * Action state for the admin agency screens.
 *
 * These live here rather than in `actions.ts` for the same reason as `app/settings/team/state.ts`:
 * a `"use server"` module may only export async functions, so `ACTIVITY_IDLE` and `MUTATION_IDLE`
 * arrived on the client as `undefined` and `useActionState` started with no state at all.
 *
 * Both imports above are type-only and therefore erased, so `lib/admin/agencies.ts` — which is
 * `server-only` — never reaches the client bundle.
 */
export type ActivityState =
  | { status: "idle" }
  | { status: "loaded"; activity: AgencyActivity }
  | { status: "error"; code: AdminErrorCode };

export const ACTIVITY_IDLE: ActivityState = { status: "idle" };

export type MutationState = {
  status: "idle" | "done" | "error";
  code?: AdminErrorCode;
  value?: string;
};

export const MUTATION_IDLE: MutationState = { status: "idle" };
