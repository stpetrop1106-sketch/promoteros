import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { translatorFor, DEFAULT_LOCALE, type Locale, type TranslationKey } from "@/lib/i18n";
import {
  Badge,
  Card,
  Detail,
  DetailList,
  EmptyState,
  Icon,
  PageHeader,
  StatStrip,
  StatTile,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  buttonClassName,
} from "@/components/ui";
import type { StatTileTone } from "@/components/ui";
import type {
  CampaignReport,
  FieldTotals,
  ReportAttendance,
  ReportBasis,
  ReportCoverage,
  ReportedTotal,
} from "@/lib/reporting";
import { loadCampaignReport, signPhotoUrls } from "./data";

/**
 * P29 — the client report. `docs/product-spec.md` §11.
 *
 * This is the artefact the agency is paid to produce. Every number on it already existed in the
 * database — check-ins, field reports, photos, coverage — and until this screen there was nowhere
 * that assembled them, so a coordinator was still pasting figures into a slide deck at midnight.
 *
 * The whole page obeys one rule, enforced by `lib/reporting.ts` and rendered by `<Figure>` below:
 * **no total is shown without the reporting basis it rests on.** A "12.400 units" headline built
 * on 12 of 30 field reports is not a smaller version of the truth, it is a different number, and
 * an agency that hands that to a client gets found out.
 *
 * Aggregation is pure and unit-tested (`tests/reporting.test.ts`); reading is in `./data.ts`;
 * this file only formats. Nothing here filters on `agency_id` — RLS does, so a campaign belonging
 * to another agency 404s (CLAUDE.md §4).
 */

export const dynamic = "force-dynamic";

const INTL_LOCALE: Record<Locale, string> = { el: "el-GR", en: "en-GB" };

/**
 * "YYYY-MM-DD" (already an Athens calendar date) rendered short, reformatted from its own parts.
 * `new Date("2026-09-10")` parses as UTC midnight and would print the previous day for a reader
 * west of Greenwich — the trap CLAUDE.md names, and the reason no `Date` is built from a date
 * string anywhere on this page.
 */
function formatDateString(onDate: string): string {
  if (!onDate) return "—";
  const [y, m, d] = onDate.split("-");
  return `${d}/${m}/${y}`;
}

/** A Postgres `time` ("HH:MM:SS") as the wall clock a coordinator reads. */
function timeLabel(value: string): string {
  return value.slice(0, 5);
}

function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(value);
}

function formatInstant(iso: string, locale: Locale): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "—";
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: "Europe/Athens",
    dateStyle: "medium",
    timeStyle: "short",
    // A2 finding 30 — 24-hour everywhere.
    hourCycle: "h23",
  }).format(new Date(parsed));
}

type T = ReturnType<typeof translatorFor>;

// -------------------------------------------------------------------------------------------
// Small presentational pieces
// -------------------------------------------------------------------------------------------

/** The sentence that says what a figure is a sum of. It is never optional. */
function basisSentence(basis: ReportBasis, t: T): string {
  if (basis.reportsExpected === 0) return t("campaign_report.basis.none_expected");
  if (basis.complete) return t("campaign_report.basis.complete", { expected: basis.reportsExpected });
  return t("campaign_report.basis.partial", {
    arrived: basis.reportsIn,
    expected: basis.reportsExpected,
    missing: basis.reportsMissing,
  });
}

/**
 * A headline figure, its basis, and — when the two disagree — an explicit badge.
 *
 * The badge is not decoration. It is what stops the number being copied into a deck as if it were
 * final, which is the exact failure this parcel exists to prevent.
 */
