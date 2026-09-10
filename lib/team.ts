import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { getEntitlement, checkBilling, type BillingAction } from "@/lib/billing/subscription";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";
import type { PlanId } from "@/lib/billing/plans";

/**
 * Team membership: who belongs to an agency, in what role, and who may change that.
 *
 * The rule this file exists to make hard to get wrong: **the role is read from the database on
 * every privileged call, never from a form field, a prop, or a cached session claim.** A server
 * action is a public HTTP endpoint — so is PostgREST, which the browser can call directly with
 * the anon key — so the checks here are the second line, not the first. The first is
 * `0011_accounts.sql`, which revokes INSERT/UPDATE/DELETE on `app_users` from `authenticated`
 * and routes every membership write through a `security definer` function that re-derives the
 * actor from `auth.uid()`. If everything in this file were deleted, the database would still
 * refuse a coordinator's attempt to promote themselves.
 */

// Role values live in `lib/team-shared.ts` because client components need them and this module
// is `server-only`. Imported for use below, and re-exported so existing server-side imports keep
// working — `export … from` alone would not bring the names into this file's scope.
import type { TeamRole, AssignableRole } from "@/lib/team-shared";

export {
  ASSIGNABLE_ROLES,
  isAssignableRole,
  type TeamRole,
  type AssignableRole,
} from "@/lib/team-shared";

export type TeamMember = {
  id: string;
  fullName: string;
  email: string;
  role: TeamRole;
  active: boolean;
  acceptedAt: string | null;
  invitedAt: string | null;
  createdAt: string | null;
  /** True for the row belonging to the person looking at the screen. */
  isSelf: boolean;
};

export type PendingInvitation = {
  id: string;
  email: string;
  role: TeamRole;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
};

export type TeamAgency = {
  id: string;
  name: string;
  city: string | null;
  timezone: string;
  plan: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  seatLimit: number;
  promoterLimit: number;
};

export type TeamSnapshot = {
  agency: TeamAgency;
  members: TeamMember[];
  invitations: PendingInvitation[];
  /** Active logins plus invitations still outstanding — both consume a seat. */
  seatsUsed: number;
  seatsRemaining: number;
  viewer: { id: string; role: TeamRole; isOwner: boolean };
  /** Owners still active. The screen needs this to explain why the last owner is protected. */
  activeOwnerCount: number;
};

type AgencyRow = {
  id: string;
  name: string;
  city: string | null;
  timezone: string;
  plan: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
  seat_limit: number | null;
  promoter_limit: number | null;
};

type MemberRow = {
  id: string;
  full_name: string;
  email: string;
  role: TeamRole;
  active: boolean;
  accepted_at: string | null;
  invited_at: string | null;
  created_at: string | null;
};

type InvitationRow = {
  id: string;
  email: string;
  role: TeamRole;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
};

/** Seat defaults if the migration's columns somehow read null — never fail open on a limit. */
const FALLBACK_SEAT_LIMIT = 3;
const FALLBACK_PROMOTER_LIMIT = 150;

/**
 * Everything the team screen renders, read through the RLS-scoped client.
 *
 * Every query here is tenant-scoped by Postgres, not by a `where agency_id = …` this file
 * remembers to write. Reading the viewer's own role back out of `app_users` rather than
 * trusting `currentUser().role` also means a demotion takes effect on the next request, without
 * waiting for a session to expire.
 */
