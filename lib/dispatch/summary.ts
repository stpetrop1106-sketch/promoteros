/**
 * P39 — what /settings/messaging shows, computed from rows. PURE; `tests/dispatch.test.ts`.
 */

import { checkEmailAddress } from "@/lib/messaging/email-address";
import { isRunPeriodKey } from "./period";
import type { DispatchStatus, SkipReason } from "./outcome";

export type DispatchRow = {
  promoter_id: string;
  period_key: string;
  status: DispatchStatus;
  skip_reason: SkipReason | null;
  created_at: string;
  updated_at: string;
};

export type LastRun = {
  periodKey: string;
  manual: boolean;
  /** The most recent moment any row of that run changed. */
  at: string;
  sent: number;
  skippedNoEmail: number;
  skippedReservedDomain: number;
  failed: number;
  pending: number;
};

/**
 * The most recent run (cron or "send now", never the welcome) and its counts. "Most recent" is by
 * the run's first row, so a straggler re-claimed into an older period does not hide a newer run.
 */
export function lastRunFrom(rows: readonly DispatchRow[]): LastRun | null {
  const runRows = rows.filter((r) => isRunPeriodKey(r.period_key));
  if (runRows.length === 0) return null;

  const started = new Map<string, string>();
  for (const r of runRows) {
    const prev = started.get(r.period_key);
    if (!prev || r.created_at < prev) started.set(r.period_key, r.created_at);
  }

  let latestKey = "";
  let latestStart = "";
  for (const [key, at] of started) {
    if (at > latestStart) {
      latestStart = at;
      latestKey = key;
    }
  }

  const run: LastRun = {
    periodKey: latestKey,
    manual: latestKey.startsWith("manual-"),
    at: latestStart,
    sent: 0,
    skippedNoEmail: 0,
    skippedReservedDomain: 0,
    failed: 0,
    pending: 0,
  };

  for (const r of runRows) {
    if (r.period_key !== latestKey) continue;
    if (r.updated_at > run.at) run.at = r.updated_at;
    if (r.status === "sent") run.sent++;
    else if (r.status === "failed") run.failed++;
    else if (r.status === "pending") run.pending++;
    else if (r.skip_reason === "reserved_domain") run.skippedReservedDomain++;
    else run.skippedNoEmail++;
  }

  return run;
}

/** Promoters whose most recent availability message (any period) failed at the provider. */
export function latestFailedPromoters(rows: readonly DispatchRow[]): Set<string> {
  const latest = new Map<string, DispatchRow>();
  for (const r of rows) {
    const prev = latest.get(r.promoter_id);
    if (!prev || r.updated_at > prev.updated_at) latest.set(r.promoter_id, r);
  }
  const failed = new Set<string>();
  for (const [id, r] of latest) if (r.status === "failed") failed.add(id);
  return failed;
}

/** How many of this key's rows are already `sent` — what a repeat "send now" will not resend. */
export function sentCount(rows: readonly DispatchRow[], periodKey: string): number {
  return rows.filter((r) => r.period_key === periodKey && r.status === "sent").length;
}

export type UnreachableReason =
  | "email_not_configured"
  | "no_email"
  | "invalid_email"
  | "reserved_domain"
  | "last_send_failed";

/**
 * Why the automation cannot reach this promoter right now, or null when it can. Order matters: a
 * configuration problem explains everyone, an address problem explains one person, and a failed
 * send is only interesting when the address itself is fine.
 */
export function unreachableReason(
  email: string | null,
  emailConfigured: boolean,
  lastSendFailed: boolean,
): UnreachableReason | null {
  if (!emailConfigured) return "email_not_configured";
  const check = checkEmailAddress(email);
  if (!check.ok) {
    return check.reason === "missing"
      ? "no_email"
      : check.reason === "invalid"
        ? "invalid_email"
        : "reserved_domain";
  }
  return lastSendFailed ? "last_send_failed" : null;
}
