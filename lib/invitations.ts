import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { matchPromoters, type Candidate } from "@/lib/matching";
import { getAdapter } from "@/lib/messaging";
import { mintToken, hashToken, verifyToken, linkFor } from "@/lib/tokens";

const DEFAULT_TTL_HOURS = 24;

export type InvitationView = {
  invitationId: string;
  promoterName: string;
  campaignName: string;
  storeName: string;
  onDate: string;
  startTime: string;
  endTime: string;
  dressCode: string | null;
  rateCents: number;
  status: string;
};

/**
 * Offer a shift to one promoter.
 *
 * The match breakdown is frozen onto the invitation on purpose: months later we must still be
 * able to say why this person was offered this shift — to the client, and to the promoter.
 */
export async function createInvitation(
  shiftId: string,
  promoterId: string,
  ttlHours = DEFAULT_TTL_HOURS,
): Promise<{ url: string; manualBody: string | null; delivered: boolean }> {
  const db = createAdminClient();

  const { data: shift, error: shiftErr } = await db
    .from("shifts")
    .select("id, agency_id, on_date, start_time, end_time, campaigns(name, rate_cents), stores(name)")
    .eq("id", shiftId)
    .single();
  if (shiftErr || !shift) throw new Error("Shift not found");

  const { data: promoter, error: promoterErr } = await db
    .from("promoters")
    .select("id, full_name, phone")
    .eq("id", promoterId)
    .single();
  if (promoterErr || !promoter) throw new Error("Promoter not found");

  const candidate: Candidate | undefined = (await matchPromoters(shiftId, 100)).find(
    (c) => c.promoterId === promoterId,
  );

  // Insert first so the token can carry the real invitation id.
  const { data: invitation, error: insertErr } = await db
    .from("invitations")
    .insert({
      agency_id: shift.agency_id,
      shift_id: shiftId,
      promoter_id: promoterId,
      token_hash: "pending",
      match_score: candidate?.score ?? null,
      match_breakdown: candidate?.breakdown ?? null,
      channel: getAdapter().channel,
      expires_at: new Date(Date.now() + ttlHours * 3600_000).toISOString(),
    })
    .select("id")
    .single();
  if (insertErr || !invitation) throw new Error(insertErr?.message ?? "Could not create invitation");

  const { token, tokenHash } = mintToken("invitation", invitation.id, ttlHours * 3600);
  await db.from("invitations").update({ token_hash: tokenHash }).eq("id", invitation.id);

  const campaign = shift.campaigns as unknown as { name: string; rate_cents: number } | null;
  const store = shift.stores as unknown as { name: string } | null;
  const url = linkFor(token, "invitation");

  const body = [
    "Νέα βάρδια",
    campaign?.name ?? "",
    store?.name ?? "",
    `${shift.on_date} · ${String(shift.start_time).slice(0, 5)}–${String(shift.end_time).slice(0, 5)}`,
    "",
    "Είσαι διαθέσιμη;",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await getAdapter().send({
    to: { name: promoter.full_name, phone: promoter.phone },
    body,
    url,
  });

  return {
    url,
    delivered: result.delivered,
    manualBody: result.delivered ? null : result.manualBody,
  };
}

/** Read an invitation from its raw token, for the promoter-facing page. */
export async function loadInvitation(token: string): Promise<
  { ok: true; view: InvitationView } | { ok: false; reason: string }
> {
  const verified = verifyToken(token, "invitation");
  if (!verified.ok) return { ok: false, reason: verified.reason };

  const db = createAdminClient();
  const { data, error } = await db
    .from("invitations")
    .select(
      "id, status, token_hash, expires_at, promoters(full_name), shifts(on_date, start_time, end_time, campaigns(name, dress_code, rate_cents), stores(name))",
    )
    .eq("id", verified.recordId)
    .single();

  if (error || !data) return { ok: false, reason: "not_found" };
  // Defence in depth: a valid signature must also match the stored hash.
  if (data.token_hash !== hashToken(token)) return { ok: false, reason: "bad_signature" };

  const shift = data.shifts as unknown as {
    on_date: string;
    start_time: string;
    end_time: string;
    campaigns: { name: string; dress_code: string | null; rate_cents: number } | null;
    stores: { name: string } | null;
  } | null;
  const promoter = data.promoters as unknown as { full_name: string } | null;

  if (!shift) return { ok: false, reason: "not_found" };

  return {
    ok: true,
    view: {
      invitationId: data.id,
      promoterName: promoter?.full_name ?? "",
      campaignName: shift.campaigns?.name ?? "",
      storeName: shift.stores?.name ?? "",
      onDate: shift.on_date,
      startTime: String(shift.start_time).slice(0, 5),
      endTime: String(shift.end_time).slice(0, 5),
      dressCode: shift.campaigns?.dress_code ?? null,
      rateCents: shift.campaigns?.rate_cents ?? 0,
      status: data.status,
    },
  };
}

/**
 * Record a promoter's answer.
 *
 * A decline immediately re-ranks and returns the next candidates, because the whole point of
 * the product is that the coordinator does not go looking for a replacement by hand.
 */
export async function respondToInvitation(
  token: string,
  answer: "accept" | "decline",
  declineReason?: string,
): Promise<
  | { ok: true; answer: "accept" }
  | { ok: true; answer: "decline"; replacements: Candidate[] }
  | { ok: false; reason: string }
> {
  const verified = verifyToken(token, "invitation");
  if (!verified.ok) return { ok: false, reason: verified.reason };

  const db = createAdminClient();
  const { data: invitation, error } = await db
    .from("invitations")
    .select("id, agency_id, shift_id, promoter_id, status, token_hash")
    .eq("id", verified.recordId)
    .single();

  if (error || !invitation) return { ok: false, reason: "not_found" };
  if (invitation.token_hash !== hashToken(token)) return { ok: false, reason: "bad_signature" };
  if (invitation.status !== "pending") return { ok: false, reason: "already_answered" };

  if (answer === "decline") {
    await db
      .from("invitations")
      .update({
        status: "declined",
        responded_at: new Date().toISOString(),
        decline_reason: declineReason ?? null,
      })
      .eq("id", invitation.id);

    // The decliner is excluded automatically — match_promoters skips anyone with a
    // declined invitation for this shift.
    const replacements = await matchPromoters(invitation.shift_id, 3);
    return { ok: true, answer: "decline", replacements };
  }

  await db
    .from("invitations")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("id", invitation.id);

  await db.from("assignments").upsert(
    {
      agency_id: invitation.agency_id,
      shift_id: invitation.shift_id,
      promoter_id: invitation.promoter_id,
      status: "confirmed",
    },
    { onConflict: "shift_id,promoter_id" },
  );

  await refreshShiftStatus(invitation.shift_id);
  return { ok: true, answer: "accept" };
}

/** Keep `shifts.status` consistent with confirmed assignments. */
export async function refreshShiftStatus(shiftId: string): Promise<void> {
  const db = createAdminClient();

  const { data: shift } = await db
    .from("shifts")
    .select("promoters_required")
    .eq("id", shiftId)
    .single();
  if (!shift) return;

  const { count } = await db
    .from("assignments")
    .select("id", { count: "exact", head: true })
    .eq("shift_id", shiftId)
    .eq("status", "confirmed");

  const filled = count ?? 0;
  const status =
    filled === 0 ? "open" : filled >= shift.promoters_required ? "filled" : "partially_filled";

  await db.from("shifts").update({ status }).eq("id", shiftId);
}
