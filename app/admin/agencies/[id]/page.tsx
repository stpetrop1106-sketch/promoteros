import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { agencySummary } from "@/lib/admin/agencies";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { PageHeader, Card, Badge, Button } from "@/components/ui";
import { PLAN_LABEL, STATUS_LABEL, STATUS_VARIANT, formatAdminDate } from "@/lib/admin/labels";
import { ActivityPanel } from "./activity-panel";
import { ActionsPanel } from "./actions-panel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "PromoterOS admin" };

const t = translatorFor(DEFAULT_LOCALE);

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-[color:var(--color-muted)]">{label}</p>
      <p className="text-lg font-semibold text-[color:var(--color-ink)]">{value}</p>
    </div>
  );
}

/**
 * Aggregates are always visible (`agencySummary`, no reason required — commercial-
 * architecture.md §5). Recent activity — actual campaign and shift records — is gated behind
 * `ActivityPanel`'s reason form. Acting on the agency is gated behind `ActionsPanel`'s explicit
 * mode toggle.
 */
export default async function AdminAgencyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agency = await agencySummary(id);

  if (!agency) notFound();

  return (
    <>
      <PageHeader
        title={agency.name}
        subtitle={t("admin.agency.aggregates_title")}
        actions={
          <Link href="/admin/agencies">
            <Button variant="ghost" size="sm">
              {t("admin.agency.back")}
            </Button>
          </Link>
        }
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant={STATUS_VARIANT[agency.subscriptionStatus] ?? "neutral"}>
          {t(STATUS_LABEL[agency.subscriptionStatus] ?? "admin.status.trialing")}
        </Badge>
        <Badge variant="info">{t(PLAN_LABEL[agency.plan] ?? "admin.plan.starter")}</Badge>
        {agency.suspendedAt ? (
          <Badge variant="bad">{t("admin.agencies.suspended_badge")}</Badge>
        ) : null}
        {agency.deletionRequestedAt ? (
          <Badge variant="warn">
            {t("admin.agency.deletion.marked_badge", { when: formatAdminDate(agency.deletionRequestedAt) })}
          </Badge>
        ) : null}
      </div>

      <Card className="mt-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label={t("admin.agencies.col.users")} value={agency.userCount} />
          <Stat label={t("admin.agencies.col.promoters")} value={agency.promoterCount} />
          <Stat label={t("admin.agencies.col.campaigns")} value={agency.campaignCount} />
          <Stat label={t("admin.agencies.col.shifts")} value={agency.shiftCount} />
          <Stat label={t("admin.agencies.col.trial_ends")} value={formatAdminDate(agency.trialEndsAt)} />
          <Stat label={t("admin.agencies.col.created")} value={formatAdminDate(agency.createdAt)} />
          <Stat label={t("admin.agency.city_label")} value={agency.city ?? "—"} />
          <Stat label={t("admin.agency.timezone_label")} value={agency.timezone} />
        </div>
      </Card>

      <ActivityPanel agencyId={agency.agencyId} />

      <div className="mt-8">
        <ActionsPanel
          agencyId={agency.agencyId}
          agencyName={agency.name}
          currentPlan={agency.plan}
          suspended={Boolean(agency.suspendedAt)}
          deletionRequested={Boolean(agency.deletionRequestedAt)}
          userCount={agency.userCount}
          promoterCount={agency.promoterCount}
        />
      </div>
    </>
  );
}