function Figure({
  labelKey,
  total,
  locale,
  t,
}: {
  labelKey: TranslationKey;
  total: ReportedTotal;
  locale: Locale;
  t: T;
}) {
  const fieldGap = total.basis.reportsIn - total.reportedCount;
  return (
    <div>
      <dt className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-[color:var(--color-muted)]">
        {t(labelKey)}
        {total.complete ? null : <Badge variant="warn">{t("campaign_report.basis.incomplete")}</Badge>}
      </dt>
      <dd className="mt-1 text-2xl font-semibold text-[color:var(--color-ink)]">
        {formatNumber(total.value, locale)}
      </dd>
      <p className="mt-1 text-xs text-[color:var(--color-muted)]">{basisSentence(total.basis, t)}</p>
      {fieldGap > 0 ? (
        <p className="mt-0.5 text-xs text-[color:var(--color-muted)]">
          {t("campaign_report.basis.field_partial", {
            reported: total.reportedCount,
            arrived: total.basis.reportsIn,
          })}
        </p>
      ) : null}
    </div>
  );
}

function CoverageCard({
  coverage,
  locale,
  t,
}: {
  coverage: ReportCoverage;
  locale: Locale;
  t: T;
}) {
  const filledTone: StatTileTone = coverage.filledSlots >= coverage.requiredSlots ? "ok" : "warn";
  return (
    <Card header={<h2 className="text-sm font-semibold text-[color:var(--color-ink)]">{t("campaign_report.coverage.title")}</h2>}>
      <StatStrip className="sm:grid-cols-3 xl:grid-cols-6">
        <StatTile
          label={t("campaign_report.coverage.shifts")}
          value={formatNumber(coverage.shifts, locale)}
          icon={<Icon name="calendar" size={18} />}
        />
        <StatTile
          label={t("campaign_report.coverage.filled")}
          value={t("campaign_report.of", {
            done: formatNumber(coverage.filledSlots, locale),
            total: formatNumber(coverage.requiredSlots, locale),
          })}
          icon={<Icon name="users" size={18} />}
          tone={filledTone}
        />
        <StatTile
          label={t("campaign_report.coverage.completion")}
          value={`${Math.round(coverage.completionRate * 100)}%`}
          icon={<Icon name="trendUp" size={18} />}
          tone={coverage.completionRate >= 1 ? "ok" : "neutral"}
        />
        <StatTile
          label={t("campaign_report.coverage.cancelled_shifts")}
          value={formatNumber(coverage.cancelledShifts, locale)}
          icon={<Icon name="close" size={18} />}
          tone={coverage.cancelledShifts > 0 ? "warn" : "neutral"}
        />
        <StatTile
          label={t("campaign_report.coverage.cancellations")}
          value={formatNumber(coverage.cancelledAssignments, locale)}
          icon={<Icon name="close" size={18} />}
          tone={coverage.cancelledAssignments > 0 ? "warn" : "neutral"}
        />
        <StatTile
          label={t("campaign_report.coverage.no_shows")}
          value={formatNumber(coverage.noShows, locale)}
          icon={<Icon name="alert" size={18} />}
          tone={coverage.noShows > 0 ? "bad" : "ok"}
        />
      </StatStrip>
      <p className="mt-4 text-xs leading-5 text-[color:var(--color-muted)]">
        {t("campaign_report.coverage.note")}
      </p>
    </Card>
  );
}

