import Link from "next/link";
import {
  ATHENS_TZ,
  END_TIMES,
  START_TIMES,
  athensToday,
  isoAsUtcDate,
  type DayState,
} from "@/lib/availability-links";
import { translatorFor, type Locale } from "@/lib/i18n";
import { PromoterLanguageToggle } from "@/components/ui";
import { loadAvailability } from "./data";
import { AvailabilityGrid } from "./availability-grid";
import type { GridDay, GridLabels, SaveFailure } from "./state";
import {
  langQuery,
  localeFromSearchParams,
  otherLocale,
  type PromoterSearchParams,
} from "@/lib/promoter-locale";

export const dynamic = "force-dynamic";

const INTL_LOCALE: Record<Locale, string> = { el: "el-GR", en: "en-GB" };

/**
 * `product-spec.md` §2 — the promoter declares their own availability.
 *
 * No login, same shape as `/i/[token]` and `/c/[token]`: the signed link is the credential. What
 * separates this one is that it is long-lived (eight weeks — see `lib/availability-links.ts`),
 * because a promoter comes back to it whenever their month changes.
 *
 * The page shows the promoter's own name and their own fortnight. It shows NOTHING about the
 * agency: no campaign, no client, no store, no rate, no shift, no other promoter, not even the
 * agency's name. `./data.ts` documents the exact column list and why.
 */

/**
 * Both halves are formatted from the SAME UTC-midnight Date built out of explicit numeric parts,
 * with `timeZone: "UTC"` — never `new Date("2026-09-11")`, which parses as UTC midnight and then
 * prints as the previous day for anyone west of Greenwich. The date itself is already the Athens
 * calendar date; there is nothing left to convert.
 */
function formatDay(iso: string, locale: Locale): { weekday: string; dayLabel: string; isWeekend: boolean } {
  const utc = isoAsUtcDate(iso);
  const intl = INTL_LOCALE[locale];
  const weekday = new Intl.DateTimeFormat(intl, { timeZone: "UTC", weekday: "short" }).format(utc);
  const dayLabel = new Intl.DateTimeFormat(intl, {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
  }).format(utc);
  const weekday0 = utc.getUTCDay();
  return { weekday, dayLabel, isWeekend: weekday0 === 0 || weekday0 === 6 };
}

function summarise(state: DayState, t: ReturnType<typeof translatorFor>): string {
  if (state.choice === "clear") return t("promoter_availability.summary.not_set");

  const from = state.fromTime;
  const to = state.toTime;

  if (state.choice === "available") return t("promoter_availability.summary.available");

  if (state.choice === "partial") {
    return to
      ? t("promoter_availability.summary.available_range", { from: from ?? "", to })
      : t("promoter_availability.summary.available_from", { from: from ?? "" });
  }

  // `unavailable`. A whole-day row is the normal case; a partial one can only have been entered
  // by a coordinator ("not free 14:00–16:00"), and the promoter deserves to see the window.
  if (from || to) {
    return to && from
      ? t("promoter_availability.summary.unavailable_range", { from, to })
      : t("promoter_availability.summary.unavailable_from", { from: from ?? to ?? "" });
  }
  return t("promoter_availability.summary.unavailable");
}

function ErrorScreen({ reason, locale }: { reason: SaveFailure; locale: Locale }) {
  const t = translatorFor(locale);
  const key =
    reason === "expired"
      ? "promoter_availability.error.expired"
      : reason === "inactive"
        ? "promoter_availability.error.inactive"
        : reason === "not_found"
          ? "promoter_availability.error.not_found"
          : reason === "save_failed"
            ? "promoter_availability.error.unreachable"
            : "promoter_availability.error.bad_token";

  return (
    <main className="mx-auto max-w-md px-6 py-16 text-center">
      <h1 className="text-lg font-semibold">{t("promoter_availability.error.title")}</h1>
      <p className="mt-3 text-sm text-[color:var(--color-muted)]">{t(key)}</p>
      <p className="mt-2 text-sm text-[color:var(--color-muted)]">
        {t("promoter_availability.error.ask_coordinator")}
      </p>
    </main>
  );
}

