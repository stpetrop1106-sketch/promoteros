import Link from "next/link";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { SHIFT_STATUS_BADGE, SHIFT_STATUS_KEY, type ShiftStatus } from "@/app/campaigns/_shared";
import type { ProgrammeShiftInput } from "@/lib/programmes";
import { formatDateString } from "./format";

/**
 * The shift rows inside one section (or the unsectioned bucket) — the existing table styling from
 * `app/shifts/page.tsx`, factored out so both places render it identically. A server component:
 * nothing here is interactive, so it composes freely into either `SectionCard` or the unsectioned
 * block without crossing the client boundary.
 */
export function ShiftTable({
  shifts,
  label,
  showCampaign = false,
}: {
  shifts: ProgrammeShiftInput[];
  label: string;
  showCampaign?: boolean;
}) {
  const t = translatorFor(DEFAULT_LOCALE);

  return (
    <Table label={label} bare>
      <TableHead>
        <TableRow>
          <TableHeaderCell>{t("shifts.date")}</TableHeaderCell>
          {showCampaign ? <TableHeaderCell>{t("shifts.campaign")}</TableHeaderCell> : null}
          <TableHeaderCell>{t("shifts.store")}</TableHeaderCell>
          <TableHeaderCell className="text-right">{t("shifts.needed")}</TableHeaderCell>
          <TableHeaderCell>{t("campaigns.detail.col_coverage")}</TableHeaderCell>
          <TableHeaderCell>{t("campaigns.list.col_status")}</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {shifts.map((s) => (
          <TableRow key={s.id}>
            <TableCell>
              <Link
                href={`/shifts/${s.id}`}
                className="rounded-sm font-medium text-[color:var(--color-accent)] hover:underline focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
              >
                {formatDateString(s.onDate)}
              </Link>
              <span className="mt-0.5 block text-xs tabular-nums text-[color:var(--color-muted)]">
                {s.startTime.slice(0, 5)}–{s.endTime.slice(0, 5)}
              </span>
            </TableCell>
            {showCampaign ? (
              <TableCell className="text-[color:var(--color-ink)]">{s.campaignName}</TableCell>
            ) : null}
            <TableCell>{s.storeName ?? "—"}</TableCell>
            <TableCell className="text-right font-medium tabular-nums text-[color:var(--color-ink)]">
              {s.promotersRequired}
            </TableCell>
            <TableCell className="tabular-nums">
              {t("shift.coverage", { filled: s.confirmedCount, required: s.promotersRequired })}
            </TableCell>
            <TableCell>
              <Badge variant={SHIFT_STATUS_BADGE[s.status as ShiftStatus] ?? "neutral"} dot>
                {t(SHIFT_STATUS_KEY[s.status as ShiftStatus] ?? "campaigns.shift_status.open")}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
