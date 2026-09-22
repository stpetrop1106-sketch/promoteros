import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { ownerContext } from "@/lib/team";
import { getEntitlement, type BillingNotice, type Entitlement } from "@/lib/billing/subscription";
import {
  PLAN_ORDER,
  PLANS,
  formatEur,
  effectiveMonthlyCents,
  isBillingInterval,
  priceCents,
  priceIdFor,
  type BillingInterval,
  type PlanId,
} from "@/lib/billing/plans";
import { isConfigured, stripeMode } from "@/lib/billing/stripe";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";
import { PageHeader, Card, Badge, LinkButton, EmptyState, SectionHeading, DetailList, Detail, Icon } from "@/components/ui";
import { SubscribeButton, PortalButton } from "./billing-controls";

/**
 * Billing.
 *
 * Three rules shape this screen and none of them is cosmetic:
 *
 *   1. **Owner only.** A coordinator who lands here gets a sentence explaining who can see it and
 *      a way back — not a blank 403, which reads as a bug (§6, no dead ends). The real check is
 *      `ownerContext()`, which re-reads the role from the database on every request.
 *   2. **No card form.** Every path that touches money leaves for a Stripe-hosted page. Card
 *      data must never reach our servers, so there is nothing here to collect it.
 *   3. **It renders with no Stripe key.** That is the normal state today
 *      (`docs/keys-needed.md` §2). The plans, the limits and the current subscription state all
 *      come from our own database, so the screen is fully informative; only the buttons that
 *      would call Stripe are disabled, with a sentence saying why.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: translatorFor(DEFAULT_LOCALE)("page_title.settings_billing") };

const t = translatorFor(DEFAULT_LOCALE);

const PLAN_NAME: Record<PlanId, TranslationKey> = {
  starter: "billing.plan.starter",
  agency: "billing.plan.agency",
  multi_brand: "billing.plan.multi_brand",
};

const STATUS_LABEL: Record<Entitlement["status"], TranslationKey> = {
  trialing: "billing.status.trialing",
  active: "billing.status.active",
  past_due: "billing.status.past_due",
  canceled: "billing.status.canceled",
  paused: "billing.status.paused",
};

const NOTICE_TITLE: Record<BillingNotice, TranslationKey> = {
  trial_ending: "billing.notice.trial_ending.title",
  trial_expired: "billing.notice.trial_expired.title",
  past_due: "billing.notice.past_due.title",
  grace_ending: "billing.notice.grace_ending.title",
  read_only_unpaid: "billing.notice.read_only_unpaid.title",
  paused: "billing.notice.paused.title",
  canceled: "billing.notice.canceled.title",
};

const NOTICE_BODY: Record<BillingNotice, TranslationKey> = {
  trial_ending: "billing.notice.trial_ending.body",
  trial_expired: "billing.notice.trial_expired.body",
  past_due: "billing.notice.past_due.body",
  grace_ending: "billing.notice.grace_ending.body",
  read_only_unpaid: "billing.notice.read_only_unpaid.body",
  paused: "billing.notice.paused.body",
  canceled: "billing.notice.canceled.body",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("el-GR", { dateStyle: "long" }).format(date);
}

function StatusBadge({ entitlement }: { entitlement: Entitlement }) {
  const variant =
    entitlement.access === "read_only" ? "bad" : entitlement.access === "grace" ? "warn" : "ok";

  return <Badge variant={variant}>{t(STATUS_LABEL[entitlement.status])}</Badge>;
}

/**
 * The banner. Its severity mirrors `evaluateAccess()` exactly: amber while everything still
 * works, red only once access has actually dropped to read-only. A red banner over a working
 * product teaches people to ignore banners.
 */
function NoticeBanner({ entitlement }: { entitlement: Entitlement }) {
  if (!entitlement.notice) return null;

  const severe = entitlement.access === "read_only";
  const days = entitlement.graceDaysRemaining ?? entitlement.trialDaysRemaining ?? 0;
  const tone = severe
    ? "border-[color:var(--color-bad-line)] bg-[color:var(--color-bad-subtle)] text-[color:var(--color-bad-ink)]"
    : "border-[color:var(--color-warn-line)] bg-[color:var(--color-warn-subtle)] text-[color:var(--color-warn-ink)]";

  return (
    <div role="status" className={`mt-8 flex items-start gap-2.5 rounded-xl border px-4 py-3 ${tone}`}>
      <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-semibold">{t(NOTICE_TITLE[entitlement.notice])}</p>
        <p className="mt-1 text-sm leading-6 opacity-90">
          {t(NOTICE_BODY[entitlement.notice], { days: Math.max(0, days) })}
        </p>
      </div>
    </div>
  );
}

type BillingPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const user = await requireUser();
  const owner = await ownerContext();
  const params = await searchParams;

  // Not an owner. A specific explanation and a route forward, never a blank refusal.
  if (!owner) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <PageHeader title={t("billing.title")} />
        <div className="mt-8">
          <EmptyState
            title={t("billing.owner_only_title")}
            description={t("billing.owner_only_body")}
            action={
              <LinkButton href="/settings" variant="secondary">
                {t("billing.back_to_settings")}
              </LinkButton>
            }
          />
        </div>
      </main>
    );
  }

  const entitlement = await getEntitlement(owner.agencyId);

  if (!entitlement) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <PageHeader title={t("billing.title")} />
        <div className="mt-8">
          <EmptyState
            title={t("billing.no_agency_title")}
            description={t("billing.no_agency_body")}
            action={<LinkButton href="/onboarding">{t("billing.no_agency_cta")}</LinkButton>}
          />
        </div>
      </main>
    );
  }

  const intervalParam = params["interval"];
  const interval: BillingInterval =
    typeof intervalParam === "string" && isBillingInterval(intervalParam) ? intervalParam : "month";

  const checkout = typeof params["checkout"] === "string" ? params["checkout"] : null;
  const configured = isConfigured();
  const mode = stripeMode();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        title={t("billing.title")}
        subtitle={t("billing.subtitle", { agency: entitlement.agencyName })}
        actions={
          <LinkButton href="/settings" variant="ghost" size="sm">
            {t("billing.back_to_settings")}
          </LinkButton>
        }
      />

      <NoticeBanner entitlement={entitlement} />

      {/* Coming back from Stripe always says something. A silent return would leave the customer
          wondering whether they had just paid. */}
      {checkout === "success" ? (
        <div
          role="status"
          className="mt-8 flex items-start gap-2.5 rounded-xl border border-[color:var(--color-ok-line)] bg-[color:var(--color-ok-subtle)] px-4 py-3 text-[color:var(--color-ok-ink)]"
        >
          <Icon name="check" size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">{t("billing.checkout.success_title")}</p>
            <p className="mt-1 text-sm leading-6 opacity-90">{t("billing.checkout.success_body")}</p>
          </div>
        </div>
      ) : null}

      {checkout === "cancelled" ? (
        <div
          role="status"
          className="mt-8 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-4 py-3"
        >
          <p className="text-sm font-semibold text-[color:var(--color-ink)]">
            {t("billing.checkout.cancelled_title")}
          </p>
          <p className="mt-1 text-sm leading-6 text-[color:var(--color-muted)]">
            {t("billing.checkout.cancelled_body")}
          </p>
        </div>
      ) : null}

      {!configured ? (
        <Card className="mt-8">
          <p className="text-sm font-semibold text-[color:var(--color-ink)]">
            {t("billing.not_configured_title")}
          </p>
          <p className="mt-1 text-sm leading-6 text-[color:var(--color-muted)]">
            {t("billing.not_configured_body")}
          </p>
        </Card>
      ) : null}

      {mode === "test" ? (
        <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-[color:var(--color-warn-ink)]">
          <Icon name="alert" size={14} />
          {t("billing.test_mode")}
        </p>
      ) : null}

      <div className="mt-8 flex flex-col gap-6">
      <Card header={<SectionHeading level={3} title={t("billing.current.title")} />}>
        <DetailList columns={2}>
          <Detail label={t("billing.current.plan")}>
            <Badge variant="info">{t(PLAN_NAME[entitlement.planId])}</Badge>
          </Detail>
          <Detail label={t("billing.current.status")}>
            <StatusBadge entitlement={entitlement} />
          </Detail>
          {entitlement.status === "trialing" ? (
            <Detail label={t("billing.current.trial_ends")}>
              {entitlement.trialEndsAt
                ? t("billing.current.trial_days", {
                    date: formatDate(entitlement.trialEndsAt),
                    days: Math.max(0, entitlement.trialDaysRemaining ?? 0),
                  })
                : "—"}
            </Detail>
          ) : null}
          <Detail label={t("billing.current.renews")}>{formatDate(entitlement.currentPeriodEnd)}</Detail>
          <Detail label={t("billing.current.access")}>
            {t(
              entitlement.access === "read_only"
                ? "billing.access.read_only"
                : entitlement.access === "grace"
                  ? "billing.access.grace"
                  : "billing.access.full",
            )}
          </Detail>
        </DetailList>

        {!entitlement.stripeSubscriptionId ? (
          <p className="mt-5 border-t border-[color:var(--color-line)] pt-4 text-xs text-[color:var(--color-muted)]">
            {t("billing.current.no_subscription")}
          </p>
        ) : null}
      </Card>

      <Card header={<SectionHeading level={3} title={t("billing.usage.title")} />}>
        <DetailList columns={2}>
          <Detail label={t("billing.usage.seats")}>
            <span className="inline-flex flex-wrap items-center gap-2">
              {t("billing.usage.of_limit", { used: entitlement.seatsUsed, limit: entitlement.seatLimit })}
              {entitlement.overSeatLimit ? <Badge variant="warn">{t("billing.usage.at_limit")}</Badge> : null}
            </span>
          </Detail>
          <Detail label={t("billing.usage.promoters")}>
            <span className="inline-flex flex-wrap items-center gap-2">
              {t("billing.usage.of_limit", { used: entitlement.promotersUsed, limit: entitlement.promoterLimit })}
              {entitlement.overPromoterLimit ? <Badge variant="warn">{t("billing.usage.at_limit")}</Badge> : null}
            </span>
          </Detail>
        </DetailList>
        <p className="mt-5 border-t border-[color:var(--color-line)] pt-4 text-xs leading-5 text-[color:var(--color-muted)]">
          {t("billing.usage.note")}
        </p>
      </Card>

      <Card
        header={
          <SectionHeading
            level={3}
            title={t("billing.plans.title")}
            description={t("billing.plans.subtitle")}
            actions={
              // A plain anchor, not <Link>: typed routes only know a route once it has been built,
              // and this page is new. The toggle is a full navigation either way.
              <a
                href={interval === "year" ? "/settings/billing" : "/settings/billing?interval=year"}
                className="text-xs font-semibold text-[color:var(--color-accent)] underline underline-offset-2 hover:no-underline"
              >
                {interval === "year" ? t("billing.interval.switch_to_monthly") : t("billing.interval.switch_to_annual")}
              </a>
            }
          />
        }
      >
        <ul className="grid gap-4 sm:grid-cols-3">
          {PLAN_ORDER.map((planId) => {
            const plan = PLANS[planId];
            const isCurrent = entitlement.planId === planId && entitlement.status !== "canceled";
            const priceReady = priceIdFor(planId, interval) !== null;

            return (
              <li
                key={planId}
                className={
                  "flex flex-col gap-3 rounded-xl border p-4 " +
                  (isCurrent
                    ? "border-[color:var(--color-accent-line)] bg-[color:var(--color-accent-subtle)]/40"
                    : "border-[color:var(--color-line)]")
                }
              >
                <div>
                  <p className="text-sm font-semibold text-[color:var(--color-ink)]">{t(PLAN_NAME[planId])}</p>
                  <p className="mt-1 text-lg font-semibold text-[color:var(--color-ink)]">
                    {formatEur(priceCents(plan, interval))}
                    {/* A2 finding 29 — `ml-1` plus a leading space inside the key rendered
                        "149 € / μήνα". The unit belongs against the amount. */}
                    <span className="text-xs font-normal text-[color:var(--color-muted)]">
                      {interval === "year" ? t("billing.interval.per_year") : t("billing.interval.per_month")}
                    </span>
                  </p>
                  {interval === "year" ? (
                    <p className="mt-1 text-xs text-[color:var(--color-muted)]">
                      {t("billing.interval.annual_effective", { price: formatEur(effectiveMonthlyCents(plan, "year")) })}
                    </p>
                  ) : null}
                </div>

                <ul className="space-y-1 text-xs text-[color:var(--color-muted)]">
                  <li>
                    {plan.seatLimit === null
                      ? t("billing.plan.seats_unlimited")
                      : t("billing.plan.seats", { count: plan.seatLimit })}
                  </li>
                  <li>{t("billing.plan.promoters", { count: plan.promoterLimit })}</li>
                </ul>

                <div className="mt-auto">
                  {isCurrent && entitlement.stripeSubscriptionId ? (
                    <Badge variant="info">{t("billing.cta.current_plan")}</Badge>
                  ) : (
                    <SubscribeButton
                      planId={planId}
                      interval={interval}
                      label={entitlement.stripeSubscriptionId ? t("billing.cta.change_plan") : t("billing.cta.subscribe")}
                      variant={planId === "agency" ? "primary" : "secondary"}
                      disabled={!configured || !priceReady}
                    />
                  )}

                  {/* A2 finding 23 — the button is disabled without a Stripe key, and a
                      disabled button with no sentence beside it is indistinguishable from a
                      broken one. Say which of the two reasons applies, per card. */}
                  {!configured ? (
                    <p className="mt-2 text-xs text-[color:var(--color-muted)]">{t("billing.cta.unavailable")}</p>
                  ) : !priceReady ? (
                    <p className="mt-2 text-xs text-[color:var(--color-muted)]">{t("billing.plan.price_missing")}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card header={<SectionHeading level={3} title={t("billing.portal.title")} />}>
        <p className="text-sm leading-6 text-[color:var(--color-muted)]">{t("billing.portal.body")}</p>
        <div className="mt-4">
          <PortalButton label={t("billing.portal.cta")} disabled={!configured || !entitlement.stripeCustomerId} />
        </div>
        {!configured ? (
          <p className="mt-2 text-xs text-[color:var(--color-muted)]">{t("billing.cta.unavailable")}</p>
        ) : !entitlement.stripeCustomerId ? (
          <p className="mt-2 text-xs text-[color:var(--color-muted)]">{t("billing.portal.unavailable")}</p>
        ) : null}
      </Card>
      </div>

      <p className="mt-8 text-xs leading-5 text-[color:var(--color-muted)]">{t("billing.data_note")}</p>
      <p className="mt-2 text-xs leading-5 text-[color:var(--color-muted)]">
        {t("billing.contact_note", { email: user.email })}
      </p>
    </main>
  );
}
