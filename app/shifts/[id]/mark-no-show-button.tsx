"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";
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

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" size="sm" loading={pending}>
      {label}
    </Button>
  );
}

/**
 * Marks a confirmed-but-not-checked-in assignment a no-show. This is how `reliability_score`
 * will eventually earn its value (build-plan §8, P10), so it has to be reachable from the one
 * place a coordinator is already looking when the exception shows up: this row. Confirm-gated
 * and visually separated from re-invite/cancel — same "destructive action, never adjacent to a
 * common one" rule as `CancelAssignmentButton`.
 */
export function MarkNoShowButton({
  shiftId,
  assignmentId,
  label,
  confirmText,
}: {
  shiftId: string;
  assignmentId: string;
  label: string;
  confirmText: string;
}) {
  const [state, formAction] = useActionState<MarkNoShowState, FormData>(markNoShow, {
    status: "idle",
  });

  if (state.status === "done") return null;

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(confirmText)) event.preventDefault();
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="shiftId" value={shiftId} />
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <Submit label={label} />
      {state.status === "error" ? (
        <span role="alert" className="text-xs font-medium text-[color:var(--color-bad-ink)]">
          {errorMessage(state.reason)}
        </span>
      ) : null}
    </form>
  );
}
