import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * `waitlist_signups` is product leads, not tenant data (0004_waitlist_signups.sql) — read-only
 * here, same as everywhere else. No reason, no audit row: it belongs on the console per
 * commercial-architecture.md §5's waitlist bullet, but it is not a customer's operational data.
 */

export type WaitlistStats = {
  total: number;
  byPromoterCount: Array<{ promoterCount: string; count: number }>;
  byUtmSource: Array<{ utmSource: string | null; count: number }>;
};

type WaitlistStatsJson = {
  total: number;
  by_promoter_count: Array<{ promoter_count: string; n: number }>;
  by_utm_source: Array<{ utm_source: string | null; n: number }>;
};

export async function waitlistStats(): Promise<WaitlistStats | null> {
  const db = await createServerSupabase();
  const { data, error } = await db.rpc("admin_waitlist_stats");
  if (error || !data) return null;

  const json = data as WaitlistStatsJson;
  return {
    total: json.total,
    byPromoterCount: (json.by_promoter_count ?? []).map((row) => ({
      promoterCount: row.promoter_count,
      count: row.n,
    })),
    byUtmSource: (json.by_utm_source ?? []).map((row) => ({
      utmSource: row.utm_source,
      count: row.n,
    })),
  };
}

export type WaitlistSignupRow = {
  id: string;
  fullName: string;
  workEmail: string;
  companyName: string;
  promoterCount: string;
  utmSource: string | null;
  createdAt: string;
};

type WaitlistRecentRpcRow = {
  id: string;
  full_name: string;
  work_email: string;
  company_name: string;
  promoter_count: string;
  utm_source: string | null;
  created_at: string;
};

export async function waitlistRecent(limit = 50): Promise<WaitlistSignupRow[]> {
  const db = await createServerSupabase();
  const { data, error } = await db.rpc("admin_waitlist_recent", { p_limit: limit });

  if (error || !data) return [];

  return (data as WaitlistRecentRpcRow[]).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    workEmail: row.work_email,
    companyName: row.company_name,
    promoterCount: row.promoter_count,
    utmSource: row.utm_source,
    createdAt: row.created_at,
  }));
}
