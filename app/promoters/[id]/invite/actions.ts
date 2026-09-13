"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getEntitlement, checkBilling } from "@/lib/billing/subscription";
import { createInvitation } from "@/lib/invitations";
import { loadEligibilityForShift } from "./data";
import type { SendInviteState } from "./state";

/**
 * Send an invitation from a promoter's own profile, to a shift the coordinator picked — possibly
 * one the matching engine never suggested. `lib/invitations.ts`'s `createInvitation` itself does
 * not enforce any of P38's eligibility rules (it will happily invite an archived or blocklisted
 * promoter, or double-book them) — that engine-shaped gate lives entirely in
 * `lib/invite-eligibility.ts`, so it has to be applied here, in application code, before
 * `createInvitation` is ever called.
 *
 * The panel the coordinator loaded is a hint, not the authority: `loadEligibilityForShift`
 * re-reads the database from scratch — the shift can have filled, or a second invitation for the
 * same promoter can have landed, in the time between loading the panel and pressing send.
 */
export async function sendInviteFromProfile(
  _prev: SendInviteState,
  formData: FormData,
): Promise<SendInviteState> {
  const promoterId = String(formData.get("promoterId") ?? "");
  const shiftId = String(formData.get("shiftId") ?? "");
  if (!promoterId || !shiftId) return { status: "error", reason: "missing_ids" };

  const user = await requireUser();

  // Same "write" gate as every other mutation in this codebase (app/campaigns/new/actions.ts,
  // app/promoters/[id]/availability/data.ts): a read-only agency must not be able to send a new
  // offer, checked before doing anything else costs a query on a request that will be refused.
  const entitlement = await getEntitlement(user.agencyId);
  if (entitlement && !checkBilling(entitlement, "write").allowed) {
    return { status: "error", reason: "blocked_read_only" };
  }

  const check = await loadEligibilityForShift(promoterId, shiftId);
  if (!check.ok) return { status: "error", reason: "not_found" };
  if (!check.canSend) return { status: "blocked", reasons: check.blocking };

  try {
    const result = await createInvitation(shiftId, promoterId);
    revalidatePath(`/promoters/${promoterId}`);
    revalidatePath(`/promoters/${promoterId}/invite`);

    return result.delivered
      ? { status: "sent", url: result.url }
      : { status: "manual", manualBody: result.manualBody ?? "", url: result.url };
  } catch {
    // Never surface `Error#message` to the promoter-facing… no, this is coordinator-facing, but
    // still: an internal message ("Shift not found", a Postgres error) is not a sentence a
    // coordinator should have to read. A short, known code maps to one Greek sentence below.
    return { status: "error", reason: "unknown" };
  }
}
