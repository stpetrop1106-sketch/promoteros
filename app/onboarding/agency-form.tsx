"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { TextField, SelectField, Button } from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { createAgency, CREATE_AGENCY_IDLE, TIMEZONES, type CreateAgencyState } from "./actions";

const t = translatorFor(DEFAULT_LOCALE);

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {pending ? t("onboarding.create.submitting") : t("onboarding.create.submit")}
    </Button>
  );
}

/**
 * The one screen between a stranger and a working product, so it asks for three things and
 * explains why it needs each of them. Validation is inline next to the field; the server
 * repeats every check, because this form is not the boundary.
 */
export function AgencyForm({ suggestedName }: { suggestedName?: string }) {
  const [state, formAction] = useActionState<CreateAgencyState, FormData>(
    createAgency,
    CREATE_AGENCY_IDLE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.errors?.general ? (
        <p
          role="alert"
          className="rounded-lg border border-[color:var(--color-bad)] bg-[color:var(--color-bad)]/10 px-4 py-3 text-sm text-[color:var(--color-ink)]"
        >
          {state.errors.general}
        </p>
      ) : null}

      <TextField
        id="agency-name"
        name="name"
        label={t("onboarding.create.name_label")}
        hint={t("onboarding.create.name_hint")}
        placeholder={t("onboarding.create.name_placeholder")}
        error={state.errors?.name}
        required
        maxLength={120}
        autoComplete="organization"
        autoFocus
      />

      <TextField
        id="agency-city"
        name="city"
        label={t("onboarding.create.city_label")}
        hint={t("onboarding.create.city_hint")}
        placeholder={t("onboarding.create.city_placeholder")}
        error={state.errors?.city}
        maxLength={80}
        autoComplete="address-level2"
      />

      <SelectField
        id="agency-timezone"
        name="timezone"
        label={t("onboarding.create.timezone_label")}
        hint={t("onboarding.create.timezone_hint")}
        error={state.errors?.timezone}
        defaultValue="Europe/Athens"
        options={TIMEZONES.map((tz) => ({ value: tz, label: tz }))}
      />

      <TextField
        id="owner-name"
        name="fullName"
        label={t("onboarding.create.full_name_label")}
        hint={t("onboarding.create.full_name_hint")}
        defaultValue={suggestedName ?? ""}
        maxLength={120}
        autoComplete="name"
      />

      <div className="flex flex-col gap-2">
        <SubmitButton />
        <p className="text-xs text-[color:var(--color-muted)]">{t("onboarding.create.trial_note")}</p>
      </div>
    </form>
  );
}
