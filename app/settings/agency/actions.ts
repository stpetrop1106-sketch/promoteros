"use server";

import { revalidatePath } from "next/cache";
import {
  updateAgencyIdentity,
  RETENTION_MONTHS_MIN,
  RETENTION_MONTHS_MAX,
} from "@/lib/agency-settings";
import type { AgencyIdentityFormState } from "./state";

/**
 * The one write on this screen. Same shape as `app/settings/team/actions.ts`:
 *
 *   1. Read and lightly parse the form.
 *   2. Call `updateAgencyIdentity()` (`lib/agency-settings.ts`), which re-derives the owner from
 *      the database and validates before touching Postgres.
 *   3. Turn its result into a state the form can render.
 *
 * `updateAgencyIdentity()` is the security boundary, not this function — a server action is a
 * public HTTP endpoint, and this one would still be safe to call directly with someone else's
 * form data because the owner check happens inside it, against the caller's real session.
 *
 * A1-05 lists this as a write path with no billing gate. It stays ungated, and that is a
 * decision rather than an oversight. The columns it writes are the agency's registered legal
 * name and its privacy contact address — the two things `/privacy/promoters` refuses to render
 * without (migration 0014). Gating this would mean a read-only agency could not correct the
 * identity on the privacy notice its own promoters are told to read, which is a legal obligation
 * we would be blocking to collect a subscription. Nothing here consumes a seat, a promoter slot
 * or any other billable resource, so there is nothing for the gate to protect.
 */
export async function saveAgencyIdentity(
  _prev: AgencyIdentityFormState,
  formData: FormData,
): Promise<AgencyIdentityFormState> {
  const legalName = String(formData.get("legalName") ?? "").trim();
  const privacyContactEmail = String(formData.get("privacyContactEmail") ?? "").trim();
  const retentionRaw = String(formData.get("retentionMonths") ?? "").trim();

  const retentionMonths = Number.parseInt(retentionRaw, 10);
  if (
    !Number.isFinite(retentionMonths) ||
    retentionMonths < RETENTION_MONTHS_MIN ||
    retentionMonths > RETENTION_MONTHS_MAX
  ) {
    return { status: "error", code: "retention_out_of_range" };
  }

  const result = await updateAgencyIdentity({ legalName, privacyContactEmail, retentionMonths });

  if (!result.ok) return { status: "error", code: result.code };

  revalidatePath("/settings/agency");
  revalidatePath("/onboarding");
  return { status: "saved" };
}
