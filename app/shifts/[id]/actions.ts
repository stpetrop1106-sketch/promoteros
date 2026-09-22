"use server";

import { revalidatePath } from "next/cache";
import { createInvitation, refreshShiftStatus } from "@/lib/invitations";
import { createCheckinLink, checkinLinkTtlHours } from "@/lib/checkins";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { getEntitlement, checkBilling } from "@/lib/billing/subscription";
import { linkFor, mintTokenAt } from "@/lib/tokens";
import { formatShiftWhen } from "@/lib/shift-format";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import type { CancelInvitationState, ResendInvitationState } from "./state";

const t = translatorFor(DEFAULT_LOCALE);

export type InviteState = {
  status: "idle" | "sent" | "manual" | "error";
  /** Present when the adapter could not deliver — the coordinator pastes this themselves. */
  manualBody?: string;
  url?: string;
  reason?: string;
};

export type CancelAssignmentState = {
  status: "idle" | "done" | "error";
  reason?: string;
};

export type MarkNoShowState = {
  status: "idle" | "done" | "error";
  reason?: string;
};

export async function invite(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const shiftId = String(formData.get("shiftId") ?? "");
  const promoterId = String(formData.get("promoterId") ?? "");

  if (!shiftId || !promoterId) return { status: "error", reason: "missing_ids" };

  // A server action is a public HTTP endpoint: both ids arrive from the browser and neither can
  // be trusted. Re-check them through the RLS-scoped client before doing anything, because
  // `createInvitation` runs on the service role and would happily invite across tenants.
  await requireUser();
  const db = await createServerSupabase();

  const [{ data: shift }, { data: promoter }] = await Promise.all([
    db.from("shifts").select("id").eq("id", shiftId).maybeSingle(),
    db.from("promoters").select("id").eq("id", promoterId).maybeSingle(),
  ]);

  if (!shift || !promoter) return { status: "error", reason: "not_found" };

  try {
    const result = await createInvitation(shiftId, promoterId);
    revalidatePath(`/shifts/${shiftId}`);

    return result.delivered
      ? { status: "sent", url: result.url }
      : { status: "manual", manualBody: result.manualBody ?? "", url: result.url };
  } catch (err) {
    return { status: "error", reason: err instanceof Error ? err.message : "unknown" };
  }
}

/**
 * Cancel a confirmed assignment (a coordinator learns of this by phone). Unlike `invite`, this
 * does the whole write through the RLS-scoped client — no admin client is reachable here at
 * all — because both ids belong to an ordinary signed-in coordinator action, not an anonymous
 * promoter one. RLS closes the tenant boundary on the select *and* the update.
 *
 * Keeps `shifts.status` consistent the same way `respondToInvitation` does: by calling the
 * shared `refreshShiftStatus` after the write, never by computing status locally.
 */
/**
 * ---------------------------------------------------------------------------------------------
 * A1-05: why the three actions below carry NO billing gate, on purpose
 * ---------------------------------------------------------------------------------------------
 * The audit lists `cancelAssignment`, `markNoShow` and `mintCheckinLink` as write paths with no
 * `checkBilling()`. They stay that way, for the reason P27 already gave for `revokeInvitation`
 * and `removeMember`: a read-only agency must not be *trapped*, only prevented from taking on
 * anything new.
 *
 *   cancelAssignment  frees capacity rather than consuming it. Blocking it leaves an agency
 *                     unable to unstaff a shift it cannot run — and the promoter travels to a
 *                     store for work that is not happening.
 *   markNoShow        records something that has already happened. Refusing to write it does not
 *                     undo the no-show; it only corrupts the record the agency bills from, and
 *                     the reliability score the matching engine reads.
 *   mintCheckinLink   serves a shift that was already confirmed while the subscription was live.
 *                     Blocking it strands a promoter at the door with no way to check in.
 *
 * `reoffer` further down DOES carry the gate: it creates a new invitation, which is exactly the
 * new commitment commercial-architecture.md §3 says a read-only agency does not get to make.
 */
export async function cancelAssignment(
  _prev: CancelAssignmentState,
  formData: FormData,
): Promise<CancelAssignmentState> {
  const shiftId = String(formData.get("shiftId") ?? "");
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const cancelReason = String(formData.get("cancelReason") ?? "").trim();

  if (!shiftId || !assignmentId) return { status: "error", reason: "missing_ids" };

  await requireUser();
  const db = await createServerSupabase();

  const { data: assignment } = await db
    .from("assignments")
    .select("id, shift_id, status")
    .eq("id", assignmentId)
    .maybeSingle();

  if (!assignment || assignment.shift_id !== shiftId) {
    return { status: "error", reason: "not_found" };
  }
  if (assignment.status !== "confirmed") {
    return { status: "error", reason: "not_confirmed" };
  }

  const { error } = await db
    .from("assignments")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancel_reason: cancelReason || null,
    })
    .eq("id", assignmentId);

  if (error) return { status: "error", reason: "save_failed" };

  await refreshShiftStatus(shiftId);
  revalidatePath(`/shifts/${shiftId}`);
  return { status: "done" };
}

