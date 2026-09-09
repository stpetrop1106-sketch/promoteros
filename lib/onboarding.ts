import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Guided first run.
 *
 * **Progress is derived, never stored.** There is no `onboarding_step` column and there must
 * never be one: a counter on a row is wrong the moment someone adds a promoter from
 * `/promoters/new` instead of from here, and a checklist that lies about what you have already
 * done is worse than no checklist. Everything below is a `count(*)` against the agency's own
 * data, read through the RLS-scoped client.
 *
 * The sequence ends at a ranked shift on purpose (docs/commercial-architecture.md §2): that
 * screen is the product, and an onboarding that stops before it has failed.
 */

export type OnboardingStepId = "promoters" | "campaign" | "shift" | "team";

/**
 * Only real, existing routes. A union rather than `string` so `next` typed routes check these
 * at build time — a step that links to a screen someone renamed is a dead end, and dead ends are
 * the thing this parcel exists to remove.
 */
export type OnboardingHref = "/promoters/new" | "/campaigns/new" | "/campaigns" | "/settings/team";

export type OnboardingStep = {
  id: OnboardingStepId;
  done: boolean;
  /** How many of the thing exists — the screen shows "2 of 3" rather than a bare tick. */
  count: number;
  /** What the step needs before it counts as done. */
  target: number;
  /** The real create screen. Onboarding links to those rather than duplicating them. */
  href: OnboardingHref;
  /** Optional steps can be skipped without the run being incomplete. */
  optional: boolean;
};

export type OnboardingProgress = {
  promoterCount: number;
  campaignCount: number;
  shiftCount: number;
  /** Active staff logins, including the owner. */
  teamCount: number;
  pendingInvitationCount: number;
  /** The shift to open to see the ranking — the most recently created one. */
  firstShiftId: string | null;
  /** True once a shift exists, i.e. the ranked list is reachable. */
  rankingReady: boolean;
  steps: OnboardingStep[];
  /** Every required step done. Optional steps do not hold this back. */
  coreComplete: boolean;
};

/**
 * Three is not arbitrary: with one or two promoters the ranking has nothing to rank and the
 * product looks broken. The empty state says so rather than letting someone conclude the
 * matching engine does not work.
 */
export const PROMOTER_TARGET = 3;

type CountResult = { count: number | null };

function countOf(result: CountResult | null | undefined): number {
  return result?.count ?? 0;
}

export async function loadOnboardingProgress(): Promise<OnboardingProgress> {
  const db = await createServerSupabase();

  const [promoters, campaigns, shifts, members, invitations, latestShift] = await Promise.all([
    db.from("promoters").select("id", { count: "exact", head: true }).neq("status", "archived"),
    db.from("campaigns").select("id", { count: "exact", head: true }),
    db.from("shifts").select("id", { count: "exact", head: true }),
    db.from("app_users").select("id", { count: "exact", head: true }).eq("active", true),
    db
      .from("agency_invitations")
      .select("id", { count: "exact", head: true })
      .is("accepted_at", null),
    db
      .from("shifts")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>(),
  ]);

  const promoterCount = countOf(promoters);
  const campaignCount = countOf(campaigns);
  const shiftCount = countOf(shifts);
  const teamCount = countOf(members);
  const pendingInvitationCount = countOf(invitations);

  const steps: OnboardingStep[] = [
    {
      id: "promoters",
      done: promoterCount >= PROMOTER_TARGET,
      count: promoterCount,
      target: PROMOTER_TARGET,
      href: "/promoters/new",
      optional: false,
    },
    {
      id: "campaign",
      done: campaignCount >= 1,
      count: campaignCount,
      target: 1,
      href: "/campaigns/new",
      optional: false,
    },
    {
      id: "shift",
      done: shiftCount >= 1,
      count: shiftCount,
      target: 1,
      // A shift is created inside its campaign, so the route depends on one existing.
      href: campaignCount >= 1 ? "/campaigns" : "/campaigns/new",
      optional: false,
    },
    {
      id: "team",
      done: teamCount + pendingInvitationCount > 1,
      count: teamCount + pendingInvitationCount,
      target: 2,
      href: "/settings/team",
      optional: true,
    },
  ];

  return {
    promoterCount,
    campaignCount,
    shiftCount,
    teamCount,
    pendingInvitationCount,
    firstShiftId: latestShift.data?.id ?? null,
    rankingReady: shiftCount >= 1,
    steps,
    coreComplete: steps.filter((s) => !s.optional).every((s) => s.done),
  };
}
