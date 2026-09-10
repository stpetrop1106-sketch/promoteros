"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEntitlement, checkBilling } from "@/lib/billing/subscription";
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
  const user = await requireUser();

  // P24 — a status change is exactly checkBilling's own worked example of "write" ("edit a
  // campaign"), and unlike app/shifts/[id]/actions.ts's cancelAssignment this is not a factual
  // correction forced on the agency by someone else's action (a no-show, a decline) — it is the
  // coordinator's own deliberate decision, for every transition including "cancelled". So it is
  // gated the same as any other edit, not carved out. No way to surface a specific message here:
  // this action returns void and is bound straight to a plain <form action> in
  // app/campaigns/[id]/page.tsx (not owned by this parcel), so a blocked request silently no-ops
  // — the same behaviour this function already has for an invalid transition, two lines below.
  // See docs/status/P24.md for the request to that page's owner to surface this.
  const entitlement = await getEntitlement(user.agencyId);
  if (entitlement && !checkBilling(entitlement, "write").allowed) return;

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
