"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, TextArea, TextField } from "@/components/ui";
import type { TranslationKey } from "@/lib/i18n";
import { saveBrief, type BriefFormState } from "./actions";

const INITIAL_STATE: BriefFormState = { status: "idle" };

function Actions({
  draftLabel,
  publishLabel,
  savingLabel,
}: {
  draftLabel: string;
  publishLabel: string;
  savingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap gap-3">
      <Button type="submit" name="intent" value="draft" variant="secondary" loading={pending} disabled={pending}>
        {pending ? savingLabel : draftLabel}
      </Button>
      <Button type="submit" name="intent" value="publish" variant="primary" loading={pending} disabled={pending}>
        {pending ? savingLabel : publishLabel}
      </Button>
    </div>
  );
}

export function BriefForm({
  t,
  campaignId,
  initialTitle,
  initialBody,
}: {
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  campaignId: string;
  initialTitle: string;
  initialBody: string;
}) {
  const [state, formAction] = useActionState(saveBrief, INITIAL_STATE);

  const errorFor = (field: keyof NonNullable<BriefFormState["fieldErrors"]>) =>
    state.fieldErrors?.[field] ? t(state.fieldErrors[field]!) : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="campaignId" value={campaignId} />

      {state.formError ? (
        <p
          role="alert"
          className="rounded-lg border border-[color:var(--color-bad)] bg-[color:var(--color-bad)]/10 px-4 py-3 text-sm font-medium text-[color:var(--color-bad)]"
        >
          {t(state.formError)}
        </p>
      ) : null}

      <TextField
        id="title"
        name="title"
        label={t("campaigns.brief.title_label")}
        defaultValue={initialTitle}
        error={errorFor("title")}
        required
      />

      <TextArea
        id="bodyMd"
        name="bodyMd"
        label={t("campaigns.brief.body_label")}
        hint={t("campaigns.brief.body_hint")}
        defaultValue={initialBody}
        rows={16}
        error={errorFor("bodyMd")}
        required
      />

      <Actions
        draftLabel={t("campaigns.brief.save_draft")}
        publishLabel={t("campaigns.brief.publish")}
        savingLabel={t("campaigns.brief.saving")}
      />
    </form>
  );
}
