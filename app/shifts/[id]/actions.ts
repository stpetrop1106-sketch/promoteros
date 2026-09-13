"use server";

import { revalidatePath } from "next/cache";
import { createInvitation, refreshShiftStatus } from "@/lib/invitations";
import { createCheckinLink, checkinLinkTtlHours } from "@/lib/checkins";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";

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
