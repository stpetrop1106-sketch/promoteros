import type { TeamErrorCode } from "@/lib/team";

/**
 * Action state for the invitation-accept form.
 *
 * This lives outside `app/onboarding/join/[token]/actions.ts` deliberately. A module carrying
 * the `"use server"` directive may only export async functions — every other export is replaced
 * by `undefined` on the client rather than rejected at build time. `accept-form.tsx` passes
 * `ACCEPT_IDLE` to `useActionState`, so exporting it from the actions module made the initial
 * state `undefined` and the component crashed on its first render.
 *
 * The type import above is erased at compile time, so nothing pulls `lib/team.ts` into the
 * client bundle on its account.
 *
 * Same failure as `app/waitlist-state.ts` documents. Keep plain values and types here; keep
 * server actions there.
 */
export type AcceptState = {
  status: "idle" | "error";
  code?: TeamErrorCode;
};

export const ACCEPT_IDLE: AcceptState = { status: "idle" };
