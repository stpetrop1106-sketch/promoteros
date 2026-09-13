"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEntitlement, checkBilling } from "@/lib/billing/subscription";
import { createProgramme, renameProgramme, setProgrammeArchived } from "@/lib/programmes";
import type { CreateSectionState, RenameSectionState } from "./state";

/**
 * Creates a new section ("ενότητα") inside one campaign. RLS-scoped client only — never the admin
 * client from a coordinator page (CLAUDE.md §4) — and gated the same way
 * `app/campaigns/[id]/shifts/new/actions.ts`'s `createShifts` gates a new operational commitment.
 */
export async function createSection(
  _prev: CreateSectionState,
  formData: FormData,
): Promise<CreateSectionState> {
  const user = await requireUser();

  const entitlement = await getEntitlement(user.agencyId);
  if (entitlement && !checkBilling(entitlement, "write").allowed) {
    return { status: "error", formError: "shifts.sections.error.blocked_read_only" };
  }

  const name = String(formData.get("name") ?? "").trim();
  const campaignId = String(formData.get("campaignId") ?? "").trim();

  if (!campaignId) {
    return { status: "error", fieldErrors: { campaignId: "shifts.sections.validation.campaign_required" } };
  }
  if (name.length < 1 || name.length > 120) {
    return { status: "error", fieldErrors: { name: "shifts.sections.validation.name_invalid" } };
  }

  const db = await createServerSupabase();
  const result = await createProgramme(db, { agencyId: user.agencyId, campaignId, name });

  if (!result.ok) {
    return {
      status: "error",
      formError:
        result.error === "invalid"
          ? "shifts.sections.validation.campaign_required"
          : "shifts.sections.error.save_failed",
    };
  }

  revalidatePath("/shifts");
  revalidatePath(`/campaigns/${campaignId}`);
  return { status: "idle" };
}

/** Renames one section. Same RLS-only shape as `app/shifts/[id]/actions.ts`'s `cancelAssignment`. */
export async function renameSection(
  _prev: RenameSectionState,
  formData: FormData,
): Promise<RenameSectionState> {
  const user = await requireUser();

  const entitlement = await getEntitlement(user.agencyId);
  if (entitlement && !checkBilling(entitlement, "write").allowed) {
    return { status: "error", formError: "shifts.sections.error.blocked_read_only" };
  }

  const programmeId = String(formData.get("programmeId") ?? "");
  const name = String(formData.get("name") ?? "");
  if (!programmeId) return { status: "error", formError: "shifts.sections.error.save_failed" };

  const db = await createServerSupabase();
  const result = await renameProgramme(db, programmeId, name);

  if (!result.ok) {
    return {
      status: "error",
      formError:
        result.error === "invalid"
          ? "shifts.sections.validation.name_invalid"
          : "shifts.sections.error.save_failed",
    };
  }

  revalidatePath("/shifts");
  return { status: "done" };
}

/**
 * Archives or unarchives a section. Bound as `setSectionArchived.bind(null, programmeId, true)`
 * and used directly as a `<form action>`, the same contract as
 * `app/campaigns/[id]/actions.ts`'s `setCampaignStatus` — no way to surface a specific message
 * here, so a blocked or failed request silently no-ops, which is acceptable for a reversible,
 * non-destructive toggle (archiving never deletes the shifts inside a section).
 */
export async function setSectionArchived(
  programmeId: string,
  archived: boolean,
  _formData: FormData,
): Promise<void> {
  const user = await requireUser();

  const entitlement = await getEntitlement(user.agencyId);
  if (entitlement && !checkBilling(entitlement, "write").allowed) return;

  const db = await createServerSupabase();
  await setProgrammeArchived(db, programmeId, archived);

  revalidatePath("/shifts");
}
