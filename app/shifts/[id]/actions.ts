"use server";

import { revalidatePath } from "next/cache";
import { createInvitation } from "@/lib/invitations";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

export type InviteState = {
  status: "idle" | "sent" | "manual" | "error";
  /** Present when the adapter could not deliver — the coordinator pastes this themselves. */
  manualBody?: string;
  url?: string;
  reason?: string;
};

export async function invite(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const shiftId = String(formData.get("shiftId") ?? "");
  const promoterId = String(formData.get("promoterId") ?? "");

  if (!shiftId || !promoterId) return { status: "error", reason: "missing_ids" };

  // A server action is a public HTTP endpoint: both ids arrive from the browser and neither can
  // be trusted. Re-check them through the RLS-scoped client before doing anything, because
  // `createInvitation` runs on the service role and would happily invite across tenants.
  await requireUser();
  const db = await createServerSupabase();

  const [{ data: shift }, { data: promoter }] = await Promise.all([
    db.from("shifts").select("id").eq("id", shiftId).maybeSingle(),
    db.from("promoters").select("id").eq("id", promoterId).maybeSingle(),
  ]);

  if (!shift || !promoter) return { status: "error", reason: "not_found" };

  try {
    const result = await createInvitation(shiftId, promoterId);
    revalidatePath(`/shifts/${shiftId}`);

    return result.delivered
      ? { status: "sent", url: result.url }
      : { status: "manual", manualBody: result.manualBody ?? "", url: result.url };
  } catch (err) {
    return { status: "error", reason: err instanceof Error ? err.message : "unknown" };
  }
}
