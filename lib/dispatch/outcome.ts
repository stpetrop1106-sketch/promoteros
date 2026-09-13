/**
 * P39 — the vocabulary of a dispatch, and the pure rules over it.
 *
 * No database, no network, no clock except as a parameter. `tests/dispatch.test.ts` covers it.
 */

import type { SendResult } from "@/lib/messaging";

export type DispatchKind = "availability_link" | "checkin_link" | "invitation";
export type DispatchStatus = "pending" | "sent" | "skipped" | "failed";

/** Mirrors the check constraint in `0017_message_dispatches.sql`. */
export type SkipReason = "no_email" | "invalid_email" | "reserved_domain" | "email_not_configured";

export type DispatchKey = {
  agencyId: string;
  promoterId: string;
  kind: DispatchKind;
  periodKey: string;
};

export type DispatchOutcome =
  | { status: "sent"; channel: string; providerMessageId: string | null }
  | { status: "skipped"; channel: string; skipReason: SkipReason }
  | { status: "failed"; channel: string; error: string };

/**
 * An adapter's answer, as a row. Only a real provider acceptance is `sent`; a manual result is
 * `skipped` when the reason is the address (nothing to retry until someone fixes it) and `failed`
 * when the provider refused or could not be reached (worth retrying on a later run).
 */
export function outcomeFromSend(result: SendResult): DispatchOutcome {
  if (result.delivered) {
    return {
      status: "sent",
      channel: result.channel,
      providerMessageId: result.providerMessageId ?? null,
    };
  }

  switch (result.reason) {
    case "no_address":
      return { status: "skipped", channel: result.channel, skipReason: "no_email" };
    case "invalid_address":
      return { status: "skipped", channel: result.channel, skipReason: "invalid_email" };
    case "reserved_domain":
      return { status: "skipped", channel: result.channel, skipReason: "reserved_domain" };
    case "rate_limited":
    case "provider_error":
      return {
        status: "failed",
        channel: result.channel,
        error: redactError(result.error ?? result.reason),
      };
    default:
      // A manual channel answered with no reason: nothing can send unattended. The dispatcher
      // does not start a run in that state, so reaching this is a configuration change mid-run.
      return { status: "skipped", channel: result.channel, skipReason: "email_not_configured" };
  }
}

/** A `pending` row this old belongs to a run that died. 0017 comment, and the engine. */
export const STALE_PENDING_MS = 30 * 60 * 1000;

export type ExistingDispatch = {
  id: string;
  status: DispatchStatus;
  attempts: number;
  updatedAt: string;
};

/**
 * May a later run take over a row that already exists for this (promoter, kind, period)?
 *
 *  - `sent`    never. This is the whole guarantee.
 *  - `skipped` yes — nothing went out; the address may have been fixed since.
 *  - `failed`  yes — the provider did not accept it.
 *  - `pending` only once it is stale: a live run is mid-send, a dead one will never finish. A
 *              resend of a message that did in fact go out carries the same idempotency key
 *              (derived from this row's id), so Resend de-duplicates it within 24 hours.
 *
 * The take-over itself is a conditional update on `attempts` (see the Supabase store), so two runs
 * that both decide "yes" cannot both win.
 */
export function canReclaim(existing: ExistingDispatch, now: Date, staleAfterMs = STALE_PENDING_MS): boolean {
  if (existing.status === "sent") return false;
  if (existing.status === "skipped" || existing.status === "failed") return true;
  const updated = Date.parse(existing.updatedAt);
  if (!Number.isFinite(updated)) return false;
  return now.getTime() - updated >= staleAfterMs;
}

const EMAIL_LIKE = /[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+/g;

/** Errors are stored and shown. No address may ride along in one. */
export function redactError(message: string): string {
  return message.replace(EMAIL_LIKE, "[address]").slice(0, 300);
}

/** The key a provider de-duplicates on. Stable for the life of the row, across re-claims. */
export function idempotencyKeyFor(dispatchId: string): string {
  return `promoteros-dispatch-${dispatchId}`;
}

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------

export type DispatchResult =
  | { result: "sent" }
  | { result: "skipped"; skipReason: SkipReason }
  | { result: "failed" }
  | { result: "already_claimed" }
  | { result: "error" };

export type RunCounts = {
  considered: number;
  sent: number;
  skipped: number;
  skippedNoEmail: number;
  skippedReservedDomain: number;
  failed: number;
  alreadyClaimed: number;
  errors: number;
  /** Recipients the run never reached because its time budget ran out. */
  notStarted: number;
};

export function emptyCounts(): RunCounts {
  return {
    considered: 0,
    sent: 0,
    skipped: 0,
    skippedNoEmail: 0,
    skippedReservedDomain: 0,
    failed: 0,
    alreadyClaimed: 0,
    errors: 0,
    notStarted: 0,
  };
}

export function countResults(results: readonly DispatchResult[], notStarted = 0): RunCounts {
  const counts = emptyCounts();
  counts.considered = results.length + notStarted;
  counts.notStarted = notStarted;
  for (const r of results) {
    switch (r.result) {
      case "sent":
        counts.sent++;
        break;
      case "skipped":
        counts.skipped++;
        if (r.skipReason === "reserved_domain") counts.skippedReservedDomain++;
        else counts.skippedNoEmail++;
        break;
      case "failed":
        counts.failed++;
        break;
      case "already_claimed":
        counts.alreadyClaimed++;
        break;
      case "error":
        counts.errors++;
        break;
    }
  }
  return counts;
}
