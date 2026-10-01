"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Icon,
  SelectField,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  type BadgeVariant,
} from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";
import { MAX_IMPORT_ROWS } from "@/lib/import/constants";
import { cellText } from "@/lib/import/cells";
import type { SheetGrid } from "@/lib/import/types";
import {
  assignPromoterColumn,
  detectPromoterHeader,
  missingPromoterFields,
  parsePromoterRows,
  planPromoterImport,
  samplePromoterValues,
  summarisePromoterImport,
  PROMOTER_FIELDS,
  type ExistingPromoter,
  type PlannedPromoterRow,
  type PromoterColumnMapping,
  type PromoterField,
  type PromoterRowStatus,
  type RequiredPromoterField,
} from "@/lib/promoters/import";
import { commitPromoterImport, loadExistingPromoterPhones, loadPromoterImportContext } from "./actions";
import { PROMOTER_COMMIT_IDLE, type PromoterCommitResult, type PromoterImportContext } from "./types";

/**
 * S1 — the promoter import wizard. Two steps the coordinator drives (columns, review) and one that
 * reports (done). Deliberately shorter than the shift wizard: a promoter has no campaign, no
 * section and no store to resolve, so there is nothing to ask beyond "what do these columns mean"
 * and "here is what will happen".
 *
 * `t` is resolved here, not passed in — a function may not cross the server/client boundary.
 */

const t = translatorFor(DEFAULT_LOCALE);

/** Below this the detector is guessing; the coordinator is asked to look. */
const REVIEW_BELOW = 0.6;

const STATUS_BADGE: Record<PromoterRowStatus, BadgeVariant> = {
  ready: "ok",
  warning: "warn",
  error: "bad",
  duplicate: "neutral",
};

const STATUS_KEY: Record<PromoterRowStatus, TranslationKey> = {
  ready: "promoters.import.preview.status.ready",
  warning: "promoters.import.preview.status.warning",
  error: "promoters.import.preview.status.error",
  duplicate: "promoters.import.preview.status.duplicate",
};

const REQUIRED_LABEL: Record<RequiredPromoterField, TranslationKey> = {
  name: "promoters.import.columns.required.name",
  phone: "promoters.import.columns.required.phone",
};

function tCount(count: number, one: TranslationKey, other: TranslationKey, params: Record<string, string | number> = {}) {
  return t(count === 1 ? one : other, { count, ...params });
}

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

function headersAt(grid: SheetGrid, rowIndex: number): string[] {
  const row = grid.rows[rowIndex] ?? [];
  const width = Math.max(row.length, ...grid.rows.slice(rowIndex, rowIndex + 20).map((r) => r.length));
  return Array.from({ length: width }, (_, i) => cellText(row[i] ?? null));
}

type Reading = {
  headerRowIndex: number;
  headers: string[];
  mapping: PromoterColumnMapping;
  confidence: Record<number, number>;
};

function readSheet(grid: SheetGrid): Reading {
  const detected = detectPromoterHeader(grid);
  const headers = headersAt(grid, detected.headerRowIndex);
  const mapping: PromoterColumnMapping = {};
  for (let i = 0; i < headers.length; i++) mapping[i] = detected.mapping[i] ?? "ignore";
  return { headerRowIndex: detected.headerRowIndex, headers, mapping, confidence: detected.confidence };
}

function readSheetAtRow(grid: SheetGrid, rowIndex: number): Reading {
  const headers = headersAt(grid, rowIndex);
  const mapping: PromoterColumnMapping = {};
  const confidence: Record<number, number> = {};
  for (let i = 0; i < headers.length; i++) {
    mapping[i] = "ignore";
    confidence[i] = 0;
  }
  return { headerRowIndex: rowIndex, headers, mapping, confidence };
}

function defaultSheetIndex(sheets: SheetGrid[]): number {
  const index = sheets.findIndex((sheet) => detectPromoterHeader(sheet).complete);
  return index < 0 ? 0 : index;
}

type Step = "columns" | "preview" | "done";

