"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";
import { cancelAssignment, type CancelAssignmentState } from "./actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" size="sm" loading={pending}>
      {label}
    </Button>
  );
}

/**
 * The one destructive control on a "confirmed" board row. Kept as its own client component, away
 * from the common actions, per commercial-architecture.md §6: "the dangerous action is never
 * adjacent to the common one." A native `window.confirm` gates the submit — no modal component
 * exists in `components/ui` yet, and this is the same pattern
 * `app/campaigns/[id]/cancel-campaign-form.tsx` uses for the equivalent case.
 */
export function CancelAssignmentButton({
  shiftId,
  assignmentId,
  label,
  confirmText,
  reasonLabel,
  reasonPlaceholder,
}: {
  shiftId: string;
  assignmentId: string;
  label: string;
  confirmText: string;
  reasonLabel: string;
  reasonPlaceholder: string;
}) {
  const [state, formAction] = useActionState<CancelAssignmentState, FormData>(cancelAssignment, {
    status: "idle",
  });
  const [reason, setReason] = useState("");

  if (state.status === "done") return null;

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(confirmText)) event.preventDefault();
      }}
      className="flex flex-wrap items-center gap-2"
    >
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
        className="h-8 w-40 rounded border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-2 text-xs"
      />
      <Submit label={label} />
      {state.status === "error" ? (
        <span className="text-xs text-[color:var(--color-bad)]">{state.reason}</span>
      ) : null}
    </form>
  );
}
