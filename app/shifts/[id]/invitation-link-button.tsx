"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, ConfirmButton, CopyButton, WhatsAppButton } from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";
import { cancelInvitation, resendInvitationLink } from "./actions";
import {
  CANCEL_INVITATION_IDLE,
  RESEND_INVITATION_IDLE,
  type CancelInvitationState,
  type ResendInvitationState,
} from "./state";

const t = translatorFor(DEFAULT_LOCALE);

const KNOWN_RESEND_REASONS = new Set([
  "missing_ids",
  "not_found",
  "not_pending",
  "invitation_expired",
  "link_unavailable",
  "blocked_read_only",
]);

const KNOWN_CANCEL_REASONS = new Set(["missing_ids", "not_found", "not_pending", "save_failed"]);

/** Same reasoning as `cancel-assignment-button.tsx`'s own `errorMessage`: a raw reason code never
 *  reaches the coordinator, and an unrecognised one still degrades to a specific sentence rather
 *  than looking a translation key up with attacker- or typo-controlled input. */
function resendError(reason: string | undefined): string {
  const safe = reason && KNOWN_RESEND_REASONS.has(reason) ? reason : "not_found";
  return t(`shifts.board.invite_link.error.${safe}` as TranslationKey);
}

function cancelError(reason: string | undefined): string {
  const safe = reason && KNOWN_CANCEL_REASONS.has(reason) ? reason : "save_failed";
  return t(`shifts.board.cancel_invite.error.${safe}` as TranslationKey);
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" size="sm" loading={pending}>
      {label}
    </Button>
  );
}

function CancelSubmit({ name }: { name: string }) {
  const { pending } = useFormStatus();
  return (
    <ConfirmButton
      variant="ghost"
      label={t("shifts.board.cancel_invite.action")}
      confirmLabel={t("shifts.board.cancel_invite.confirm_yes")}
      cancelLabel={t("shifts.board.confirm_no")}
      warning={t("shifts.board.cancel_invite.confirm", { name })}
      loading={pending}
    />
  );
}

/**
 * A2 finding 7 — the two controls an `awaiting_reply` row was missing.
 *
 * The row used to have an empty ΕΝΕΡΓΕΙΕΣ column: the invitation existed in the database and was
 * reachable from nowhere in the UI, and `/promoters/[id]/invite` refused to issue a second one.
 * With `ClipboardAdapter` as the default transport the coordinator pastes the link by hand, so a
 * lost clipboard meant the promoter simply never heard about the shift.
 *
 * "Αντιγραφή συνδέσμου" rebuilds the *same* link (see `resendInvitationLink` — nothing is issued
 * and nothing is invalidated), rendered the way `CheckinLinkButton` renders its own: the message
 * to paste, plus wa.me when the promoter's number allows it.
 *
 * "Ακύρωση πρόσκλησης" withdraws the offer, which is what clears the block so somebody else can
 * be invited. It arms before it fires, like every other destructive control in the product.
 */
export function InvitationLinkButton({
  shiftId,
  invitationId,
  fullName,
  phone,
}: {
  shiftId: string;
  invitationId: string;
  fullName: string;
  phone?: string | null;
}) {
  const [resendState, resendAction] = useActionState<ResendInvitationState, FormData>(
    resendInvitationLink,
    RESEND_INVITATION_IDLE,
  );
  const [cancelState, cancelAction] = useActionState<CancelInvitationState, FormData>(
    cancelInvitation,
    CANCEL_INVITATION_IDLE,
  );

  // The row disappears from the board on the next render once the invitation is withdrawn; until
  // it does, do not keep offering controls that no longer apply.
  if (cancelState.status === "done") return null;

  return (
    <div className="flex flex-col items-end gap-2">
      {resendState.status === "ready" ? (
        <div className="w-64 text-left">
          <textarea
            id={`invite-link-message-${invitationId}`}
            readOnly
            value={resendState.message}
            rows={5}
            className="w-full rounded-lg border border-[color:var(--color-line-strong)] bg-[color:var(--color-surface)] p-2.5 text-xs leading-5 text-[color:var(--color-ink-soft)] shadow-[var(--shadow-2xs)]"
          />
          <div className="mt-1.5 flex flex-wrap items-start gap-2">
            <CopyButton
              text={resendState.message}
              variant="ghost"
              selectTargetId={`invite-link-message-${invitationId}`}
            />
            <WhatsAppButton phone={phone} text={resendState.message} variant="ghost" />
          </div>
        </div>
      ) : (
        <form action={resendAction}>
          <input type="hidden" name="shiftId" value={shiftId} />
          <input type="hidden" name="invitationId" value={invitationId} />
          <Submit label={t("shifts.board.invite_link.action")} />
          {resendState.status === "error" ? (
            <p role="alert" className="mt-1 max-w-64 text-xs font-medium text-[color:var(--color-bad-ink)]">
              {resendError(resendState.reason)}
            </p>
          ) : null}
        </form>
      )}

      <form action={cancelAction} className="flex flex-col items-end gap-1">
        <input type="hidden" name="shiftId" value={shiftId} />
        <input type="hidden" name="invitationId" value={invitationId} />
        <CancelSubmit name={fullName} />
        {cancelState.status === "error" ? (
          <p role="alert" className="max-w-64 text-xs font-medium text-[color:var(--color-bad-ink)]">
            {cancelError(cancelState.reason)}
          </p>
        ) : null}
      </form>
    </div>
  );
}
