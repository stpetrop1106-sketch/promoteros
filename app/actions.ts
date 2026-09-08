"use server";

import { z } from "zod";
import type { TranslationKey } from "@/lib/i18n";
import { createAdminClient } from "@/lib/supabase/admin";

export type WaitlistState = {
  status: "idle" | "success" | "already_joined" | "error";
  message: TranslationKey;
};

export const initialWaitlistState: WaitlistState = {
  status: "idle",
  message: "waitlist.status.idle",
};

const waitlistSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  workEmail: z.string().trim().email().max(254),
  companyName: z.string().trim().min(2).max(160),
  jobTitle: z.string().trim().max(120),
  promoterCount: z.enum(["1-30", "31-100", "101-300", "300+"]),
  primaryChallenge: z.string().trim().max(1000),
  utmSource: z.string().trim().max(120),
  utmMedium: z.string().trim().max(120),
  utmCampaign: z.string().trim().max(120),
  website: z.string().max(0),
});

/**
 * Stores a pre-launch registration through the server only. The waitlist table
 * has RLS enabled with no public policy, so browsers cannot read registrations.
 */
export async function joinWaitlist(
  _previousState: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const parsed = waitlistSchema.safeParse({
    fullName: formData.get("fullName") ?? "",
    workEmail: formData.get("workEmail") ?? "",
    companyName: formData.get("companyName") ?? "",
    jobTitle: formData.get("jobTitle") ?? "",
    promoterCount: formData.get("promoterCount") ?? "",
    primaryChallenge: formData.get("primaryChallenge") ?? "",
    utmSource: formData.get("utmSource") ?? "",
    utmMedium: formData.get("utmMedium") ?? "",
    utmCampaign: formData.get("utmCampaign") ?? "",
    website: formData.get("website") ?? "",
  });

  if (!parsed.success) {
    return { status: "error", message: "waitlist.status.invalid" };
  }

  // A filled honeypot is treated as a successful submission so bots get no
  // signal, while no data is retained.
  if (parsed.data.website) {
    return { status: "success", message: "waitlist.status.success" };
  }

  const { data } = parsed;

  try {
    const db = createAdminClient();
    const { error } = await db.from("waitlist_signups").insert({
      full_name: data.fullName,
      work_email: data.workEmail,
      company_name: data.companyName,
      job_title: data.jobTitle || null,
      promoter_count: data.promoterCount,
      primary_challenge: data.primaryChallenge || null,
      utm_source: data.utmSource || null,
      utm_medium: data.utmMedium || null,
      utm_campaign: data.utmCampaign || null,
    });

    if (error?.code === "23505") {
      return { status: "already_joined", message: "waitlist.status.already_joined" };
    }

    if (error) {
      console.error("Waitlist signup failed", { code: error.code });
      return { status: "error", message: "waitlist.status.error" };
    }
  } catch (error) {
    console.error("Waitlist signup could not connect", {
      error: error instanceof Error ? error.name : "unknown",
    });
    return { status: "error", message: "waitlist.status.error" };
  }

  return { status: "success", message: "waitlist.status.success" };
}
