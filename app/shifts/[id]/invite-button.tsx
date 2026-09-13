"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, CopyButton, Icon, WhatsAppButton } from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { invite, type InviteState } from "./actions";

const t = translatorFor(DEFAULT_LOCALE);

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" size="sm" loading={pending}>
      {label}
    </Button>
  );
}

export function InviteButton({
  shiftId,
  promoterId,
  label,
  copyLabel,
  phone,
}: {
  shiftId: string;
  promoterId: string;
  label: string;
  copyLabel: string;
  /** The promoter's phone, for "open in WhatsApp". Optional so existing callers keep working. */
  phone?: string | null;
}) {
  const [state, formAction] = useActionState<InviteState, FormData>(invite, {
    status: "idle",
  });

  // Clipboard adapter: the coordinator pastes into WhatsApp themselves, which is exactly
  // what they do today. Showing the exact text is the feature, not a fallback apology.
  if (state.status === "manual" && state.manualBody) {
    return (
      <div className="w-64 text-left">
        <textarea
          id={`invite-message-${promoterId}`}
          readOnly
          value={state.manualBody}
          rows={5}
          className="w-full rounded-lg border border-[color:var(--color-line-strong)] bg-[color:var(--color-surface)] p-2.5 text-xs leading-5 text-[color:var(--color-ink-soft)] shadow-[var(--shadow-2xs)]"
        />
        <div className="mt-1.5 flex flex-wrap items-start gap-2">
          <CopyButton
            text={state.manualBody}
            label={copyLabel}
            variant="ghost"
            selectTargetId={`invite-message-${promoterId}`}
          />
          <WhatsAppButton phone={phone} text={state.manualBody} variant="ghost" />
        </div>
      </div>
    );
  }

  // Delivered by the adapter (email, since P39). A bare check mark left the coordinator guessing
  // whether anything had actually gone out.
  if (state.status === "sent") {
    return (
      <span role="status" className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--color-ok-ink)]">
        <Icon name="check" size={14} />
        {t("shifts.invite.delivered")}
      </span>
    );
  }

  // Never the raw error message — the action used to hand back `Error#message` ("Shift not found",
  // a Postgres error), which is not a sentence a coordinator should have to read.
  if (state.status === "error") {
    return (
      <p role="alert" className="text-xs text-[color:var(--color-bad-ink)]">
        {t("shifts.invite.failed")}
      </p>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="shiftId" value={shiftId} />
      <input type="hidden" name="promoterId" value={promoterId} />
      <Submit label={label} />
    </form>
  );
}
