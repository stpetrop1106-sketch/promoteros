import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import { adminErrorCode, type AdminErrorCode } from "@/lib/admin/errors";

/**
 * Every read and write this file exposes calls a named SECURITY DEFINER function in
 * `0013_admin.sql`, never a bare `.from(...)` query. `agencies`, `app_users`, `promoters`,
 * `campaigns` and `shifts` are all tenant-scoped by RLS, and a platform admin belongs to no
 * tenant — `current_agency_id()` is null for them, so every ordinary policy denies everything.
 * The functions are how the console legitimately sees across agencies; there is deliberately no
 * other way to get the same result, which is the point of "no raw SQL console"
 * (commercial-architecture.md §5).
 */

export type AgencySummary = {
  agencyId: string;
  name: string;
  plan: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  createdAt: string;
  suspendedAt: string | null;
  deletionRequestedAt: string | null;
  userCount: number;
  promoterCount: number;
  campaignCount: number;
  shiftCount: number;
};

type AgencyListRpcRow = {
  agency_id: string;
  name: string;
  plan: string;
  subscription_status: string;
  trial_ends_at: string | null;
  created_at: string;
  suspended_at: string | null;
  deletion_requested_at: string | null;
  user_count: number;
  promoter_count: number;
  campaign_count: number;
  shift_count: number;
};

function fromListRow(row: AgencyListRpcRow): AgencySummary {
  return {
    agencyId: row.agency_id,
    name: row.name,
    plan: row.plan,
    subscriptionStatus: row.subscription_status,
    trialEndsAt: row.trial_ends_at,
    createdAt: row.created_at,
    suspendedAt: row.suspended_at,
    deletionRequestedAt: row.deletion_requested_at,
    userCount: Number(row.user_count),
    promoterCount: Number(row.promoter_count),
    campaignCount: Number(row.campaign_count),
    shiftCount: Number(row.shift_count),
  };
}

/** Every agency, with usage counts. No reason required — aggregates, not contents. */
export async function listAgencies(): Promise<AgencySummary[]> {
  const db = await createServerSupabase();
  const { data, error } = await db.rpc("admin_list_agencies");
  if (error || !data) return [];
  return (data as AgencyListRpcRow[]).map(fromListRow);
}

export type AgencyDetailSummary = AgencySummary & {
  slug: string;
  city: string | null;
  timezone: string;
  seatLimit: number;
  promoterLimit: number;
};

type AgencySummaryRpcRow = AgencyListRpcRow & {
  slug: string;
  city: string | null;
  timezone: string;
  seat_limit: number;
  promoter_limit: number;
};

/** One agency's aggregates, for the detail page header. Also no reason required. */
export async function agencySummary(agencyId: string): Promise<AgencyDetailSummary | null> {
  const db = await createServerSupabase();
  const { data, error } = await db.rpc("admin_agency_summary", { p_agency_id: agencyId });

  const rows = data as AgencySummaryRpcRow[] | null;
  if (error || !rows || rows.length === 0) return null;
  const row = rows[0]!;

  return {
    ...fromListRow(row),
    slug: row.slug,
    city: row.city,
    timezone: row.timezone,
    seatLimit: row.seat_limit,
    promoterLimit: row.promoter_limit,
  };
}

export type AgencyActivity = {
  recentCampaigns: Array<{
    id: string;
    name: string;
    status: string;
    startsOn: string;
    endsOn: string;
    createdAt: string;
  }>;
  recentShifts: Array<{
    id: string;
    onDate: string;
    startTime: string;
    endTime: string;
    status: string;
    storeName: string;
    campaignName: string;
  }>;
};

type AgencyActivityJson = {
  recent_campaigns: Array<{
    id: string;
    name: string;
    status: string;
    starts_on: string;
    ends_on: string;
    created_at: string;
  }>;
  recent_shifts: Array<{
    id: string;
    on_date: string;
    start_time: string;
    end_time: string;
    status: string;
    store_name: string;
    campaign_name: string;
  }>;
};

export type AdminResult<T> = { ok: true; data: T } | { ok: false; code: AdminErrorCode };

