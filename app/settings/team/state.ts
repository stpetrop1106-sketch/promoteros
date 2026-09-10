import type { TeamErrorCode } from "@/lib/team";

/**
 * Action state for the team screens.
 *
 * These live here rather than in `actions.ts` because that file carries the `"use server"`
 * directive, and such a module may only export async functions — every other export is replaced
 * by `undefined` on the client rather than rejected at build time. `team-controls.tsx` passes
 * `INVITE_IDLE` to `useActionState`, so exporting it from the actions module made the initial
 * state `undefined` and the component crashed on its first render.
 *
 * The type import above is erased at compile time, so nothing pulls `lib/team.ts` — which is
 * `server-only` — into the client bundle.
 *
 * Same failure as `app/waitlist-state.ts` documents. Keep plain values and types here; keep
 * server actions there.
 */
export type InviteState = {
  status: "idle" | "sent" | "error";
  /** The link to send. Shown because staff invitations have no mail transport yet — see P19 notes. */
  url?: string;
  email?: string;
  code?: TeamErrorCode;
};

export const INVITE_IDLE: InviteState = { status: "idle" };

export type MutationState = {
  status: "idle" | "done" | "error";
  code?: TeamErrorCode;
  /** Which row the message belongs to, so the list can render it in place. */
  targetId?: string;
};

export const MUTATION_IDLE: MutationState = { status: "idle" };
