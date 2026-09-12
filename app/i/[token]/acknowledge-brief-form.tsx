"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { acknowledgeBrief, type AcknowledgeBriefState } from "./actions";

/**
 * Mirrors `page.tsx`'s server-side `formatInstant` exactly (same locale, same timezone), so a
 * timestamp formats identically whether it was rendered on the initial page load or produced by
 * this action just now. A plain function cannot cross the server/client boundary as a prop —
 * only a Server Action can — so this is a deliberate small duplication rather than a shared
 * import of a function value.
 */
function formatInstant(iso: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "";
  return new Intl.DateTimeFormat("el-GR", {
    timeZone: "Europe/Athens",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(parsed));
}

/** `{date}` is filled in with an already-localised, already-Athens-zoned string. */
function fillDate(template: string, date: string): string {
  return template.replace("{date}", date);
}

function ConfirmButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg border border-[color:var(--color-line)] px-4 py-3 font-medium disabled:opacity-50"
    >
      {label}
    </button>
  );
}

export function AcknowledgeBriefForm({
  token,
  initialAcknowledgedAt,
  confirmLabel,
  acknowledgedTemplate,
  errorLabel,
}: {
  token: string;
  /** Raw ISO timestamp, or null if not yet acknowledged. Formatted here, not by the caller. */
  initialAcknowledgedAt: string | null;
  confirmLabel: string;
  /** Contains the literal substring `{date}`. */
  acknowledgedTemplate: string;
  errorLabel: string;
}) {
  const [state, formAction] = useActionState<AcknowledgeBriefState, FormData>(acknowledgeBrief, {
    status: "idle",
  });

  const acknowledgedAtIso =
    state.status === "acknowledged" ? state.acknowledgedAt : initialAcknowledgedAt;
  const acknowledgedAt = acknowledgedAtIso ? formatInstant(acknowledgedAtIso) : null;

  if (acknowledgedAt) {
    return (
      <p className="mt-3 text-sm font-medium text-[color:var(--color-ok)]">
        {fillDate(acknowledgedTemplate, acknowledgedAt)}
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="token" value={token} />
      {state.status === "error" && (
        <p className="text-sm text-[color:var(--color-bad)]">{errorLabel}</p>
      )}
      <ConfirmButton label={confirmLabel} />
    </form>
  );
}
