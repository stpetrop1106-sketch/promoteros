"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { fieldErrorsFromZodError, requiredText, type FormState } from "@/app/campaigns/_shared";

type BriefField = "title" | "bodyMd";

export type BriefFormState = FormState<BriefField>;

const schema = z.object({
  campaignId: z.string(),
  title: z.string().trim().min(2, "campaigns.validation.name_length").max(200, "campaigns.validation.too_long"),
  bodyMd: z.string().trim().min(1, "campaigns.validation.required").max(20000, "campaigns.validation.too_long"),
  intent: z.enum(["draft", "publish"]),
});

export async function saveBrief(_prev: BriefFormState, formData: FormData): Promise<BriefFormState> {
  const user = await requireUser();
  const db = await createServerSupabase();

  const parsed = schema.safeParse({
    campaignId: requiredText(formData.get("campaignId")),
    title: requiredText(formData.get("title")),
    bodyMd: requiredText(formData.get("bodyMd")),
    intent: requiredText(formData.get("intent")) || "draft",
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFromZodError<BriefField>(parsed.error) };
  }

  const data = parsed.data;

  const { data: campaign } = await db.from("campaigns").select("id").eq("id", data.campaignId).maybeSingle();
  if (!campaign) {
    return { status: "error", formError: "campaigns.validation.campaign_not_found" };
  }

  const { data: existing } = await db
    .from("briefs")
    .select("id")
    .eq("campaign_id", data.campaignId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload: { title: string; body_md: string; published_at?: string } = {
    title: data.title,
    body_md: data.bodyMd,
  };
  if (data.intent === "publish") payload.published_at = new Date().toISOString();

  const { error } = existing
    ? await db.from("briefs").update(payload).eq("id", existing.id)
    : await db.from("briefs").insert({ agency_id: user.agencyId, campaign_id: data.campaignId, ...payload });

  if (error) {
    return { status: "error", formError: "campaigns.brief.error.save_failed" };
  }

  revalidatePath(`/campaigns/${data.campaignId}`);
  revalidatePath(`/campaigns/${data.campaignId}/brief`);
  redirect(`/campaigns/${data.campaignId}`);
}
