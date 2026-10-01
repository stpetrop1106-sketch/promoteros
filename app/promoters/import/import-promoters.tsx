"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Icon } from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";
// `constants.ts` has no imports, so this costs a few bytes, not SheetJS.
import { MAX_IMPORT_BYTES } from "@/lib/import/constants";
import type { SheetGrid } from "@/lib/import/types";

/**
 * S1 — the entry point for bulk promoter import: the button, the file input, the drop overlay.
 *
 * Deliberately small, and the same shape as `app/shifts/import/import-shifts.tsx`. SheetJS
 * (`lib/import/workbook`) and the wizard are both loaded when a file arrives, never with the page —
 * a coordinator who never imports anything never downloads a spreadsheet parser.
 *
 * `t` is resolved here rather than taken as a prop: a server component may not pass a function
 * across the boundary (CLAUDE.md), and the translator is the exact prop everyone reaches for.
 */

const t = translatorFor(DEFAULT_LOCALE);

const ACCEPTED_EXTENSIONS = [".xlsx", ".xls", ".ods", ".csv"];

const ImportWizard = dynamic(() => import("./import-wizard").then((m) => m.PromoterImportWizard), { ssr: false });

type Phase =
  | { kind: "idle" }
  | { kind: "reading"; filename: string }
  | { kind: "refused"; message: TranslationKey; filename: string }
  | { kind: "open"; filename: string; sheets: SheetGrid[] };

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot).toLowerCase();
}

function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

export function ImportPromoters() {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = phase.kind === "reading" || phase.kind === "open";

  const receive = useCallback(async (file: File) => {
    const filename = file.name;
    if (!ACCEPTED_EXTENSIONS.includes(extensionOf(filename))) {
      setPhase({ kind: "refused", message: "promoters.import.file.wrong_type", filename });
      return;
    }
    if (file.size > MAX_IMPORT_BYTES) {
      setPhase({ kind: "refused", message: "promoters.import.file.too_large", filename });
      return;
    }
    if (file.size === 0) {
      setPhase({ kind: "refused", message: "promoters.import.file.empty", filename });
      return;
    }

    setPhase({ kind: "reading", filename });
    try {
      // Both chunks in parallel: SheetJS to read the file, the wizard to show it.
      const [{ readWorkbook, ImportFileError }] = await Promise.all([
        import("@/lib/import/workbook"),
        import("./import-wizard"),
      ]);
      try {
        const sheets = readWorkbook(await file.arrayBuffer());
        setPhase({ kind: "open", filename, sheets });
      } catch (error) {
        const code = error instanceof ImportFileError ? error.code : "unreadable";
        const message: TranslationKey =
          code === "too_large"
            ? "promoters.import.file.too_many_rows"
            : code === "empty"
              ? "promoters.import.file.empty"
              : "promoters.import.file.unreadable";
        setPhase({ kind: "refused", message, filename });
      }
    } catch {
      setPhase({ kind: "refused", message: "promoters.import.file.load_failed", filename });
    }
  }, []);

  // The whole roster page is a drop target: one window listener, removed while the wizard is open.
  useEffect(() => {
    if (busy) return;
    let depth = 0;

    const onEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth++;
      setDragging(true);
    };
    const onOver = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };
    const onLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      const file = event.dataTransfer?.files?.[0];
      if (file) void receive(file);
    };

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [busy, receive]);

  const close = useCallback(() => setPhase({ kind: "idle" }), []);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        iconLeft={<Icon name="inbox" size={16} />}
        loading={phase.kind === "reading"}
        onClick={() => inputRef.current?.click()}
        title={t("promoters.import.button_hint")}
      >
        {t("promoters.import.button")}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(",")}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void receive(file);
        }}
      />

      {dragging ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--color-canvas)]/85 p-6 backdrop-blur-sm"
        >
          <div className="flex max-w-md flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-[color:var(--color-accent)] bg-[color:var(--color-surface)] px-8 py-10 text-center shadow-[var(--elevation-overlay)]">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[color:var(--color-accent-subtle)] text-[color:var(--color-accent)]">
              <Icon name="inbox" size={24} />
            </span>
            <p className="text-lg font-semibold text-[color:var(--color-ink)]">{t("promoters.import.drop.title")}</p>
            <p className="text-sm text-[color:var(--color-muted)]">{t("promoters.import.drop.body")}</p>
          </div>
        </div>
      ) : null}

      {phase.kind === "refused" ? (
        <div
          role="alert"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-lg items-start gap-3 rounded-2xl border border-[color:var(--color-bad-line)] bg-[color:var(--color-bad-subtle)] px-4 py-3 text-sm text-[color:var(--color-bad-ink)] shadow-[var(--elevation-overlay)]"
        >
          <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="break-words font-semibold">{phase.filename}</p>
            <p className="mt-0.5">{t(phase.message, { max: Math.round(MAX_IMPORT_BYTES / 1024 / 1024) })}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={close} aria-label={t("promoters.import.close")}>
            <Icon name="close" size={16} />
          </Button>
        </div>
      ) : null}

      {phase.kind === "open" ? (
        <ImportWizard filename={phase.filename} sheets={phase.sheets} onClose={close} />
      ) : null}
    </>
  );
}
