import { notFound } from "next/navigation";
import {
  ATHENS_TZ,
  END_TIMES,
  START_TIMES,
  athensToday,
  isoAsUtcDate,
  type DayState,
} from "@/lib/availability-links";
import { translatorFor, DEFAULT_LOCALE, type Locale, type TranslationKey } from "@/lib/i18n";
import { Badge, PageHeader, type BadgeVariant } from "@/components/ui";
import { LinkButton } from "../../link-button";
import { loadCoordinatorAvailability, type PromoterStatus } from "./data";
import { AvailabilityGrid } from "./availability-grid";
import type { BulkLabels, GridDay, GridLabels, SaveFailure } from "./state";

export const dynamic = "force-dynamic";

const INTL_LOCALE: Record<Locale, string> = { el: "el-GR", en: "en-GB" };

const STATUS_BADGE: Record<PromoterStatus, BadgeVariant> = {
  active: "ok",
  paused: "warn",
  archived: "neutral",
  blocklisted: "bad",
};

/**
 * P5 — `product-spec.md` §2, the coordinator's side: "a promoter phones the coordinator and says
 * 'I can't do Thursday'", and that has to be recordable without asking her to open `/a/[token]`.
 *
 * Same fortnight, same Europe/Athens day arithmetic, same one-row-per-date contract as the
 * promoter's own page (`app/a/[token]/page.tsx`) — `lib/availability-links.ts` is reused
 * unchanged, so the two screens can never quietly drift into different ideas of what a "day"
 * means. What differs is the audience: this page is authenticated, shows the promoter's name and
 * status the way the rest of `app/promoters/**` does, and every row it writes is stamped
 * `source: 'coordinator'` rather than `'self'` (`./data.ts`).
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
  if (state.choice === "clear") return t("promoters.availability.summary.not_set");

  const from = state.fromTime;
  const to = state.toTime;

  if (state.choice === "available") return t("promoters.availability.summary.available");

  if (state.choice === "partial") {
    return to
      ? t("promoters.availability.summary.available_range", { from: from ?? "", to })
      : t("promoters.availability.summary.available_from", { from: from ?? "" });
  }

  if (from || to) {
    return to && from
      ? t("promoters.availability.summary.unavailable_range", { from, to })
      : t("promoters.availability.summary.unavailable_from", { from: from ?? to ?? "" });
  }
  return t("promoters.availability.summary.unavailable");
}

const ERROR_KEY: Record<SaveFailure, TranslationKey> = {
  not_found: "promoters.availability.error.not_found",
  bad_date: "promoters.availability.error.bad_date",
  bad_time: "promoters.availability.error.bad_time",
  bad_range: "promoters.availability.error.bad_range",
  bad_choice: "promoters.availability.error.bad_choice",
  save_failed: "promoters.availability.error.save_failed",
  blocked_read_only: "promoters.availability.error.blocked_read_only",
};

export default async function CoordinatorAvailabilityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = DEFAULT_LOCALE;
  const t = translatorFor(locale);

  const result = await loadCoordinatorAvailability(id);
  if (!result.ok) {
    if (result.reason === "not_found") notFound();
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p role="alert" className="text-sm text-[color:var(--color-bad)]">
          {t("promoters.availability.error.unreachable")}
        </p>
      </main>
    );
  }

  const { promoter, days: viewDays } = result.view;
  const today = athensToday();

  const days: GridDay[] = viewDays.map(({ date, state }) => {
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
    };
  });

  const errors = {
    not_found: t(ERROR_KEY.not_found),
    bad_date: t(ERROR_KEY.bad_date),
    bad_time: t(ERROR_KEY.bad_time),
    bad_range: t(ERROR_KEY.bad_range),
    bad_choice: t(ERROR_KEY.bad_choice),
    save_failed: t(ERROR_KEY.save_failed),
    blocked_read_only: t(ERROR_KEY.blocked_read_only),
  };

  const labels: GridLabels = {
    available: t("promoters.availability.choice.available"),
    unavailable: t("promoters.availability.choice.unavailable"),
    partial: t("promoters.availability.choice.partial"),
    clear: t("promoters.availability.choice.clear"),
    from: t("promoters.availability.partial.from"),
    to: t("promoters.availability.partial.to"),
    endOfDay: t("promoters.availability.partial.end_of_day"),
    apply: t("promoters.availability.partial.apply"),
    cancel: t("common.cancel"),
    saving: t("promoters.availability.saving"),
    saved: t("promoters.availability.saved"),
    bySelf: t("promoters.availability.source.self"),
    byCoordinator: t("promoters.availability.source.coordinator"),
    contradiction: t("promoters.availability.source.contradiction"),
    undeclared: t("promoters.availability.status.undeclared"),
    errors,
  };

  const bulkLabels: BulkLabels = {
    title: t("promoters.availability.bulk.title"),
    weekdays: t("promoters.availability.bulk.weekdays"),
    weekend: t("promoters.availability.bulk.weekend"),
    clearAll: t("promoters.availability.bulk.clear_all"),
    clearAllConfirm: t("promoters.availability.bulk.clear_all_confirm"),
    clearAllCancel: t("promoters.availability.bulk.clear_all_cancel"),
    clearAllWarning: t("promoters.availability.bulk.clear_all_warning"),
    clearAllWarningSelf: t("promoters.availability.bulk.clear_all_warning_self"),
    running: t("promoters.availability.bulk.running"),
    done: {
      weekdays: t("promoters.availability.bulk.done_weekdays"),
      weekend: t("promoters.availability.bulk.done_weekend"),
      clear_all: t("promoters.availability.bulk.done_clear_all"),
    },
    errors,
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        title={t("promoters.availability.title", { name: promoter.fullName })}
        subtitle={t("promoters.availability.subtitle", { tz: ATHENS_TZ })}
        actions={
          <LinkButton href={`/promoters/${promoter.id}`} variant="secondary">
            {t("promoters.availability.back_to_profile")}
          </LinkButton>
        }
      />

      {promoter.status !== "active" ? (
        <div className="mt-3">
          <Badge variant={STATUS_BADGE[promoter.status]}>{t(`promoters.status.${promoter.status}`)}</Badge>
        </div>
      ) : null}

      <AvailabilityGrid
        promoterId={promoter.id}
        days={days}
        labels={labels}
        bulkLabels={bulkLabels}
        startTimes={[...START_TIMES]}
        endTimes={[...END_TIMES]}
      />
    </main>
  );
}
