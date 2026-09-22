import { Badge, Card, EmptyState, Icon, LinkButton } from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import type { ProgrammeSummary } from "@/lib/programmes";
import { ImportShifts } from "@/app/shifts/import/import-shifts";
import { RenameSectionForm } from "./rename-section-form";
import { ArchiveSectionForm } from "./archive-section-form";
import { formatDateString, needsPeopleKey, shiftsToggleKey } from "./format";
import { ShiftTable } from "./shift-table";

/**
 * One section ("ενότητα") on `/shifts`: identity, coverage, and the shifts inside it in the
 * existing table styling. A server component — rename is the only interactive piece and it is its
 * own small client island; everything else (add shifts, archive/unarchive, the collapse toggle)
 * is a plain link, a plain `<form action>`, or native `<details>`, none of which need JavaScript.
 */
export function SectionCard({ section }: { section: ProgrammeSummary }) {
  const t = translatorFor(DEFAULT_LOCALE);

  return (
    // `id` + scroll margin: the Excel import's done screen links to `#section-<id>`, and the
    // sticky mobile top bar would otherwise cover the section heading it lands on.
    <div id={`section-${section.id}`} className="scroll-mt-20">
    <Card
      elevation="card"
      header={
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-[color:var(--color-ink)]">{section.name}</h2>
              {section.archived ? <Badge variant="neutral">{t("shifts.sections.archived_badge")}</Badge> : null}
              {section.source === "import" && section.sourceFilename ? (
                <Badge variant="info">{t("shifts.sections.import_badge", { filename: section.sourceFilename })}</Badge>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-[color:var(--color-muted)]">
              {[section.campaignName, section.clientName].filter(Boolean).join(" · ")}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {section.archived ? null : (
            <LinkButton
              href={`/campaigns/${section.campaignId}/shifts/new?programme=${section.id}`}
              variant="secondary"
              size="sm"
              iconLeft={<Icon name="plus" size={14} />}
            >
              {t("shifts.sections.add_shifts")}
            </LinkButton>
            )}
            {section.archived ? null : (
              <ImportShifts
                target={{ programmeId: section.id, programmeName: section.name, campaignId: section.campaignId }}
              />
            )}
            <RenameSectionForm programmeId={section.id} currentName={section.name} />
            <ArchiveSectionForm programmeId={section.id} archived={section.archived} />
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-[color:var(--color-ink-soft)]">
          {/* A2 finding 22 — a section with no shifts used to read "0 από 0 καλυμμένες ·
              Πλήρως στελεχωμένη", which is the one thing an empty section is not. With nothing
              inside it there is no coverage to report either, so both go and the line says what
              is actually true. */}
          {section.shiftCount === 0 ? (
            <span className="text-[color:var(--color-muted)]">{t("shifts.sections.needs_people_empty")}</span>
          ) : (
            <>
              <span className="font-medium tabular-nums text-[color:var(--color-ink)]">
                {t("shift.coverage", { filled: section.confirmedTotal, required: section.requiredTotal })}
              </span>
              <span className={section.openShiftCount > 0 ? "text-[color:var(--color-warn-ink)]" : "text-[color:var(--color-ok-ink)]"}>
                {section.openShiftCount > 0
                  ? t(needsPeopleKey(section.openShiftCount), { count: section.openShiftCount })
                  : t("shifts.sections.needs_people_none")}
              </span>
            </>
          )}
          <span className="text-[color:var(--color-muted)]">
            {section.fromDate && section.toDate
              ? t("shifts.sections.date_range", {
                  from: formatDateString(section.fromDate),
                  to: formatDateString(section.toDate),
                })
              : t("shifts.sections.date_range_none")}
          </span>
          <span className="text-[color:var(--color-muted)]">
            {section.nextShiftDate
              ? t("shifts.sections.next_shift", { date: formatDateString(section.nextShiftDate) })
              : t("shifts.sections.next_shift_none")}
          </span>
        </div>

        {section.shifts.length === 0 ? (
          <EmptyState bare title={t("shifts.sections.shifts_empty")} />
        ) : (
          <details open className="group">
            <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="chevronRight" size={14} className="transition-transform duration-150 ease-[var(--ease-out-soft)] group-open:rotate-90" />
                {t(shiftsToggleKey(section.shiftCount), { count: section.shiftCount })}
              </span>
            </summary>
            <div className="mt-3">
              <ShiftTable shifts={section.shifts} label={section.name} />
            </div>
          </details>
        )}
      </div>
    </Card>
    </div>
  );
}
