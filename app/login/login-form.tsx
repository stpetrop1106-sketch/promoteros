"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { requestMagicLink, signInWithCode, type LoginState, type CodeState } from "./actions";

type Labels = {
  email: string;
  placeholder: string;
  submit: string;
  sending: string;
  sent: string;
  invalidEmail: string;
  rateLimited: string;
  error: string;
  codeLabel: string;
  codeHint: string;
  codeSubmit: string;
  codeChecking: string;
  codeInvalid: string;
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

function SecondarySubmit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-3 w-full rounded border border-[color:var(--color-line)] px-4 py-2 text-sm font-medium hover:bg-[color:var(--color-surface)] disabled:opacity-50"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

/**
 * Sign in with the six-digit code instead of the link.
 *
 * Not a fallback — in practice the more reliable of the two. A magic link is single-use, and mail
 * providers routinely fetch every link in an incoming message to scan it, consuming the token
 * before the person clicks and making a valid link report itself as already used. A typed code
 * cannot be consumed that way.
 *
 * A separate <form>, rendered as a sibling rather than nested: a form inside a form is invalid
 * HTML and the inner one silently never submits.
 */
function CodeForm({ next, email, labels }: { next: string; email: string; labels: Labels }) {
  const [state, formAction] = useActionState<CodeState, FormData>(signInWithCode, {
    status: "idle",
  });

  return (
    <form action={formAction} className="mt-6 border-t border-[color:var(--color-line)] pt-6">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="email" value={email} />

      <label htmlFor="code" className="block text-sm font-medium">
        {labels.codeLabel}
      </label>
      <p className="mt-1 text-xs text-[color:var(--color-muted)]">{labels.codeHint}</p>
      <input
        id="code"
        name="code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        required
        className="mt-2 w-full rounded border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3 py-2 text-center text-lg tracking-[0.4em]"
      />

      <SecondarySubmit label={labels.codeSubmit} pendingLabel={labels.codeChecking} />

      {state.status === "invalid_code" && (
        <p role="alert" className="mt-3 text-sm text-[color:var(--color-bad)]">
          {labels.codeInvalid}
        </p>
      )}
    </form>
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
    <>
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

      {state.status === "sent" && state.email ? (
        <CodeForm next={next} email={state.email} labels={labels} />
      ) : null}
    </>
  );
}
