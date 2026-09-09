import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";

export type AuditLogRow = {
  id: string;
  adminId: string;
  adminName: string | null;
  action: string;
  agencyId: string | null;
  agencyName: string | null;
  targetType: string | null;
  targetId: string | null;
  reason: string;
  createdAt: string;
};

type AuditLogRpcRow = {
  id: string;
  admin_id: string;
  admin_name: string | null;
  action: string;
  agency_id: string | null;
  agency_name: string | null;
  target_type: string | null;
  target_id: string | null;
  reason: string;
  created_at: string;
};

export type AuditFilters = {
  adminId?: string;
  agencyId?: string;
  /** ISO timestamps. */
  from?: string;
  to?: string;
  limit?: number;
};

/**
 * Filterable by admin, agency and date — and never filterable to nothing: there is no "exclude
 * this admin" option, only "which admin" (default: every admin, self included). commercial-
 * architecture.md §6.
 */
export async function queryAuditLog(filters: AuditFilters): Promise<AuditLogRow[]> {
  const db = await createServerSupabase();
  const { data, error } = await db.rpc("admin_audit_log_query", {
    p_admin_id: filters.adminId ?? null,
    p_agency_id: filters.agencyId ?? null,
    p_from: filters.from ?? null,
    p_to: filters.to ?? null,
    p_limit: filters.limit ?? 100,
  });

  if (error || !data) return [];

  return (data as AuditLogRpcRow[]).map((row) => ({
    id: row.id,
    adminId: row.admin_id,
    adminName: row.admin_name,
    action: row.action,
    agencyId: row.agency_id,
    agencyName: row.agency_name,
    targetType: row.target_type,
    targetId: row.target_id,
    reason: row.reason,
    createdAt: row.created_at,
  }));
}

export type PlatformAdminOption = { id: string; fullName: string };

/** For the audit-log filter dropdown. */
export async function listPlatformAdmins(): Promise<PlatformAdminOption[]> {
  const db = await createServerSupabase();
  const { data, error } = await db.rpc("admin_list_platform_admins");

  if (error || !data) return [];
  return (data as Array<{ id: string; full_name: string }>).map((row) => ({
    id: row.id,
    fullName: row.full_name,
  }));
}