export function PromoterImportWizard({
  filename,
  sheets,
  onClose,
}: {
  filename: string;
  sheets: SheetGrid[];
  onClose: () => void;
}) {
  const router = useRouter();
  const titleRef = useRef<HTMLHeadingElement>(null);

  const [context, setContext] = useState<PromoterImportContext | null>(null);
  const [contextFailed, setContextFailed] = useState(false);
  const [existing, setExisting] = useState<ExistingPromoter[] | "loading" | "failed">("loading");

  const [step, setStep] = useState<Step>("columns");
  const [sheetIndex, setSheetIndex] = useState(() => defaultSheetIndex(sheets));
  const grid = sheets[sheetIndex]!;
  const [reading, setReading] = useState<Reading>(() => readSheet(grid));
  const [touched, setTouched] = useState<ReadonlySet<number>>(new Set());

  const [onlyProblems, setOnlyProblems] = useState(false);
  const [result, setResult] = useState<PromoterCommitResult>(PROMOTER_COMMIT_IDLE);
  const [submitting, setSubmitting] = useState(false);
  const [closeArmed, setCloseArmed] = useState(false);
  const inFlight = useRef(false);

  // --- Context ---------------------------------------------------------------------------------
  const load = useCallback(() => {
    setContextFailed(false);
    setExisting("loading");
    loadPromoterImportContext()
      .then((res) => (res.ok ? setContext(res.context) : setContextFailed(true)))
      .catch(() => setContextFailed(true));
    loadExistingPromoterPhones()
      .then((rows) => setExisting(rows ?? "failed"))
      .catch(() => setExisting("failed"));
  }, []);
  useEffect(load, [load]);

  // --- Dialog behaviour --------------------------------------------------------------------------
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    titleRef.current?.focus();
    setCloseArmed(false);
  }, [step]);

  /**
   * Asks inside the wizard rather than through `window.confirm`, which is an operating-system
   * dialog in the operating system's language over a Greek screen (A2 finding 11). Escape arms the
   * prompt; a second Escape confirms — so throwing work away always takes two presses.
   */
  const requestClose = useCallback(() => {
    if (submitting) return;
    if (step === "preview" && !closeArmed) {
      setCloseArmed(true);
      return;
    }
    onClose();
  }, [closeArmed, onClose, step, submitting]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestClose]);

  // --- Derived ---------------------------------------------------------------------------------
  const today = context?.today ?? "";
  const rows = useMemo(
    () =>
      today
        ? parsePromoterRows(grid, reading.headerRowIndex, reading.mapping, {
            knownAreas: context?.areas ?? [],
            today,
          })
        : [],
    [grid, reading, today, context],
  );

  const missing = missingPromoterFields(reading.mapping);

  const planned: PlannedPromoterRow[] = useMemo(
    () => (Array.isArray(existing) ? planPromoterImport(rows, existing) : []),
    [rows, existing],
  );
  const summary = useMemo(() => summarisePromoterImport(planned), [planned]);

  const capacity = context?.remainingCapacity ?? null;
  const overCapacity = capacity !== null && summary.valid > capacity;

  const steps: Step[] = ["columns", "preview"];
  const position = steps.indexOf(step);
  const done = step === "done" && result.status === "done";

  const needsReview = reading.headers.filter((_, col) => {
    const field = reading.mapping[col] ?? "ignore";
    return field !== "ignore" && (reading.confidence[col] ?? 0) < REVIEW_BELOW && !touched.has(col);
  }).length;

  // --- Submit ----------------------------------------------------------------------------------
  const submit = async () => {
    if (inFlight.current || !context) return;
    inFlight.current = true;
    setSubmitting(true);
    try {
      const response = await commitPromoterImport({
        filename,
        // `issues` is stripped: the server recomputes it. Sending it would be sending something
        // about to be discarded, and trusting it would be trusting the browser about validity.
        rows: rows.map(({ issues: _issues, ...rest }) => rest),
      });
      setResult(response);
      if (response.status === "done") {
        setStep("done");
        router.refresh();
      }
    } catch {
      setResult({ status: "error", error: "load_failed" });
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  // --- Gatekeeping -----------------------------------------------------------------------------
  let blocker: string | null = null;
  if (step === "columns") {
    if (missing.length > 0) {
      blocker = t("promoters.import.columns.missing", { fields: missing.map((m) => t(REQUIRED_LABEL[m])).join(", ") });
    } else if (rows.length === 0 && context) {
      blocker = t("promoters.import.columns.no_rows");
    } else if (rows.length > MAX_IMPORT_ROWS) {
      blocker = t("promoters.import.columns.too_many", { max: MAX_IMPORT_ROWS });
    }
  }

  const visible = onlyProblems ? planned.filter((p) => p.status !== "ready") : planned;
  const problemCount = planned.length - summary.valid + summary.warnings;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-[color:var(--color-n-950)]/40 sm:items-start sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="promoter-import-title"
        className="flex h-full w-full max-w-5xl flex-col overflow-hidden bg-[color:var(--color-canvas)] shadow-[var(--elevation-overlay)] sm:h-auto sm:max-h-[calc(100dvh-3rem)] sm:rounded-2xl sm:border sm:border-[color:var(--color-line)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2
              id="promoter-import-title"
              ref={titleRef}
              tabIndex={-1}
              className="text-lg font-semibold text-[color:var(--color-ink)] focus:outline-none"
            >
              {t("promoters.import.title")}
            </h2>
            <p className="mt-0.5 break-words text-xs text-[color:var(--color-muted)]">
              {filename}
              {!done && position >= 0
                ? ` · ${t("promoters.import.step_of", { step: position + 1, total: steps.length })} · ${t(`promoters.import.step.${step}` as TranslationKey)}`
                : null}
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={requestClose} disabled={submitting} aria-label={t("promoters.import.close")}>
            <Icon name="close" size={18} />
          </Button>
        </header>

        {closeArmed ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-bad-line)] bg-[color:var(--color-bad-subtle)] px-5 py-3 sm:px-6"
          >
            <p className="min-w-0 text-sm font-medium text-[color:var(--color-bad-ink)]">{t("promoters.import.close_confirm")}</p>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button type="button" variant="danger" size="sm" autoFocus onClick={onClose}>
                {t("promoters.import.close_confirm_yes")}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setCloseArmed(false)}>
                {t("promoters.import.close_confirm_no")}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {contextFailed ? (
            <Banner tone="bad" role="alert">
              <p>{t("promoters.import.context_failed")}</p>
              <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={load}>
                {t("promoters.import.retry")}
              </Button>
            </Banner>
          ) : !context ? (
            <div className="flex flex-col gap-3" aria-busy="true">
              <p className="text-sm text-[color:var(--color-muted)]" role="status">
                {t("promoters.import.reading")}
              </p>
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : step === "columns" ? (
            <div className="flex flex-col gap-5">
              <StepHeading title={t("promoters.import.columns.title")} description={t("promoters.import.columns.description")} />

              <div className="grid gap-4 sm:grid-cols-2">
                {sheets.length > 1 ? (
                  <SelectField
                    id="promoter-import-sheet"
                    label={t("promoters.import.columns.sheet_label")}
                    value={String(sheetIndex)}
                    onChange={(event) => {
                      const index = Number(event.target.value);
                      setSheetIndex(index);
                      setReading(readSheet(sheets[index]!));
                      setTouched(new Set());
                    }}
                    options={sheets.map((sheet, index) => ({ value: String(index), label: sheet.name }))}
                  />
                ) : null}
                <SelectField
                  id="promoter-import-header-row"
                  label={t("promoters.import.columns.header_row_label")}
                  hint={t("promoters.import.columns.header_row_hint")}
                  value={String(reading.headerRowIndex)}
                  onChange={(event) => {
                    setReading(readSheetAtRow(grid, Number(event.target.value)));
                    setTouched(new Set());
                  }}
                  options={grid.rows.slice(0, 15).map((row, index) => {
                    const preview = row.map((cell) => cellText(cell)).filter(Boolean).slice(0, 4).join(" · ");
                    return {
                      value: String(index),
                      label: t("promoters.import.columns.header_row_option", { row: index + 1, preview: preview.slice(0, 60) || "—" }),
                    };
                  })}
                />
              </div>

              {missing.length > 0 ? (
                <Banner tone="warn" role="status">
                  {t("promoters.import.columns.missing", { fields: missing.map((m) => t(REQUIRED_LABEL[m])).join(", ") })}
                </Banner>
              ) : needsReview > 0 ? (
                <Banner tone="warn" role="status">
                  {tCount(needsReview, "promoters.import.columns.review_one", "promoters.import.columns.review_other")}
                </Banner>
              ) : null}

              <p className="text-sm text-[color:var(--color-ink-soft)]">
                {tCount(rows.length, "promoters.import.columns.rows_found_one", "promoters.import.columns.rows_found_other")}
              </p>

              <ul className="flex flex-col gap-2.5">
                {reading.headers.map((header, col) => {
                  const field = reading.mapping[col] ?? "ignore";
                  const review = field !== "ignore" && (reading.confidence[col] ?? 0) < REVIEW_BELOW && !touched.has(col);
                  const samples = samplePromoterValues(grid, reading.headerRowIndex, col);
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
                            {header || t("promoters.import.columns.untitled")}
                          </span>
                          {review ? (
                            <Badge variant="warn" size="sm">
                              {t("promoters.import.columns.review_badge")}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <SelectField
                        id={`promoter-import-col-${col}`}
                        label={t("promoters.import.columns.meaning_label", { column: columnLetter(col) })}
                        value={field}
                        onChange={(event) => {
                          setReading((r) => ({
                            ...r,
                            mapping: assignPromoterColumn(r.mapping, col, event.target.value as PromoterField),
                          }));
                          setTouched((s) => new Set([...s, col]));
                        }}
                        options={PROMOTER_FIELDS.map((f) => ({
                          value: f,
                          label: t(`promoters.import.field.${f}` as TranslationKey),
                        }))}
                      />
                      <div className="min-w-0">
                        <p className="text-2xs font-medium uppercase tracking-wide text-[color:var(--color-muted)]">
                          {t("promoters.import.columns.samples")}
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
                          <p className="mt-1 text-xs text-[color:var(--color-muted-soft)]">{t("promoters.import.columns.no_samples")}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : step === "preview" ? (
            <div className="flex flex-col gap-5">
              <StepHeading title={t("promoters.import.preview.title")} />

              {result.status === "error" ? (
                <Banner tone="bad" role="alert">
                  {t(`promoters.import.error.${result.error}` as TranslationKey)}
                </Banner>
              ) : null}

              {context.readOnly ? <Banner tone="warn">{t("promoters.import.preview.read_only")}</Banner> : null}
              {existing === "failed" ? <Banner tone="bad">{t("promoters.import.context_failed")}</Banner> : null}

              {existing === "loading" ? (
                <p className="text-sm text-[color:var(--color-muted)]" role="status">
                  {tCount(rows.length, "promoters.import.validating_one", "promoters.import.validating_other")}
                </p>
              ) : (
                <div className="flex flex-col gap-1 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-4 py-3">
                  {/* The sentence the owner asked for, verbatim: "221 valid / 12 duplicates / 5 errors". */}
                  <p className="text-base font-semibold text-[color:var(--color-ink)]" aria-live="polite">
                    {t("promoters.import.preview.summary", {
                      valid: summary.valid,
                      duplicates: summary.duplicates,
                      errors: summary.errors,
                    })}
                  </p>
                  {summary.warnings > 0 ? (
                    <p className="text-sm text-[color:var(--color-warn-ink)]">
                      {tCount(summary.warnings, "promoters.import.preview.warnings_one", "promoters.import.preview.warnings_other")}
                    </p>
                  ) : null}
                  {summary.duplicates > 0 ? (
                    <p className="text-sm text-[color:var(--color-ink-soft)]">{t("promoters.import.preview.duplicates_hint")}</p>
                  ) : null}
                  {overCapacity && capacity !== null ? (
                    <p className="text-sm text-[color:var(--color-warn-ink)]">
                      {t("promoters.import.preview.capacity_exceeded", { count: capacity, valid: summary.valid })}
                    </p>
                  ) : null}
                </div>
              )}

              {problemCount > 0 ? (
                <label className="flex items-center gap-2 text-sm text-[color:var(--color-ink-soft)]">
                  <input
                    type="checkbox"
                    checked={onlyProblems}
                    onChange={(event) => setOnlyProblems(event.target.checked)}
                    className="size-4 accent-[color:var(--color-accent)]"
                  />
                  {t("promoters.import.preview.only_problems", { count: problemCount })}
                </label>
              ) : null}

              <Table label={t("promoters.import.preview.table_label")} layout="fluid">
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>{t("promoters.import.preview.col.row")}</TableHeaderCell>
                    <TableHeaderCell>{t("promoters.import.preview.col.name")}</TableHeaderCell>
                    <TableHeaderCell>{t("promoters.import.preview.col.phone")}</TableHeaderCell>
                    <TableHeaderCell>{t("promoters.import.preview.col.areas")}</TableHeaderCell>
                    <TableHeaderCell>{t("promoters.import.preview.col.status")}</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visible.map((p) => (
                    <TableRow key={p.row.sourceRow}>
                      <TableCell className="tabular-nums text-[color:var(--color-muted)]">{p.row.sourceRow}</TableCell>
                      <TableCell>{p.row.fullName ?? "—"}</TableCell>
                      <TableCell className="tabular-nums">{p.row.phone ?? p.row.phoneRaw ?? "—"}</TableCell>
                      <TableCell>{p.row.areaNames.length > 0 ? p.row.areaNames.join(", ") : "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <Badge variant={STATUS_BADGE[p.status]} size="sm" dot>
                            {t(STATUS_KEY[p.status])}
                          </Badge>
                          {p.existing ? (
                            <span className="text-xs text-[color:var(--color-muted)]">
                              {t("promoters.import.preview.duplicate_of", { name: p.existing.fullName })}
                            </span>
                          ) : p.reasons.length > 0 ? (
                            <span className="text-xs text-[color:var(--color-muted)]">
                              {p.reasons.map((r) => t(`promoters.import.reason.${r}` as TranslationKey)).join(" · ")}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : done && result.status === "done" ? (
            <div className="flex flex-col gap-4">
              <StepHeading title={t("promoters.import.done.title")} />
              <Banner tone={result.outcome.created > 0 ? "ok" : "warn"} role="status">
                <p className="font-semibold">
                  {result.outcome.created === 0
                    ? t("promoters.import.done.created_none")
                    : tCount(result.outcome.created, "promoters.import.done.created_one", "promoters.import.done.created_other")}
                </p>
                <ul className="mt-1 flex flex-col gap-0.5 text-sm">
                  {result.outcome.duplicates > 0 ? <li>{t("promoters.import.done.duplicates", { count: result.outcome.duplicates })}</li> : null}
                  {result.outcome.errors > 0 ? <li>{t("promoters.import.done.errors", { count: result.outcome.errors })}</li> : null}
                  {result.outcome.overLimit > 0 ? <li>{t("promoters.import.done.over_limit", { count: result.outcome.overLimit })}</li> : null}
                  {result.outcome.notCreated > 0 ? <li>{t("promoters.import.done.not_created", { count: result.outcome.notCreated })}</li> : null}
                </ul>
              </Banner>
              <div>
                <Button type="button" onClick={onClose} iconLeft={<Icon name="check" size={16} />}>
                  {t("promoters.import.done.close")}
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {context && !done ? (
          <footer className="flex flex-col gap-3 border-t border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className={blocker ? "text-sm text-pretty text-[color:var(--color-muted)]" : "sr-only"} aria-live="polite">
              {blocker ?? ""}
            </p>
            <div className="flex items-center justify-end gap-2">
              {position > 0 ? (
                <Button type="button" variant="ghost" onClick={() => setStep("columns")} disabled={submitting}>
                  {t("promoters.import.back")}
                </Button>
              ) : null}
              {step === "preview" ? (
                <Button
                  type="button"
                  className="min-w-0 flex-1 sm:flex-none"
                  onClick={submit}
                  loading={submitting}
                  disabled={submitting || summary.valid === 0 || context.readOnly || existing === "loading" || existing === "failed"}
                  iconLeft={<Icon name="check" size={16} />}
                >
                  {submitting
                    ? t("promoters.import.preview.submitting")
                    : summary.valid === 0
                      ? t("promoters.import.preview.submit_none")
                      : tCount(
                          capacity !== null ? Math.min(summary.valid, capacity) : summary.valid,
                          "promoters.import.preview.submit_one",
                          "promoters.import.preview.submit_other",
                          { count: capacity !== null ? Math.min(summary.valid, capacity) : summary.valid },
                        )}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => {
                    setStep("preview");
                    setResult(PROMOTER_COMMIT_IDLE);
                  }}
                  disabled={Boolean(blocker)}
                  iconRight={<Icon name="arrowRight" size={16} />}
                >
                  {t("promoters.import.next")}
                </Button>
              )}
            </div>
          </footer>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Small local pieces. `components/ui` is frozen, so these compose it rather than extend it — the
// same shapes app/shifts/import/wizard-ui.tsx uses, kept local so this parcel owns them.
// ---------------------------------------------------------------------------------------------

const TONE_CLASS = {
  ok: "border-[color:var(--color-ok-line)] bg-[color:var(--color-ok-subtle)] text-[color:var(--color-ok-ink)]",
  warn: "border-[color:var(--color-warn-line)] bg-[color:var(--color-warn-subtle)] text-[color:var(--color-warn-ink)]",
  bad: "border-[color:var(--color-bad-line)] bg-[color:var(--color-bad-subtle)] text-[color:var(--color-bad-ink)]",
} as const;

function Banner({
  tone,
  children,
  role,
}: {
  tone: keyof typeof TONE_CLASS;
  children: React.ReactNode;
  role?: "alert" | "status";
}) {
  return (
    <div role={role} className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm leading-5 ${TONE_CLASS[tone]}`}>
      <Icon name={tone === "ok" ? "check" : "alert"} size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function StepHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-base font-semibold text-[color:var(--color-ink)]">{title}</h3>
      {description ? <p className="text-sm text-pretty text-[color:var(--color-muted)]">{description}</p> : null}
    </div>
  );
}
