import type { Metadata } from "next";
import Link from "next/link";
import {
  loadAgencyIdentity,
  agencyIdentityOwnerContext,
  identityComplete,
} from "@/lib/agency-settings";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { PageHeader, Card, Button, EmptyState } from "@/components/ui";
import { AgencyIdentityForm } from "./agency-identity-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "PromoterOS" };

const t = translatorFor(DEFAULT_LOCALE);

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-2">
      <dt className="text-sm text-[color:var(--color-muted)]">{label}</dt>
      <dd className="text-sm font-medium text-[color:var(--color-ink)]">{children}</dd>
    </div>
  );
}

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
      <main className="mx-auto max-w-2xl px-6 py-12">
        <PageHeader title={t("agency_settings.title")} />
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

  const complete = identityComplete(identity);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <PageHeader
        title={t("agency_settings.title")}
        subtitle={t("agency_settings.subtitle")}
        actions={
          <Link href="/settings">
            <Button variant="ghost" size="sm">
              {t("agency_settings.back_to_settings")}
            </Button>
          </Link>
        }
      />

      {!complete ? (
        <div className="mt-6 rounded-lg border border-[color:var(--color-warn)] bg-[color:var(--color-warn)]/10 px-4 py-3 text-sm text-[color:var(--color-ink)]">
          <p className="font-medium">{t("agency_settings.incomplete.title")}</p>
          <p className="mt-1 text-[color:var(--color-muted)]">
            {t("agency_settings.incomplete.body")}
          </p>
        </div>
      ) : null}

      <Card
        className="mt-6"
        header={
          <div>
            <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">
              {t("agency_settings.card_title")}
            </h2>
            <p className="mt-0.5 text-xs text-[color:var(--color-muted)]">
              {t("agency_settings.card_subtitle")}
            </p>
          </div>
        }
      >
        {owner ? (
          <AgencyIdentityForm
            legalName={identity.legalName ?? ""}
            privacyContactEmail={identity.privacyContactEmail ?? ""}
            retentionMonths={identity.retentionMonths}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <dl className="divide-y divide-[color:var(--color-line)]">
              <Row label={t("agency_settings.form.legal_name.label")}>
                {identity.legalName ?? t("agency_settings.not_set")}
              </Row>
              <Row label={t("agency_settings.form.privacy_email.label")}>
                {identity.privacyContactEmail ?? t("agency_settings.not_set")}
              </Row>
              <Row label={t("agency_settings.form.retention.label")}>
                {identity.retentionMonths
                  ? t("agency_settings.retention_value", { months: identity.retentionMonths })
                  : t("agency_settings.not_set")}
              </Row>
            </dl>
            <p className="text-sm text-[color:var(--color-muted)]">
              {t("agency_settings.readonly_notice")}
            </p>
          </div>
        )}
      </Card>
    </main>
  );
}