/**
 * The one read that IS a customer's operational data. Requires a typed reason and writes the
 * audit row inside the same database function, before the query runs — not after, not
 * optionally (commercial-architecture.md §5). If this call returns `ok: true`, the row already
 * exists in `admin_audit_log`.
 */
export async function viewAgencyActivity(
  agencyId: string,
  reason: string,
): Promise<AdminResult<AgencyActivity>> {
  const db = await createServerSupabase();
  const { data, error } = await db.rpc("admin_view_agency_activity", {
    p_agency_id: agencyId,
    p_reason: reason,
  });

  if (error || !data) return { ok: false, code: adminErrorCode(error?.message) };

  const json = data as AgencyActivityJson;

  return {
    ok: true,
    data: {
      recentCampaigns: (json.recent_campaigns ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        startsOn: c.starts_on,
        endsOn: c.ends_on,
        createdAt: c.created_at,
      })),
      recentShifts: (json.recent_shifts ?? []).map((s) => ({
        id: s.id,
        onDate: s.on_date,
        startTime: s.start_time,
        endTime: s.end_time,
        status: s.status,
        storeName: s.store_name,
        campaignName: s.campaign_name,
      })),
    },
  };
}

export async function extendTrial(
  agencyId: string,
  days: number,
  reason: string,
): Promise<AdminResult<string>> {
  const db = await createServerSupabase();
  const { data, error } = await db.rpc("admin_extend_trial", {
    p_agency_id: agencyId,
    p_days: days,
    p_reason: reason,
  });
  if (error || !data) return { ok: false, code: adminErrorCode(error?.message) };
  return { ok: true, data: data as string };
}

export async function changePlan(
  agencyId: string,
  plan: string,
  reason: string,
): Promise<AdminResult<string>> {
  const db = await createServerSupabase();
  const { data, error } = await db.rpc("admin_change_plan", {
    p_agency_id: agencyId,
    p_plan: plan,
    p_reason: reason,
  });
  if (error || !data) return { ok: false, code: adminErrorCode(error?.message) };
  return { ok: true, data: data as string };
}

export async function suspendAgency(
  agencyId: string,
  reason: string,
): Promise<AdminResult<string>> {
  const db = await createServerSupabase();
  const { data, error } = await db.rpc("admin_suspend_agency", {
    p_agency_id: agencyId,
    p_reason: reason,
  });
  if (error || !data) return { ok: false, code: adminErrorCode(error?.message) };
  return { ok: true, data: data as string };
}

export async function unsuspendAgency(
  agencyId: string,
  reason: string,
): Promise<AdminResult<boolean>> {
  const db = await createServerSupabase();
  const { data, error } = await db.rpc("admin_unsuspend_agency", {
    p_agency_id: agencyId,
    p_reason: reason,
  });
  if (error) return { ok: false, code: adminErrorCode(error.message) };
  return { ok: true, data: Boolean(data) };
}

export async function markDeletionRequest(
  agencyId: string,
  reason: string,
): Promise<AdminResult<string>> {
  const db = await createServerSupabase();
  const { data, error } = await db.rpc("admin_mark_deletion_request", {
    p_agency_id: agencyId,
    p_reason: reason,
  });
  if (error || !data) return { ok: false, code: adminErrorCode(error?.message) };
  return { ok: true, data: data as string };
}

export async function clearDeletionRequest(
  agencyId: string,
  reason: string,
): Promise<AdminResult<boolean>> {
  const db = await createServerSupabase();
  const { data, error } = await db.rpc("admin_clear_deletion_request", {
    p_agency_id: agencyId,
    p_reason: reason,
  });
  if (error) return { ok: false, code: adminErrorCode(error.message) };
  return { ok: true, data: Boolean(data) };
}

// Plan values live in `lib/admin/plans.ts` because client components need them and this module
// is `server-only`. Re-exported so existing server-side imports keep working.
export {
  ASSIGNABLE_PLANS,
  isAssignablePlan,
  type AssignablePlan,
} from "@/lib/admin/plans";
