"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { requestMagicLink, type LoginState } from "./actions";

type Labels = {
  email: string;
  placeholder: string;
  submit: string;
  sending: string;
  sent: string;
  invalidEmail: string;
  rateLimited: string;
  error: string;
};

// --color-accent, not --color-action: the action teal is too light to carry white text.
function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-4 w-full rounded bg-[color:var(--color-accent)] px-4 py-2 text-sm font-medium text-[color:var(--color-surface)] hover:bg-[color:var(--color-accent-hover)] disabled:opacity-50"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function LoginForm({ next, labels }: { next: string; labels: Labels }) {
  const [state, formAction] = useActionState<LoginState, FormData>(requestMagicLink, {
    status: "idle",
  });

  // Written out rather than interpolated: Tailwind scans source text, so a class name built at
  // runtime is never generated and the colour silently disappears.
  const OK = "mt-4 text-sm text-[color:var(--color-ok)]";
  const WARN = "mt-4 text-sm text-[color:var(--color-warn)]";
  const BAD = "mt-4 text-sm text-[color:var(--color-bad)]";

  const message =
    state.status === "sent"
      ? { text: labels.sent, className: OK }
      : state.status === "invalid_email"
        ? { text: labels.invalidEmail, className: BAD }
        : state.status === "rate_limited"
          ? { text: labels.rateLimited, className: WARN }
          : state.status === "error"
            ? { text: labels.error, className: BAD }
            : null;

  return (
    <form action={formAction} className="mt-8">
      <input type="hidden" name="next" value={next} />

      <label htmlFor="email" className="block text-sm font-medium">
        {labels.email}
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder={labels.placeholder}
        className="mt-1 w-full rounded border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3 py-2 text-sm"
      />

      <Submit label={labels.submit} pendingLabel={labels.sending} />

      {message && (
        <p role="status" className={message.className}>
          {message.text}
        </p>
      )}
    </form>
  );
}
