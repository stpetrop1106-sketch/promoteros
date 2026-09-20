"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { respond, type RespondState } from "./actions";

function Buttons({
  acceptLabel,
  declineLabel,
}: {
  acceptLabel: string;
  declineLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      <button
        type="submit"
        name="answer"
        value="accept"
        disabled={pending}
        className="rounded-lg bg-[color:var(--color-ok)] px-4 py-3 font-semibold text-white transition hover:bg-[color:var(--color-ok-ink)] disabled:opacity-50"
      >
        {acceptLabel}
      </button>
      <button
        type="submit"
        name="answer"
        value="decline"
        disabled={pending}
        className="rounded-lg border border-[color:var(--color-line)] px-4 py-3 font-medium text-[color:var(--color-ink)] transition hover:bg-[color:var(--color-surface-hover)] disabled:opacity-50"
      >
        {declineLabel}
      </button>
    </div>
  );
}

export function RespondForm({
  token,
  acceptLabel,
  declineLabel,
  acceptedLabel,
  declinedLabel,
}: {
  token: string;
  acceptLabel: string;
  declineLabel: string;
  acceptedLabel: string;
  declinedLabel: string;
}) {
  const [state, formAction] = useActionState<RespondState, FormData>(respond, {
    status: "idle",
  });

  if (state.status === "accepted" || state.status === "declined") {
    return (
      <p className="mt-6 text-center text-sm">
        {state.status === "accepted" ? acceptedLabel : declinedLabel}
      </p>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="token" value={token} />
      <Buttons acceptLabel={acceptLabel} declineLabel={declineLabel} />
    </form>
  );
}
