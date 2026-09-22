import Link from "next/link";
import { loadCheckin } from "@/lib/checkins";
import { translatorFor } from "@/lib/i18n";
import { Markdown, PromoterLanguageToggle } from "@/components/ui";
import { CheckinForm } from "./checkin-form";
import { CheckinErrorScreen } from "./error-screen";
import { formatShiftWhen } from "@/lib/shift-format";
import { athensDate } from "@/lib/exceptions";
import {
  langQuery,
  localeFromSearchParams,
  otherLocale,
  type PromoterSearchParams,
} from "@/lib/promoter-locale";

export const dynamic = "force-dynamic";

/**
 * The promoter's arrival page. No login: the signed link is the credential, same shape as
 * `/i/[token]`. Mobile-first — this is opened standing in a supermarket, on one bar of signal.
 *
 * The "not yet time" gate is date-level only (not hour-level) on purpose: a wrong hour-level cutoff
 * that blocks a legitimate early or late arrival is a worse failure than being slightly permissive.
 * See docs/status/P9.md. The date itself is Athens, not UTC — see the comment on `todayIso`.
 */
export default async function CheckinPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: PromoterSearchParams;
}) {
  const { token } = await params;
  const locale = localeFromSearchParams(await searchParams);
  const t = translatorFor(locale);
  const result = await loadCheckin(token);

  // A3-05 — including `cancelled`, which used to be told "the link has expired".
  if (!result.ok) return <CheckinErrorScreen reason={result.reason} locale={locale} />;

  const v = result.view;
  // The agency's wall clock, not the server's. `toISOString()` is UTC, and Athens runs two to three
  // hours ahead of it: between midnight and 03:00 Athens time, UTC is still yesterday, so a promoter
  // opening this page on the morning of her own shift was told it had not started yet. Found while
  // the owner was testing an invitation on 2026-09-20.
  const todayIso = athensDate(new Date());
  const notYetTime = !v.checkedIn && v.onDate > todayIso;
  const alreadyDone = v.checkedIn && v.hasReport;

  const labels = {
    confirm: t("checkin.confirm"),
    locating: t("checkin.locating"),
    submitting: t("checkin.submitting"),
    success: t("checkin.success"),
    tooFar: t("checkin.too_far"),
    recordedFarNote: t("checkin.recorded_far_note"),
    goToReport: t("checkin.go_to_report"),
    useOverride: t("checkin.override"),
    overridePrompt: t("checkin.override_prompt"),
    overrideReasonLabel: t("checkin.override_reason_label"),
    overrideReasonPlaceholder: t("checkin.override_reason_placeholder"),
    overrideSubmit: t("checkin.override_submit"),
    retryGeo: t("checkin.retry_geo"),
    geoDenied: t("checkin.geo_denied"),
    geoUnavailable: t("checkin.geo_unavailable"),
    geoTimeout: t("checkin.geo_timeout"),
    geoUnsupported: t("checkin.geo_unsupported"),
    geoInsecure: t("checkin.geo_insecure"),
    offline: t("promoter.offline"),
    alreadyCheckedIn: t("checkin.already_checked_in_error"),
    saveFailedByReason: {
      already_checked_in: t("checkin.already_checked_in_error"),
      default: t("checkin.save_failed"),
    },
  };

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1 className="text-lg font-semibold">{t("checkin.title")}</h1>

      <dl className="mt-6 space-y-3 rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-5 text-sm shadow-[var(--elevation-card)]">
        <div>
          <dt className="text-[color:var(--color-muted)]">{t("shifts.campaign")}</dt>
          <dd className="font-medium">{v.campaignName}</dd>
        </div>
        <div>
          <dt className="text-[color:var(--color-muted)]">{t("shifts.store")}</dt>
          <dd className="font-medium">
            {v.storeName}
            {v.storeAddress ? ` · ${v.storeAddress}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-[color:var(--color-muted)]">{t("shifts.date")}</dt>
          <dd className="font-medium">
            {formatShiftWhen(v.onDate, v.startTime, v.endTime)}
          </dd>
        </div>
        {v.briefSummary && (
          <div>
            <dt className="text-[color:var(--color-muted)]">{t("checkin.brief_title")}</dt>
            <dd>
              <Markdown source={v.briefSummary} className="text-[color:var(--color-ink)]" />
            </dd>
          </div>
        )}
      </dl>

      <p className="mt-4 text-xs text-[color:var(--color-muted)]">{t("checkin.privacy")}</p>

      {alreadyDone ? (
        <p className="mt-6 text-center text-sm">{t("checkin.already_done")}</p>
      ) : v.checkedIn ? (
        <div className="mt-6 space-y-3 text-center text-sm">
          <p className="font-medium text-[color:var(--color-ok)]">{t("checkin.success")}</p>
          {v.withinGeofence === false && (
            <p className="text-[color:var(--color-muted)]">
              {t("checkin.too_far")} {t("checkin.recorded_far_note")}
            </p>
          )}
          <Link
            href={{ pathname: `/c/${token}/report`, query: langQuery(locale) }}
            className="inline-block rounded-lg bg-[color:var(--color-accent)] px-4 py-3 font-semibold text-white transition hover:bg-[color:var(--color-accent-hover)]"
          >
            {t("checkin.go_to_report")}
          </Link>
        </div>
      ) : notYetTime ? (
        <p className="mt-6 text-center text-sm text-[color:var(--color-muted)]">
          {t("checkin.not_yet_time")}
        </p>
      ) : (
        <CheckinForm
          token={token}
          reportHref={`/c/${token}/report`}
          reportQuery={langQuery(locale)}
          labels={labels}
        />
      )}

      {/* P32 · Gate 1. This is the page where location is asked for, so it is the page where
          the notice explaining that no location is stored matters most.
          A3-22 — a 44px target instead of a 15px line of grey text. */}
      <div className="mt-10 flex items-center justify-center gap-2 text-center">
        <Link
          className="inline-flex min-h-[44px] items-center px-3 py-2 text-sm text-[color:var(--color-muted)] underline underline-offset-2"
          href={{ pathname: `/c/${token}/privacy`, query: langQuery(locale) }}
        >
          {t("promoter_privacy.link")}
        </Link>
        <span aria-hidden className="text-[color:var(--color-line)]">·</span>
        <PromoterLanguageToggle
          pathname={`/c/${token}`}
          query={langQuery(otherLocale(locale))}
          label={t("promoter.language.label")}
          otherLabel={t("promoter.language.other")}
        />
      </div>
    </main>
  );
}
