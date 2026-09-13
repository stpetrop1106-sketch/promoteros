"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, CopyButton, WhatsAppButton } from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";
import { mintCheckinLink, type MintCheckinLinkState } from "./actions";

const t = translatorFor(DEFAULT_LOCALE);

const KNOWN_ERROR_REASONS = new Set(["missing_ids", "not_found", "not_confirmed"]);

/** Same reasoning as `cancel-assignment-button.tsx`'s own `errorMessage`: a raw code never
 *  reaches the coordinator, and an unrecognised one still degrades to a specific sentence. */
function errorMessage(reason: string | undefined): string {
  const safe = reason && KNOWN_ERROR_REASONS.has(reason) ? reason : "not_found";
  return t(`shifts.board.error.${safe}` as TranslationKey);
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" size="sm" loading={pending}>
      {label}
    </Button>
  );
}

/**
 * P38 — mints a check-in link for one confirmed assignment, on demand, from the shift board.
 * Closes the gap the manager found: before this, nothing in the product ever issued the link
 * `/c/[token]` needs, even though that page itself already works end to end.
 *
 * Same clipboard-adapter rendering as `invite-button.tsx`: the coordinator gets the exact message
 * to paste, plus `WhatsAppButton` when the promoter's phone can be turned into a wa.me link.
 * Minting writes nothing to the database (`createCheckinLink` is a stateless HMAC token, see
 * `lib/checkins.ts`), so pressing this again after it has already been used is harmless.
 */
export function CheckinLinkButton({
  shiftId,
  assignmentId,
  phone,
  label,
}: {
  shiftId: string;
  assignmentId: string;
  phone?: string | null;
  label: string;
}) {
  const [state, formAction] = useActionState<MintCheckinLinkState, FormData>(mintCheckinLink, {
    status: "idle",
  });

  if (state.status === "ready") {
    return (
      <div className="w-64 text-left">
        <textarea
          id={`checkin-link-message-${assignmentId}`}
          readOnly
          value={state.message}
          rows={5}
          className="w-full rounded-lg border border-[color:var(--color-line-strong)] bg-[color:var(--color-surface)] p-2.5 text-xs leading-5 text-[color:var(--color-ink-soft)] shadow-[var(--shadow-2xs)]"
        />
        <div className="mt-1.5 flex flex-wrap items-start gap-2">
          <CopyButton
            text={state.message}
            variant="ghost"
            selectTargetId={`checkin-link-message-${assignmentId}`}
          />
          <WhatsAppButton phone={phone} text={state.message} variant="ghost" />
        </div>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="shiftId" value={shiftId} />
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <Submit label={label} />
      {state.status === "error" ? (
        <p role="alert" className="mt-1 text-xs font-medium text-[color:var(--color-bad-ink)]">
          {errorMessage(state.reason)}
        </p>
      ) : null}
    </form>
  );
}