/**
 * Mark a confirmed assignment a no-show. Same RLS-only shape as `cancelAssignment` — see there
 * for why no admin client is involved. Also refreshes `shifts.status`: a no-show reduces the
 * confirmed count exactly like a cancellation, and the shift is under-covered again either way.
 */
export async function markNoShow(
  _prev: MarkNoShowState,
  formData: FormData,
): Promise<MarkNoShowState> {
  const shiftId = String(formData.get("shiftId") ?? "");
  const assignmentId = String(formData.get("assignmentId") ?? "");

  if (!shiftId || !assignmentId) return { status: "error", reason: "missing_ids" };

  await requireUser();
  const db = await createServerSupabase();

  const { data: assignment } = await db
    .from("assignments")
    .select("id, shift_id, status")
    .eq("id", assignmentId)
    .maybeSingle();

  if (!assignment || assignment.shift_id !== shiftId) {
    return { status: "error", reason: "not_found" };
  }
  if (assignment.status !== "confirmed") {
    return { status: "error", reason: "not_confirmed" };
  }

  const { error } = await db.from("assignments").update({ status: "no_show" }).eq("id", assignmentId);
  if (error) return { status: "error", reason: "save_failed" };

  await refreshShiftStatus(shiftId);
  revalidatePath(`/shifts/${shiftId}`);
  return { status: "done" };
}

export type MintCheckinLinkState =
  | { status: "idle" }
  | { status: "ready"; url: string; message: string }
  | { status: "error"; reason: string };

/**
 * P38 — "Σύνδεσμος check-in" on a confirmed row of the shift board. Closes the gap the manager
 * found: `createCheckinLink` (`lib/checkins.ts`) had no caller anywhere in the product before
 * this. RLS-only, same shape as `cancelAssignment`/`markNoShow` above — no admin client reachable
 * here, both ids belong to an ordinary signed-in coordinator action.
 *
 * The TTL is computed from the shift's own end time (`checkinLinkTtlHours`) rather than left at
 * `createCheckinLink`'s default: a coordinator can mint this the moment a shift is confirmed,
 * days or weeks before it happens, and the link must still work on the day.
 */
