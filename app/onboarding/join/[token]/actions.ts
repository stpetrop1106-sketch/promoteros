"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { hashToken, verifyToken } from "@/lib/tokens";
import { teamErrorCode } from "@/lib/team";
import type { AcceptState } from "./state";

/**
 * Join the agency named on the invitation this token belongs to.
 *
 * The only thing that crosses the wire is the token. There is no agency id in the form, and
 * there must never be one — `accept_agency_invitation` reads the agency, the role and the
 * permitted email address off the stored row, so holding a link can only ever join you to the
 * agency that issued it, in the role it chose. The signature and expiry are checked here first
 * so an obviously bad link gets an honest message instead of a database round trip, and the
 * hash is re-checked in Postgres regardless (same belt-and-braces as `loadInvitation`).
 */
export async function acceptInvitation(
  _prev: AcceptState,
  formData: FormData,
): Promise<AcceptState> {
  const token = String(formData.get("token") ?? "");
  if (!token) return { status: "error", code: "invitation_not_found" };

  const verified = verifyToken(token, "invitation");
  if (!verified.ok) {
    return {
      status: "error",
      code: verified.reason === "expired" ? "invitation_expired" : "invitation_not_found",
    };
  }

  const db = await createServerSupabase();
  const { error } = await db.rpc("accept_agency_invitation", {
    p_token_hash: hashToken(token),
  });

  if (error) return { status: "error", code: teamErrorCode(error.message) };

  revalidatePath("/onboarding");
  redirect("/onboarding");
}

/**
 * Signed in as the wrong person. Sign out and come straight back to the invitation rather than
 * dropping them on `/login` with no way to find the link again (no dead ends, §6).
 */
export async function signOutAndReturn(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const db = await createServerSupabase();
  await db.auth.signOut();
  redirect(token ? `/onboarding/join/${encodeURIComponent(token)}` : "/login");
}
