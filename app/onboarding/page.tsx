import type { Metadata } from "next";
import Link from "next/link";
import { authState } from "@/lib/auth";
import { loadOnboardingProgress, PROMOTER_TARGET, type OnboardingStep } from "@/lib/onboarding";
import { createServerSupabase } from "@/lib/supabase/server";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";
import { PageHeader, Card, Button, Badge } from "@/components/ui";
import { AgencyForm } from "./agency-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "PromoterOS" };

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
    <li className="flex flex-col gap-3 border-t border-[color:var(--color-line)] py-5 first:border-t-0 first:pt-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex gap-3">
        <span
          aria-hidden="true"
          className={
            "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold " +
            (step.done
              ? "bg-[color:var(--color-ok)] text-white"
              : "border border-[color:var(--color-line)] text-[color:var(--color-muted)]")
          }
        >
          {step.done ? "✓" : index + 1}
        </span>
        <div>
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[color:var(--color-ink)]">
            {t(STEP_TITLE[step.id])}
            {step.optional ? <Badge variant="neutral">{t("onboarding.step.optional")}</Badge> : null}
            {step.done ? (
              <span className="text-xs font-medium text-[color:var(--color-ok)]">
                {t("onboarding.step.done")}
              </span>
            ) : null}
          </p>
          <p className="mt-1 max-w-prose text-sm leading-6 text-[color:var(--color-muted)]">
            {t(STEP_WHY[step.id])}
          </p>
          <p className="mt-1 text-xs text-[color:var(--color-muted)]">
            {t("onboarding.step.count", { count: step.count, target: step.target })}
          </p>
        </div>
      </div>
      <div className="shrink-0 sm:pl-4">
        <Link href={step.href}>
          <Button variant={step.done ? "ghost" : "secondary"} size="sm">
            {t(STEP_CTA[step.id])}
          </Button>
        </Link>
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
      <main className="mx-auto max-w-lg px-6 py-16">
        <PageHeader title={t("onboarding.signin.title")} subtitle={t("onboarding.signin.body")} />
        <div className="mt-6">
          <Link href="/login?next=%2Fonboarding">
            <Button>{t("onboarding.signin.cta")}</Button>
          </Link>
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
      <main className="mx-auto max-w-lg px-6 py-16">
        <PageHeader
          title={t("onboarding.create.title")}
          subtitle={t("onboarding.create.subtitle")}
        />
        <Card className="mt-6">
          <AgencyForm suggestedName={suggestedName} />
        </Card>
        <p className="mt-4 text-xs text-[color:var(--color-muted)]">
          {t("onboarding.create.invited_instead")}
        </p>
      </main>
    );
  }

  const db = await createServerSupabase();
  const [progress, agencyResult] = await Promise.all([
    loadOnboardingProgress(),
    db
      .from("agencies")
      .select("name, trial_ends_at")
      .eq("id", state.user.agencyId)
      .maybeSingle<{ name: string; trial_ends_at: string | null }>(),
  ]);

  const doneCount = progress.steps.filter((s) => !s.optional && s.done).length;
  const totalCount = progress.steps.filter((s) => !s.optional).length;
  const agencyName = agencyResult.data?.name ?? "";
  const trialEndsAt = agencyResult.data?.trial_ends_at ?? null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        title={t("onboarding.title")}
        subtitle={t("onboarding.subtitle", { agency: agencyName })}
        actions={
          <Link href="/shifts">
            <Button variant="ghost" size="sm">
              {t("onboarding.skip_all")}
            </Button>
          </Link>
        }
      />

      <p className="mt-2 text-sm text-[color:var(--color-muted)]">
        {t("onboarding.progress", { done: doneCount, total: totalCount })}
        {trialEndsAt ? ` · ${t("onboarding.trial_ends", { date: formatDate(trialEndsAt) })}` : ""}
      </p>

      <Card className="mt-6">
        <ol className="flex flex-col">
          {progress.steps.map((step, index) => (
            <StepRow key={step.id} step={step} index={index} />
          ))}
        </ol>
      </Card>

      {/* The aha moment. Everything above exists to make this link real. */}
      <Card className="mt-6">
        <h2 className="text-base font-semibold text-[color:var(--color-ink)]">
          {t("onboarding.aha.title")}
        </h2>
        <p className="mt-1 max-w-prose text-sm leading-6 text-[color:var(--color-muted)]">
          {progress.rankingReady
            ? t("onboarding.aha.body")
            : t("onboarding.aha.locked", { count: PROMOTER_TARGET })}
        </p>
        <div className="mt-4">
          {progress.rankingReady && progress.firstShiftId ? (
            <Link href={`/shifts/${progress.firstShiftId}`}>
              <Button>{t("onboarding.aha.cta")}</Button>
            </Link>
          ) : (
            <Link href={progress.campaignCount >= 1 ? "/campaigns" : "/campaigns/new"}>
              <Button variant="secondary">{t("onboarding.aha.locked_cta")}</Button>
            </Link>
          )}
        </div>
      </Card>

      <p className="mt-6 text-sm text-[color:var(--color-muted)]">
        <Link href="/settings" className="font-medium text-[color:var(--color-accent)] hover:underline">
          {t("onboarding.settings_link")}
        </Link>
      </p>
    </main>
  );
}
