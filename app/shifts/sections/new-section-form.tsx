"use client";

import { useActionState, useState } from "react";
import type { ReactNode } from "react";
import { Button, Card, Icon, SelectField, TextField, type SelectOption } from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { createSection } from "./actions";
import { CREATE_SECTION_IDLE } from "./state";

// Same fix as `app/campaigns/[id]/shifts/new/shift-series-form.tsx`: a server component cannot
// pass a function prop (including `t`) to a client component, so this resolves its own.
const t = translatorFor(DEFAULT_LOCALE);

function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-[color:var(--color-bad-line)] bg-[color:var(--color-bad-subtle)] px-4 py-3 text-sm font-medium leading-5 text-[color:var(--color-bad-ink)]"
    >
      <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

/**
 * "Νέα ενότητα" — a top-level action on `/shifts`, not tied to any one section, so it toggles its
 * own inline panel rather than needing a route or a kit `Dialog` (there is none; `components/ui`
 * is frozen). Closes itself on a successful create; `key` on the form remounts it (and therefore
 * resets `useActionState`) so a second open always starts clean.
 */
export function NewSectionForm({ campaigns }: { campaigns: SelectOption[] }) {
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);

  if (!open) {
    return (
      <Button variant="secondary" iconLeft={<Icon name="plus" size={16} />} onClick={() => setOpen(true)}>
        {t("shifts.sections.new_button")}
      </Button>
    );
  }

  return (
    <Card elevation="raised" header={<h2 className="text-sm font-semibold text-[color:var(--color-ink)]">{t("shifts.sections.new.title")}</h2>}>
      <NewSectionFields
        key={attempt}
        campaigns={campaigns}
        onCancel={() => setOpen(false)}
        onCreated={() => {
          setOpen(false);
          setAttempt((n) => n + 1);
        }}
      />
    </Card>
  );
}

function NewSectionFields({
  campaigns,
  onCancel,
  onCreated,
}: {
  campaigns: SelectOption[];
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [state, formAction, pending] = useActionState(async (prev: typeof CREATE_SECTION_IDLE, fd: FormData) => {
    const next = await createSection(prev, fd);
    if (next.status === "idle") onCreated();
    return next;
  }, CREATE_SECTION_IDLE);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.formError ? <ErrorBanner>{t(state.formError)}</ErrorBanner> : null}

      {campaigns.length === 0 ? (
        <p className="text-sm text-[color:var(--color-muted)]">{t("shifts.sections.new.no_campaigns_hint")}</p>
      ) : (
        <>
          <TextField
            id="new-section-name"
            name="name"
            label={t("shifts.sections.new.name_label")}
            error={state.fieldErrors?.name ? t(state.fieldErrors.name) : undefined}
            required
            autoFocus
          />
          <SelectField
            id="new-section-campaign"
            name="campaignId"
            label={t("shifts.sections.new.campaign_label")}
            placeholder={t("shifts.sections.new.campaign_placeholder")}
            options={campaigns}
            error={state.fieldErrors?.campaignId ? t(state.fieldErrors.campaignId) : undefined}
            required
          />
        </>
      )}

      <div className="flex items-center gap-2">
        {campaigns.length > 0 ? (
          <Button type="submit" loading={pending}>
            {pending ? t("shifts.sections.new.submitting") : t("shifts.sections.new.submit")}
          </Button>
        ) : null}
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("shifts.sections.new.cancel")}
        </Button>
      </div>
    </form>
  );
}
