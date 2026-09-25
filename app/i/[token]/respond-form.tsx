"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { respond, type RespondState } from "./actions";

/**
 * A3-11 — the two buttons dimmed to 50% opacity while the action ran and were otherwise
 * unchanged. On a real connection those actions took between 10 and 30 seconds, so a promoter had
 * no way to tell a tap that registered from a tap that missed, and the obvious move is to tap
 * again. The arrival and report buttons already swapped their label; this page was the odd one
 * out. Now both say "Αποστολή…" the moment they are pressed.
 */
function Buttons({
  acceptLabel,
  declineLabel,
  sendingLabel,
}: {
  acceptLabel: string;
  declineLabel: string;
  sendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      <button
        type="submit"
        name="answer"
        value="accept"
        disabled={pending}
        aria-busy={pending || undefined}
        className="rounded-lg bg-[color:var(--color-ok)] px-4 py-3 font-semibold text-white transition hover:bg-[color:var(--color-ok-ink)] disabled:opacity-50"
      >
        {pending ? sendingLabel : acceptLabel}
      </button>
      <button
        type="submit"
        name="answer"
        value="decline"
        disabled={pending}
        aria-busy={pending || undefined}
        className="rounded-lg border border-[color:var(--color-line)] px-4 py-3 font-medium text-[color:var(--color-ink)] transition hover:bg-[color:var(--color-surface-hover)] disabled:opacity-50"
      >
        {pending ? sendingLabel : declineLabel}
      </button>
    </div>
  );
}

export function RespondForm({
  token,
  acceptLabel,
  declineLabel,
  sendingLabel,
  acceptedLabel,
  declinedLabel,
  alreadyAnsweredLabel,
  inactiveLabel,
  errorLabel,
  offlineLabel,
}: {
  token: string;
  acceptLabel: string;
  declineLabel: string;
  sendingLabel: string;
  acceptedLabel: string;
  declinedLabel: string;
  alreadyAnsweredLabel: string;
  inactiveLabel: string;
  errorLabel: string;
  offlineLabel: string;
}) {
  /**
   * A3-01 — a transport failure rejects this promise and, handed straight to `useActionState`,
   * produces no state at all: the page would sit there saying nothing while the promoter believed
   * their answer had gone in. Caught here and turned into a state the form can render.
   */
  async function runAction(previous: RespondState, formData: FormData): Promise<RespondState> {
    try {
      return await respond(previous, formData);
    } catch {
      return { status: "error", reason: "offline" };
    }
  }

  const [state, formAction] = useActionState<RespondState, FormData>(runAction, {
    status: "idle",
  });

  if (state.status === "accepted" || state.status === "declined") {
    return (
      <p className="mt-6 text-center text-sm">
        {state.status === "accepted" ? acceptedLabel : declinedLabel}
      </p>
    );
  }

  /**
   * A3-11's tail. `RespondState` had an `error` member that this component never rendered, so a
   * second tap after an answer already landed (`already_answered`) drew the form again with no
   * message whatsoever — the promoter is told nothing, twice.
   */
  const errorText =
    state.status === "error"
      ? state.reason === "offline"
        ? offlineLabel
        : state.reason === "already_answered"
          ? alreadyAnsweredLabel
          : state.reason === "inactive"
            ? inactiveLabel
            : errorLabel
      : null;

  return (
    <form action={formAction}>
      <input type="hidden" name="token" value={token} />
      {errorText && (
        <p role="alert" className="mt-4 text-center text-sm font-medium text-[color:var(--color-bad)]">
          {errorText}
        </p>
      )}
      <Buttons
        acceptLabel={acceptLabel}
        declineLabel={declineLabel}
        sendingLabel={sendingLabel}
      />
    </form>
  );
}
