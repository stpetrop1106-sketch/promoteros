import type { Metadata } from "next";
import {
  loadAgencyIdentity,
  agencyIdentityOwnerContext,
  identityComplete,
} from "@/lib/agency-settings";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { PageHeader, Card, LinkButton, EmptyState, SectionHeading, DetailList, Detail, Icon } from "@/components/ui";
import { AgencyIdentityForm } from "./agency-identity-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: translatorFor(DEFAULT_LOCALE)("page_title.settings_agency") };

const t = translatorFor(DEFAULT_LOCALE);

/**
 * The screen that closes the gap `docs/status/P33.md` describes: `agencies.legal_name`,
 * `agencies.privacy_contact_email` and `agencies.promoter_retention_months` (migration 0014) had
 * no product surface at all before this parcel — a real agency signing up saw a 500 on
 * `/privacy/promoters`, the notice its own promoters are told to read, because that page refuses
 * to render with a placeholder controller.
 *
 * Read-only for anyone signed in (so a coordinator can see what the agency has declared and why
 * it matters); the form only renders for an active owner, re-derived from the database by
 * `agencyIdentityOwnerContext()` — never trusted from a prop. Presentation, not the security
 * boundary: `updateAgencyIdentity()` (`lib/agency-settings.ts`) repeats the same check before any
 * write, exactly like `app/settings/team/page.tsx` documents for its own owner-only controls.
 */
export default async function AgencyIdentityPage() {
  const [identity, owner] = await Promise.all([
    loadAgencyIdentity(),
    agencyIdentityOwnerContext(),
  ]);

  if (!identity) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <PageHeader title={t("agency_settings.title")} />
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

  const complete = identityComplete(identity);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        title={t("agency_settings.title")}
        subtitle={t("agency_settings.subtitle")}
        actions={
          <LinkButton href="/settings" variant="ghost" size="sm">
            {t("agency_settings.back_to_settings")}
          </LinkButton>
        }
      />

      {!complete ? (
        <div
          role="status"
          className="mt-8 flex items-start gap-2.5 rounded-xl border border-[color:var(--color-warn-line)] bg-[color:var(--color-warn-subtle)] px-4 py-3 text-sm leading-5 text-[color:var(--color-warn-ink)]"
        >
          <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">{t("agency_settings.incomplete.title")}</p>
            <p className="mt-1 opacity-90">{t("agency_settings.incomplete.body")}</p>
          </div>
        </div>
      ) : null}

      <Card
        className="mt-8"
        elevation="raised"
        header={<SectionHeading level={3} title={t("agency_settings.card_title")} description={t("agency_settings.card_subtitle")} />}
      >
        {owner ? (
          <AgencyIdentityForm
            legalName={identity.legalName ?? ""}
            privacyContactEmail={identity.privacyContactEmail ?? ""}
            retentionMonths={identity.retentionMonths}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <DetailList columns={1}>
              <Detail label={t("agency_settings.form.legal_name.label")}>
                {identity.legalName ?? t("agency_settings.not_set")}
              </Detail>
              <Detail label={t("agency_settings.form.privacy_email.label")}>
                {identity.privacyContactEmail ?? t("agency_settings.not_set")}
              </Detail>
              <Detail label={t("agency_settings.form.retention.label")}>
                {identity.retentionMonths
                  ? t("agency_settings.retention_value", { months: identity.retentionMonths })
                  : t("agency_settings.not_set")}
              </Detail>
            </DetailList>
            <p className="border-t border-[color:var(--color-line)] pt-4 text-sm text-[color:var(--color-muted)]">
              {t("agency_settings.readonly_notice")}
            </p>
          </div>
        )}
      </Card>
    </main>
  );
}
