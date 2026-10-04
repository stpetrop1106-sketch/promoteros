import Link from "next/link";
import Image from "next/image";
import { currentUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";
import { formatEuroCents } from "@/lib/shift-format";
import {
  PLANS,
  PLAN_ORDER,
  priceCents,
  priceIdFor,
  type PlanId,
} from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

/**
 * What PromoterOS costs.
 *
 * Public: an agency deciding whether to try this should not have to create an account to find out
 * the price. Signed-in visitors additionally see where their own trial stands, read from
 * `agencies.trial_ends_at` — never recomputed, because that column is the single authority for the
 * trial and duplicating its length anywhere would undo the one-edit property (D25).
 *
 * **Nothing here pretends a payment is possible.** There are no Stripe keys in this project yet
 * (D27), so `priceIdFor()` returns null for every tier, and the page says plainly that online
 * payment is not switched on while still letting an agency start the free month. A disabled
 * "Subscribe" button with no explanation is how a product loses the customer who was ready to buy.
 */

const PLAN_LABEL: Record<PlanId, TranslationKey> = {
  starter: "billing.plan.starter",
  agency: "billing.plan.agency",
  multi_brand: "billing.plan.multi_brand",
};

const INCLUDED: TranslationKey[] = [
  "pricing.included_1",
  "pricing.included_2",
  "pricing.included_3",
  "pricing.included_4",
  "pricing.included_5",
  "pricing.included_6",
];

function PlanCard({ planId, recommended }: { planId: PlanId; recommended: boolean }) {
  const t = translatorFor(DEFAULT_LOCALE);
  const plan = PLANS[planId];
  const monthly = priceCents(plan, "month");
  const annual = priceCents(plan, "year");
  const annualPerMonth = Math.round(annual / 12);

  return (
    <article
      className={`flex flex-col rounded-[var(--radius-xl)] border bg-[color:var(--color-surface)] p-6 ${
        recommended
          ? "border-[color:var(--color-accent-line)] shadow-[var(--elevation-card)]"
          : "border-[color:var(--color-line)]"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-[color:var(--color-ink)]">
          {t(PLAN_LABEL[planId])}
        </h2>
        {recommended ? (
          <span className="rounded-full bg-[color:var(--color-accent-subtle)] px-2.5 py-1 text-[0.7rem] font-medium text-[color:var(--color-accent-ink)]">
            {t("pricing.recommended")}
          </span>
        ) : null}
      </div>

      <p className="mt-5 font-mono text-3xl tabular-nums text-[color:var(--color-ink)]">
        {formatEuroCents(monthly)}
        <span className="ml-1 font-sans text-sm text-[color:var(--color-muted)]">
          {t("billing.interval.per_month")}
        </span>
      </p>
      <p className="mt-1.5 text-[0.82rem] text-[color:var(--color-muted)]">
        {t("billing.interval.annual_effective", { price: formatEuroCents(annualPerMonth) })}
      </p>

      <div className="mt-6 border-t border-[color:var(--color-line)] pt-5">
        <p className="text-[0.72rem] uppercase tracking-[0.1em] text-[color:var(--color-muted)]">
          {t("pricing.limits_title")}
        </p>
        <ul className="mt-3 flex flex-col gap-2 text-[0.9rem] text-[color:var(--color-ink-soft)]">
          <li>
            {plan.seatLimit === null
              ? t("billing.plan.seats_unlimited")
              : t("billing.plan.seats", { count: plan.seatLimit })}
          </li>
          <li>{t("billing.plan.promoters", { count: plan.promoterLimit })}</li>
        </ul>
      </div>

      {/* The price id is absent for every tier today. Saying so here, per tier, is the contract
          `lib/billing/plans.ts` documents: a missing id means "cannot subscribe yet", never a
          crash and never a button that silently does nothing. */}
      {priceIdFor(planId, "month") === null ? (
        <p className="mt-5 text-[0.78rem] leading-5 text-[color:var(--color-muted-soft)]">
          {t("billing.plan.price_missing")}
        </p>
      ) : null}

      <Link
        href="/signup"
        className={`mt-6 rounded-[var(--radius-sm)] px-4 py-2.5 text-center text-[0.9rem] font-medium transition ${
          recommended
            ? "bg-[color:var(--color-accent)] text-white hover:bg-[color:var(--color-accent-hover)]"
            : "border border-[color:var(--color-line-strong)] text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-hover)]"
        }`}
      >
        {t("pricing.start_cta")}
      </Link>
    </article>
  );
}

export default async function PricingPage() {
  const t = translatorFor(DEFAULT_LOCALE);
  const user = await currentUser();

  // Only for the line telling a signed-in owner where their own trial stands. A visitor who is not
  // signed in sees the prices and nothing about anybody's account.
  let agency: { name: string; trial_ends_at: string | null; plan: string } | null = null;
  if (user) {
    const db = await createServerSupabase();
    const { data } = await db
      .from("agencies")
      .select("name, trial_ends_at, plan")
      .eq("id", user.agencyId)
      .maybeSingle<{ name: string; trial_ends_at: string | null; plan: string }>();
    agency = data ?? null;
  }

  const trialEnds = agency?.trial_ends_at ? new Date(agency.trial_ends_at) : null;
  const trialDate = trialEnds
    ? new Intl.DateTimeFormat("el-GR", { day: "2-digit", month: "long", year: "numeric" }).format(
        trialEnds,
      )
    : null;

  return (
    <main className="min-h-screen bg-[color:var(--color-canvas)]">
      <header className="border-b border-[color:var(--color-line)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/promoteros-mark.svg" alt={t("landing.logo_alt")} width={28} height={28} />
            <span className="text-[1.05rem] font-semibold tracking-tight text-[color:var(--color-ink)]">
              {t("app.name")}
            </span>
          </Link>
          <Link
            href={user ? "/dashboard" : "/login"}
            className="text-[0.88rem] text-[color:var(--color-muted)] transition hover:text-[color:var(--color-ink)]"
          >
            {user ? t("app.name") : t("auth.login_title")}
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
        <h1 className="text-[2rem] font-semibold tracking-[-0.02em] text-[color:var(--color-ink)] sm:text-[2.6rem]">
          {t("pricing.title")}
        </h1>
        <p className="mt-5 max-w-2xl text-[1.02rem] leading-[1.75] text-[color:var(--color-muted)]">
          {t("pricing.subtitle")}
        </p>
        <p className="mt-3 text-[0.95rem] text-[color:var(--color-action-ink)]">
          {t("pricing.trial_note")}
        </p>

        {agency && trialDate ? (
          <div className="mt-8 rounded-[var(--radius-lg)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-5 py-4">
            <p className="text-[0.92rem] text-[color:var(--color-ink)]">
              {t("pricing.your_trial", { agency: agency.name, date: trialDate })}
            </p>
            <Link
              href="/settings/billing"
              className="mt-2 inline-block text-[0.85rem] font-medium text-[color:var(--color-accent)] hover:underline"
            >
              {t("pricing.your_subscription_cta")}
            </Link>
          </div>
        ) : null}

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {PLAN_ORDER.map((planId) => (
            <PlanCard key={planId} planId={planId} recommended={planId === "agency"} />
          ))}
        </div>

        <p className="mt-6 text-[0.85rem] text-[color:var(--color-muted)]">
          {t("pricing.change_plan_note")}
        </p>

        <section className="mt-14 rounded-[var(--radius-lg)] border border-[color:var(--color-warn-line)] bg-[color:var(--color-warn-subtle)] px-5 py-5">
          <h2 className="text-[0.95rem] font-semibold text-[color:var(--color-ink)]">
            {t("pricing.payment_pending_title")}
          </h2>
          <p className="mt-2 max-w-2xl text-[0.9rem] leading-6 text-[color:var(--color-warn-ink)]">
            {t("pricing.payment_pending_body")}
          </p>
        </section>

        <section className="mt-14 border-t border-[color:var(--color-line)] pt-10">
          <h2 className="text-[1.3rem] font-semibold tracking-[-0.01em] text-[color:var(--color-ink)]">
            {t("pricing.included_title")}
          </h2>
          <p className="mt-3 max-w-2xl text-[0.95rem] leading-7 text-[color:var(--color-muted)]">
            {t("pricing.included_note")}
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {INCLUDED.map((key) => (
              <li
                key={key}
                className="flex gap-3 text-[0.92rem] leading-6 text-[color:var(--color-ink-soft)]"
              >
                <span
                  className="mt-2.5 size-1.5 shrink-0 rounded-full bg-[color:var(--color-action)]"
                  aria-hidden="true"
                />
                {t(key)}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