function AttendanceCard({
  attendance,
  locale,
  t,
}: {
  attendance: ReportAttendance;
  locale: Locale;
  t: T;
}) {
  return (
    <Card header={<h2 className="text-sm font-semibold text-[color:var(--color-ink)]">{t("campaign_report.attendance.title")}</h2>}>
      <StatStrip className="sm:grid-cols-3 xl:grid-cols-6">
        <StatTile
          label={t("campaign_report.attendance.checked_in")}
          value={t("campaign_report.of", {
            done: formatNumber(attendance.checkedIn, locale),
            total: formatNumber(attendance.expected, locale),
          })}
          icon={<Icon name="mapPin" size={18} />}
          tone={attendance.checkedIn >= attendance.expected ? "ok" : "warn"}
        />
        <StatTile
          label={t("campaign_report.attendance.within_geofence")}
          value={formatNumber(attendance.withinGeofence, locale)}
          icon={<Icon name="mapPin" size={18} />}
          tone="ok"
        />
        <StatTile
          label={t("campaign_report.attendance.outside_geofence")}
          value={formatNumber(attendance.outsideGeofence, locale)}
          icon={<Icon name="mapPin" size={18} />}
          tone={attendance.outsideGeofence > 0 ? "warn" : "neutral"}
        />
        <StatTile
          label={t("campaign_report.attendance.geofence_unknown")}
          value={formatNumber(attendance.geofenceUnknown, locale)}
          icon={<Icon name="mapPin" size={18} />}
        />
        {/* Two axes over the same check-ins, and a manual override is not a fault — CLAUDE.md
            §3 — so this tile stays neutral even when the count is high. */}
        <StatTile
          label={t("campaign_report.attendance.manual_overrides")}
          value={formatNumber(attendance.manualOverrides, locale)}
          icon={<Icon name="check" size={18} />}
        />
        <StatTile
          label={t("campaign_report.attendance.not_checked_in")}
          value={formatNumber(attendance.notCheckedIn, locale)}
          icon={<Icon name="alert" size={18} />}
          tone={attendance.notCheckedIn > 0 ? "bad" : "ok"}
        />
      </StatStrip>
      <p className="mt-4 text-xs leading-5 text-[color:var(--color-muted)]">
        {t("campaign_report.attendance.note")}
      </p>
    </Card>
  );
}

function reportsLabel(totals: FieldTotals, t: T): string {
  return t("campaign_report.of", {
    done: totals.basis.reportsIn,
    total: totals.basis.reportsExpected,
  });
}

// -------------------------------------------------------------------------------------------
// The page
// -------------------------------------------------------------------------------------------

