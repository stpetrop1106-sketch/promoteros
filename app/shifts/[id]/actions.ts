"use server";

import { revalidatePath } from "next/cache";
import { createInvitation, refreshShiftStatus } from "@/lib/invitations";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

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
