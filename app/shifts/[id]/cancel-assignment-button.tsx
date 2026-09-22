"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ConfirmButton } from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";
import { cancelAssignment, type CancelAssignmentState } from "./actions";

const t = translatorFor(DEFAULT_LOCALE);

const KNOWN_ERROR_REASONS = new Set(["missing_ids", "not_found", "not_confirmed", "save_failed"]);

/** Server actions return short reason codes, never prose — see `actions.ts`. Map them to a
 *  specific Greek sentence here so this component never shows a raw code to the coordinator.
 *  An unrecognised code (there should never be one) still degrades to a specific sentence
 *  rather than looking a translation key up with attacker/typo-controlled input. */
function errorMessage(reason: string | undefined): string {
  const safe = reason && KNOWN_ERROR_REASONS.has(reason) ? reason : "save_failed";
  return t(`shifts.board.error.${safe}` as TranslationKey);
}

function Submit({ labels }: { labels: { label: string; confirm: string; cancel: string; warning: string } }) {
  const { pending } = useFormStatus();
  return (
    <ConfirmButton
      label={labels.label}
      confirmLabel={labels.confirm}
      cancelLabel={labels.cancel}
      warning={labels.warning}
      loading={pending}
    />
  );
}

/**
 * The one destructive control on a "confirmed" board row. Kept as its own client component, away
 * from the common actions, per commercial-architecture.md §6: "the dangerous action is never
 * adjacent to the common one."
 *
 * A2 finding 11 — this used to gate on `window.confirm`: an operating-system dialog, with
 * operating-system-language buttons, over a Greek product. It now arms in place
 * (`components/ui/ConfirmButton`), the same two-step the availability grid's
 * "Καθάρισε όλο το δεκαπενθήμερο" and the promoter archive control already use.
 */
export function CancelAssignmentButton({
  shiftId,
  assignmentId,
  label,
  confirmText,
  confirmLabel,
  cancelLabel,
  reasonLabel,
  reasonPlaceholder,
}: {
  shiftId: string;
  assignmentId: string;
  label: string;
  /** The sentence spelling out what cancelling this person's shift means. */
  confirmText: string;
  confirmLabel: string;
  cancelLabel: string;
  reasonLabel: string;
  reasonPlaceholder: string;
}) {
  const [state, formAction] = useActionState<CancelAssignmentState, FormData>(cancelAssignment, {
    status: "idle",
  });
  const [reason, setReason] = useState("");

  if (state.status === "done") return null;

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="shiftId" value={shiftId} />
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <label className="sr-only" htmlFor={`cancel-reason-${assignmentId}`}>
        {reasonLabel}
      </label>
      <input
        id={`cancel-reason-${assignmentId}`}
        name="cancelReason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={reasonPlaceholder}
        className="h-9 w-40 min-w-0 rounded-lg border border-[color:var(--color-line-strong)] bg-[color:var(--color-canvas-sunken)]/50 px-2.5 text-xs text-[color:var(--color-ink)] outline-none placeholder:text-[color:var(--color-muted-soft)] focus-visible:border-[color:var(--color-accent)] focus-visible:bg-[color:var(--color-surface)] focus-visible:shadow-[var(--focus-ring)]"
      />
      <Submit labels={{ label, confirm: confirmLabel, cancel: cancelLabel, warning: confirmText }} />
      {state.status === "error" ? (
        <span role="alert" className="text-xs font-medium text-[color:var(--color-bad-ink)]">
          {errorMessage(state.reason)}
        </span>
      ) : null}
    </form>
  );
}
