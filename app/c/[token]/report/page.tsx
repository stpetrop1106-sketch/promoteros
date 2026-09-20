import Link from "next/link";
import { loadCheckin } from "@/lib/checkins";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { ReportForm } from "./report-form";
import { submitReport } from "./actions";
import { formatShiftWhen } from "@/lib/shift-format";

export const dynamic = "force-dynamic";

/**
 * The field report, filed after check-in. Same no-login shape as `/c/[token]`: the signed token
 * is the credential — see `lib/checkins.ts`.
 *
 * A report cannot exist before a check-in (`submitFieldReport` enforces this server-side); this
 * page mirrors that with a plain message and a link back to `/c/[token]`, never a dead end.
 */
export default async function ReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const t = translatorFor(DEFAULT_LOCALE);
  const result = await loadCheckin(token);

  if (!result.ok) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-[color:var(--color-muted)]">{t("checkin.expired")}</p>
      </main>
    );
  }

  const v = result.view;

  if (!v.checkedIn) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-[color:var(--color-muted)]">{t("report.checkin_required_notice")}</p>
        <Link
          href={`/c/${token}`}
          className="mt-6 inline-block rounded-lg bg-[color:var(--color-accent)] px-4 py-3 font-semibold text-white transition hover:bg-[color:var(--color-accent-hover)]"
        >
          {t("report.back_to_checkin")}
        </Link>
      </main>
    );
  }

  if (v.hasReport) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="font-medium text-[color:var(--color-ok)]">{t("report.already_submitted")}</p>
      </main>
    );
  }

  const labels = {
    unitsPromoted: t("report.units_promoted_label"),
    salesCount: t("report.sales_count_label"),
    interactionsCount: t("report.interactions_count_label"),
    stockIssues: t("report.stock_issues_label"),
    storeManagerName: t("report.store_manager_name_label"),
    notes: t("report.notes_label"),
    photos: t("report.photos_label"),
    photosHint: t("report.photos_hint"),
    photosPreparing: t("report.photos_preparing"),
    submit: t("report.submit"),
    submitting: t("report.submitting"),
    success: t("report.success"),
    successWithPhotoFailures: t("report.success_with_photo_failures"),
  };

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1 className="text-lg font-semibold">{t("report.title")}</h1>

      <dl className="mt-4 space-y-1 text-sm text-[color:var(--color-muted)]">
        <div>
          {v.campaignName} · {v.storeName}
        </div>
        <div>
          {formatShiftWhen(v.onDate, v.startTime, v.endTime)}
        </div>
      </dl>

      <ReportForm action={submitReport.bind(null, token)} labels={labels} />
    </main>
  );
}
