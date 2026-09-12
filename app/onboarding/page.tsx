import type { Metadata } from "next";
import Link from "next/link";
import { authState } from "@/lib/auth";
import { loadOnboardingProgress, PROMOTER_TARGET, type OnboardingStep } from "@/lib/onboarding";
import { loadAgencyIdentity, identityComplete } from "@/lib/agency-settings";
import { createServerSupabase } from "@/lib/supabase/server";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";
import { PageHeader, Card, Button, LinkButton, Badge, Icon, SectionHeading } from "@/components/ui";
import { signOut } from "@/app/login/actions";
import { AgencyForm } from "./agency-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: translatorFor(DEFAULT_LOCALE)("page_title.onboarding") };

const t = translatorFor(DEFAULT_LOCALE);

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("el-GR", { dateStyle: "long" }).format(new Date(value));
}

const STEP_TITLE: Record<OnboardingStep["id"], TranslationKey> = {
  promoters: "onboarding.step.promoters.title",
  campaign: "onboarding.step.campaign.title",
  shift: "onboarding.step.shift.title",
  team: "onboarding.step.team.title",
};

const STEP_WHY: Record<OnboardingStep["id"], TranslationKey> = {
  promoters: "onboarding.step.promoters.why",
  campaign: "onboarding.step.campaign.why",
  shift: "onboarding.step.shift.why",
  team: "onboarding.step.team.why",
};

const STEP_CTA: Record<OnboardingStep["id"], TranslationKey> = {
  promoters: "onboarding.step.promoters.cta",
  campaign: "onboarding.step.campaign.cta",
  shift: "onboarding.step.shift.cta",
  team: "onboarding.step.team.cta",
};

function StepRow({ step, index }: { step: OnboardingStep; index: number }) {
  return (
    <li className="flex flex-col gap-3 px-5 py-5 first:pt-4 last:pb-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
      <div className="flex gap-3.5">
        <span
          aria-hidden="true"
          className={
            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1 ring-inset " +
            (step.done
              ? "bg-[color:var(--color-ok)] text-white ring-[color:var(--color-ok)]"
              : "bg-[color:var(--color-canvas-sunken)] text-[color:var(--color-muted)] ring-[color:var(--color-line)]")
          }
        >
          {step.done ? <Icon name="check" size={14} strokeWidth={2.25} /> : index + 1}
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[color:var(--color-ink)]">
            {t(STEP_TITLE[step.id])}
            {step.optional ? <Badge variant="neutral">{t("onboarding.step.optional")}</Badge> : null}
            {step.done ? <Badge variant="ok">{t("onboarding.step.done")}</Badge> : null}
          </p>
          <p className="mt-1 max-w-prose text-sm leading-6 text-[color:var(--color-muted)]">
            {t(STEP_WHY[step.id])}
          </p>
          <p className="mt-1 text-xs text-[color:var(--color-muted)]">
            {t("onboarding.step.count", { count: step.count, target: step.target })}
          </p>
        </div>
      </div>
      <div className="shrink-0 pl-10 sm:pl-4">
        <LinkButton href={step.href} variant={step.done ? "ghost" : "secondary"} size="sm">
          {t(STEP_CTA[step.id])}
        </LinkButton>
      </div>
    </li>
  );
}

/**
 * `/onboarding` is the one coordinator screen that must work for someone who is *not* attached
 * to an agency yet, so it calls `authState()` rather than `requireUser()` — `requireUser()`
 * would bounce a brand-new signup to `/login?reason=no_agency`, which is exactly the dead end
 * this parcel exists to remove. `middleware.ts` does not match `/onboarding` either, for the
 * same reason.
 */
