/**
 * State types and idle constants for the "Στείλε πρόσκληση" send action, kept out of
 * `actions.ts` — CLAUDE.md's server/client boundary rule: a `"use server"` module may export
 * only async functions, so a `const` like `SEND_INVITE_IDLE` living there would build fine and
 * then arrive as `undefined` on the client the moment something imports it for a value.
 */
import type { ExtendedBlockReason } from "./data";

export type SendInviteState =
  | { status: "idle" }
  | { status: "sent"; url: string }
  | { status: "manual"; manualBody: string; url: string }
  /** The server re-check found this cannot be sent after all — see `actions.ts`. */
  | { status: "blocked"; reasons: ExtendedBlockReason[] }
  | { status: "error"; reason: "missing_ids" | "not_found" | "blocked_read_only" | "unknown" };

export const SEND_INVITE_IDLE: SendInviteState = { status: "idle" };
