"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Icon, TextArea, TextField } from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { saveBrief, type BriefFormState } from "./actions";

const t = translatorFor(DEFAULT_LOCALE);

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
  campaignId,
  initialTitle,
  initialBody,
}: {
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
          className="flex items-start gap-2 rounded-xl border border-[color:var(--color-bad-line)] bg-[color:var(--color-bad-subtle)] px-4 py-3 text-sm font-medium text-[color:var(--color-bad-ink)]"
        >
          <Icon name="alert" size={16} className="mt-px shrink-0" />
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
