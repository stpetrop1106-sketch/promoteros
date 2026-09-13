"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  type BadgeVariant,
} from "@/components/ui";
import type { TranslationKey } from "@/lib/i18n";
import type { StoreMatch } from "@/lib/import/types";
import type { PlanSummary } from "./plan";
import type { CommitResult, ImportContext, ImportStoreOption, PlannedRow, RowStatus } from "./types";
import { Banner, OptionChip, StepHeading, formatDate, reasonLabel, t, tCount } from "./wizard-ui";

const STATUS_BADGE: Record<RowStatus, BadgeVariant> = {
  ready: "ok",
  warning: "warn",
  error: "bad",
  skipped: "neutral",
  excluded: "neutral",
};

const STATUS_KEY: Record<RowStatus, TranslationKey> = {
  ready: "shifts.import.preview.status.ready",
  warning: "shifts.import.preview.status.warning",
  error: "shifts.import.preview.status.error",
  skipped: "shifts.import.preview.status.skipped",
  excluded: "shifts.import.preview.status.excluded",
};

export function PreviewStep({
  context,
  planned,
  summary,
  matches,
  stores,
  existingKeys,
  includeInFile,
  includeExisting,
  onIncludeInFile,
  onIncludeExisting,
  destinationLabel,
  targetArchived,
  result,
  onBackToStores,
}: {
  context: ImportContext;
  planned: PlannedRow[];
  summary: PlanSummary;
  matches: StoreMatch[];
  stores: ImportStoreOption[];
  existingKeys: ReadonlySet<string> | "loading" | "failed";
  includeInFile: boolean;
  includeExisting: boolean;
  onIncludeInFile: (value: boolean) => void;
  onIncludeExisting: (value: boolean) => void;
  destinationLabel: string;
  targetArchived: boolean;
  result: CommitResult;
  onBackToStores: () => void;
}) {
  const [onlyProblems, setOnlyProblems] = useState(false);

  const storeNames = useMemo(() => new Map(stores.map((s) => [s.id, s.name])), [stores]);
  const matchNames = useMemo(() => new Map(matches.map((m) => [m.key, m.name])), [matches]);
  const newStores = useMemo(
    () => [...new Set(planned.flatMap((p) => (p.store?.kind === "create" && p.status !== "excluded" && p.status !== "skipped" ? [p.store.key] : [])))],
    [planned],
  );

  const visible = onlyProblems ? planned.filter((p) => p.status !== "ready") : planned;
  const problemCount = planned.length - summary.counts.ready;

  return (
    <div className="flex flex-col gap-5">
      <StepHeading title={t("shifts.import.preview.title")} description={t("shifts.import.preview.destination", { section: destinationLabel })} />

      {result.status === "error" ? (
        <Banner tone="bad" role="alert">
          <p>
            {t(`shifts.import.error.${result.error}` as TranslationKey, { names: (result.details ?? []).join(", ") })}
          </p>
          {result.error === "stores_changed" || result.error === "geocode_failed" || result.error === "store_not_found" ? (
            <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={onBackToStores}>
              {t("shifts.import.preview.back_to_stores")}
            </Button>
          ) : null}
        </Banner>
      ) : null}

      {context.readOnly ? <Banner tone="warn">{t("shifts.import.preview.read_only")}</Banner> : null}
      {targetArchived ? <Banner tone="warn">{t("shifts.import.error.programme_archived")}</Banner> : null}
      {existingKeys === "failed" ? <Banner tone="bad">{t("shifts.import.preview.duplicates_failed")}</Banner> : null}

      <div className="flex flex-col gap-1 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-4 py-3">
        <p className="text-base font-semibold text-[color:var(--color-ink)]" aria-live="polite">
          {tCount(summary.toCreate, "shifts.import.preview.headline_one", "shifts.import.preview.headline_other")}
          {summary.notImported > 0
            ? ` · ${tCount(summary.notImported, "shifts.import.preview.problems_one", "shifts.import.preview.problems_other")}`
            : ""}
        </p>
        {summary.withWarnings > 0 ? (
          <p className="text-sm text-[color:var(--color-warn-ink)]">
            {tCount(summary.withWarnings, "shifts.import.preview.warnings_one", "shifts.import.preview.warnings_other")}
          </p>
        ) : null}
        {newStores.length > 0 ? (
          <p className="text-sm text-[color:var(--color-ink-soft)]">
            {tCount(newStores.length, "shifts.import.preview.new_stores_one", "shifts.import.preview.new_stores_other", {
              names: newStores.map((key) => matchNames.get(key) ?? "").join(", "),
            })}
          </p>
        ) : null}
        {existingKeys === "loading" ? (
          <p className="text-sm text-[color:var(--color-muted)]" role="status">
            {t("shifts.import.preview.checking_duplicates")}
          </p>
        ) : null}
      </div>

      {summary.duplicatesInFile > 0 || summary.duplicatesExisting > 0 ? (
        <div className="flex flex-col gap-2">
          {summary.duplicatesExisting > 0 ? (
            <OptionChip>
              <input
                type="checkbox"
                checked={includeExisting}
                onChange={(event) => onIncludeExisting(event.target.checked)}
                className="size-4 shrink-0 accent-[color:var(--color-accent)]"
              />
              <span>
                {tCount(summary.duplicatesExisting, "shifts.import.preview.include_existing_one", "shifts.import.preview.include_existing_other")}
              </span>
            </OptionChip>
          ) : null}
          {summary.duplicatesInFile > 0 ? (
            <OptionChip>
              <input
                type="checkbox"
                checked={includeInFile}
                onChange={(event) => onIncludeInFile(event.target.checked)}
                className="size-4 shrink-0 accent-[color:var(--color-accent)]"
              />
              <span>
                {tCount(summary.duplicatesInFile, "shifts.import.preview.include_in_file_one", "shifts.import.preview.include_in_file_other")}
              </span>
            </OptionChip>
          ) : null}
        </div>
      ) : null}

      {problemCount > 0 ? (
        <label className="flex items-center gap-2 text-sm text-[color:var(--color-ink-soft)]">
          <input
            type="checkbox"
            checked={onlyProblems}
            onChange={(event) => setOnlyProblems(event.target.checked)}
            className="size-4 accent-[color:var(--color-accent)]"
          />
          {t("shifts.import.preview.only_problems", { count: problemCount })}
        </label>
      ) : null}

      <Table label={t("shifts.import.preview.table_label")}>
        <TableHead>
          <TableRow>
            <TableHeaderCell>{t("shifts.import.preview.col.row")}</TableHeaderCell>
            <TableHeaderCell>{t("shifts.import.preview.col.date")}</TableHeaderCell>
            <TableHeaderCell>{t("shifts.import.preview.col.hours")}</TableHeaderCell>
            <TableHeaderCell>{t("shifts.import.preview.col.store")}</TableHeaderCell>
            <TableHeaderCell>{t("shifts.import.preview.col.people")}</TableHeaderCell>
            <TableHeaderCell>{t("shifts.import.preview.col.status")}</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {visible.map((p) => {
            const store =
              p.store?.kind === "existing"
                ? storeNames.get(p.store.storeId) ?? p.row.storeName
                : p.store?.kind === "create"
                  ? matchNames.get(p.store.key) ?? p.row.storeName
                  : p.row.storeName;
            return (
              <TableRow key={p.row.sourceRow}>
                <TableCell className="tabular-nums text-[color:var(--color-muted)]">{p.row.sourceRow}</TableCell>
                <TableCell className="tabular-nums">{formatDate(p.row.date)}</TableCell>
                <TableCell className="tabular-nums">
                  {p.row.startTime && p.row.endTime ? `${p.row.startTime}–${p.row.endTime}` : p.row.startTime ?? p.row.endTime ?? "—"}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-2">
                    <span>{store ?? "—"}</span>
                    {p.store?.kind === "create" ? (
                      <Badge variant="accent" size="sm">
                        {t("shifts.import.preview.new_store_badge")}
                      </Badge>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell className="tabular-nums">{p.row.promotersRequired}</TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <Badge variant={STATUS_BADGE[p.status]} size="sm" dot>
                      {t(STATUS_KEY[p.status])}
                    </Badge>
                    {p.reasons.length > 0 ? (
                      <span className="text-xs text-[color:var(--color-muted)]">{p.reasons.map(reasonLabel).join(" · ")}</span>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
