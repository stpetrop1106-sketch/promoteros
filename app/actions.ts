"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkWaitlistRateLimit } from "@/lib/waitlist/rate-limit";
import { getEmailAdapter } from "@/lib/waitlist/email";
// A "use server" module may only export async functions. The state type and its initial
// value live in ./waitlist-state so they survive the client boundary — see that file.
import type { WaitlistState } from "./waitlist-state";

const waitlistSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  workEmail: z.string().trim().email().max(254),
  companyName: z.string().trim().min(2).max(160),
  jobTitle: z.string().trim().max(120),
  // The ranges the form offers. An enum rather than free text because this is the one field the
  // signups are actually segmented by, and "about 40" is not a segment.
  promoterCount: z.enum(["1-25", "26-50", "51-100", "101-250", "250+"]),
  // Both of these are optional: a half-answered form from a real agency is worth more than a
  // perfect one that was abandoned at the fourth question.
  primaryChallenge: z.string().trim().max(120),
  currentTooling: z.string().trim().max(120),
  wantsDemo: z.enum(["yes", "no", ""]),
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
    currentTooling: formData.get("currentTooling") ?? "",
    wantsDemo: formData.get("wantsDemo") ?? "",
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

  // This is an unauthenticated write endpoint, so it needs its own gate before touching the
  // table — see lib/waitlist/rate-limit.ts for why this has to be database-backed.
  const rateLimit = await checkWaitlistRateLimit();
  if (!rateLimit.allowed) {
    return { status: "rate_limited", message: "waitlist.status.rate_limited" };
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
      current_tooling: data.currentTooling || null,
      // Null means "not asked", which is a different fact from "said no" — see migration 0020.
      wants_demo: data.wantsDemo === "" ? null : data.wantsDemo === "yes",
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

  // The row is already saved at this point. A confirmation email is a nice-to-have on top of
  // that, never a condition of it — see lib/waitlist/email.ts. Any failure here is logged and
  // swallowed, not surfaced to the registrant as an error.
  try {
    await getEmailAdapter().sendWaitlistConfirmation({
      to: { name: data.fullName, email: data.workEmail },
    });
  } catch (error) {
    console.error("Waitlist confirmation email threw", {
      error: error instanceof Error ? error.name : "unknown",
    });
  }

  return { status: "success", message: "waitlist.status.success" };
}
