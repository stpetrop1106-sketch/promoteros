"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import type { CampaignStatus } from "@/app/campaigns/_shared";

// Allowed forward moves. Terminal states (`completed`, `cancelled`) have none — status change is
// the "edit" surface for a campaign in v1; there is no path back out of them, on purpose.
const TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ["active", "cancelled"],
  active: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

/**
 * Bound as `setCampaignStatus.bind(null, campaignId, "active")` and used directly as a
 * `<form action>` — the trailing `formData` parameter is required by that contract even though
 * this action never reads it (no fields, just a confirmation click).
 */
export async function setCampaignStatus(
  campaignId: string,
  next: CampaignStatus,
  _formData: FormData,
): Promise<void> {
  await requireUser();
  const db = await createServerSupabase();

  const { data: campaign } = await db
    .from("campaigns")
    .select("id, status")
    .eq("id", campaignId)
    .maybeSingle();

  if (!campaign) return;

  const allowed = TRANSITIONS[campaign.status as CampaignStatus] ?? [];
  if (!allowed.includes(next)) return;

  await db.from("campaigns").update({ status: next }).eq("id", campaignId);

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/campaigns");
}
