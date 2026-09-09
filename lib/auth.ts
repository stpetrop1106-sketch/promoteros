import "server-only";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

// Mirrors the `user_role` enum. `owner` was appended by 0011_accounts.sql, so the enum
// sorts coordinator < supervisor < admin < owner — do not rely on that ordering for
// permission checks; check the value.
export type UserRole = "coordinator" | "supervisor" | "admin" | "owner";

export type CurrentUser = {
  userId: string;
  agencyId: string;
  role: UserRole;
  email: string;
  fullName: string;
};

/**
 * Why an authenticated request still has no coordinator identity.
 *
 * `anonymous`  — no valid session at all.
 * `no_agency`  — a real, verified Supabase user with no `app_users` row, because nobody has
 *                invited that address into an agency yet. This is the correct resting state for
 *                an uninvited sign-up: RLS fails closed and they see nothing.
 */
export type NoUserReason = "anonymous" | "no_agency";

export type AuthState =
  | { ok: true; user: CurrentUser }
  | { ok: false; reason: NoUserReason };

type AppUserRow = {
  id: string;
  agency_id: string;
  role: UserRole;
  email: string;
  full_name: string;
  active: boolean;
};

const APP_USER_COLUMNS = "id, agency_id, role, email, full_name, active";

/**
 * The signed-in coordinator, or null.
 *
 * Reads `app_users` through the RLS-scoped client, so this call is itself subject to the same
 * tenant policy as everything else — there is no privileged read anywhere in the auth path.
 *
 * On a first sign-in there is no `app_users` row yet, so we ask Postgres to provision one from
 * a pending invitation (`ensure_app_user()`, see `0006_auth.sql`). Provisioning happens here
 * rather than on a trigger over `auth.users` on purpose: the trigger would fire when the magic
 * link is *requested*, giving an unverified address a tenant row. This fires only once a
 * verified session exists.
 */
export async function currentUser(): Promise<CurrentUser | null> {
  const state = await authState();
  return state.ok ? state.user : null;
}

/** Like `currentUser()`, but says *why* there is no user — the login page needs the distinction. */
export async function authState(): Promise<AuthState> {
  const db = await createServerSupabase();

  // getUser(), never getSession(): only getUser() revalidates the JWT against the auth server.
  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) return { ok: false, reason: "anonymous" };

  const { data: existing } = await db
    .from("app_users")
    .select(APP_USER_COLUMNS)
    .eq("id", user.id)
    .maybeSingle<AppUserRow>();

  if (existing) return toState(existing);

  // First sign-in: claim a pending invitation, if one was left for this address.
  const { error: provisionError } = await db.rpc("ensure_app_user");
  if (provisionError) return { ok: false, reason: "no_agency" };

  const { data: provisioned } = await db
    .from("app_users")
    .select(APP_USER_COLUMNS)
    .eq("id", user.id)
    .maybeSingle<AppUserRow>();

  return provisioned ? toState(provisioned) : { ok: false, reason: "no_agency" };
}

function toState(row: AppUserRow): AuthState {
  // A deactivated coordinator keeps their Supabase login but loses the agency identity, which
  // is what every RLS policy keys off. Nothing is left half-open.
  if (!row.active) return { ok: false, reason: "no_agency" };

  return {
    ok: true,
    user: {
      userId: row.id,
      agencyId: row.agency_id,
      role: row.role,
      email: row.email,
      fullName: row.full_name,
    },
  };
}

/**
 * The gate for every coordinator page and server action. Call it first, before any query.
 *
 * It is a convenience, not the security boundary — the boundary is RLS in Postgres. A page that
 * forgot this call would return an empty list rather than another agency's roster.
 */
export async function requireUser(): Promise<CurrentUser> {
  const state = await authState();
  if (state.ok) return state.user;

  redirect(state.reason === "no_agency" ? "/login?reason=no_agency" : "/login");
}
