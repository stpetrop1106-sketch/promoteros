import { Card } from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import type { UnsectionedGroup } from "@/lib/programmes";
import { ShiftTable } from "./shift-table";

/**
 * "Χωρίς ενότητα" — shifts with no `programme_id`, possible for anything created outside the
 * section flows. Rendered only when non-empty, as one flat bucket (it may span several campaigns,
 * hence the extra Campaign column) rather than as a second kind of section.
 */
export function UnsectionedSection({ group }: { group: UnsectionedGroup }) {
  const t = translatorFor(DEFAULT_LOCALE);
  if (group.shifts.length === 0) return null;

  return (
    <Card
      elevation="flat"
      className="border-dashed"
      header={
        <div>
          <h2 className="text-base font-semibold text-[color:var(--color-ink)]">
            {t("shifts.sections.unsectioned_title")}
          </h2>
          <p className="mt-1 text-xs text-[color:var(--color-muted)]">
            {t("shifts.sections.unsectioned_description")}
          </p>
        </div>
      }
    >
      <ShiftTable shifts={group.shifts} label={t("shifts.sections.unsectioned_title")} showCampaign />
    </Card>
  );
}
