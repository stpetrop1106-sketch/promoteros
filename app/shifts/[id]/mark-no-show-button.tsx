"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ConfirmButton } from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";
import { markNoShow, type MarkNoShowState } from "./actions";

const t = translatorFor(DEFAULT_LOCALE);

const KNOWN_ERROR_REASONS = new Set(["missing_ids", "not_found", "not_confirmed", "save_failed"]);

/** See the identical helper in `cancel-assignment-button.tsx` — kept duplicated rather than
 *  shared because this parcel does not own a place outside `app/shifts/[id]/` to put it. */
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
 * Marks a confirmed-but-not-checked-in assignment a no-show. This is how `reliability_score`
 * will eventually earn its value (build-plan §8, P10), so it has to be reachable from the one
 * place a coordinator is already looking when the exception shows up: this row. Confirm-gated
 * and visually separated from re-invite/cancel — same "destructive action, never adjacent to a
 * common one" rule as `CancelAssignmentButton`, and since A2 finding 11 the same in-page
 * two-step arming rather than `window.confirm`.
 */
export function MarkNoShowButton({
  shiftId,
  assignmentId,
  label,
  confirmText,
  confirmLabel,
  cancelLabel,
}: {
  shiftId: string;
  assignmentId: string;
  label: string;
  /** The sentence spelling out what marking this person a no-show means. */
  confirmText: string;
  confirmLabel: string;
  cancelLabel: string;
}) {
  const [state, formAction] = useActionState<MarkNoShowState, FormData>(markNoShow, {
    status: "idle",
  });

  if (state.status === "done") return null;

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="shiftId" value={shiftId} />
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <Submit labels={{ label, confirm: confirmLabel, cancel: cancelLabel, warning: confirmText }} />
      {state.status === "error" ? (
        <span role="alert" className="text-xs font-medium text-[color:var(--color-bad-ink)]">
          {errorMessage(state.reason)}
        </span>
      ) : null}
    </form>
  );
}