export default async function OnboardingPage() {
  const state = await authState();

  if (!state.ok && state.reason === "anonymous") {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <PageHeader title={t("onboarding.signin.title")} subtitle={t("onboarding.signin.body")} />
        <div className="mt-8">
          <LinkButton href="/login?next=%2Fonboarding">{t("onboarding.signin.cta")}</LinkButton>
        </div>
      </main>
    );
  }

  if (!state.ok && state.reason === "suspended") {
    // A real signed-in user whose current agency was suspended by us (the admin console — see
    // commercial-architecture.md §5), following an old link or an invitation into a second
    // agency. `authState()`'s own contract is "never let this fall through to a flow that will
    // not work" (see lib/auth.ts), and falling through to the "create your agency" branch below
    // would let them start setting up a brand-new agency while their existing one is locked —
    // confusing at best. Reuse the exact explanation `middleware.ts` renders for the same state
    // (P22's `enforcement.suspended.*` keys) so the product never says two different things about
    // one suspension, and give a real way out per commercial-architecture.md §6 ("no dead ends").
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <PageHeader
          title={t("enforcement.suspended.title")}
          subtitle={t("enforcement.suspended.body")}
        />
        <div className="mt-8">
          <form action={signOut}>
            <Button type="submit" variant="secondary">
              {t("enforcement.suspended.signout")}
            </Button>
          </form>
        </div>
      </main>
    );
  }

  if (!state.ok) {
    // Verified session, no agency: this is a self-serve signup, not an error.
    const db = await createServerSupabase();
    const {
      data: { user },
    } = await db.auth.getUser();

    const suggestedName =
      (user?.user_metadata?.full_name as string | undefined) ?? undefined;

    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <PageHeader
          title={t("onboarding.create.title")}
          subtitle={t("onboarding.create.subtitle")}
        />
        <Card className="mt-8" elevation="raised">
          <AgencyForm suggestedName={suggestedName} />
        </Card>
        <p className="mt-4 text-center text-xs text-[color:var(--color-muted)]">
          {t("onboarding.create.invited_instead")}
        </p>
      </main>
    );
  }

  const db = await createServerSupabase();
  const [progress, agencyResult, agencyIdentity] = await Promise.all([
    loadOnboardingProgress(),
    db
      .from("agencies")
      .select("name, trial_ends_at")
      .eq("id", state.user.agencyId)
      .maybeSingle<{ name: string; trial_ends_at: string | null }>(),
    loadAgencyIdentity(),
  ]);

  const doneCount = progress.steps.filter((s) => !s.optional && s.done).length;
  const totalCount = progress.steps.filter((s) => !s.optional).length;
  const agencyName = agencyResult.data?.name ?? "";
  const trialEndsAt = agencyResult.data?.trial_ends_at ?? null;
  // P33 — not one of `progress.steps`: `lib/onboarding.ts` is owned by another lane, and its
  // `OnboardingStepId` union is not mine to extend. Rendered as its own skippable card instead,
  // same position in the flow (after the aha moment, before the settings link) with the same
  // "say what stays broken" honesty the other steps use.
  const identityMissing = !agencyIdentity || !identityComplete(agencyIdentity);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        title={t("onboarding.title")}
        subtitle={t("onboarding.subtitle", { agency: agencyName })}
        actions={
          <LinkButton href="/shifts" variant="ghost" size="sm">
            {t("onboarding.skip_all")}
          </LinkButton>
        }
      >
        <p className="text-sm text-[color:var(--color-muted)]">
          {t("onboarding.progress", { done: doneCount, total: totalCount })}
          {trialEndsAt ? ` · ${t("onboarding.trial_ends", { date: formatDate(trialEndsAt) })}` : ""}
        </p>
      </PageHeader>

      <div className="mt-8 flex flex-col gap-6">
        <Card flush>
          <ol className="flex flex-col divide-y divide-[color:var(--color-line)]">
            {progress.steps.map((step, index) => (
              <StepRow key={step.id} step={step} index={index} />
            ))}
          </ol>
        </Card>

        {/* The aha moment. Everything above exists to make this link real — the one card the
            page is about, so it gets the raised elevation and the accent-tinted icon chip
            `docs/design.md` reserves for that. */}
        <Card elevation="raised">
          <div className="flex items-start gap-3.5">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--color-accent-subtle)] text-[color:var(--color-accent-ink)]"
            >
              <Icon name="spark" size={20} />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-[color:var(--color-ink)]">{t("onboarding.aha.title")}</h2>
              <p className="mt-1 max-w-prose text-sm leading-6 text-[color:var(--color-muted)]">
                {progress.rankingReady
                  ? t("onboarding.aha.body")
                  : t("onboarding.aha.locked", { count: PROMOTER_TARGET })}
              </p>
              <div className="mt-4">
                {progress.rankingReady && progress.firstShiftId ? (
                  <LinkButton href={`/shifts/${progress.firstShiftId}`}>{t("onboarding.aha.cta")}</LinkButton>
                ) : (
                  <LinkButton href={progress.campaignCount >= 1 ? "/campaigns" : "/campaigns/new"} variant="secondary">
                    {t("onboarding.aha.locked_cta")}
                  </LinkButton>
                )}
              </div>
            </div>
          </div>
        </Card>

        {identityMissing ? (
          <Card header={<SectionHeading level={3} title={t("onboarding.identity.title")} />}>
            <p className="max-w-prose text-sm leading-6 text-[color:var(--color-muted)]">
              {t("onboarding.identity.body")}
            </p>
            <div className="mt-4">
              <LinkButton href="/settings/agency" variant="secondary">
                {t("onboarding.identity.cta")}
              </LinkButton>
            </div>
          </Card>
        ) : null}
      </div>

      <p className="mt-6 text-sm text-[color:var(--color-muted)]">
        <Link href="/settings" className="font-medium text-[color:var(--color-accent)] underline-offset-2 hover:underline">
          {t("onboarding.settings_link")}
        </Link>
      </p>
    </main>
  );
}
