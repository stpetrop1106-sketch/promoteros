"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { invite, type InviteState } from "./actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 rounded border border-[color:var(--color-line)] px-3 py-1 text-sm hover:bg-white disabled:opacity-50"
    >
      {label}
    </button>
  );
}

export function InviteButton({
  shiftId,
  promoterId,
  label,
  copyLabel,
}: {
  shiftId: string;
  promoterId: string;
  label: string;
  copyLabel: string;
}) {
  const [state, formAction] = useActionState<InviteState, FormData>(invite, {
    status: "idle",
  });

  // Clipboard adapter: the coordinator pastes into WhatsApp themselves, which is exactly
  // what they do today. Showing the exact text is the feature, not a fallback apology.
  if (state.status === "manual" && state.manualBody) {
    return (
      <div className="mt-2 w-64 text-left">
        <textarea
          readOnly
          value={state.manualBody}
          rows={5}
          className="w-full rounded border border-[color:var(--color-line)] bg-white p-2 text-xs"
        />
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(state.manualBody ?? "")}
          className="mt-1 rounded border border-[color:var(--color-line)] px-2 py-1 text-xs hover:bg-white"
        >
          {copyLabel}
        </button>
      </div>
    );
  }

  if (state.status === "sent") {
    return <p className="mt-2 text-xs text-[color:var(--color-ok)]">✓</p>;
  }

  if (state.status === "error") {
    return <p className="mt-2 text-xs text-[color:var(--color-bad)]">{state.reason}</p>;
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="shiftId" value={shiftId} />
      <input type="hidden" name="promoterId" value={promoterId} />
      <Submit label={label} />
    </form>
  );
}
