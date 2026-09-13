"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, CopyButton, Icon, WhatsAppButton } from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";
import type { BlockReason, WarningReason } from "@/lib/invite-eligibility";
import { sendInviteFromProfile } from "./actions";
import { SEND_INVITE_IDLE, type SendInviteState } from "./state";
import type { ExtendedBlockReason } from "./data";

const t = translatorFor(DEFAULT_LOCALE);

const BLOCK_KEY: Record<ExtendedBlockReason, TranslationKey> = {
  archived: "invite_eligibility.blocking.archived",
  blocklisted: "invite_eligibility.blocking.blocklisted",
  already_confirmed: "invite_eligibility.blocking.already_confirmed",
  pending_invitation: "invite_eligibility.blocking.pending_invitation",
  overlapping_confirmed_shift: "invite_eligibility.blocking.overlapping_confirmed_shift",
  shift_unavailable: "invite_eligibility.blocking.shift_unavailable",
};

const WARNING_KEY: Record<WarningReason, TranslationKey> = {
  no_availability_declared: "invite_eligibility.warning.no_availability_declared",
  declared_unavailable: "invite_eligibility.warning.declared_unavailable",
  outside_travel_radius: "invite_eligibility.warning.outside_travel_radius",
  brief_not_read: "invite_eligibility.warning.brief_not_read",
};

const KNOWN_ERROR_REASONS = new Set(["missing_ids", "not_found", "blocked_read_only", "unknown"]);

function errorMessage(reason: string): string {
  const safe = KNOWN_ERROR_REASONS.has(reason) ? reason : "unknown";
  return t(`invite_panel.send.error.${safe}` as TranslationKey);
}

function ReasonList({ reasons, tone }: { reasons: string[]; tone: "bad" | "warn" }) {
  if (reasons.length === 0) return null;
  const color = tone === "bad" ? "text-[color:var(--color-bad-ink)]" : "text-[color:var(--color-warn-ink)]";
  return (
    <ul className={`flex flex-col gap-0.5 text-xs ${color}`}>
      {reasons.map((r) => (
        <li key={r} className="flex items-start gap-1.5">
          <Icon name="alert" size={12} className="mt-0.5 shrink-0" />
          <span>{r}</span>
        </li>
      ))}
    </ul>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending}>
      {label}
    </Button>
  );
}

/**
 * The send control for one row of the invite panel (`invite-panel.tsx`). Mirrors
 * `app/shifts/[id]/invite-button.tsx`'s clipboard-adapter rendering exactly — same
 * CopyButton/WhatsAppButton pair for a manual send — but adds the one state that button never
 * needs: `blocked`, returned when the server's own re-check (`actions.ts`) finds this cannot be
 * sent after all, because the panel's list is a hint taken at load time, not a live guarantee.
 */
export function SendInviteButton({
  shiftId,
  promoterId,
  promoterPhone,
  blocking,
  warnings,
  label,
}: {
  shiftId: string;
  promoterId: string;
  promoterPhone: string | null | undefined;
  blocking: BlockReason[];
  warnings: WarningReason[];
  label: string;
}) {
  const [state, formAction] = useActionState<SendInviteState, FormData>(
    sendInviteFromProfile,
    SEND_INVITE_IDLE,
  );

  if (state.status === "sent") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--color-ok-ink)]">
        <Icon name="check" size={14} />
        {t("invite_panel.send.sent")}
      </span>
    );
  }

  if (state.status === "manual" && state.manualBody) {
    return (
      <div className="w-64 text-left">
        <textarea
          id={`profile-invite-message-${shiftId}`}
          readOnly
          value={state.manualBody}
          rows={5}
          className="w-full rounded-lg border border-[color:var(--color-line-strong)] bg-[color:var(--color-surface)] p-2.5 text-xs leading-5 text-[color:var(--color-ink-soft)] shadow-[var(--shadow-2xs)]"
        />
        <div className="mt-1.5 flex flex-wrap items-start gap-2">
          <CopyButton
            text={state.manualBody}
            variant="ghost"
            selectTargetId={`profile-invite-message-${shiftId}`}
          />
          <WhatsAppButton phone={promoterPhone} text={state.manualBody} variant="ghost" />
        </div>
      </div>
    );
  }

  if (state.status === "blocked") {
    return (
      <div className="max-w-64 text-right">
        <ReasonList reasons={state.reasons.map((r) => t(BLOCK_KEY[r]))} tone="bad" />
      </div>
    );
  }

  if (state.status === "error") {
    return <p className="text-xs text-[color:var(--color-bad-ink)]">{errorMessage(state.reason)}</p>;
  }

  const blockedNow = blocking.length > 0;

  return (
    <div className="flex flex-col items-end gap-1.5">
      {blockedNow ? (
        <ReasonList reasons={blocking.map((r) => t(BLOCK_KEY[r]))} tone="bad" />
      ) : (
        <>
          <ReasonList reasons={warnings.map((r) => t(WARNING_KEY[r]))} tone="warn" />
          <form action={formAction}>
            <input type="hidden" name="shiftId" value={shiftId} />
            <input type="hidden" name="promoterId" value={promoterId} />
            <Submit label={label} />
          </form>
        </>
      )}
    </div>
  );
}
