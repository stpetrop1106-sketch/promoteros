"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, ConfirmButton, Icon } from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import type { CampaignStatus } from "@/app/campaigns/_shared";
import { setCampaignStatus } from "./actions";
import { CAMPAIGN_STATUS_IDLE, type CampaignStatusState } from "./state";

// A client component resolves its own translator — a function cannot be a prop across the
// server/client boundary (CLAUDE.md). Same shape as `app/shifts/sections/rename-section-form.tsx`.
const t = translatorFor(DEFAULT_LOCALE);

function ErrorNote({ state }: { state: CampaignStatusState }) {
  if (state.status !== "error" || !state.error) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-1.5 text-xs font-medium leading-5 text-[color:var(--color-bad-ink)]"
    >
      <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
      <span>{t(state.error)}</span>
    </p>
  );
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
 * One forward status move ("Ενεργοποίηση", "Ολοκλήρωση").
 *
 * A2 finding 12 — the button used to be a bare `<form action={setCampaignStatus.bind(...)}>`,
 * which cannot report anything at all: a billing-blocked agency pressed it and nothing whatever
 * happened. Each button now owns its own `useActionState`, so a refusal appears under the
 * button that caused it rather than in a banner somewhere else on the page.
 */
export function CampaignStatusButton({
  campaignId,
  next,
  label,
}: {
  campaignId: string;
  next: CampaignStatus;
  label: string;
}) {
  const [state, formAction] = useActionState(setCampaignStatus, CAMPAIGN_STATUS_IDLE);

  return (
    <form action={formAction} className="flex flex-col gap-1.5">
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="next" value={next} />
      <Submit label={label} />
      <ErrorNote state={state} />
    </form>
  );
}

/**
 * The one destructive action on the campaign detail page, kept away from the ordinary status
 * buttons per the "dangerous action never adjacent to the common one" rule.
 *
 * A2 finding 11 — this used to gate on `window.confirm`. It arms in place now, like every other
 * destructive control in the product.
 */
export function CancelCampaignForm({
  campaignId,
  campaignName,
}: {
  campaignId: string;
  campaignName: string;
}) {
  const [state, formAction] = useActionState(setCampaignStatus, CAMPAIGN_STATUS_IDLE);

  return (
    <form action={formAction} className="flex flex-col items-start gap-1.5">
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="next" value="cancelled" />
      <ConfirmButton
        label={t("campaigns.detail.cancel")}
        confirmLabel={t("campaigns.detail.cancel_confirm_yes")}
        cancelLabel={t("campaigns.detail.cancel_confirm_no")}
        warning={t("campaigns.detail.cancel_confirm", { name: campaignName })}
      />
      <ErrorNote state={state} />
    </form>
  );
}
