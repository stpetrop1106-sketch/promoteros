/**
 * Action states for /settings/messaging.
 *
 * Here and not in `actions.ts`: a `"use server"` module may export only async functions, and an
 * `*_IDLE` constant exported from one reaches `useActionState` as `undefined` (CLAUDE.md, "the
 * server/client boundary"). Plain types and plain objects — nothing server-only is imported.
 */

export type MessagingErrorCode =
  | "not_owner"
  /** A1-05 — the subscription is read-only, so this write is refused. */
  | "subscription_read_only"
  | "migration_missing"
  | "email_not_configured"
  | "write_not_permitted"
  | "unknown";

export type AutoSwitchState =
  | { status: "idle" }
  | { status: "saved"; enabled: boolean }
  | { status: "error"; code: MessagingErrorCode };

export const AUTO_SWITCH_IDLE: AutoSwitchState = { status: "idle" };

export type SendNowState =
  | { status: "idle" }
  | { status: "started"; recipients: number }
  | { status: "error"; code: MessagingErrorCode };

export const SEND_NOW_IDLE: SendNowState = { status: "idle" };
