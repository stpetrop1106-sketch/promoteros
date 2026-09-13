"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Icon } from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";
// `constants.ts` has no imports, so this costs a few bytes, not SheetJS.
import { MAX_IMPORT_BYTES } from "@/lib/import/constants";
import type { SheetGrid } from "@/lib/import/types";

/**
 * MOUNT POINT — owned by P37c (Excel import UI). Created by the manager as a stub so P37a can mount
 * it on the Shifts screen before P37c exists, without either parcel editing the other's file.
 *
 * FROZEN PROPS. P37c may add optional props; it may not rename or remove these.
 *
 *  - no `target`: the screen-level entry. A button, plus a drop target for the whole Shifts page —
 *    the coordinator drags the client's file anywhere onto it.
 *  - with `target`: import straight into one existing section (programme), from that section's
 *    header. Campaign and section are already decided, so the wizard skips those steps.
 *
 * What this file holds is deliberately small: the button, the file input, the drop overlay. SheetJS
 * (`lib/import/workbook`) and the wizard are both loaded when a file arrives, never with the page.
 */
export type ImportShiftsProps = {
  target?: {
    programmeId: string;
    programmeName: string;
    campaignId: string;
  };
};

const t = translatorFor(DEFAULT_LOCALE);

const ACCEPTED_EXTENSIONS = [".xlsx", ".xls", ".ods", ".csv"];

const ImportWizard = dynamic(() => import("./import-wizard").then((m) => m.ImportWizard), { ssr: false });

type OpenFile = { filename: string; sheets: SheetGrid[] };

type Phase =
  | { kind: "idle" }
  | { kind: "reading"; filename: string }
  | { kind: "refused"; message: TranslationKey; filename: string }
  | { kind: "open"; file: OpenFile };

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot).toLowerCase();
}

function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

export function ImportShifts({ target }: ImportShiftsProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = phase.kind === "reading" || phase.kind === "open";

  const receive = useCallback(async (file: File) => {
    const filename = file.name;
    if (!ACCEPTED_EXTENSIONS.includes(extensionOf(filename))) {
      setPhase({ kind: "refused", message: "shifts.import.file.wrong_type", filename });
      return;
    }
    if (file.size > MAX_IMPORT_BYTES) {
      setPhase({ kind: "refused", message: "shifts.import.file.too_large", filename });
      return;
    }
    if (file.size === 0) {
      setPhase({ kind: "refused", message: "shifts.import.file.empty", filename });
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
        setPhase({ kind: "open", file: { filename, sheets } });
      } catch (error) {
        const code = error instanceof ImportFileError ? error.code : "unreadable";
        const message: TranslationKey =
          code === "too_large"
            ? "shifts.import.file.too_many_rows"
            : code === "empty"
              ? "shifts.import.file.empty"
              : "shifts.import.file.unreadable";
        setPhase({ kind: "refused", message, filename });
      }
    } catch {
      setPhase({ kind: "refused", message: "shifts.import.file.load_failed", filename });
    }
  }, []);

  // The whole page is a drop target, but only for the screen-level entry: one listener, not one per section.
  useEffect(() => {
    if (target || busy) return;
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
  }, [target, busy, receive]);

  const close = useCallback(() => setPhase({ kind: "idle" }), []);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size={target ? "sm" : "md"}
        iconLeft={<Icon name="inbox" size={target ? 14 : 16} />}
        loading={phase.kind === "reading"}
        onClick={() => inputRef.current?.click()}
        title={target ? t("shifts.import.button_section_hint", { section: target.programmeName }) : t("shifts.import.button_hint")}
      >
        {target ? t("shifts.import.button_section") : t("shifts.import.button")}
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
            <p className="text-lg font-semibold text-[color:var(--color-ink)]">{t("shifts.import.drop.title")}</p>
            <p className="text-sm text-[color:var(--color-muted)]">{t("shifts.import.drop.body")}</p>
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
          <Button type="button" variant="ghost" size="sm" onClick={close} aria-label={t("shifts.import.close")}>
            <Icon name="close" size={16} />
          </Button>
        </div>
      ) : null}

      {phase.kind === "open" ? (
        <ImportWizard filename={phase.file.filename} sheets={phase.file.sheets} target={target} onClose={close} />
      ) : null}
    </>
  );
}
