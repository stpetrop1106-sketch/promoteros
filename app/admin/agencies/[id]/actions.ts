"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/admin/guard";
import {
  viewAgencyActivity,
  extendTrial,
  changePlan,
  suspendAgency,
  unsuspendAgency,
  markDeletionRequest,
  clearDeletionRequest,
  isAssignablePlan,
  type AgencyActivity,
} from "@/lib/admin/agencies";
import { adminErrorCode, type AdminErrorCode, REASON_MIN_LENGTH } from "@/lib/admin/errors";

/**
 * Every action here re-derives admin membership with `requirePlatformAdmin()` first — a server
 * action is a public HTTP endpoint, exactly like `app/settings/team/actions.ts` says about
 * PostgREST. The database repeats the same check inside every `0013_admin.sql` function, so a
 * skipped or bypassed call to this file still cannot reach another agency's data.
 *
 * Each mutating action's real security boundary is the database function; the validation here
 * exists so the coordinator — a platform admin, in this file — gets a specific, useful message
 * instead of a raised exception, exactly like `lib/team.ts`'s comment about the same split.
 */

// State types and their initial values live in `./state` — a "use server" module may only export
// async functions, and anything else reaches the client as `undefined`. Import them from there,
// and do NOT re-export them from here: a re-export is still an export.
import type { ActivityState, MutationState } from "./state";

/**
 * Bind with the agency id: `loadAgencyActivity.bind(null, agencyId)`. Logs an audit row (inside
 * `admin_view_agency_activity`) before the data is fetched — the caller only ever sees the data
 * after the log write has already committed.
 */
export async function loadAgencyActivity(
  agencyId: string,
  _prev: ActivityState,
  formData: FormData,
): Promise<ActivityState> {
  await requirePlatformAdmin();

  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < REASON_MIN_LENGTH) return { status: "error", code: "reason_required" };

  const result = await viewAgencyActivity(agencyId, reason);
  if (!result.ok) return { status: "error", code: result.code };
  return { status: "loaded", activity: result.data };
}


function readReason(formData: FormData): string | null {
  const reason = String(formData.get("reason") ?? "").trim();
  return reason.length >= REASON_MIN_LENGTH ? reason : null;
}

function refresh(agencyId: string) {
  revalidatePath(`/admin/agencies/${agencyId}`);
  revalidatePath("/admin/agencies");
}

export async function runExtendTrial(
  agencyId: string,
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  await requirePlatformAdmin();

  const reason = readReason(formData);
  if (!reason) return { status: "error", code: "reason_required" };

  const days = Number(formData.get("days"));
  if (!Number.isFinite(days) || days <= 0 || days > 365) {
    return { status: "error", code: "invalid_days" };
  }

  const result = await extendTrial(agencyId, Math.trunc(days), reason);
  if (!result.ok) return { status: "error", code: result.code };

  refresh(agencyId);
  return { status: "done", value: result.data };
}

export async function runChangePlan(
  agencyId: string,
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  await requirePlatformAdmin();

  const reason = readReason(formData);
  if (!reason) return { status: "error", code: "reason_required" };

  const plan = String(formData.get("plan") ?? "");
  if (!isAssignablePlan(plan)) return { status: "error", code: "invalid_plan" };

  const result = await changePlan(agencyId, plan, reason);
  if (!result.ok) return { status: "error", code: result.code };

  refresh(agencyId);
  return { status: "done", value: result.data };
}

export async function runSuspend(
  agencyId: string,
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  await requirePlatformAdmin();

  const reason = readReason(formData);
  if (!reason) return { status: "error", code: "reason_required" };

  const result = await suspendAgency(agencyId, reason);
  if (!result.ok) return { status: "error", code: result.code };

  refresh(agencyId);
  return { status: "done", value: result.data };
}

export async function runUnsuspend(
  agencyId: string,
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  await requirePlatformAdmin();

  const reason = readReason(formData);
  if (!reason) return { status: "error", code: "reason_required" };

  const result = await unsuspendAgency(agencyId, reason);
  if (!result.ok) return { status: "error", code: result.code };

  refresh(agencyId);
  return { status: "done" };
}

export async function runMarkDeletion(
  agencyId: string,
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  await requirePlatformAdmin();

  const reason = readReason(formData);
  if (!reason) return { status: "error", code: "reason_required" };

  const result = await markDeletionRequest(agencyId, reason);
  if (!result.ok) return { status: "error", code: result.code };

  refresh(agencyId);
  return { status: "done", value: result.data };
}

export async function runClearDeletion(
  agencyId: string,
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  await requirePlatformAdmin();

  const reason = readReason(formData);
  if (!reason) return { status: "error", code: "reason_required" };

  const result = await clearDeletionRequest(agencyId, reason);
  if (!result.ok) return { status: "error", code: result.code };

  refresh(agencyId);
  return { status: "done" };
}

// `mapAdminError` used to live here as a sync re-export of `adminErrorCode`. A "use server"
// module may only export ASYNC functions, so it failed the production build — and it had no
// callers: `lib/admin/errors.ts` is not server-only, so client components import
// `adminErrorCode` from there directly.