export default async function CampaignReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = DEFAULT_LOCALE;
  const t = translatorFor(locale);
  const user = await requireUser();

  const loaded = await loadCampaignReport(id);
  if (!loaded) notFound();
  const { report, truncated }: { report: CampaignReport; truncated: boolean } = loaded;

  // Private bucket, short-lived signed URLs, never a public object. See `./data.ts`.
  const photoUrls = await signPhotoUrls(report.photos, user.agencyId);

  const subtitle = [report.campaign.clientName, report.campaign.campaignType]
    .filter(Boolean)
    .join(" · ");

  const exportBase = `/campaigns/${id}/report/export`;
  const exportLinkClass = buttonClassName({ variant: "secondary", size: "sm" });

  const hasShifts = report.shiftRows.length > 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 sm:py-12">
      <div className="flex flex-col gap-8">
        <PageHeader
          eyebrow={
            <Link
              href={`/campaigns/${id}`}
              className="inline-flex items-center gap-1 rounded-sm hover:text-[color:var(--color-ink)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            >
              <Icon name="chevronLeft" size={14} />
              {report.campaign.name}
            </Link>
          }
          title={t("campaign_report.title", { campaign: report.campaign.name })}
          subtitle={subtitle || undefined}
          actions={
            <>
              {/* Plain anchors, not <Link>: these are file downloads, not client navigations.
                  `buttonClassName()` keeps them pixel-identical to every real <Button> on the
                  page — see its doc comment in components/ui/Button.tsx. */}
              <a className={exportLinkClass} href={`${exportBase}?mode=shifts`}>
                {t("campaign_report.export_shifts")}
              </a>
              <a className={exportLinkClass} href={`${exportBase}?mode=stores`}>
                {t("campaign_report.export_stores")}
              </a>
            </>
          }
        />

        {truncated ? (
          <p className="flex items-start gap-2 rounded-2xl border border-[color:var(--color-warn-line)] bg-[color:var(--color-warn-subtle)] px-4 py-3.5 text-sm text-[color:var(--color-warn-ink)]">
            <Icon name="alert" size={18} className="mt-px shrink-0 text-[color:var(--color-warn)]" />
            <span>
              <span className="font-semibold">{t("campaign_report.truncated.title")}</span>{" "}
              {t("campaign_report.truncated.body")}
            </span>
          </p>
        ) : null}

        {/* --- Identity of the report ---------------------------------------------------- */}
        <Card
          elevation="raised"
          header={<h2 className="text-sm font-semibold text-[color:var(--color-ink)]">{t("campaign_report.overview.title")}</h2>}
        >
          <DetailList columns={2}>
            <Detail label={t("campaign_report.overview.client")}>{report.campaign.clientName ?? "—"}</Detail>
            <Detail label={t("campaign_report.overview.period")}>
              {report.period
                ? `${formatDateString(report.period.from)} → ${formatDateString(report.period.to)}`
                : `${formatDateString(report.campaign.startsOn)} → ${formatDateString(report.campaign.endsOn)}`}
            </Detail>
            <Detail label={t("campaign_report.overview.stores", { count: report.storeCount })}>
              {report.storeNames.length > 0 ? report.storeNames.join(" · ") : "—"}
            </Detail>
            <Detail label={t("campaign_report.overview.promoters", { count: report.promoterCount })}>
              {report.promoterNames.length > 0 ? report.promoterNames.join(" · ") : "—"}
            </Detail>
          </DetailList>
          <p className="mt-4 text-xs text-[color:var(--color-muted)]">
            {t("campaign_report.generated", { at: formatInstant(report.generatedAt, locale) })}
          </p>
        </Card>

        {!hasShifts ? (
          // Nothing is scheduled, so there is nothing to report on. Teaching the next step beats
          // a wall of zeroes (commercial-architecture.md §6: empty states teach, no dead ends).
          <EmptyState
            icon={<Icon name="calendar" size={24} />}
            title={t("campaign_report.empty.no_shifts.title")}
            description={t("campaign_report.empty.no_shifts.body")}
            action={
              <Link href={`/campaigns/${id}/shifts/new`} className={buttonClassName({ size: "sm" })}>
                {t("campaign_report.empty.no_shifts.cta")}
              </Link>
            }
          />
        ) : (
          <>
            <CoverageCard coverage={report.coverage} locale={locale} t={t} />

            {!report.hasFieldData ? (
              // The honest empty state: shifts exist, the campaign is under way, and nothing has
              // come back from the field yet. That is a real answer and it is said plainly,
              // rather than dressed up as a page of confident zeroes.
              <EmptyState
                icon={<Icon name="inbox" size={24} />}
                title={t("campaign_report.empty.title")}
                description={t("campaign_report.empty.body")}
                action={
                  <p className="max-w-md text-xs text-[color:var(--color-muted)]">
                    {t("campaign_report.empty.hint", {
                      expected: report.totals.basis.reportsExpected,
                    })}
                  </p>
                }
              />
            ) : (
              <>
                <Card
                  elevation="raised"
                  header={
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">{t("campaign_report.totals.title")}</h2>
                      <span className="text-xs text-[color:var(--color-muted)]">
                        {basisSentence(report.totals.basis, t)}
                      </span>
                    </div>
                  }
                >
                  <dl className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                    <Figure
                      labelKey="campaign_report.totals.units"
                      total={report.totals.unitsPromoted}
                      locale={locale}
                      t={t}
                    />
                    <Figure
                      labelKey="campaign_report.totals.sales"
                      total={report.totals.salesCount}
                      locale={locale}
                      t={t}
                    />
                    <Figure
                      labelKey="campaign_report.totals.interactions"
                      total={report.totals.interactionsCount}
                      locale={locale}
                      t={t}
                    />
                  </dl>
                </Card>

                <AttendanceCard attendance={report.attendance} locale={locale} t={t} />
              </>
            )}

            {/* --- Per store ------------------------------------------------------------- */}
            <Card
              flush={report.stores.length > 0}
              header={
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">{t("campaign_report.stores.title")}</h2>
                  <span className="text-xs text-[color:var(--color-muted)]">
                    {t("campaign_report.stores.hint")}
                  </span>
                </div>
              }
            >
              {report.stores.length === 0 ? (
                <p className="text-sm text-[color:var(--color-muted)]">{t("campaign_report.stores.none")}</p>
              ) : (
                <Table bare label={t("campaign_report.stores.title")}>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>{t("campaign_report.stores.col_store")}</TableHeaderCell>
                      <TableHeaderCell className="text-right">{t("campaign_report.stores.col_shifts")}</TableHeaderCell>
                      <TableHeaderCell className="text-right">{t("campaign_report.stores.col_coverage")}</TableHeaderCell>
                      <TableHeaderCell className="text-right">{t("campaign_report.stores.col_attendance")}</TableHeaderCell>
                      <TableHeaderCell>{t("campaign_report.stores.col_reports")}</TableHeaderCell>
                      <TableHeaderCell className="text-right">{t("campaign_report.stores.col_units")}</TableHeaderCell>
                      <TableHeaderCell className="text-right">{t("campaign_report.stores.col_sales")}</TableHeaderCell>
                      <TableHeaderCell className="text-right">{t("campaign_report.stores.col_interactions")}</TableHeaderCell>
                      <TableHeaderCell className="text-right">{t("campaign_report.stores.col_photos")}</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {report.stores.map((store) => (
                      <TableRow key={store.storeId}>
                        <TableCell>
                          <span className="font-medium text-[color:var(--color-ink)]">{store.storeName}</span>
                          {store.chain ? (
                            <span className="block text-xs text-[color:var(--color-muted)]">
                              {store.chain}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(store.coverage.shifts, locale)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {t("campaign_report.of", {
                            done: store.coverage.filledSlots,
                            total: store.coverage.requiredSlots,
                          })}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {t("campaign_report.of", {
                            done: store.attendance.checkedIn,
                            total: store.attendance.expected,
                          })}
                        </TableCell>
                        <TableCell>
                          <span className="whitespace-nowrap">{reportsLabel(store.totals, t)}</span>
                          {store.totals.basis.complete ? null : (
                            <Badge variant="warn" size="sm" className="ml-2">
                              {t("campaign_report.basis.incomplete")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(store.totals.unitsPromoted.value, locale)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(store.totals.salesCount.value, locale)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(store.totals.interactionsCount.value, locale)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(store.photoCount, locale)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>

            {/* --- Photos, grouped by store ---------------------------------------------- */}
            <Card
              header={
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">{t("campaign_report.photos.title")}</h2>
                  <span className="text-xs text-[color:var(--color-muted)]">
                    {t("campaign_report.photos.count", { count: report.photos.length })}
                  </span>
                </div>
              }
            >
              {report.photosByStore.length === 0 ? (
                <p className="text-sm text-[color:var(--color-muted)]">{t("campaign_report.photos.none")}</p>
              ) : (
                <div className="flex flex-col gap-6">
                  {report.photosByStore.map((group) => (
                    <section key={group.storeId}>
                      <h3 className="text-sm font-semibold text-[color:var(--color-ink)]">
                        {group.storeName}
                      </h3>
                      <ul className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                        {group.photos.map((photo) => {
                          const url = photoUrls.get(photo.id);
                          return (
                            <li key={photo.id} className="flex flex-col gap-1">
                              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-canvas)]">
                                {url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={url}
                                    alt={t("campaign_report.photos.alt", {
                                      store: group.storeName,
                                      date: formatDateString(photo.onDate),
                                    })}
                                    className="size-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <span className="px-2 text-center text-xs text-[color:var(--color-muted)]">
                                    {t("campaign_report.photos.unavailable")}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[color:var(--color-muted)]">
                                {t("campaign_report.photos.meta", {
                                  date: formatDateString(photo.onDate),
                                  promoter: photo.promoterName,
                                })}
                              </p>
                              {photo.caption ? (
                                <p className="text-xs text-[color:var(--color-ink)]">
                                  {photo.caption}
                                </p>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </Card>

            {/* --- Notes and observations ------------------------------------------------ */}
            <Card header={<h2 className="text-sm font-semibold text-[color:var(--color-ink)]">{t("campaign_report.notes.title")}</h2>}>
              {report.notes.length === 0 ? (
                <p className="text-sm text-[color:var(--color-muted)]">{t("campaign_report.notes.none")}</p>
              ) : (
                <ul className="flex flex-col gap-5">
                  {report.notes.map((note) => (
                    <li
                      key={note.fieldReportId}
                      className="border-l-2 border-[color:var(--color-line)] pl-4"
                    >
                      <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-muted)]">
                        {t("campaign_report.notes.meta", {
                          store: note.storeName,
                          date: formatDateString(note.onDate),
                          promoter: note.promoterName,
                        })}
                      </p>
                      {note.notes ? (
                        <p className="mt-1 whitespace-pre-line text-sm text-[color:var(--color-ink)]">
                          {note.notes}
                        </p>
                      ) : null}
                      {note.stockIssues ? (
                        <p className="mt-1 text-sm text-[color:var(--color-ink)]">
                          <span className="font-semibold">{t("campaign_report.notes.stock_issues")}: </span>
                          {note.stockIssues}
                        </p>
                      ) : null}
                      {note.storeManagerName ? (
                        <p className="mt-1 text-xs text-[color:var(--color-muted)]">
                          {t("campaign_report.notes.manager")}: {note.storeManagerName}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* --- Per shift -------------------------------------------------------------- */}
            <Card
              flush
              header={<h2 className="text-sm font-semibold text-[color:var(--color-ink)]">{t("campaign_report.shifts.title")}</h2>}
            >
              <Table bare layout="fluid" label={t("campaign_report.shifts.title")}>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>{t("campaign_report.shifts.col_date")}</TableHeaderCell>
                    <TableHeaderCell>{t("campaign_report.shifts.col_store")}</TableHeaderCell>
                    <TableHeaderCell>{t("campaign_report.shifts.col_promoters")}</TableHeaderCell>
                    <TableHeaderCell className="text-right">{t("campaign_report.shifts.col_coverage")}</TableHeaderCell>
                    <TableHeaderCell>{t("campaign_report.shifts.col_reports")}</TableHeaderCell>
                    <TableHeaderCell className="text-right">{t("campaign_report.shifts.col_units")}</TableHeaderCell>
                    <TableHeaderCell className="text-right">{t("campaign_report.shifts.col_photos")}</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.shiftRows.map((row) => (
                    <TableRow key={row.shiftId}>
                      <TableCell>
                        <Link
                          href={`/shifts/${row.shiftId}`}
                          className="whitespace-nowrap rounded-sm font-medium text-[color:var(--color-accent)] hover:underline focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                        >
                          {formatDateString(row.onDate)} · {timeLabel(row.startTime)}–
                          {timeLabel(row.endTime)}
                        </Link>
                      </TableCell>
                      <TableCell>{row.storeName}</TableCell>
                      <TableCell>
                        {row.promoterNames.length > 0 ? row.promoterNames.join(", ") : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {t("campaign_report.of", {
                          done: row.filledSlots,
                          total: row.promotersRequired,
                        })}
                      </TableCell>
                      <TableCell>
                        <span className="whitespace-nowrap">{reportsLabel(row.totals, t)}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.totals.basis.reportsIn === 0
                          ? "—"
                          : formatNumber(row.totals.unitsPromoted.value, locale)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(row.photoCount, locale)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
