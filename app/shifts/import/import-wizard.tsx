"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Icon, Skeleton } from "@/components/ui";
import type { ColumnMapping, KnownStore, SheetGrid, StoreMatch } from "@/lib/import/types";
import { detectHeader } from "@/lib/import/header-detection";
import { parseRows } from "@/lib/import/row-parser";
import { matchStores } from "@/lib/import/store-matching";
import { MAX_IMPORT_ROWS } from "@/lib/import/constants";
import { cellText } from "@/lib/import/cells";
import { commitImport, loadExistingShiftKeys, loadImportContext } from "./actions";
import {
  dateSpan,
  headerSignature,
  missingRequiredFields,
  planRows,
  restoreMapping,
  rowsForStoreMatching,
  sectionNameFromFilename,
  storeTargetsBySourceRow,
  summarisePlan,
  willCreate,
} from "./plan";
import { forgetMapping, recallMapping, rememberMapping } from "./mapping-memory";
import type { CommitResult, ImportContext, StoreResolution } from "./types";
import { ColumnsStep } from "./columns-step";
import { DestinationStep, type DestinationDraft, destinationProblem, emptyDestination } from "./destination-step";
import { StoresStep, type StoreDecision, decisionProblem, defaultDecision, isSettled } from "./stores-step";
import { PreviewStep } from "./preview-step";
import { DoneStep } from "./done-step";
import { Banner, t } from "./wizard-ui";
import type { ImportShiftsProps } from "./import-shifts";

type Step = "columns" | "destination" | "stores" | "preview" | "done";

type Reading = {
  headerRowIndex: number;
  headers: string[];
  mapping: ColumnMapping;
  confidence: Record<number, number>;
  remembered: boolean;
};

function headersAt(grid: SheetGrid, rowIndex: number): string[] {
  const row = grid.rows[rowIndex] ?? [];
  const width = Math.max(row.length, ...grid.rows.slice(rowIndex, rowIndex + 20).map((r) => r.length));
  return Array.from({ length: width }, (_, i) => cellText(row[i] ?? null));
}

/** Detected reading of a sheet, replaced by the remembered mapping when this header has been seen. */
function readSheet(grid: SheetGrid): Reading {
  const detected = detectHeader(grid);
  const headers = headersAt(grid, detected.headerRowIndex);
  const mapping: ColumnMapping = {};
  for (let i = 0; i < headers.length; i++) mapping[i] = detected.mapping[i] ?? "ignore";
  const saved = restoreMapping(recallMapping(headerSignature(headers)), headers);
  if (saved) {
    const confidence: Record<number, number> = {};
    for (let i = 0; i < headers.length; i++) confidence[i] = 1;
    return { headerRowIndex: detected.headerRowIndex, headers, mapping: saved, confidence, remembered: true };
  }
  return { headerRowIndex: detected.headerRowIndex, headers, mapping, confidence: detected.confidence, remembered: false };
}

function readSheetAtRow(grid: SheetGrid, rowIndex: number): Reading {
  const headers = headersAt(grid, rowIndex);
  const saved = restoreMapping(recallMapping(headerSignature(headers)), headers);
  const mapping: ColumnMapping = {};
  const confidence: Record<number, number> = {};
  for (let i = 0; i < headers.length; i++) {
    mapping[i] = saved?.[i] ?? "ignore";
    confidence[i] = saved ? 1 : 0;
  }
  return { headerRowIndex: rowIndex, headers, mapping, confidence, remembered: Boolean(saved) };
}

function defaultSheetIndex(sheets: SheetGrid[]): number {
  const index = sheets.findIndex((sheet) => detectHeader(sheet).complete);
  return index < 0 ? 0 : index;
}