export async function mintCheckinLink(
  _prev: MintCheckinLinkState,
  formData: FormData,
): Promise<MintCheckinLinkState> {
  const shiftId = String(formData.get("shiftId") ?? "");
  const assignmentId = String(formData.get("assignmentId") ?? "");
  if (!shiftId || !assignmentId) return { status: "error", reason: "missing_ids" };

  await requireUser();
  const db = await createServerSupabase();

  const { data: assignment } = await db
    .from("assignments")
    .select("id, shift_id, status, promoters(full_name, phone)")
    .eq("id", assignmentId)
    .maybeSingle();

  if (!assignment || assignment.shift_id !== shiftId) {
    return { status: "error", reason: "not_found" };
  }
  if (assignment.status !== "confirmed") {
    return { status: "error", reason: "not_confirmed" };
  }

  const { data: shift } = await db
    .from("shifts")
    .select("on_date, start_time, end_time, campaigns(name), stores(name)")
    .eq("id", shiftId)
    .maybeSingle();
  if (!shift) return { status: "error", reason: "not_found" };

  const startTime = String(shift.start_time).slice(0, 5);
  const endTime = String(shift.end_time).slice(0, 5);
  const ttlHours = checkinLinkTtlHours(shift.on_date, endTime);
  const { url } = await createCheckinLink(assignmentId, ttlHours);

  const promoter = assignment.promoters as unknown as { full_name: string; phone: string } | null;
  const campaign = shift.campaigns as unknown as { name: string } | null;
  const store = shift.stores as unknown as { name: string } | null;

  const message = [
    promoter?.full_name
      ? t("shifts.board.checkin_link.message.greeting", { name: promoter.full_name })
      : null,
    t("shifts.board.checkin_link.message.body"),
    [campaign?.name, store?.name].filter(Boolean).join(" · "),
    `${shift.on_date} · ${startTime}–${endTime}`,
    url,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

  return { status: "ready", url, message };
}


// ---------------------------------------------------------------------------------------------
// A2 finding 7 — recovering a pending invitation
// ---------------------------------------------------------------------------------------------
//
// Once "Αποστολή πρόσκλησης" had been pressed, the message and its link were shown once and were
// then reachable from nowhere: the board row for an `awaiting_reply` promoter had an empty
// ΕΝΕΡΓΕΙΕΣ column, and `/promoters/[id]/invite` refused a second invitation with
// «Έχει ήδη ανοιχτή πρόσκληση για αυτή τη βάρδια.» The default transport is `ClipboardAdapter`
// (CLAUDE.md, Messaging) — the coordinator pastes the link by hand — so losing the clipboard is
// not an edge case, it is Tuesday. The promoter never hears about the shift, the coordinator
// cannot re-send, and the shift sits on "awaiting reply" until it expires.
//
// Two actions close that: rebuild the link (below), and cancel the invitation so the block can be
// cleared deliberately and somebody else offered the shift.

/**
 * Rebuild the exact link an open invitation was sent with.
 *
 * Nothing is written and nothing is invalidated: a token is a pure function of purpose, record
 * id, expiry and the signing secret, and `invitations.expires_at` holds the expiry — so the
 * token this produces hashes to the `token_hash` already on the row, and the message the
 * promoter may still have keeps working. The stored hash is compared before the link is handed
 * back, so a rotated `TOKEN_SIGNING_SECRET` produces a refusal rather than a dead link.
 */
export async function resendInvitationLink(
  _prev: ResendInvitationState,
  formData: FormData,
): Promise<ResendInvitationState> {
  const shiftId = String(formData.get("shiftId") ?? "");
  const invitationId = String(formData.get("invitationId") ?? "");
  if (!shiftId || !invitationId) return { status: "error", reason: "missing_ids" };

  const user = await requireUser();

  // Re-offering a shift is a "write" in checkBilling's own terms. A read-only agency cannot
  // create an invitation (lib/invitations.ts gates that); it must not be able to push an
  // existing one out either, and — A2 finding 12 — it must be told so rather than met with a
  // button that does nothing.
  const entitlement = await getEntitlement(user.agencyId);
  if (entitlement && !checkBilling(entitlement, "write").allowed) {
    return { status: "error", reason: "blocked_read_only" };
  }

  const db = await createServerSupabase();

  const { data: invitation } = await db
    .from("invitations")
    .select("id, shift_id, status, expires_at, token_hash")
    .eq("id", invitationId)
    .maybeSingle();

  if (!invitation || invitation.shift_id !== shiftId) {
    return { status: "error", reason: "not_found" };
  }
  if (invitation.status !== "pending") return { status: "error", reason: "not_pending" };

  const expiresAt = new Date(invitation.expires_at);
  if (Number.isNaN(expiresAt.getTime())) return { status: "error", reason: "not_found" };
  if (expiresAt.getTime() <= Date.now()) return { status: "error", reason: "invitation_expired" };

  const { token, tokenHash } = mintTokenAt("invitation", invitation.id, expiresAt);
  if (tokenHash !== invitation.token_hash) {
    // The row was minted under a different signing secret. Handing this link over would produce
    // "Ο σύνδεσμος δεν είναι έγκυρος" on the promoter's phone, which is worse than saying so here.
    return { status: "error", reason: "link_unavailable" };
  }

  const { data: shift } = await db
    .from("shifts")
    .select("on_date, start_time, end_time, campaigns(name), stores(name)")
    .eq("id", shiftId)
    .maybeSingle();
  if (!shift) return { status: "error", reason: "not_found" };

  const campaign = shift.campaigns as unknown as { name: string } | null;
  const store = shift.stores as unknown as { name: string } | null;
  const url = linkFor(token, "invitation");

  const message = [
    t("shifts.board.invite_link.message.intro"),
    [campaign?.name, store?.name].filter(Boolean).join(" · "),
    formatShiftWhen(shift.on_date, String(shift.start_time), String(shift.end_time)),
    t("shifts.board.invite_link.message.cta"),
    url,
  ]
    .filter((line) => Boolean(line))
    .join("\n");

  return { status: "ready", url, message };
}

/**
 * Withdraw an open invitation, so the shift can be offered to someone else.
 *
 * `superseded` rather than `expired`: expiry is something the clock does, this is something the
 * coordinator did. It is also the one status `match_promoters`' hard filter does not exclude on
 * (0007_match_radius.sql lists 'pending', 'accepted', 'declined'), so the promoter becomes a
 * candidate again immediately — which is the point.
 *
 * Deliberately NOT billing-gated: like `cancelAssignment` and `revokeInvitation`, this releases
 * capacity rather than consuming it, and an agency that cannot withdraw an offer it can no longer
 * honour is worse off than one that can. Same reasoning docs/status/P27.md records for the other
 * release-shaped actions, and docs/audit/security.md's A1-05 recommends.
 */
export async function cancelInvitation(
  _prev: CancelInvitationState,
  formData: FormData,
): Promise<CancelInvitationState> {
  const shiftId = String(formData.get("shiftId") ?? "");
  const invitationId = String(formData.get("invitationId") ?? "");
  if (!shiftId || !invitationId) return { status: "error", reason: "missing_ids" };

  await requireUser();
  const db = await createServerSupabase();

  const { data: invitation } = await db
    .from("invitations")
    .select("id, shift_id, status")
    .eq("id", invitationId)
    .maybeSingle();

  if (!invitation || invitation.shift_id !== shiftId) {
    return { status: "error", reason: "not_found" };
  }
  if (invitation.status !== "pending") return { status: "error", reason: "not_pending" };

  const { error } = await db
    .from("invitations")
    .update({ status: "superseded", responded_at: new Date().toISOString() })
    .eq("id", invitationId)
    .eq("status", "pending");

  if (error) return { status: "error", reason: "save_failed" };

  await refreshShiftStatus(shiftId);
  revalidatePath(`/shifts/${shiftId}`);
  return { status: "done" };
}
