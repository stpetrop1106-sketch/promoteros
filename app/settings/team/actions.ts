"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { mintToken } from "@/lib/tokens";
import {
  ownerContext,
  teamErrorCode,
  isAssignableRole,
  normalizeEmail,
  teamInviteUrl,
  EMAIL_PATTERN,
  TEAM_INVITE_TTL_SECONDS,
  type TeamErrorCode,
} from "@/lib/team";

/**
 * Every write on the team screen.
 *
 * The shape of each one is the same and it is deliberate:
 *
 *   1. `ownerContext()` — re-derives the caller and their role from the database. A role in a
 *      hidden input, a prop, or a session claim is never consulted. Not an owner: stop here.
 *   2. Validate the arguments.
 *   3. Call a `security definer` function in `0011_accounts.sql` which repeats the owner check,
 *      scopes every id to `current_agency_id()`, and enforces the invariants that must hold
 *      even if this file is bypassed entirely — no self-role-change, no removing the last
 *      owner, seat limit, single-use invitations.
 *
 * Step 3 is the security boundary. Steps 1 and 2 exist so the person gets a specific, useful
 * message instead of a raised exception. A server action is a public HTTP endpoint, and so is
 * PostgREST: the browser holds the anon key and can call the database directly, which is why
 * `authenticated` no longer has INSERT/UPDATE/DELETE on `app_users` at all.
 */

export type InviteState = {
  status: "idle" | "sent" | "error";
  /** The link to send. Shown because staff invitations have no mail transport yet — see P19 notes. */
  url?: string;
  email?: string;
  code?: TeamErrorCode;
};

export const INVITE_IDLE: InviteState = { status: "idle" };

export type MutationState = {
  status: "idle" | "done" | "error";
  code?: TeamErrorCode;
  /** Which row the message belongs to, so the list can render it in place. */
  targetId?: string;
};

export const MUTATION_IDLE: MutationState = { status: "idle" };

export async function inviteTeamMember(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const owner = await ownerContext();
  if (!owner) return { status: "error", code: "not_owner" };

  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const role = String(formData.get("role") ?? "");

  if (!EMAIL_PATTERN.test(email)) return { status: "error", code: "email_invalid", email };
  if (!isAssignableRole(role)) return { status: "error", code: "role_invalid", email };

  // The id is minted here so the signed token can carry it and the row can be written once,
  // with its real hash — rather than inserted with a placeholder and patched afterwards.
  const invitationId = randomUUID();

  let token: string;
  let tokenHash: string;
  let expiresAt: Date;
  try {
    ({ token, tokenHash, expiresAt } = mintToken(
      "invitation",
      invitationId,
      TEAM_INVITE_TTL_SECONDS,
    ));
  } catch {
    return { status: "error", code: "signing_secret_missing", email };
  }

  const db = await createServerSupabase();
  const { error } = await db.rpc("invite_team_member", {
    p_invitation_id: invitationId,
    p_email: email,
    p_role: role,
    p_token_hash: tokenHash,
    p_expires_at: expiresAt.toISOString(),
  });

  if (error) return { status: "error", code: teamErrorCode(error.message), email };

  revalidatePath("/settings/team");
  return { status: "sent", url: teamInviteUrl(token), email };
}

export async function revokeInvitation(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const invitationId = String(formData.get("invitationId") ?? "");
  if (!invitationId) return { status: "error", code: "invitation_not_found" };

  const owner = await ownerContext();
  if (!owner) return { status: "error", code: "not_owner", targetId: invitationId };

  const db = await createServerSupabase();
  const { error } = await db.rpc("revoke_agency_invitation", { p_invitation_id: invitationId });

  if (error) {
    return { status: "error", code: teamErrorCode(error.message), targetId: invitationId };
  }

  revalidatePath("/settings/team");
  return { status: "done", targetId: invitationId };
}

/**
 * Change a colleague's role.
 *
 * `set_team_member_role` refuses `p_user_id = auth.uid()` outright, so an owner cannot use this
 * to change their own role and a coordinator cannot use it at all. That check lives in the
 * database rather than here precisely because this function can be skipped.
 */
export async function changeMemberRole(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!userId) return { status: "error", code: "member_not_found" };

  const owner = await ownerContext();
  if (!owner) return { status: "error", code: "not_owner", targetId: userId };

  if (userId === owner.userId) {
    return { status: "error", code: "cannot_change_own_role", targetId: userId };
  }
  if (!isAssignableRole(role)) return { status: "error", code: "role_invalid", targetId: userId };

  const db = await createServerSupabase();
  const { error } = await db.rpc("set_team_member_role", { p_user_id: userId, p_role: role });

  if (error) return { status: "error", code: teamErrorCode(error.message), targetId: userId };

  revalidatePath("/settings/team");
  return { status: "done", targetId: userId };
}

/**
 * Remove a colleague. Deactivation, not deletion: their name stays on the work they did, the
 * action is reversible by re-inviting them, and `current_agency_id()` — which every RLS policy
 * keys off — now requires `active`, so their access is gone on the next request.
 */
export async function removeMember(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { status: "error", code: "member_not_found" };

  const owner = await ownerContext();
  if (!owner) return { status: "error", code: "not_owner", targetId: userId };

  if (userId === owner.userId) {
    return { status: "error", code: "cannot_remove_self", targetId: userId };
  }

  const db = await createServerSupabase();
  const { error } = await db.rpc("remove_team_member", { p_user_id: userId });

  if (error) return { status: "error", code: teamErrorCode(error.message), targetId: userId };

  revalidatePath("/settings/team");
  return { status: "done", targetId: userId };
}
