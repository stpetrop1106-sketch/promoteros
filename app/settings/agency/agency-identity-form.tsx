"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, TextField, Icon } from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";
import type { AgencyIdentityErrorCode } from "@/lib/agency-settings";
import { saveAgencyIdentity } from "./actions";
import {
  IDENTITY_IDLE,
  RETENTION_MONTHS_MIN,
  RETENTION_MONTHS_MAX,
  type AgencyIdentityFormState,
} from "./state";

const t = translatorFor(DEFAULT_LOCALE);

/** One sentence per failure — "Something went wrong" is banned (CLAUDE.md quality bar). */
const ERROR_KEYS: Record<AgencyIdentityErrorCode, TranslationKey> = {
  not_owner: "agency_settings.errors.not_owner",
  legal_name_required: "agency_settings.errors.legal_name_required",
  legal_name_too_long: "agency_settings.errors.legal_name_too_long",
  email_required: "agency_settings.errors.email_required",
  email_invalid: "agency_settings.errors.email_invalid",
  retention_required: "agency_settings.errors.retention_out_of_range",
  retention_out_of_range: "agency_settings.errors.retention_out_of_range",
  write_not_permitted: "agency_settings.errors.write_not_permitted",
  unknown: "agency_settings.errors.unknown",
};

/** Same subtle/line/ink triple every other form-level banner in this parcel uses — see
 * `app/promoters/promoter-form.tsx`'s `Banner`. Local because `components/ui/**` is frozen. */
function ErrorNote({ code }: { code: AgencyIdentityErrorCode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-[color:var(--color-bad-line)] bg-[color:var(--color-bad-subtle)] px-4 py-3 text-sm font-medium leading-5 text-[color:var(--color-bad-ink)]"
    >
      <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
      <span>{t(ERROR_KEYS[code] ?? "agency_settings.errors.unknown")}</span>
    </div>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {pending ? t("agency_settings.form.submitting") : t("agency_settings.form.submit")}
    </Button>
  );
}

export function AgencyIdentityForm({
  legalName,
  privacyContactEmail,
  retentionMonths,
}: {
  legalName: string;
  privacyContactEmail: string;
  /** Null means "not declared yet" — the field still defaults to 24, per 0014's proposed value. */
  retentionMonths: number | null;
}) {
  const [state, formAction] = useActionState<AgencyIdentityFormState, FormData>(
    saveAgencyIdentity,
    IDENTITY_IDLE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <TextField
        id="agency-legal-name"
        name="legalName"
        label={t("agency_settings.form.legal_name.label")}
        hint={t("agency_settings.form.legal_name.hint")}
        error={
          state.status === "error" &&
          (state.code === "legal_name_required" || state.code === "legal_name_too_long")
            ? t(ERROR_KEYS[state.code])
            : undefined
        }
        defaultValue={legalName}
        required
        maxLength={200}
        autoComplete="organization"
      />

      <TextField
        id="agency-privacy-email"
        name="privacyContactEmail"
        type="email"
        label={t("agency_settings.form.privacy_email.label")}
        hint={t("agency_settings.form.privacy_email.hint")}
        error={
          state.status === "error" &&
          (state.code === "email_required" || state.code === "email_invalid")
            ? t(ERROR_KEYS[state.code])
            : undefined
        }
        defaultValue={privacyContactEmail}
        required
        maxLength={200}
        autoComplete="email"
      />

      <TextField
        id="agency-retention-months"
        name="retentionMonths"
        type="number"
        inputMode="numeric"
        min={RETENTION_MONTHS_MIN}
        max={RETENTION_MONTHS_MAX}
        step={1}
        label={t("agency_settings.form.retention.label")}
        hint={t("agency_settings.form.retention.hint")}
        error={
          state.status === "error" &&
          (state.code === "retention_required" || state.code === "retention_out_of_range")
            ? t(ERROR_KEYS[state.code])
            : undefined
        }
        defaultValue={String(retentionMonths ?? 24)}
        required
        containerClassName="max-w-xs"
      />
      <div className="-mt-2 flex flex-col gap-1">
        <p className="text-xs leading-5 text-[color:var(--color-muted)]">
          {t("agency_settings.form.retention.reasoning")}
        </p>
        <p className="text-xs leading-5 text-[color:var(--color-muted)]">
          {t("agency_settings.form.retention.not_advice")}
        </p>
      </div>

      {state.status === "error" &&
      state.code !== "legal_name_required" &&
      state.code !== "legal_name_too_long" &&
      state.code !== "email_required" &&
      state.code !== "email_invalid" &&
      state.code !== "retention_required" &&
      state.code !== "retention_out_of_range" ? (
        <ErrorNote code={state.code ?? "unknown"} />
      ) : null}

      {state.status === "saved" ? (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-xl border border-[color:var(--color-ok-line)] bg-[color:var(--color-ok-subtle)] px-4 py-3 text-sm font-medium leading-5 text-[color:var(--color-ok-ink)]"
        >
          <Icon name="check" size={18} className="shrink-0" />
          {t("agency_settings.form.saved")}
        </div>
      ) : null}

      <div className="border-t border-[color:var(--color-line)] pt-6">
        <Submit />
      </div>
    </form>
  );
}
