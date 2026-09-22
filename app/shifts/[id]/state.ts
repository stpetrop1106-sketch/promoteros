/**
 * State types and their idle constants for the shift board's client islands.
 *
 * Kept out of `actions.ts` on purpose — CLAUDE.md's server/client boundary rule: a `"use server"`
 * module may export only async functions, so a `const` a client component needs to seed
 * `useActionState` cannot live there. Same split as `app/shifts/sections/state.ts`.
 */

export type ResendInvitationState =
  | { status: "idle" }
  | { status: "ready"; url: string; message: string }
  | { status: "error"; reason: string };

export const RESEND_INVITATION_IDLE: ResendInvitationState = { status: "idle" };

export type CancelInvitationState = {
  status: "idle" | "done" | "error";
  reason?: string;
};

export const CANCEL_INVITATION_IDLE: CancelInvitationState = { status: "idle" };
