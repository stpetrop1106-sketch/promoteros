"use client";

import { useEffect, useRef, useState } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "./Button";

/**
 * A destructive action that takes two taps.
 *
 * Added in F1, for A2 finding 11: cancelling an assignment, marking a no-show, cancelling a
 * campaign and closing the import wizard all gated on `window.confirm`. That dialog is unstyled,
 * its buttons are in the operating system's language rather than the product's, and on a phone it
 * is the one people dismiss without reading. The product had already written the replacement
 * twice and by hand — `app/promoters/[id]/edit/archive-control.tsx` ("Αρχειοθέτηση" → "Ναι,
 * αρχειοθέτηση" / "Άκυρο") and the fortnight-clear on
 * `app/promoters/[id]/availability/availability-grid.tsx`, whose comment records exactly this
 * reasoning. This is that pattern, once, so the four sites cannot drift apart.
 *
 * **Why not a modal.** A modal would need focus trapping, a scroll lock and an escape route on
 * every one of these call sites, three of which are a single cell inside a table row. Arming in
 * place costs none of that and keeps the action next to the thing it acts on.
 *
 * **Inside a `<form action={…}>`.** The resting button is `type="button"`, so the first tap
 * cannot submit anything; only the armed button is `type="submit"`. That is what makes this work
 * with a server action bound to the surrounding form without any event plumbing.
 *
 * The armed state lapses on its own after `armMs`, so a button armed and forgotten cannot be
 * fired by a later, unrelated click.
 */
export interface ConfirmButtonProps {
  /** Resting label — the ordinary name of the action, e.g. "Ακύρωση ανάθεσης". */
  label: string;
  /** Armed label — the one that actually fires, e.g. "Ναι, ακύρωση". */
  confirmLabel: string;
  /** Disarms without doing anything. */
  cancelLabel: string;
  /** One sentence spelling out the consequence. Shown only while armed. */
  warning?: string;
  /**
   * "submit" (the default) fires the surrounding form's action on the second tap.
   * "button" calls `onConfirm` instead.
   */
  type?: "submit" | "button";
  onConfirm?: () => void;
  /** Resting appearance. The armed button is always `danger`. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  /** How long the armed state lasts. */
  armMs?: number;
  className?: string;
}

export function ConfirmButton({
  label,
  confirmLabel,
  cancelLabel,
  warning,
  type = "submit",
  onConfirm,
  variant = "danger",
  size = "sm",
  loading = false,
  disabled = false,
  armMs = 6000,
  className,
}: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function disarm() {
    if (timer.current) clearTimeout(timer.current);
    setArmed(false);
  }

  function arm() {
    setArmed(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setArmed(false), armMs);
  }

  if (!armed) {
    return (
      <Button
        type="button"
        variant={variant}
        size={size}
        loading={loading}
        disabled={disabled}
        onClick={arm}
        className={className}
      >
        {label}
      </Button>
    );
  }

  return (
    <div className={"flex flex-col gap-2 " + (className ?? "")}>
      {warning ? (
        <p role="alert" className="text-xs font-medium leading-5 text-[color:var(--color-bad-ink)]">
          {warning}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type={type === "submit" ? "submit" : "button"}
          variant="danger"
          size={size}
          loading={loading}
          disabled={disabled}
          autoFocus
          onClick={() => {
            if (type === "button") {
              disarm();
              onConfirm?.();
              return;
            }
            // A submit: only cancel the lapse timer. Deliberately no `setArmed(false)` here —
            // unmounting a submit button from inside its own click handler is a race with the
            // browser's default action, and this control's job is to guard the action, not to
            // dismiss itself. The caller removes it when the action succeeds; on a failure it
            // stays put with its warning, next to the error the action returned.
            if (timer.current) clearTimeout(timer.current);
            onConfirm?.();
          }}
        >
          {confirmLabel}
        </Button>
        <Button type="button" variant="ghost" size={size} disabled={loading} onClick={disarm}>
          {cancelLabel}
        </Button>
      </div>
    </div>
  );
}
