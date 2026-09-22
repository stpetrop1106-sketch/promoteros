"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEntitlement, checkBilling } from "@/lib/billing/subscription";
import type { CampaignStatus } from "@/app/campaigns/_shared";
import type { CampaignStatusState } from "./state";

// Allowed forward moves. Terminal states (`completed`, `cancelled`) have none — status change is
// the "edit" surface for a campaign in v1; there is no path back out of them, on purpose.
const TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ["active", "cancelled"],
  active: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

const STATUSES = ["draft", "active", "completed", "cancelled"] as const;

function isCampaignStatus(value: string): value is CampaignStatus {
  return (STATUSES as readonly string[]).includes(value);
}

/**
 * Move a campaign's status.
 *
 * **A2 finding 12.** This used to be bound as `setCampaignStatus.bind(null, id, "active")` and
 * used directly as a `<form action>`, so it returned `void` and could not report anything. When
 * the billing guard refused — a `canceled` agency, or one past its 14-day grace — it simply
 * `return`ed: no message, no state change, no console error. The customer most likely to meet
 * that is a paying one whose card has just failed, which is the worst possible moment for the
 * product to stop responding without saying why. It is now a `useActionState` action, like
 * `renameSection` in `app/shifts/sections/actions.ts`, and every refusal has a sentence.
 *
 * The guard itself is unchanged and is still the real enforcement: a disabled button is a
 * courtesy, a server action is a public HTTP endpoint.
 */
export async function setCampaignStatus(
  _prev: CampaignStatusState,
  formData: FormData,
): Promise<CampaignStatusState> {
  const user = await requireUser();

  // P24 — a status change is exactly checkBilling's own worked example of "write" ("edit a
  // campaign"), and unlike app/shifts/[id]/actions.ts's cancelAssignment this is not a factual
  // correction forced on the agency by someone else's action (a no-show, a decline) — it is the
  // coordinator's own deliberate decision, for every transition including "cancelled". So it is
  // gated the same as any other edit, not carved out.
  const entitlement = await getEntitlement(user.agencyId);
  if (entitlement && !checkBilling(entitlement, "write").allowed) {
    return { status: "error", error: "enforcement.campaigns.blocked_read_only_status" };
  }

  const campaignId = String(formData.get("campaignId") ?? "").trim();
  const nextRaw = String(formData.get("next") ?? "").trim();

  if (!campaignId || !isCampaignStatus(nextRaw)) {
    return { status: "error", error: "campaigns.detail.status_error.save_failed" };
  }
  const next: CampaignStatus = nextRaw;

  const db = await createServerSupabase();

  const { data: campaign } = await db
    .from("campaigns")
    .select("id, status")
    .eq("id", campaignId)
    .maybeSingle();

  if (!campaign) {
    return { status: "error", error: "campaigns.validation.campaign_not_found" };
  }

  const allowed = TRANSITIONS[campaign.status as CampaignStatus] ?? [];
  if (!allowed.includes(next)) {
    // Someone else moved it while this page was open — say so rather than no-op.
    return { status: "error", error: "campaigns.detail.status_error.transition" };
  }

  const { error } = await db.from("campaigns").update({ status: next }).eq("id", campaignId);
  if (error) {
    return { status: "error", error: "campaigns.detail.status_error.save_failed" };
  }

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/campaigns");
  return { status: "done" };
}
