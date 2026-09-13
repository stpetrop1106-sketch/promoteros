import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCheckinLink } from "@/lib/checkins";
import { automaticDeliveryConfigured, getAdapterFor } from "@/lib/messaging";
import { dispatchOne } from "./engine";
import { supabaseDispatchStore } from "./supabase-store";
import { createPacer, runBounded, RESEND_MIN_INTERVAL_MS } from "./pacer";
import { availabilityMessage, checkinMessage, type Recipient } from "./messages";
import { WELCOME_PERIOD_KEY } from "./period";
import { countResults, emptyCounts, type DispatchResult, type RunCounts } from "./outcome";

/**
 * P39 — the three automatic sends, against the real database.
 *
 *   runAvailabilityLinks   the 1st/15th cron, and the owner's "send now"
 *   runCheckinLinks        every day: today's confirmed assignments
 *   sendWelcomeAvailabilityLink   right after a promoter is created
 *
 * All of them go through `dispatchOne` (claim → build → send → record), so none of them can email
 * anyone twice for the same occurrence. All of them do NOTHING when email is not configured —
 * not even a `skipped` row — so the day the manager adds `RESEND_API_KEY`, the period is still
 * unclaimed and the next run sends it.
 *
 * Service role throughout: the cron has no user, and `after()` runs outside the coordinator's
 * request. Tenant scoping is by construction — every dispatch key takes `agency_id` from the
 * promoter row it is about, never from a caller.
 */

type AdminDb = ReturnType<typeof createAdminClient>;

const PAGE_SIZE = 1000;
const IN_CHUNK = 100;
/** Two in flight; the pacer, not the concurrency, is what holds the provider rate. */
const CONCURRENCY = 2;

export type RunSummary = RunCounts & { emailConfigured: boolean; agencies: number };

function notConfigured(): RunSummary {
  return { ...emptyCounts(), emailConfigured: false, agencies: 0 };
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

type AgencyRow = { id: string; name: string };

/** Agencies a run may send for: never a suspended one. */
async function loadAgencies(
  db: AdminDb,
  options: { agencyIds?: readonly string[]; respectAutoSwitch: boolean },
): Promise<AgencyRow[]> {
  const rows: AgencyRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = db.from("agencies").select("id, name").is("suspended_at", null);
    if (options.respectAutoSwitch) query = query.eq("auto_availability_links", true);
    if (options.agencyIds) query = query.in("id", [...options.agencyIds]);
    const { data, error } = await query.order("id").range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`agencies: ${error.code ?? "error"}`);
    const page = (data ?? []) as AgencyRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

type PromoterRow = {
  id: string;
  agency_id: string;
  full_name: string;
  phone: string;
  email: string | null;
};

async function loadActivePromoters(
  db: AdminDb,
  agencyIds: readonly string[],
): Promise<(Recipient & { agencyId: string })[]> {
  const out: (Recipient & { agencyId: string })[] = [];
  for (const ids of chunks(agencyIds, IN_CHUNK)) {
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await db
        .from("promoters")
        .select("id, agency_id, full_name, phone, email")
        .eq("status", "active")
        .in("agency_id", ids)
        .order("id")
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(`promoters: ${error.code ?? "error"}`);
      const page = (data ?? []) as PromoterRow[];
      for (const p of page) {
        out.push({
          id: p.id,
          agencyId: p.agency_id,
          fullName: p.full_name,
          phone: p.phone,
          email: p.email,
        });
      }
      if (page.length < PAGE_SIZE) break;
    }
  }
  return out;
}

/**
 * Every active promoter of every eligible agency gets their availability link.
 *
 * `respectAutoSwitch` is true for the cron (the owner's switch decides) and false for the owner's
 * own "send now" (pressing it IS the decision).
 */
export async function runAvailabilityLinks(options: {
  periodKey: string;
  agencyIds?: readonly string[];
  respectAutoSwitch: boolean;
  deadline?: number;
}): Promise<RunSummary> {
  if (!automaticDeliveryConfigured()) return notConfigured();

  const db = createAdminClient();
  const agencies = await loadAgencies(db, options);
  if (agencies.length === 0) return { ...emptyCounts(), emailConfigured: true, agencies: 0 };

  const agencyName = new Map(agencies.map((a) => [a.id, a.name]));
  const promoters = await loadActivePromoters(
    db,
    agencies.map((a) => a.id),
  );

  const store = supabaseDispatchStore(db);
  const adapter = getAdapterFor({ beforeRequest: createPacer(RESEND_MIN_INTERVAL_MS) });

  const { results, notStarted } = await runBounded<(typeof promoters)[number], DispatchResult>(
    promoters,
    (p) =>
      dispatchOne(
        { store, adapter },
        {
          agencyId: p.agencyId,
          promoterId: p.id,
          kind: "availability_link",
          periodKey: options.periodKey,
        },
        async () => availabilityMessage(p, "periodic", agencyName.get(p.agencyId) ?? null),
      ),
    { concurrency: CONCURRENCY, onError: () => ({ result: "error" }), deadline: options.deadline },
  );

  return { ...countResults(results, notStarted), emailConfigured: true, agencies: agencies.length };
}