export async function loadTeamSnapshot(): Promise<TeamSnapshot | null> {
  const user = await requireUser();
  const db = await createServerSupabase();

  const [agencyResult, membersResult, invitationsResult] = await Promise.all([
    db
      .from("agencies")
      .select(
        "id, name, city, timezone, plan, subscription_status, trial_ends_at, seat_limit, promoter_limit",
      )
      .eq("id", user.agencyId)
      .maybeSingle<AgencyRow>(),
    db
      .from("app_users")
      .select("id, full_name, email, role, active, accepted_at, invited_at, created_at")
      .order("created_at", { ascending: true })
      .returns<MemberRow[]>(),
    db
      .from("agency_invitations")
      .select("id, email, role, created_at, expires_at, accepted_at")
      .is("accepted_at", null)
      .order("created_at", { ascending: true })
      .returns<InvitationRow[]>(),
  ]);

  const agencyRow = agencyResult.data;
  if (!agencyRow) return null;

  const now = Date.now();

  const members: TeamMember[] = (membersResult.data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    active: row.active,
    acceptedAt: row.accepted_at,
    invitedAt: row.invited_at,
    createdAt: row.created_at,
    isSelf: row.id === user.userId,
  }));

  const invitations: PendingInvitation[] = (invitationsResult.data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    expired: new Date(row.expires_at).getTime() <= now,
  }));

  const seatLimit = agencyRow.seat_limit ?? FALLBACK_SEAT_LIMIT;
  const activeMembers = members.filter((m) => m.active);
  const liveInvitations = invitations.filter((i) => !i.expired);
  const seatsUsed = activeMembers.length + liveInvitations.length;

  // The viewer's role, freshly read, is the one the UI is allowed to reason about.
  const viewerRow = members.find((m) => m.id === user.userId);
  const viewerRole: TeamRole = viewerRow?.role ?? (user.role as TeamRole);

  return {
    agency: {
      id: agencyRow.id,
      name: agencyRow.name,
      city: agencyRow.city,
      timezone: agencyRow.timezone,
      plan: agencyRow.plan ?? "starter",
      subscriptionStatus: agencyRow.subscription_status ?? "trialing",
      trialEndsAt: agencyRow.trial_ends_at,
      seatLimit,
      promoterLimit: agencyRow.promoter_limit ?? FALLBACK_PROMOTER_LIMIT,
    },
    members,
    invitations,
    seatsUsed,
    seatsRemaining: Math.max(0, seatLimit - seatsUsed),
    viewer: {
      id: user.userId,
      role: viewerRole,
      isOwner: viewerRole === "owner",
    },
    activeOwnerCount: activeMembers.filter((m) => m.role === "owner").length,
  };
}

export type OwnerContext = { userId: string; agencyId: string };

/**
 * Gate for every write in `app/settings/team/actions.ts`.
 *
 * Signed out redirects (via `requireUser`). Signed in but not an owner returns null, and the
 * caller turns that into a specific error. The role comes from a fresh RLS-scoped read, so a
 * user demoted a second ago cannot act on a stale claim.
 */
export async function ownerContext(): Promise<OwnerContext | null> {
  const user = await requireUser();
  const db = await createServerSupabase();

  const { data } = await db
    .from("app_users")
    .select("id, agency_id, role, active")
    .eq("id", user.userId)
    .maybeSingle<{ id: string; agency_id: string; role: TeamRole; active: boolean }>();

  if (!data || !data.active || data.role !== "owner") return null;

  return { userId: data.id, agencyId: data.agency_id };
}

const t = translatorFor(DEFAULT_LOCALE);

// Reuses P17/P22's plan-name keys (`billing.plan.*`) — see the identical constant in
// app/promoters/actions.ts.
const PLAN_LABEL_KEY: Record<PlanId, TranslationKey> = {
  starter: "billing.plan.starter",
  agency: "billing.plan.agency",
  multi_brand: "billing.plan.multi_brand",
};

/**
 * P24 — the general billing read-only guard for team writes (docs/commercial-architecture.md
 * §3), mirroring `app/promoters/actions.ts`'s `checkPromoterCreationAllowed()`: `getEntitlement`
 * then `checkBilling`, called before the write, with a specific message per block reason.
 *
 * **Not called from anywhere in this codebase yet.** The actual mutations this parcel was asked
 * to gate — `inviteTeamMember`, `changeMemberRole`, `revokeInvitation`, `removeMember` — all live
 * in `app/settings/team/actions.ts`, not in this file, and that path (all of `app/settings/**`)
 * is explicitly off-limits to this parcel. Wiring this in also means adding a case to
 * `app/settings/team/team-controls.tsx`'s `ERROR_KEYS: Record<TeamErrorCode, TranslationKey>`,
 * which is exhaustive over `TeamErrorCode` — so this deliberately does *not* add a new value to
 * `TEAM_ERROR_CODES` either; doing so without updating that map would fail `tsc` on a file this
 * parcel cannot touch. This function returns a fully-resolved message string instead (same shape
 * as `checkPromoterCreationAllowed`), so wiring it in needs no `TeamErrorCode` change — just a
 * new `message?: string` field on `InviteState`/`MutationState` and one call per action, right
 * before `ownerContext()`. See docs/status/P24.md's "Requests to other lanes" for the exact
 * recommendation (which of the four should gate, and why two of them deliberately should not).
 */
