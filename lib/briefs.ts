import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createServerSupabase } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/tokens";

/**
 * Brief acknowledgement — P31, docs/product-spec.md §9.
 *
 * `brief_ack (brief_id, promoter_id, acknowledged_at, quiz_score)` (0001_init.sql) has existed
 * since the first migration and is already read by the matching engine (`brief_completed` in
 * 0005_matching_fixes.sql), but nothing in the application has ever written a row to it. This
 * file is that write path, plus the read the coordinator needs to see who has read a brief.
 *
 * The promoter-facing functions below re-verify the invitation token and re-read the invitation
 * row independently of `lib/invitations.ts` rather than importing from it — this parcel does not
 * own that file, and `lib/checkins.ts` already sets the precedent of a parallel, independent
 * lookup for a different token purpose next to `lib/invitations.ts` rather than a shared import.
 */

export type PromoterBriefView = {
  briefId: string;
  title: string;
  bodyMd: string;
  /** Null until this promoter has acknowledged this exact brief version. */
  acknowledgedAt: string | null;
};

type InvitationCampaignRow = {
  id: string;
  promoter_id: string;
  shifts: { campaign_id: string } | null;
};

async function loadInvitationCampaign(
  token: string,
): Promise<
  | { ok: true; invitationId: string; promoterId: string; campaignId: string }
  | { ok: false; reason: string }
> {
  const verified = verifyToken(token, "invitation");
  if (!verified.ok) return { ok: false, reason: verified.reason };

  const db = createAdminClient();
  const { data, error } = await db
    .from("invitations")
    .select("id, promoter_id, shifts(campaign_id)")
    .eq("id", verified.recordId)
    .single();
  if (error || !data) return { ok: false, reason: "not_found" };

  const row = data as unknown as InvitationCampaignRow;
  if (!row.shifts) return { ok: false, reason: "not_found" };

  return {
    ok: true,
    invitationId: row.id,
    promoterId: row.promoter_id,
    campaignId: row.shifts.campaign_id,
  };
}