export function ImportWizard({
  filename,
  sheets,
  target,
  onClose,
}: {
  filename: string;
  sheets: SheetGrid[];
  target: ImportShiftsProps["target"];
  onClose: () => void;
}) {
  const router = useRouter();
  const titleRef = useRef<HTMLHeadingElement>(null);

  const [context, setContext] = useState<ImportContext | null>(null);
  const [contextFailed, setContextFailed] = useState(false);

  const [step, setStep] = useState<Step>("columns");
  const [sheetIndex, setSheetIndex] = useState(() => defaultSheetIndex(sheets));
  const grid = sheets[sheetIndex]!;
  const [reading, setReading] = useState<Reading>(() => readSheet(grid));
  const [touched, setTouched] = useState<ReadonlySet<number>>(new Set());

  const [destination, setDestination] = useState<DestinationDraft>(() => emptyDestination(sectionNameFromFilename(filename)));
  const [decisions, setDecisions] = useState<Record<string, StoreDecision>>({});
  const [includeInFile, setIncludeInFile] = useState(false);
  const [includeExisting, setIncludeExisting] = useState(false);
  const [existingKeys, setExistingKeys] = useState<ReadonlySet<string> | "loading" | "failed">(new Set());
  const [result, setResult] = useState<CommitResult>({ status: "idle" });
  const [submitting, setSubmitting] = useState(false);
  /** A2 finding 11 — the two-step close prompt that replaced `window.confirm`. */
  const [closeArmed, setCloseArmed] = useState(false);
  const inFlight = useRef(false);

  // --- Context ---------------------------------------------------------------------------------
  const load = useCallback(() => {
    setContextFailed(false);
    loadImportContext()
      .then((res) => (res.ok ? setContext(res.context) : setContextFailed(true)))
      .catch(() => setContextFailed(true));
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
  }, [step]);

  // Moving on disarms the close prompt: it belongs to the step it was raised on.
  useEffect(() => {
    setCloseArmed(false);
  }, [step]);

  /**
   * A2 finding 11 — this used to gate on `window.confirm`: an operating-system dialog, in the
   * operating system's language, over a full-screen Greek wizard. It asks in the wizard now. The
   * first press (or Escape) arms; the second, or the explicit "Ναι, κλείσιμο", closes. Escape
   * therefore still takes two presses to throw work away, which is the point.
   */
  const requestClose = useCallback(() => {
    if (submitting) return;
    const hasDecisions = step === "stores" || step === "preview";
    if (hasDecisions && !closeArmed) {
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

  // --- Derived: rows, stores, plan ---------------------------------------------------------------
  const today = context?.today ?? "";
  const rows = useMemo(
    () => (today ? parseRows(grid, reading.headerRowIndex, reading.mapping, { today }) : []),
    [grid, reading, today],
  );
  const missing = missingRequiredFields(reading.mapping);

  const campaignId = target ? target.campaignId : destination.campaignMode === "existing" ? destination.campaignId : "";
  const clientId = useMemo(() => {
    if (!context) return null;
    if (target || destination.campaignMode === "existing") {
      return context.campaigns.find((c) => c.id === campaignId)?.clientId ?? null;
    }
    return destination.clientMode === "existing" ? destination.clientId || null : null;
  }, [context, target, destination, campaignId]);

  const storeOptions = useMemo(
    () => (context ? context.stores.filter((s) => s.clientId === null || (clientId !== null && s.clientId === clientId)) : []),
    [context, clientId],
  );
  const known: KnownStore[] = useMemo(
    () => storeOptions.map((s) => ({ id: s.id, name: s.name, address: s.address, chain: s.chain })),
    [storeOptions],
  );
  const matches: StoreMatch[] = useMemo(() => matchStores(rowsForStoreMatching(rows), known), [rows, known]);

  const knownIds = useMemo(() => new Set(known.map((s) => s.id)), [known]);
  const decisionOf = useCallback(
    (match: StoreMatch): StoreDecision => {
      const chosen = decisions[match.key];
      // A store picked for another client's campaign is no longer on offer: ask again.
      if (chosen && (chosen.action !== "existing" || knownIds.has(chosen.storeId))) return chosen;
      return defaultDecision(match);
    },
    [decisions, knownIds],
  );

  const resolutions: StoreResolution[] | null = useMemo(() => {
    const out: StoreResolution[] = [];
    for (const match of matches) {
      const d = decisionOf(match);
      if (!isSettled(d)) return null;
      if (d.action === "existing") out.push({ key: match.key, sourceRows: match.sourceRows, action: "existing", storeId: d.storeId });
      else if (d.action === "create") out.push({ key: match.key, sourceRows: match.sourceRows, action: "create" });
      else out.push({ key: match.key, sourceRows: match.sourceRows, action: "skip" });
    }
    return out;
  }, [matches, decisionOf]);

  const includeDuplicateRows = useMemo(() => new Set<number>(), []);
  const planned = useMemo(() => {
    if (!resolutions) return [];
    const targets = storeTargetsBySourceRow(resolutions);
    const keys = existingKeys instanceof Set ? existingKeys : new Set<string>();
    const first = planRows({ rows, targets, existingKeys: keys, includeDuplicateRows });
    const include = new Set<number>();
    for (const p of first) {
      if ((p.duplicate === "in_file" && includeInFile) || (p.duplicate === "existing" && includeExisting)) include.add(p.row.sourceRow);
    }
    return planRows({ rows, targets, existingKeys: keys, includeDuplicateRows: include });
  }, [resolutions, rows, existingKeys, includeDuplicateRows, includeInFile, includeExisting]);
  const summary = useMemo(() => summarisePlan(planned), [planned]);

  // --- Steps -------------------------------------------------------------------------------------
  const steps: Step[] = target ? ["columns", "stores", "preview"] : ["columns", "destination", "stores", "preview"];
  const position = steps.indexOf(step);

  const targetProgramme = target && context ? context.programmes.find((p) => p.id === target.programmeId) : undefined;

  const enterPreview = useCallback(() => {
    setStep("preview");
    setResult({ status: "idle" });
    if (!campaignId || !resolutions) {
      setExistingKeys(new Set());
      return;
    }
    const storeIds = [...new Set(resolutions.flatMap((r) => (r.action === "existing" ? [r.storeId] : [])))];
    const span = dateSpan(rows);
    if (storeIds.length === 0 || !span) {
      setExistingKeys(new Set());
      return;
    }
    setExistingKeys("loading");
    loadExistingShiftKeys(campaignId, storeIds, span.from, span.to)
      .then((keys) => setExistingKeys(keys ? new Set(keys) : "failed"))
      .catch(() => setExistingKeys("failed"));
  }, [campaignId, resolutions, rows]);

  const next = () => {
    if (step === "columns") {
      rememberMapping(headerSignature(reading.headers), reading.mapping);
      setStep(target ? "stores" : "destination");
    } else if (step === "destination") {
      setStep("stores");
    } else if (step === "stores") {
      enterPreview();
    }
  };
  const back = () => {
    const previous = steps[position - 1];
    if (previous) setStep(previous);
  };

  const submit = async () => {
    if (inFlight.current || !resolutions || !context) return;
    inFlight.current = true;
    setSubmitting(true);
    try {
      const response = await commitImport({
        filename,
        rows: rows.map(({ issues: _issues, notes: _notes, ...rest }) => rest),
        campaign: target
          ? { mode: "existing", campaignId: target.campaignId }
          : destination.campaignMode === "existing"
            ? { mode: "existing", campaignId: destination.campaignId }
            : {
                mode: "new",
                client:
                  destination.clientMode === "existing"
                    ? { mode: "existing", clientId: destination.clientId }
                    : { mode: "new", name: destination.newClientName },
                name: destination.newCampaignName,
                startsOn: destination.startsOn,
                endsOn: destination.endsOn,
                rateEuros: destination.rateEuros,
              },
        programme: target
          ? { mode: "existing", programmeId: target.programmeId }
          : destination.programmeMode === "existing" && destination.campaignMode === "existing"
            ? { mode: "existing", programmeId: destination.programmeId }
            : { mode: "new", name: destination.newProgrammeName },
        stores: resolutions,
        includeDuplicateRows: planned.filter((p) => p.duplicate && willCreate(p)).map((p) => p.row.sourceRow),
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

  // --- Gatekeeping per step ----------------------------------------------------------------------
  let blocker: string | null = null;
  if (step === "columns") {
    if (missing.length > 0) blocker = t("shifts.import.columns.blocked");
    else if (rows.length === 0 && context) blocker = t("shifts.import.columns.no_rows");
    else if (rows.length > MAX_IMPORT_ROWS) blocker = t("shifts.import.columns.too_many", { max: MAX_IMPORT_ROWS });
  } else if (step === "destination" && context) {
    blocker = destinationProblem(destination, context);
  } else if (step === "stores") {
    blocker = decisionProblem(matches, decisionOf);
  }

  const done = step === "done" && result.status === "done";

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-[color:var(--color-n-950)]/40 sm:items-start sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-wizard-title"
        className="flex h-full w-full max-w-5xl flex-col overflow-hidden bg-[color:var(--color-canvas)] shadow-[var(--elevation-overlay)] sm:h-auto sm:max-h-[calc(100dvh-3rem)] sm:rounded-2xl sm:border sm:border-[color:var(--color-line)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2
              id="import-wizard-title"
              ref={titleRef}
              tabIndex={-1}
              className="text-lg font-semibold text-[color:var(--color-ink)] focus:outline-none"
            >
              {target ? t("shifts.import.title_section", { section: target.programmeName }) : t("shifts.import.title")}
            </h2>
            <p className="mt-0.5 break-words text-xs text-[color:var(--color-muted)]">
              {filename}
              {!done && position >= 0
                ? ` · ${t("shifts.import.step_of", { step: position + 1, total: steps.length })} · ${t(`shifts.import.step.${step}` as never)}`
                : null}
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={requestClose} disabled={submitting} aria-label={t("shifts.import.close")}>
            <Icon name="close" size={18} />
          </Button>
        </header>

        {closeArmed ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-bad-line)] bg-[color:var(--color-bad-subtle)] px-5 py-3 sm:px-6"
          >
            <p className="min-w-0 text-sm font-medium text-[color:var(--color-bad-ink)]">
              {t("shifts.import.close_confirm")}
            </p>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button type="button" variant="danger" size="sm" autoFocus onClick={onClose}>
                {t("shifts.import.close_confirm_yes")}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setCloseArmed(false)}>
                {t("shifts.import.close_confirm_no")}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {contextFailed ? (
            <Banner tone="bad" role="alert">
              <p>{t("shifts.import.context_failed")}</p>
              <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={load}>
                {t("shifts.import.retry")}
              </Button>
            </Banner>
          ) : !context ? (
            <div className="flex flex-col gap-3" aria-busy="true">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : step === "columns" ? (
            <ColumnsStep
              sheets={sheets}
              sheetIndex={sheetIndex}
              onSheet={(index) => {
                setSheetIndex(index);
                setReading(readSheet(sheets[index]!));
                setTouched(new Set());
              }}
              grid={grid}
              reading={reading}
              touched={touched}
              rows={rows}
              missing={missing}
              onHeaderRow={(rowIndex) => {
                setReading(readSheetAtRow(grid, rowIndex));
                setTouched(new Set());
              }}
              onMapping={(mapping, column) => {
                setReading((r) => ({ ...r, mapping, remembered: false }));
                setTouched((s) => new Set([...s, column]));
              }}
              onForget={() => {
                forgetMapping(headerSignature(reading.headers));
                setReading(readSheet(grid));
                setTouched(new Set());
              }}
            />
          ) : step === "destination" ? (
            <DestinationStep context={context} draft={destination} onChange={setDestination} span={dateSpan(rows)} />
          ) : step === "stores" ? (
            <StoresStep
              matches={matches}
              stores={storeOptions}
              decisionOf={decisionOf}
              onDecide={(key, update) => setDecisions((d) => ({ ...d, [key]: update(d[key]) }))}
            />
          ) : step === "preview" ? (
            <PreviewStep
              context={context}
              planned={planned}
              summary={summary}
              matches={matches}
              stores={storeOptions}
              existingKeys={existingKeys}
              includeInFile={includeInFile}
              includeExisting={includeExisting}
              onIncludeInFile={setIncludeInFile}
              onIncludeExisting={setIncludeExisting}
              destinationLabel={destinationLabel(context, target, destination)}
              targetArchived={Boolean(targetProgramme?.archived)}
              result={result}
              onBackToStores={() => setStep("stores")}
            />
          ) : done && result.status === "done" ? (
            <DoneStep outcome={result.outcome} onClose={onClose} />
          ) : null}
        </div>

        {context && !done ? (
          <footer className="flex flex-col gap-3 border-t border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className={blocker ? "text-sm text-pretty text-[color:var(--color-muted)]" : "sr-only"} aria-live="polite">
              {blocker ?? ""}
            </p>
            <div className="flex items-center justify-end gap-2">
              {position > 0 ? (
                <Button type="button" variant="ghost" onClick={back} disabled={submitting}>
                  {t("shifts.import.back")}
                </Button>
              ) : null}
              {step === "preview" ? (
                <Button
                  type="button"
                  className="min-w-0 flex-1 sm:flex-none"
                  onClick={submit}
                  loading={submitting}
                  disabled={
                    submitting ||
                    summary.toCreate === 0 ||
                    context.readOnly ||
                    existingKeys === "loading" ||
                    existingKeys === "failed" ||
                    Boolean(targetProgramme?.archived)
                  }
                  iconLeft={<Icon name="check" size={16} />}
                >
                  {submitting ? t("shifts.import.preview.submitting") : importButtonLabel(summary.toCreate, planned, destinationLabel(context, target, destination))}
                </Button>
              ) : (
                <Button type="button" onClick={next} disabled={Boolean(blocker)} iconRight={<Icon name="arrowRight" size={16} />}>
                  {t("shifts.import.next")}
                </Button>
              )}
            </div>
          </footer>
        ) : null}
      </div>
    </div>
  );
}

function destinationLabel(context: ImportContext, target: ImportShiftsProps["target"], d: DestinationDraft): string {
  if (target) return target.programmeName;
  if (d.campaignMode === "existing" && d.programmeMode === "existing") {
    return context.programmes.find((p) => p.id === d.programmeId)?.name ?? "";
  }
  return d.newProgrammeName.trim();
}

function importButtonLabel(count: number, planned: ReturnType<typeof planRows>, section: string): string {
  const newStores = new Set(planned.filter(willCreate).flatMap((p) => (p.store?.kind === "create" ? [p.store.key] : []))).size;
  if (count === 0) return t("shifts.import.preview.submit_none");
  const shifts = t(count === 1 ? "shifts.import.preview.submit_one" : "shifts.import.preview.submit_other", { count, section });
  if (newStores === 0) return shifts;
  return t(newStores === 1 ? "shifts.import.preview.submit_stores_one" : "shifts.import.preview.submit_stores_other", {
    shifts,
    count: newStores,
  });
}
