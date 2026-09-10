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
 * `suspended`  — a real, active `app_users` row, but `agencies.suspended_at` is set. Unlike
 *                `no_agency` this is a deliberate act by us (P18's admin console), not an
 *                unfinished invitation, so it carries the agency name and gets its own honest
 *                explanation (`middleware.ts` renders it — see the notes there) rather than the
 *                generic sign-in screen.
 */
export type NoUserReason = "anonymous" | "no_agency" | "suspended";

export type AuthState =
  | { ok: true; user: CurrentUser }
  | { ok: false; reason: "anonymous" | "no_agency" }
  | { ok: false; reason: "suspended"; agencyName: string };

type AppUserRow = {
  id: string;
  agency_id: string;
  role: UserRole;
  email: string;
  full_name: string;
  active: boolean;
};

const APP_USER_COLUMNS = "id, agency_id, role, email, full_name, active";

type AgencySuspensionRow = { name: string; suspended_at: string | null };

/**
 * Read through the same RLS-scoped client as everything else, so this can never see another
 * agency's suspension flag — `own_agency` (`0002_rls.sql`) scopes the row to `current_agency_id()`
 * the same way it does for `getEntitlement()` in `lib/billing/subscription.ts`.
 *
 * A failed read (network blip, not a suspension) returns `null`, and the caller treats that as
 * "not suspended" rather than locking someone out for an infrastructure hiccup — the same
 * fail-open posture `evaluateAccess()` documents for billing. Suspension is meant to be a
 * deliberate, visible admin action, never a side effect of a dropped connection.
 */
async function loadAgencySuspension(
  db: Awaited<ReturnType<typeof createServerSupabase>>,
  agencyId: string,
): Promise<AgencySuspensionRow | null> {
  const { data } = await db
    .from("agencies")
    .select("name, suspended_at")
    .eq("id", agencyId)
    .maybeSingle<AgencySuspensionRow>();
  return data ?? null;
}

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

  if (existing) return toState(db, existing);

  // First sign-in: claim a pending invitation, if one was left for this address.
  const { error: provisionError } = await db.rpc("ensure_app_user");
  if (provisionError) return { ok: false, reason: "no_agency" };

  const { data: provisioned } = await db
    .from("app_users")
    .select(APP_USER_COLUMNS)
    .eq("id", user.id)
    .maybeSingle<AppUserRow>();

  return provisioned ? toState(db, provisioned) : { ok: false, reason: "no_agency" };
}

async function toState(
  db: Awaited<ReturnType<typeof createServerSupabase>>,
  row: AppUserRow,
): Promise<AuthState> {
  // A deactivated coordinator keeps their Supabase login but loses the agency identity, which
  // is what every RLS policy keys off. Nothing is left half-open.
  if (!row.active) return { ok: false, reason: "no_agency" };

  const agency = await loadAgencySuspension(db, row.agency_id);
  if (agency?.suspended_at) {
    return { ok: false, reason: "suspended", agencyName: agency.name };
  }

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
 *
 * A suspended agency never reaches the caller: `redirect()` throws before this function returns,
 * so a page that only ever does `const user = await requireUser()` before writing anything
 * writes nothing for a suspended agency, by construction. `middleware.ts` intercepts
 * `/login?reason=suspended` itself and renders the honest explanation — see its own comment for
 * why that has to happen in middleware rather than on `/login`'s page component, which this
 * parcel does not own.
 */
export async function requireUser(): Promise<CurrentUser> {
  const state = await authState();
  if (state.ok) return state.user;

  if (state.reason === "suspended") redirect("/login?reason=suspended");
  redirect(state.reason === "no_agency" ? "/login?reason=no_agency" : "/login");
}
