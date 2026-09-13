"use client";

import { Badge, Button, SelectField } from "@/components/ui";
import type { TranslationKey } from "@/lib/i18n";
import type { ColumnMapping, ImportField, ParsedRow, SheetGrid } from "@/lib/import/types";
import { assignColumn, displayCell, sampleValues, type RequiredField } from "./plan";
import { Banner, StepHeading, fieldLabel, t, tCount } from "./wizard-ui";

const FIELDS: ImportField[] = [
  "date",
  "store_name",
  "store_address",
  "city",
  "chain",
  "time_range",
  "start_time",
  "end_time",
  "promoters_required",
  "notes",
  "ignore",
];

const REQUIRED_LABEL: Record<RequiredField, TranslationKey> = {
  date: "shifts.import.columns.required.date",
  store_name: "shifts.import.columns.required.store_name",
  time: "shifts.import.columns.required.time",
};

/** Below this the engine is guessing; the coordinator is asked to look. */
const REVIEW_BELOW = 0.6;

function columnLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export function ColumnsStep({
  sheets,
  sheetIndex,
  onSheet,
  grid,
  reading,
  touched,
  rows,
  missing,
  onHeaderRow,
  onMapping,
  onForget,
}: {
  sheets: SheetGrid[];
  sheetIndex: number;
  onSheet: (index: number) => void;
  grid: SheetGrid;
  reading: { headerRowIndex: number; headers: string[]; mapping: ColumnMapping; confidence: Record<number, number>; remembered: boolean };
  touched: ReadonlySet<number>;
  rows: ParsedRow[];
  missing: RequiredField[];
  onHeaderRow: (rowIndex: number) => void;
  onMapping: (mapping: ColumnMapping, column: number) => void;
  onForget: () => void;
}) {
  const headerRowOptions = grid.rows.slice(0, 15).map((row, index) => {
    const preview = row
      .map((cell) => displayCell(cell))
      .filter(Boolean)
      .slice(0, 4)
      .join(" · ");
    return {
      value: String(index),
      label: t("shifts.import.columns.header_row_option", { row: index + 1, preview: preview.slice(0, 60) || "—" }),
    };
  });

  const fieldOptions = FIELDS.map((field) => ({ value: field, label: fieldLabel(field) }));
  const needsReview = reading.headers.filter((_, col) => {
    const field = reading.mapping[col] ?? "ignore";
    return field !== "ignore" && (reading.confidence[col] ?? 0) < REVIEW_BELOW && !touched.has(col);
  }).length;

  return (
    <div className="flex flex-col gap-5">
      {reading.remembered ? (
        <Banner tone="ok" role="status">
          <p>{t("shifts.import.columns.remembered")}</p>
          <Button type="button" variant="ghost" size="sm" className="mt-1 -ml-2" onClick={onForget}>
            {t("shifts.import.columns.forget")}
          </Button>
        </Banner>
      ) : null}

      <StepHeading title={t("shifts.import.columns.title")} description={t("shifts.import.columns.description")} />

      <div className="grid gap-4 sm:grid-cols-2">
        {sheets.length > 1 ? (
          <SelectField
            id="import-sheet"
            label={t("shifts.import.columns.sheet_label")}
            value={String(sheetIndex)}
            onChange={(event) => onSheet(Number(event.target.value))}
            options={sheets.map((sheet, index) => ({ value: String(index), label: sheet.name }))}
          />
        ) : null}
        <SelectField
          id="import-header-row"
          label={t("shifts.import.columns.header_row_label")}
          hint={t("shifts.import.columns.header_row_hint")}
          value={String(reading.headerRowIndex)}
          onChange={(event) => onHeaderRow(Number(event.target.value))}
          options={headerRowOptions}
        />
      </div>

      {missing.length > 0 ? (
        <Banner tone="warn" role="status">
          {t("shifts.import.columns.missing", { fields: missing.map((m) => t(REQUIRED_LABEL[m])).join(", ") })}
        </Banner>
      ) : needsReview > 0 ? (
        <Banner tone="warn" role="status">
          {tCount(needsReview, "shifts.import.columns.review_one", "shifts.import.columns.review_other")}
        </Banner>
      ) : null}

      <p className="text-sm text-[color:var(--color-ink-soft)]">
        {tCount(rows.length, "shifts.import.columns.rows_found_one", "shifts.import.columns.rows_found_other")}
      </p>

      <ul className="flex flex-col gap-2.5">
        {reading.headers.map((header, col) => {
          const field = reading.mapping[col] ?? "ignore";
          const review = field !== "ignore" && (reading.confidence[col] ?? 0) < REVIEW_BELOW && !touched.has(col);
          const samples = sampleValues(grid, reading.headerRowIndex, col);
          return (
            <li
              key={col}
              className={
                "grid gap-3 rounded-xl border px-4 py-3 sm:grid-cols-[minmax(0,1fr)_15rem_minmax(0,1.2fr)] sm:items-center " +
                (review
                  ? "border-[color:var(--color-warn-line)] bg-[color:var(--color-warn-subtle)]"
                  : field === "ignore"
                    ? "border-[color:var(--color-line)] bg-[color:var(--color-canvas-sunken)]"
                    : "border-[color:var(--color-line)] bg-[color:var(--color-surface)]")
              }
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="neutral" size="sm">
                    {columnLetter(col)}
                  </Badge>
                  <span className="break-words text-sm font-semibold text-[color:var(--color-ink)]">
                    {header || t("shifts.import.columns.untitled")}
                  </span>
                  {review ? (
                    <Badge variant="warn" size="sm">
                      {t("shifts.import.columns.review_badge")}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <SelectField
                id={`import-col-${col}`}
                label={t("shifts.import.columns.meaning_label", { column: columnLetter(col) })}
                value={field}
                onChange={(event) => onMapping(assignColumn(reading.mapping, col, event.target.value as ImportField), col)}
                options={fieldOptions}
              />
              <div className="min-w-0">
                <p className="text-2xs font-medium uppercase tracking-wide text-[color:var(--color-muted)]">
                  {t("shifts.import.columns.samples")}
                </p>
                {samples.length > 0 ? (
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {samples.map((value, i) => (
                      <li
                        key={i}
                        className="max-w-full truncate rounded-md bg-[color:var(--color-canvas-sunken)] px-2 py-0.5 text-xs text-[color:var(--color-ink-soft)]"
                      >
                        {value}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-[color:var(--color-muted-soft)]">{t("shifts.import.columns.no_samples")}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
