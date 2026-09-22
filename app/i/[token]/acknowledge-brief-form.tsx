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

/**
 * A3-11 — "Το διάβασα" took about ten seconds and showed nothing at all while it ran. The audit
 * recorded it as a failed tap and was about to file it as a bug, which is exactly the mistake the
 * promoter makes, except they tap again.
 */
function ConfirmButton({ label, sendingLabel }: { label: string; sendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className="w-full rounded-lg bg-[color:var(--color-accent)] px-4 py-3 font-semibold text-white transition hover:bg-[color:var(--color-accent-hover)] disabled:opacity-50"
    >
      {pending ? sendingLabel : label}
    </button>
  );
}

export function AcknowledgeBriefForm({
  token,
  initialAcknowledgedAt,
  canAcknowledge,
  confirmLabel,
  sendingLabel,
  acknowledgedTemplate,
  errorLabel,
  offlineLabel,
}: {
  token: string;
  /** Raw ISO timestamp, or null if not yet acknowledged. Formatted here, not by the caller. */
  initialAcknowledgedAt: string | null;
  /**
   * A3-09 — the brief stays readable after the invitation token expires, but the acknowledgement
   * is a write and still requires a live token. False hides the button instead of offering one
   * that is guaranteed to fail.
   */
  canAcknowledge: boolean;
  confirmLabel: string;
  sendingLabel: string;
  /** Contains the literal substring `{date}`. */
  acknowledgedTemplate: string;
  errorLabel: string;
  offlineLabel: string;
}) {
  /** A3-01 — a rejection here produced no state and therefore no message. See `respond-form.tsx`. */
  async function runAction(
    previous: AcknowledgeBriefState,
    formData: FormData,
  ): Promise<AcknowledgeBriefState> {
    try {
      return await acknowledgeBrief(previous, formData);
    } catch {
      return { status: "error", reason: "offline" };
    }
  }

  const [state, formAction] = useActionState<AcknowledgeBriefState, FormData>(runAction, {
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

  if (!canAcknowledge) return null;

  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="token" value={token} />
      {state.status === "error" && (
        <p role="alert" className="text-sm text-[color:var(--color-bad)]">
          {state.reason === "offline" ? offlineLabel : errorLabel}
        </p>
      )}
      <ConfirmButton label={confirmLabel} sendingLabel={sendingLabel} />
    </form>
  );
}