export async function checkTeamWriteAllowed(
  agencyId: string,
  action: Extract<BillingAction, "write" | "add_staff">,
): Promise<string | null> {
  const entitlement = await getEntitlement(agencyId);
  if (!entitlement) return null;

  const gate = checkBilling(entitlement, action);
  if (gate.allowed) return null;

  if (gate.block === "seat_limit_reached") {
    return t("enforcement.team.blocked_seat_limit", {
      plan: t(PLAN_LABEL_KEY[entitlement.planId]),
      limit: entitlement.seatLimit,
    });
  }

  // "subscription_read_only" — the only other block "write"/"add_staff" can return.
  return t("enforcement.team.blocked_read_only");
}

/**
 * Every failure `0011_accounts.sql` can raise, plus the ones this layer adds.
 *
 * They are codes rather than sentences because the sentence belongs in `lib/i18n/el.ts`, and
 * because "Something went wrong" is banned (docs/commercial-architecture.md §6) — each of these
 * maps to a specific message telling the reader what to do next.
 */
export const TEAM_ERROR_CODES = [
  "not_authenticated",
  "not_owner",
  "no_agency",
  "no_email",
  "email_invalid",
  "role_invalid",
  "token_invalid",
  "expiry_invalid",
  "already_member",
  "belongs_to_other_agency",
  "seat_limit_reached",
  "invitation_not_found",
  "invitation_used",
  "invitation_expired",
  "invitation_email_mismatch",
  "already_in_agency",
  "member_not_found",
  "member_inactive",
  "cannot_change_own_role",
  "cannot_remove_self",
  "last_owner",
  "name_too_short",
  /** `TOKEN_SIGNING_SECRET` is not configured, so no invitation link can be signed. */
  "signing_secret_missing",
  "unknown",
] as const;

export type TeamErrorCode = (typeof TEAM_ERROR_CODES)[number];

const CODE_SET = new Set<string>(TEAM_ERROR_CODES);

/**
 * Turn a Postgres exception into one of our codes.
 *
 * The functions in `0011` raise the code as the whole message, so the common case is an exact
 * match. The substring pass is for the day PostgREST or a driver decides to decorate it; an
 * unrecognised message becomes `unknown`, which the UI renders as a real sentence with a retry,
 * never as a raw database string (which could leak schema detail to a customer).
 */
export function teamErrorCode(message: string | null | undefined): TeamErrorCode {
  if (!message) return "unknown";

  const trimmed = message.trim();
  if (CODE_SET.has(trimmed)) return trimmed as TeamErrorCode;

  for (const code of TEAM_ERROR_CODES) {
    if (code !== "unknown" && trimmed.includes(code)) return code;
  }

  return "unknown";
}

/** Normalised for comparison and storage; the database lower-cases it too. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** How long a staff invitation stays usable. Long enough to survive a weekend, not a month. */
export const TEAM_INVITE_TTL_SECONDS = 7 * 24 * 3600;

/**
 * The URL an invited colleague opens.
 *
 * Deliberately not `linkFor()` from `lib/tokens.ts`: that maps the `invitation` purpose to
 * `/i/[token]`, which is the promoter-facing page. A staff invitation lands in the onboarding
 * area instead, because accepting one requires a real sign-in.
 */
export function teamInviteUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/onboarding/join/${token}`;
}