/** The one published brief a promoter is ever shown — draft content never reaches them. */
async function loadPublishedBrief(
  db: ReturnType<typeof createAdminClient>,
  campaignId: string,
): Promise<{ id: string; title: string; body_md: string } | null> {
  const { data } = await db
    .from("briefs")
    .select("id, title, body_md")
    .eq("campaign_id", campaignId)
    .not("published_at", "is", null)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/**
 * Read the published brief for the campaign behind an invitation token, plus whether this
 * promoter has already acknowledged it. `view: null` means there is nothing to acknowledge yet
 * (no published brief) — the invitation page renders nothing in that case, not an error.
 */
export async function loadBriefForInvitation(
  token: string,
): Promise<{ ok: true; view: PromoterBriefView | null } | { ok: false; reason: string }> {
  const resolved = await loadInvitationCampaign(token);
  if (!resolved.ok) return resolved;

  const db = createAdminClient();
  const brief = await loadPublishedBrief(db, resolved.campaignId);
  if (!brief) return { ok: true, view: null };

  const { data: ack } = await db
    .from("brief_ack")
    .select("acknowledged_at")
    .eq("brief_id", brief.id)
    .eq("promoter_id", resolved.promoterId)
    .maybeSingle();

  return {
    ok: true,
    view: {
      briefId: brief.id,
      title: brief.title,
      bodyMd: brief.body_md,
      acknowledgedAt: ack?.acknowledged_at ?? null,
    },
  };
}

/**
 * Record that a promoter has read the currently published brief for their invitation's campaign.
 *
 * Idempotent by construction: `brief_ack`'s primary key is `(brief_id, promoter_id)`, and the
 * upsert is issued with `ignoreDuplicates`, i.e. `ON CONFLICT DO NOTHING`. A promoter who taps
 * twice, or reopens the link tomorrow, never errors and never moves `acknowledged_at` — the
 * row is written once, on the first tap, and every later tap just re-reads it. `quiz_score` is
 * left out of the payload entirely (stays null); comprehension quizzes are out of scope.
 */
export async function acknowledgeBriefForInvitation(
  token: string,
): Promise<{ ok: true; acknowledgedAt: string } | { ok: false; reason: string }> {
  const resolved = await loadInvitationCampaign(token);
  if (!resolved.ok) return resolved;

  const db = createAdminClient();
  const brief = await loadPublishedBrief(db, resolved.campaignId);
  if (!brief) return { ok: false, reason: "no_brief" };

  const { error: upsertErr } = await db
    .from("brief_ack")
    .upsert(
      { brief_id: brief.id, promoter_id: resolved.promoterId },
      { onConflict: "brief_id,promoter_id", ignoreDuplicates: true },
    );
  if (upsertErr) return { ok: false, reason: "save_failed" };

  const { data: row, error: readErr } = await db
    .from("brief_ack")
    .select("acknowledged_at")
    .eq("brief_id", brief.id)
    .eq("promoter_id", resolved.promoterId)
    .single();
  if (readErr || !row) return { ok: false, reason: "save_failed" };

  return { ok: true, acknowledgedAt: row.acknowledged_at };
}

// ---------------------------------------------------------------------------------------------
// Coordinator side — RLS-scoped, never the admin client.
// ---------------------------------------------------------------------------------------------

export type BriefAckPromoter = {
  promoterId: string;
  promoterName: string;
  acknowledgedAt: string | null;
};

export type BriefRoster =
  | { kind: "no_brief" }
  | { kind: "not_published" }
  | { kind: "no_staff"; briefId: string }
  | { kind: "ready"; briefId: string; acknowledged: BriefAckPromoter[]; pending: BriefAckPromoter[] };

type AssignmentPromoterRow = {
  promoter_id: string;
  promoters: { id: string; full_name: string } | null;
};

/**
 * Who has acknowledged the campaign's current brief, and who has not.
 *
 * Takes an already-created `createServerSupabase()` client rather than making its own — the
 * caller is a coordinator page/action, already behind `requireUser()`, and every query below
 * runs through the caller's RLS-scoped session so a campaign in another agency simply returns no
 * rows (CLAUDE.md §4). Never pass the admin client here.
 *
 * The roster is "who is actually staffed" — promoters with a non-cancelled assignment on one of
 * this campaign's shifts — not everyone ever invited. That is the list a coordinator is asked
 * about before an activation, and it is keyed off the *latest* brief row for the campaign: a
 * republished brief is a new `id`, so a content change correctly resets everyone to "not yet".
 */
export async function loadBriefRoster(
  db: Awaited<ReturnType<typeof createServerSupabase>>,
  campaignId: string,
): Promise<BriefRoster> {
  const { data: brief } = await db
    .from("briefs")
    .select("id, published_at")
    .eq("campaign_id", campaignId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!brief) return { kind: "no_brief" };
  if (!brief.published_at) return { kind: "not_published" };

  const { data: shifts } = await db.from("shifts").select("id").eq("campaign_id", campaignId);
  const shiftIds = (shifts ?? []).map((s) => s.id as string);
  if (shiftIds.length === 0) return { kind: "no_staff", briefId: brief.id };

  const { data: assignmentRows } = await db
    .from("assignments")
    .select("promoter_id, promoters(id, full_name)")
    .in("shift_id", shiftIds)
    .neq("status", "cancelled");

  const staffByPromoterId = new Map<string, string>();
  for (const row of (assignmentRows ?? []) as unknown as AssignmentPromoterRow[]) {
    const name = row.promoters?.full_name;
    if (name) staffByPromoterId.set(row.promoter_id, name);
  }

  if (staffByPromoterId.size === 0) return { kind: "no_staff", briefId: brief.id };

  const promoterIds = [...staffByPromoterId.keys()];
  const { data: acks } = await db
    .from("brief_ack")
    .select("promoter_id, acknowledged_at")
    .eq("brief_id", brief.id)
    .in("promoter_id", promoterIds);

  const ackByPromoterId = new Map<string, string>();
  for (const ack of acks ?? []) {
    ackByPromoterId.set(ack.promoter_id as string, ack.acknowledged_at as string);
  }

  const acknowledged: BriefAckPromoter[] = [];
  const pending: BriefAckPromoter[] = [];
  for (const [promoterId, promoterName] of staffByPromoterId) {
    const acknowledgedAt = ackByPromoterId.get(promoterId) ?? null;
    const entry = { promoterId, promoterName, acknowledgedAt };
    (acknowledgedAt ? acknowledged : pending).push(entry);
  }

  acknowledged.sort((a, b) => (a.acknowledgedAt ?? "").localeCompare(b.acknowledgedAt ?? ""));
  pending.sort((a, b) => a.promoterName.localeCompare(b.promoterName));

  return { kind: "ready", briefId: brief.id, acknowledged, pending };
}
