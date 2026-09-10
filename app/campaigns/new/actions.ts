"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEntitlement, checkBilling } from "@/lib/billing/subscription";
import {
  fieldErrorsFromZodError,
  optionalText,
  parseEurosToCents,
  requiredText,
  type FormState,
} from "@/app/campaigns/_shared";

type CampaignField =
  | "clientId"
  | "newClientName"
  | "name"
  | "campaignType"
  | "startsOn"
  | "endsOn"
  | "dressCode"
  | "rateEuros";

export type CampaignFormState = FormState<CampaignField>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const schema = z
  .object({
    clientMode: z.enum(["existing", "new"]),
    clientId: z.string().optional(),
    newClientName: z.string().max(200, "campaigns.validation.too_long").optional(),
    name: z
      .string()
      .trim()
      .min(2, "campaigns.validation.name_length")
      .max(200, "campaigns.validation.too_long"),
    campaignType: z.string().max(120, "campaigns.validation.too_long").optional(),
    startsOn: z.string().regex(DATE_RE, "campaigns.validation.date_invalid"),
    endsOn: z.string().regex(DATE_RE, "campaigns.validation.date_invalid"),
    dressCode: z.string().max(500, "campaigns.validation.too_long").optional(),
    rateEuros: z.string().refine((v) => parseEurosToCents(v) !== null, "campaigns.validation.rate_invalid"),
    skillIds: z.array(z.string()).default([]),
  })
  .refine((v) => v.endsOn >= v.startsOn, {
    message: "campaigns.validation.date_order",
    path: ["endsOn"],
  })
  .refine((v) => v.clientMode !== "existing" || Boolean(v.clientId), {
    message: "campaigns.validation.client_required",
    path: ["clientId"],
  })
  .refine((v) => v.clientMode !== "new" || (v.newClientName?.trim().length ?? 0) >= 2, {
    message: "campaigns.validation.new_client_name",
    path: ["newClientName"],
  });

export async function createCampaign(
  _prev: CampaignFormState,
  formData: FormData,
): Promise<CampaignFormState> {
  const user = await requireUser();

  // P24 — creating a campaign is new operational commitment, the canonical "write" checkBilling
  // exists to stop once an agency is read-only (docs/commercial-architecture.md §3). Checked
  // before the form is even parsed, same as app/promoters/actions.ts's
  // checkPromoterCreationAllowed(): no reason to validate fields the request will be refused
  // anyway. "write" only ever returns the "subscription_read_only" block (limits are
  // add_promoter/add_staff only), so there is exactly one message to give.
  const entitlement = await getEntitlement(user.agencyId);
  if (entitlement && !checkBilling(entitlement, "write").allowed) {
    return { status: "error", formError: "enforcement.campaigns.blocked_read_only_create" };
  }

  const db = await createServerSupabase();

  const parsed = schema.safeParse({
    clientMode: requiredText(formData.get("clientMode")) || "existing",
    clientId: optionalText(formData.get("clientId")),
    newClientName: optionalText(formData.get("newClientName")),
    name: requiredText(formData.get("name")),
    campaignType: optionalText(formData.get("campaignType")),
    startsOn: requiredText(formData.get("startsOn")),
    endsOn: requiredText(formData.get("endsOn")),
    dressCode: optionalText(formData.get("dressCode")),
    rateEuros: requiredText(formData.get("rateEuros")),
    skillIds: formData.getAll("skillIds").map(String),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFromZodError<CampaignField>(parsed.error) };
  }

  const data = parsed.data;

  let clientId = data.clientId ?? null;

  if (data.clientMode === "new") {
    // `clients (agency_id, name)` is unique — upsert so a coordinator retyping an existing
    // client's name lands on that client instead of a confusing duplicate-key error. Only the
    // conflict-key columns are in the payload, so an existing client's `notes` is never clobbered.
    const { data: client, error: clientErr } = await db
      .from("clients")
      .upsert({ agency_id: user.agencyId, name: data.newClientName!.trim() }, { onConflict: "agency_id,name" })
      .select("id")
      .single();

    if (clientErr || !client) {
      return { status: "error", formError: "campaigns.new.error.client_save_failed" };
    }
    clientId = client.id;
  }

  if (!clientId) {
    return {
      status: "error",
      fieldErrors: { clientId: "campaigns.validation.client_required" },
    };
  }

  const { data: campaign, error: campaignErr } = await db
    .from("campaigns")
    .insert({
      agency_id: user.agencyId,
      client_id: clientId,
      name: data.name,
      campaign_type: data.campaignType ?? null,
      starts_on: data.startsOn,
      ends_on: data.endsOn,
      dress_code: data.dressCode ?? null,
      rate_cents: parseEurosToCents(data.rateEuros) ?? 0,
      status: "draft",
    })
    .select("id")
    .single();

  if (campaignErr || !campaign) {
    return { status: "error", formError: "campaigns.new.error.save_failed" };
  }

  if (data.skillIds.length > 0) {
    // Non-fatal on purpose: the campaign row already exists and is the thing the coordinator was
    // waiting for. Skills can be revisited; failing the whole flow here would be worse than a
    // campaign with no skills attached yet.
    await db
      .from("campaign_skills")
      .insert(data.skillIds.map((skillId) => ({ campaign_id: campaign.id, skill_id: skillId })));
  }

  revalidatePath("/campaigns");
  redirect(`/campaigns/${campaign.id}`);
}