type AssignmentRow = {
  id: string;
  agency_id: string;
  shifts: {
    on_date: string;
    start_time: string;
    end_time: string;
    status: string;
    campaigns: { name: string } | null;
    stores: { name: string } | null;
  } | null;
  promoters: {
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
    status: string;
  } | null;
};

/**
 * The check-in link, to everyone with a confirmed assignment on a shift today (Athens date).
 * `period_key` is the assignment id: one link per assignment, ever, however often the cron runs.
 * `createCheckinLink` (`lib/checkins.ts`, another parcel's file) is called, never changed.
 */
export async function runCheckinLinks(options: {
  todayIso: string;
  deadline?: number;
}): Promise<RunSummary> {
  if (!automaticDeliveryConfigured()) return notConfigured();

  const db = createAdminClient();
  const agencies = await loadAgencies(db, { respectAutoSwitch: false });
  if (agencies.length === 0) return { ...emptyCounts(), emailConfigured: true, agencies: 0 };

  const assignments: AssignmentRow[] = [];
  for (const ids of chunks(
    agencies.map((a) => a.id),
    IN_CHUNK,
  )) {
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await db
        .from("assignments")
        .select(
          "id, agency_id, shifts!inner(on_date, start_time, end_time, status, campaigns(name), stores(name)), promoters!inner(id, full_name, phone, email, status)",
        )
        .eq("status", "confirmed")
        .eq("shifts.on_date", options.todayIso)
        .in("agency_id", ids)
        .order("id")
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(`assignments: ${error.code ?? "error"}`);
      const page = (data ?? []) as unknown as AssignmentRow[];
      assignments.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
  }

  const due = assignments.filter(
    (a) =>
      a.shifts !== null &&
      a.shifts.on_date === options.todayIso &&
      a.shifts.status !== "cancelled" &&
      a.promoters !== null &&
      a.promoters.status !== "archived" &&
      a.promoters.status !== "blocklisted",
  );

  const store = supabaseDispatchStore(db);
  const adapter = getAdapterFor({ beforeRequest: createPacer(RESEND_MIN_INTERVAL_MS) });

  const { results, notStarted } = await runBounded<AssignmentRow, DispatchResult>(
    due,
    (a) => {
      const shift = a.shifts!;
      const promoter = a.promoters!;
      return dispatchOne(
        { store, adapter },
        {
          agencyId: a.agency_id,
          promoterId: promoter.id,
          kind: "checkin_link",
          periodKey: a.id,
        },
        async () => {
          const { url } = await createCheckinLink(a.id);
          return checkinMessage(
            {
              id: promoter.id,
              fullName: promoter.full_name,
              phone: promoter.phone,
              email: promoter.email,
            },
            {
              campaignName: shift.campaigns?.name ?? "",
              storeName: shift.stores?.name ?? "",
              startTime: String(shift.start_time),
              endTime: String(shift.end_time),
            },
            url,
          );
        },
      );
    },
    { concurrency: CONCURRENCY, onError: () => ({ result: "error" }), deadline: options.deadline },
  );

  return { ...countResults(results, notStarted), emailConfigured: true, agencies: agencies.length };
}

export type WelcomeResult =
  | DispatchResult
  | { result: "not_applicable"; why: "email_not_configured" | "not_found" | "inactive" | "agency_off" };

/**
 * The first availability link, right after a coordinator adds a promoter. Called from `after()`
 * in `app/promoters/actions.ts`, so it runs once the coordinator already has their redirect: it
 * can take seconds, retry, or fail entirely without the save ever knowing. Never throws.
 */
export async function sendWelcomeAvailabilityLink(promoterId: string): Promise<WelcomeResult> {
  try {
    if (!automaticDeliveryConfigured()) return { result: "not_applicable", why: "email_not_configured" };

    const db = createAdminClient();
    const { data: promoter } = await db
      .from("promoters")
      .select("id, agency_id, full_name, phone, email, status")
      .eq("id", promoterId)
      .maybeSingle<PromoterRow & { status: string }>();
    if (!promoter) return { result: "not_applicable", why: "not_found" };
    if (promoter.status !== "active") return { result: "not_applicable", why: "inactive" };

    const { data: agency, error: agencyError } = await db
      .from("agencies")
      .select("id, name, suspended_at, auto_availability_links")
      .eq("id", promoter.agency_id)
      .maybeSingle<{ id: string; name: string; suspended_at: string | null; auto_availability_links: boolean }>();
    // An error here is most likely 0017 not applied yet (no such column): send nothing.
    if (agencyError || !agency) return { result: "error" };
    if (agency.suspended_at || !agency.auto_availability_links) {
      return { result: "not_applicable", why: "agency_off" };
    }

    return await dispatchOne(
      { store: supabaseDispatchStore(db), adapter: getAdapterFor() },
      {
        agencyId: promoter.agency_id,
        promoterId: promoter.id,
        kind: "availability_link",
        periodKey: WELCOME_PERIOD_KEY,
      },
      async () =>
        availabilityMessage(
          {
            id: promoter.id,
            fullName: promoter.full_name,
            phone: promoter.phone,
            email: promoter.email,
          },
          "welcome",
          agency.name,
        ),
    );
  } catch {
    return { result: "error" };
  }
}
