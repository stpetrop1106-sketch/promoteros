import type { Metadata } from "next";
import Link from "next/link";
import { loadTeamSnapshot } from "@/lib/team";
import { loadOnboardingProgress } from "@/lib/onboarding";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";
import { PageHeader, Card, Badge, Button, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "PromoterOS" };

const t = translatorFor(DEFAULT_LOCALE);

const PLAN_LABEL: Record<string, TranslationKey> = {
  starter: "settings.plan.starter",
  agency: "settings.plan.agency",
  multi_brand: "settings.plan.multi_brand",
};

const STATUS_LABEL: Record<string, TranslationKey> = {
  trialing: "settings.subscription.trialing",
  active: "settings.subscription.active",
  past_due: "settings.subscription.past_due",
  canceled: "settings.subscription.canceled",
  paused: "settings.subscription.paused",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("el-GR", { dateStyle: "long" }).format(new Date(value));
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-2">
      <dt className="text-sm text-[color:var(--color-muted)]">{label}</dt>
      <dd className="text-sm font-medium text-[color:var(--color-ink)]">{children}</dd>
    </div>
  );
}

export default async function SettingsPage() {
  const snapshot = await loadTeamSnapshot();

  if (!snapshot) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <PageHeader title={t("settings.title")} />
        <div className="mt-6">
          <EmptyState
            title={t("team.no_agency_title")}
            description={t("team.no_agency_body")}
            action={
              <Link href="/onboarding">
                <Button>{t("team.no_agency_cta")}</Button>
              </Link>
            }
          />
        </div>
      </main>
    );
  }

  const { agency, viewer, seatsUsed } = snapshot;
  const progress = await loadOnboardingProgress();

  const planKey = PLAN_LABEL[agency.plan] ?? "settings.plan.starter";
  const statusKey = STATUS_LABEL[agency.subscriptionStatus] ?? "settings.subscription.trialing";

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />

      <Card
        className="mt-6"
        header={
          <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">
            {t("settings.agency.title")}
          </h2>
        }
      >
        <dl className="divide-y divide-[color:var(--color-line)]">
          <Row label={t("settings.agency.name")}>{agency.name}</Row>
          <Row label={t("settings.agency.city")}>{agency.city ?? "—"}</Row>
          <Row label={t("settings.agency.timezone")}>{agency.timezone}</Row>
          <Row label={t("settings.agency.plan")}>
            <Badge variant="info">{t(planKey)}</Badge>
          </Row>
          <Row label={t("settings.agency.status")}>
            <Badge variant={agency.subscriptionStatus === "past_due" ? "warn" : "neutral"}>
              {t(statusKey)}
            </Badge>
          </Row>
          <Row label={t("settings.agency.trial_ends")}>{formatDate(agency.trialEndsAt)}</Row>
          <Row label={t("settings.agency.seats")}>
            {t("team.seats", { used: seatsUsed, limit: agency.seatLimit })}
          </Row>
          <Row label={t("settings.agency.promoter_limit")}>
            {t("settings.agency.promoter_usage", {
              used: progress.promoterCount,
              limit: agency.promoterLimit,
            })}
          </Row>
        </dl>
        <p className="mt-3 text-xs text-[color:var(--color-muted)]">
          {t("settings.agency.change_note")}
        </p>
      </Card>

      <Card
        className="mt-6"
        header={
          <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">
            {t("settings.card.team_title")}
          </h2>
        }
      >
        <p className="text-sm leading-6 text-[color:var(--color-muted)]">
          {viewer.isOwner ? t("settings.card.team_body_owner") : t("settings.card.team_body_staff")}
        </p>
        <div className="mt-4">
          <Link href="/settings/team">
            <Button variant="secondary">{t("settings.card.team_cta")}</Button>
          </Link>
        </div>
      </Card>

      {!progress.coreComplete ? (
        <Card
          className="mt-6"
          header={
            <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">
              {t("settings.card.onboarding_title")}
            </h2>
          }
        >
          <p className="text-sm leading-6 text-[color:var(--color-muted)]">
            {t("settings.card.onboarding_body")}
          </p>
          <div className="mt-4">
            <Link href="/onboarding">
              <Button>{t("settings.card.onboarding_cta")}</Button>
            </Link>
          </div>
        </Card>
      ) : null}
    </main>
  );
}
