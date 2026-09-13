import "server-only";
import { requireUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { distanceMetres } from "@/lib/geo";
import { athensToday } from "@/lib/availability-links";
import {
  checkInviteEligibility,
  type AvailabilityWindow,
  type BlockReason,
  type ConfirmedShiftWindow,
  type WarningReason,
} from "@/lib/invite-eligibility";

/**
 * P38 — data loading for "Στείλε πρόσκληση" from a promoter's own profile.
 *
 * Kept apart from `lib/invite-eligibility.ts` on purpose (CLAUDE.md's own split for the matching
 * engine): everything below reaches Supabase, everything there decides. Every read goes through
 * the RLS-scoped client (`createServerSupabase`), never the admin one — a promoter or shift id
 * belonging to another agency simply returns no row, the same tenant boundary every other
 * coordinator-facing page in this codebase relies on (see `own_agency` in `0002_rls.sql`).
 *
 * `loadPromoterContext` below is the one place that gathers "everything about this promoter that
 * eligibility needs" — blocklist rows, confirmed shifts, pending invitations, availability, the
 * agency's travel ceiling, brief acknowledgements — in a handful of queries, once. Both the list
 * page (`loadInvitePanel`, evaluated against every open/partially-filled upcoming shift) and the
 * send action's server-side re-check (`loadEligibilityForShift`, evaluated against one) build on
 * the same context and the same `evaluateShift`, so the "no" a coordinator sees in the list is
 * never able to drift from the "no" the server re-checks at send time.
 */

export type PromoterStatus = "active" | "paused" | "archived" | "blocklisted";

export type PromoterHeader = {
  id: string;
  fullName: string;
  phone: string;
  status: PromoterStatus;
};

export type CandidateShift = {
  id: string;
  onDate: string;
  startTime: string;
  endTime: string;
  campaignId: string;
  campaignName: string;
  storeName: string;
  promotersRequired: number;
  blocking: BlockReason[];
  warnings: WarningReason[];
  canSend: boolean;
};

export type InvitePanelView = {
  promoter: PromoterHeader;
  shifts: CandidateShift[];
};

export type LoadPanelResult =
  | { ok: true; view: InvitePanelView }
  | { ok: false; reason: "not_found" };

/** A shift no longer open to new offers by the time the server re-checks it — filled, cancelled
 *  or completed between the coordinator loading the panel and pressing send. Not one of
 *  `lib/invite-eligibility.ts`'s own reasons because it is not about promoter fit at all. */
export type ExtendedBlockReason = BlockReason | "shift_unavailable";

export type ShiftEligibilityCheck =
  | {
      ok: true;
      promoter: PromoterHeader;
      canSend: boolean;
      blocking: ExtendedBlockReason[];
      warnings: WarningReason[];
    }
  | { ok: false; reason: "not_found" };

const DEFAULT_TRAVEL_RADIUS_KM = 60;
const OPEN_STATUSES = ["open", "partially_filled"] as const;

type Db = Awaited<ReturnType<typeof createServerSupabase>>;

type PromoterRow = {
  id: string;
  full_name: string;
  phone: string;
  status: PromoterStatus;
  home_lat: number | null;
  home_lng: number | null;
};

type ShiftListRow = {
  id: string;
  on_date: string;
  start_time: string;
  end_time: string;
  promoters_required: number;
  campaign_id: string;
  campaigns: { name: string; client_id: string } | null;
  stores: { name: string; lat: number | null; lng: number | null } | null;
};

type ShiftDetailRow = {
  id: string;
  status: string;
  on_date: string;
  start_time: string;
  end_time: string;
  campaign_id: string;
  campaigns: { client_id: string } | null;
  stores: { lat: number | null; lng: number | null } | null;
};

/** Everything about one promoter that `checkInviteEligibility` needs, gathered once and reused
 *  for every shift it is asked about. */
type PromoterContext = {
  promoter: PromoterRow;
  blocklistedAgencyWide: boolean;
  blocklistedClientIds: Set<string>;
  /** Every shift this promoter holds a `confirmed` assignment on, this one included — callers
   *  exclude the shift being evaluated when building `otherConfirmedShifts`. */
  confirmedShifts: Array<ConfirmedShiftWindow & { shiftId: string }>;
  pendingInvitationShiftIds: Set<string>;
  availabilityByDate: Map<string, AvailabilityWindow[]>;
  travelRadiusM: number;
  /** campaignId -> the id of that campaign's latest PUBLISHED brief, if it has one at all. */
  latestPublishedBriefIdByCampaign: Map<string, string>;
  acknowledgedBriefIds: Set<string>;
};

/** Parses `scoring_weights.params->>'max_distance_km'` the same defensive way
 *  `0007_match_radius.sql` does in SQL: only a plainly positive number is honoured, anything else
 *  (absent, non-numeric, zero, negative) falls back to the 60 km default. */
function travelRadiusMetresFrom(params: Record<string, unknown> | null | undefined): number {
  const raw = params?.["max_distance_km"];
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  const km = Number.isFinite(n) && n > 0 ? n : DEFAULT_TRAVEL_RADIUS_KM;
  return km * 1000;
}

async function loadPromoterContext(db: Db, promoterId: string): Promise<PromoterContext | null> {
  const { data: promoter } = await db
    .from("promoters")
    .select("id, full_name, phone, status, home_lat, home_lng")
    .eq("id", promoterId)
    .maybeSingle<PromoterRow>();
  if (!promoter) return null;

  const nowIso = new Date().toISOString();

  const [
    { data: blocklistRows },
    { data: assignmentRows },
    { data: invitationRows },
    { data: availabilityRows },
    { data: weightRow },
    { data: publishedBriefRows },
    { data: ackRows },
  ] = await Promise.all([
    db.from("blocklist").select("client_id").eq("promoter_id", promoterId),
    db
      .from("assignments")
      .select("shift_id, shifts(on_date, start_time, end_time)")
      .eq("promoter_id", promoterId)
      .eq("status", "confirmed"),
    db
      .from("invitations")
      .select("shift_id")
      .eq("promoter_id", promoterId)
      .eq("status", "pending")
      .gt("expires_at", nowIso),
    db.from("availability").select("on_date, status, from_time, to_time").eq("promoter_id", promoterId),
    db
      .from("scoring_weights")
      .select("params")
      .eq("factor", "distance")
      .maybeSingle<{ params: Record<string, unknown> }>(),
    // Every published brief, agency-wide — RLS scopes this to the coordinator's own agency the
    // same way every other query here is scoped. Grouped down to the latest version per campaign
    // below, mirroring lib/checkins.ts's own "order by version desc, limit 1" read.
    db.from("briefs").select("id, campaign_id, version").not("published_at", "is", null),
    db.from("brief_ack").select("brief_id").eq("promoter_id", promoterId),
  ]);

  const blocklistedAgencyWide = (blocklistRows ?? []).some((r) => r.client_id === null);
  const blocklistedClientIds = new Set(
    (blocklistRows ?? [])
      .map((r) => r.client_id as string | null)
      .filter((id): id is string => id !== null),
  );

  const confirmedShifts = ((assignmentRows ?? []) as unknown as Array<{
    shift_id: string;
    shifts: { on_date: string; start_time: string; end_time: string } | null;
  }>)
    .filter((a) => a.shifts !== null)
    .map((a) => ({
      shiftId: a.shift_id,
      onDate: a.shifts!.on_date,
      startTime: String(a.shifts!.start_time).slice(0, 5),
      endTime: String(a.shifts!.end_time).slice(0, 5),
    }));

  const pendingInvitationShiftIds = new Set((invitationRows ?? []).map((r) => r.shift_id as string));

  const availabilityByDate = new Map<string, AvailabilityWindow[]>();
  for (const row of (availabilityRows ?? []) as Array<{
    on_date: string;
    status: "available" | "unavailable";
    from_time: string | null;
    to_time: string | null;
  }>) {
    const bucket = availabilityByDate.get(row.on_date) ?? [];
    bucket.push({ status: row.status, fromTime: row.from_time, toTime: row.to_time });
    availabilityByDate.set(row.on_date, bucket);
  }

  const latestPublishedBriefIdByCampaign = new Map<string, { id: string; version: number }>();
  for (const b of (publishedBriefRows ?? []) as Array<{ id: string; campaign_id: string; version: number }>) {
    const current = latestPublishedBriefIdByCampaign.get(b.campaign_id);
    if (!current || b.version > current.version) {
      latestPublishedBriefIdByCampaign.set(b.campaign_id, { id: b.id, version: b.version });
    }
  }

  return {
    promoter,
    blocklistedAgencyWide,
    blocklistedClientIds,
    confirmedShifts,
    pendingInvitationShiftIds,
    availabilityByDate,
    travelRadiusM: travelRadiusMetresFrom(weightRow?.params),
    latestPublishedBriefIdByCampaign: new Map(
      Array.from(latestPublishedBriefIdByCampaign.entries()).map(([campaignId, v]) => [campaignId, v.id]),
    ),
    acknowledgedBriefIds: new Set((ackRows ?? []).map((r) => r.brief_id as string)),
  };
}

function evaluateShift(
  ctx: PromoterContext,
  shift: {
    id: string;
    onDate: string;
    startTime: string;
    endTime: string;
    campaignId: string;
    clientId: string;
    storeLat: number | null;
    storeLng: number | null;
  },
): { blocking: BlockReason[]; warnings: WarningReason[]; canSend: boolean } {
  const alreadyConfirmedOnThisShift = ctx.confirmedShifts.some((s) => s.shiftId === shift.id);
  const otherConfirmedShifts: ConfirmedShiftWindow[] = ctx.confirmedShifts
    .filter((s) => s.shiftId !== shift.id)
    .map((s) => ({ onDate: s.onDate, startTime: s.startTime, endTime: s.endTime }));

  const distanceM =
    ctx.promoter.home_lat != null &&
    ctx.promoter.home_lng != null &&
    shift.storeLat != null &&
    shift.storeLng != null
      ? distanceMetres(
          { lat: ctx.promoter.home_lat, lng: ctx.promoter.home_lng },
          { lat: shift.storeLat, lng: shift.storeLng },
        )
      : null;

  const briefId = ctx.latestPublishedBriefIdByCampaign.get(shift.campaignId) ?? null;

  return checkInviteEligibility({
    promoterStatus: ctx.promoter.status,
    isBlocklistedForClient: ctx.blocklistedAgencyWide || ctx.blocklistedClientIds.has(shift.clientId),
    alreadyConfirmedOnThisShift,
    hasPendingInvitationForThisShift: ctx.pendingInvitationShiftIds.has(shift.id),
    shift: { onDate: shift.onDate, startTime: shift.startTime, endTime: shift.endTime },
    otherConfirmedShifts,
    availabilityOnShiftDate: ctx.availabilityByDate.get(shift.onDate) ?? [],
    distanceM,
    travelRadiusM: ctx.travelRadiusM,
    campaignHasPublishedBrief: briefId !== null,
    briefAcknowledged: briefId !== null && ctx.acknowledgedBriefIds.has(briefId),
  });
}

function promoterHeaderOf(ctx: PromoterContext): PromoterHeader {
  return {
    id: ctx.promoter.id,
    fullName: ctx.promoter.full_name,
    phone: ctx.promoter.phone,
    status: ctx.promoter.status,
  };
}

/**
 * Every upcoming shift that still needs people (not past, not cancelled, not filled), soonest
 * first, each with its eligibility already computed against this one promoter. The page renders
 * this list and filters it client-side by campaign and date — filtering here would mean a round
 * trip per filter change, and the whole list is small enough (an agency's live open shifts, not
 * its full history) to filter in the browser instantly.
 */
export async function loadInvitePanel(promoterId: string): Promise<LoadPanelResult> {
  await requireUser();
  const db = await createServerSupabase();

  const ctx = await loadPromoterContext(db, promoterId);
  if (!ctx) return { ok: false, reason: "not_found" };

  const today = athensToday();

  const { data: shiftRows } = await db
    .from("shifts")
    .select(
      "id, on_date, start_time, end_time, promoters_required, campaign_id, campaigns(name, client_id), stores(name, lat, lng)",
    )
    .in("status", OPEN_STATUSES)
    .gte("on_date", today)
    .order("on_date", { ascending: true })
    .order("start_time", { ascending: true });

  const shifts: CandidateShift[] = ((shiftRows ?? []) as unknown as ShiftListRow[]).map((s) => {
    const campaign = s.campaigns;
    const store = s.stores;
    const startTime = String(s.start_time).slice(0, 5);
    const endTime = String(s.end_time).slice(0, 5);

    const result = evaluateShift(ctx, {
      id: s.id,
      onDate: s.on_date,
      startTime,
      endTime,
      campaignId: s.campaign_id,
      clientId: campaign?.client_id ?? "",
      storeLat: store?.lat ?? null,
      storeLng: store?.lng ?? null,
    });

    return {
      id: s.id,
      onDate: s.on_date,
      startTime,
      endTime,
      campaignId: s.campaign_id,
      campaignName: campaign?.name ?? "—",
      storeName: store?.name ?? "—",
      promotersRequired: s.promoters_required,
      blocking: result.blocking,
      warnings: result.warnings,
      canSend: result.canSend,
    };
  });

  return { ok: true, view: { promoter: promoterHeaderOf(ctx), shifts } };
}

/**
 * The server-side re-check `sendInviteFromProfile` (`app/promoters/[id]/invite/actions.ts`) runs
 * before ever calling `createInvitation`. The panel the coordinator loaded is a hint, not the
 * authority — the shift can fill, or a second invitation can land, between loading the panel and
 * pressing send — so this repeats the same lookup against the current database state rather than
 * trusting anything the browser sent back.
 */
export async function loadEligibilityForShift(
  promoterId: string,
  shiftId: string,
): Promise<ShiftEligibilityCheck> {
  await requireUser();
  const db = await createServerSupabase();

  const ctx = await loadPromoterContext(db, promoterId);
  if (!ctx) return { ok: false, reason: "not_found" };

  const { data: shift } = await db
    .from("shifts")
    .select("id, status, on_date, start_time, end_time, campaign_id, campaigns(client_id), stores(lat, lng)")
    .eq("id", shiftId)
    .maybeSingle<ShiftDetailRow>();
  if (!shift) return { ok: false, reason: "not_found" };

  const promoter = promoterHeaderOf(ctx);

  if (!(OPEN_STATUSES as readonly string[]).includes(shift.status)) {
    return { ok: true, promoter, canSend: false, blocking: ["shift_unavailable"], warnings: [] };
  }

  const result = evaluateShift(ctx, {
    id: shift.id,
    onDate: shift.on_date,
    startTime: String(shift.start_time).slice(0, 5),
    endTime: String(shift.end_time).slice(0, 5),
    campaignId: shift.campaign_id,
    clientId: shift.campaigns?.client_id ?? "",
    storeLat: shift.stores?.lat ?? null,
    storeLng: shift.stores?.lng ?? null,
  });

  return { ok: true, promoter, canSend: result.canSend, blocking: result.blocking, warnings: result.warnings };
}