export default async function PromoterAvailabilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: PromoterSearchParams;
}) {
  const { token } = await params;
  const locale = localeFromSearchParams(await searchParams);
  const t = translatorFor(locale);

  const result = await loadAvailability(token);
  if (!result.ok) return <ErrorScreen reason={result.reason} locale={locale} />;

  const today = athensToday();
  const days: GridDay[] = result.view.days.map(
    ({ date, state, hasPendingInvitation, hasBookedShift }) => {
      const { weekday, dayLabel, isWeekend } = formatDay(date, locale);
      return {
        date,
        weekday,
        dayLabel,
        isToday: date === today,
        isWeekend,
        choice: state.choice,
        fromTime: state.fromTime,
        toTime: state.toTime,
        summary: summarise(state, t),
        source: state.source,
        contradictory: state.contradictory,
        hasPendingInvitation,
        hasBookedShift,
      };
    },
  );

  const labels: GridLabels = {
    available: t("promoter_availability.choice.available"),
    unavailable: t("promoter_availability.choice.unavailable"),
    partial: t("promoter_availability.choice.partial"),
    clear: t("promoter_availability.choice.clear"),
    from: t("promoter_availability.partial.from"),
    to: t("promoter_availability.partial.to"),
    endOfDay: t("promoter_availability.partial.end_of_day"),
    apply: t("promoter_availability.partial.apply"),
    cancel: t("common.cancel"),
    saving: t("promoter_availability.saving"),
    saved: t("promoter_availability.saved"),
    byCoordinator: t("promoter_availability.source.coordinator"),
    contradiction: t("promoter_availability.source.contradiction"),
    invitationPending: t("promoter_availability.day.invitation_pending"),
    shiftBooked: t("promoter_availability.day.shift_booked"),
    errors: {
      bad_token: t("promoter_availability.error.bad_token"),
      expired: t("promoter_availability.error.expired"),
      inactive: t("promoter_availability.error.inactive"),
      not_found: t("promoter_availability.error.not_found"),
      bad_date: t("promoter_availability.error.bad_date"),
      bad_time: t("promoter_availability.error.bad_time"),
      bad_range: t("promoter_availability.error.bad_range"),
      bad_choice: t("promoter_availability.error.bad_choice"),
      save_failed: t("promoter_availability.error.save_failed"),
    },
  };

  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <h1 className="text-lg font-semibold">{t("promoter_availability.title")}</h1>
      <p className="mt-1 text-sm text-[color:var(--color-muted)]">
        {t("promoter_availability.hello", { name: result.view.promoterName })}
      </p>
      <p className="mt-4 text-sm">{t("promoter_availability.intro")}</p>
      <p className="mt-2 text-xs text-[color:var(--color-muted)]">
        {t("promoter_availability.timezone_note", { tz: ATHENS_TZ })}
      </p>

      <AvailabilityGrid
        token={token}
        days={days}
        labels={labels}
        startTimes={[...START_TIMES]}
        endTimes={[...END_TIMES]}
      />

      <p className="mt-8 text-center text-xs text-[color:var(--color-muted)]">
        {t("promoter_availability.footer")}
      </p>

      {/* P32 · Gate 1 — a promoter-facing page must reach the privacy notice without a login.
          A3-22 — a 44px target instead of a 15px line of grey text. */}
      <div className="mt-6 flex items-center justify-center gap-2 text-center">
        <Link
          className="inline-flex min-h-[44px] items-center px-3 py-2 text-sm text-[color:var(--color-muted)] underline underline-offset-2"
          href={{ pathname: `/a/${token}/privacy`, query: langQuery(locale) }}
        >
          {t("promoter_privacy.link")}
        </Link>
        <span aria-hidden className="text-[color:var(--color-line)]">·</span>
        <PromoterLanguageToggle
          pathname={`/a/${token}`}
          query={langQuery(otherLocale(locale))}
          label={t("promoter.language.label")}
          otherLabel={t("promoter.language.other")}
        />
      </div>
    </main>
  );
}
