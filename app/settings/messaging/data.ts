import "server-only";
import { requireUser } from "@/lib/auth";
import { ownerContext } from "@/lib/team";
import { createServerSupabase } from "@/lib/supabase/server";
import { automaticDeliveryConfigured } from "@/lib/messaging";
import { missingEmailEnv } from "@/lib/messaging/email";
import { checkEmailAddress } from "@/lib/messaging/email-address";
import { availabilityMessage, manualText } from "@/lib/dispatch/messages";
import { manualPeriodKey, nextAvailabilityDate } from "@/lib/dispatch/period";
import {
  lastRunFrom,
  latestFailedPromoters,
  sentCount,
  unreachableReason,
  type DispatchRow,
  type LastRun,
  type UnreachableReason,
} from "@/lib/dispatch/summary";

/**
 * The data behind /settings/messaging. Read through the RLS-scoped client only — 0017 grants the
 * dispatch log to `authenticated` for SELECT, scoped to the caller's agency, and that is all this
 * screen needs. The only privileged thing that happens here is minting links (an HMAC over a
 * promoter id the RLS read already proved belongs to this agency).
 */

const PAGE_SIZE = 1000;
/** Long enough to cover the last scheduled run (at most 16 days ago) and its welcome sends. */
const LOOKBACK_DAYS = 17;

export type UnreachablePromoter = {
  id: string;
  fullName: string;
  phone: string;
  reason: UnreachableReason;
  url: string;
  message: string;
};

export type MessagingSettings = {
  agencyName: string;
  isOwner: boolean;
  emailConfigured: boolean;
  missingEnv: string[];
  /** False until 0017 is applied: no switch column, no log table. */
  migrationApplied: boolean;
  autoEnabled: boolean;
  nextRunDate: string;
  lastRun: LastRun | null;
  activeCount: number;
  /** Active promoters with a usable address — who "send now" is for. */
  reachableCount: number;
  /** Of those, already sent today by an earlier "send now". */
  alreadySentToday: number;
  unreachable: UnreachablePromoter[];
};

type PromoterRow = { id: string; full_name: string; phone: string; email: string | null };

export async function loadMessagingSettings(now: Date = new Date()): Promise<MessagingSettings> {
  const user = await requireUser();
  const db = await createServerSupabase();
  const owner = await ownerContext();

  let migrationApplied = true;
  let agencyName = "";
  let autoEnabled = true;

  const withSwitch = await db
    .from("agencies")
    .select("name, auto_availability_links")
    .eq("id", user.agencyId)
    .maybeSingle<{ name: string; auto_availability_links: boolean }>();

  if (withSwitch.error) {
    migrationApplied = false;
    const plain = await db
      .from("agencies")
      .select("name")
      .eq("id", user.agencyId)
      .maybeSingle<{ name: string }>();
    agencyName = plain.data?.name ?? "";
  } else {
    agencyName = withSwitch.data?.name ?? "";
    autoEnabled = withSwitch.data?.auto_availability_links ?? true;
  }

  const since = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000).toISOString();
  const rows: DispatchRow[] = [];
  if (migrationApplied) {
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await db
        .from("message_dispatches")
        .select("promoter_id, period_key, status, skip_reason, created_at, updated_at")
        .eq("kind", "availability_link")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        migrationApplied = false;
        break;
      }
      const page = (data ?? []) as DispatchRow[];
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
  }

  const promoters: PromoterRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db
      .from("promoters")
      .select("id, full_name, phone, email")
      .eq("status", "active")
      .order("full_name")
      .range(from, from + PAGE_SIZE - 1);
    if (error) break;
    const page = (data ?? []) as PromoterRow[];
    promoters.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  const emailConfigured = automaticDeliveryConfigured();
  const failed = latestFailedPromoters(rows);

  const unreachable: UnreachablePromoter[] = [];
  let reachableCount = 0;

  for (const p of promoters) {
    if (checkEmailAddress(p.email).ok) reachableCount++;

    const reason = unreachableReason(p.email, emailConfigured, failed.has(p.id));
    if (!reason) continue;

    const message = availabilityMessage(
      { id: p.id, fullName: p.full_name, phone: p.phone, email: p.email },
      "periodic",
      agencyName || null,
    );
    unreachable.push({
      id: p.id,
      fullName: p.full_name,
      phone: p.phone,
      reason,
      url: message.url,
      message: manualText(message),
    });
  }

  return {
    agencyName,
    isOwner: owner !== null,
    emailConfigured,
    missingEnv: missingEmailEnv(),
    migrationApplied,
    autoEnabled,
    nextRunDate: nextAvailabilityDate(now),
    lastRun: lastRunFrom(rows),
    activeCount: promoters.length,
    reachableCount,
    alreadySentToday: sentCount(rows, manualPeriodKey(now)),
    unreachable,
  };
}
