import type { Metadata } from "next";
import { loadTeamSnapshot } from "@/lib/team";
import { loadOnboardingProgress } from "@/lib/onboarding";
import { getEntitlement } from "@/lib/billing/subscription";
import { loadAgencyIdentity, identityComplete } from "@/lib/agency-settings";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";
import { PageHeader, Card, Badge, LinkButton, EmptyState, SectionHeading, DetailList, Detail } from "@/components/ui";
import { BillingBanner } from "@/components/billing-banner";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: translatorFor(DEFAULT_LOCALE)("page_title.settings") };

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

export default async function SettingsPage() {
  const snapshot = await loadTeamSnapshot();

  if (!snapshot) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <PageHeader title={t("settings.title")} />
        <div className="mt-8">
          <EmptyState
            title={t("team.no_agency_title")}
            description={t("team.no_agency_body")}
            action={<LinkButton href="/onboarding">{t("team.no_agency_cta")}</LinkButton>}
          />
        </div>
      </main>
    );
  }

  const { agency, viewer, seatsUsed } = snapshot;
  const [progress, entitlement, agencyIdentity] = await Promise.all([
    loadOnboardingProgress(),
    getEntitlement(agency.id),
    loadAgencyIdentity(),
  ]);
  const identityMissing = !agencyIdentity || !identityComplete(agencyIdentity);

  const planKey = PLAN_LABEL[agency.plan] ?? "settings.plan.starter";
  const statusKey = STATUS_LABEL[agency.subscriptionStatus] ?? "settings.subscription.trialing";

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />

      {entitlement ? (
        <div className="mt-8">
          <BillingBanner
            notice={entitlement.notice}
            access={entitlement.access}
            graceDaysRemaining={entitlement.graceDaysRemaining}
            trialDaysRemaining={entitlement.trialDaysRemaining}
          />
        </div>
      ) : null}

      <div className="mt-8 flex flex-col gap-6">
        <Card header={<SectionHeading level={3} title={t("settings.agency.title")} />}>
          <DetailList columns={2}>
            <Detail label={t("settings.agency.name")}>{agency.name}</Detail>
            <Detail label={t("settings.agency.city")}>{agency.city ?? "—"}</Detail>
            <Detail label={t("settings.agency.timezone")}>{agency.timezone}</Detail>
            <Detail label={t("settings.agency.plan")}>
              <Badge variant="info">{t(planKey)}</Badge>
            </Detail>
            <Detail label={t("settings.agency.status")}>
              <Badge variant={agency.subscriptionStatus === "past_due" ? "warn" : "neutral"}>{t(statusKey)}</Badge>
            </Detail>
            <Detail label={t("settings.agency.trial_ends")}>{formatDate(agency.trialEndsAt)}</Detail>
            <Detail label={t("settings.agency.seats")}>{t("team.seats", { used: seatsUsed, limit: agency.seatLimit })}</Detail>
            <Detail label={t("settings.agency.promoter_limit")}>
              {t("settings.agency.promoter_usage", { used: progress.promoterCount, limit: agency.promoterLimit })}
            </Detail>
          </DetailList>
          <p className="mt-5 border-t border-[color:var(--color-line)] pt-4 text-xs leading-5 text-[color:var(--color-muted)]">
            {t("enforcement.settings.agency_note")}
          </p>
        </Card>

        <Card header={<SectionHeading level={3} title={t("enforcement.settings.billing_title")} />}>
          <p className="text-sm leading-6 text-[color:var(--color-muted)]">
            {viewer.isOwner ? t("enforcement.settings.billing_body_owner") : t("enforcement.settings.billing_body_staff")}
          </p>
          <div className="mt-4">
            <LinkButton href="/settings/billing" variant="secondary">
              {t("enforcement.settings.billing_cta")}
            </LinkButton>
          </div>
        </Card>

        <Card header={<SectionHeading level={3} title={t("settings.card.team_title")} />}>
          <p className="text-sm leading-6 text-[color:var(--color-muted)]">
            {viewer.isOwner ? t("settings.card.team_body_owner") : t("settings.card.team_body_staff")}
          </p>
          <div className="mt-4">
            <LinkButton href="/settings/team" variant="secondary">
              {t("settings.card.team_cta")}
            </LinkButton>
          </div>
        </Card>

        <Card header={<SectionHeading level={3} title={t("settings.card.identity_title")} />}>
          <p className="text-sm leading-6 text-[color:var(--color-muted)]">{t("settings.card.identity_body")}</p>
          {identityMissing ? (
            <Badge variant="warn" dot className="mt-2">
              {t("settings.card.identity_missing")}
            </Badge>
          ) : null}
          <div className="mt-4">
            <LinkButton href="/settings/agency" variant="secondary">
              {t("settings.card.identity_cta")}
            </LinkButton>
          </div>
        </Card>

        {!progress.coreComplete ? (
          <Card header={<SectionHeading level={3} title={t("settings.card.onboarding_title")} />}>
            <p className="text-sm leading-6 text-[color:var(--color-muted)]">{t("settings.card.onboarding_body")}</p>
            <div className="mt-4">
              <LinkButton href="/onboarding">{t("settings.card.onboarding_cta")}</LinkButton>
            </div>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
