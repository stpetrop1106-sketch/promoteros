"use client";

import { useActionState, useState } from "react";
import { SelectField, TextArea, TextField, type SelectOption } from "@/components/ui";
import type { TranslationKey } from "@/lib/i18n";
import { SubmitButton } from "@/app/campaigns/submit-button";
import { createCampaign, type CampaignFormState } from "./actions";

const INITIAL_STATE: CampaignFormState = { status: "idle" };

export function CampaignForm({
  t,
  clients,
  skills,
}: {
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  clients: SelectOption[];
  skills: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(createCampaign, INITIAL_STATE);
  const [clientMode, setClientMode] = useState<"existing" | "new">(clients.length > 0 ? "existing" : "new");

  const errorFor = (field: keyof NonNullable<CampaignFormState["fieldErrors"]>) =>
    state.fieldErrors?.[field] ? t(state.fieldErrors[field]!) : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.formError ? (
        <p
          role="alert"
          className="rounded-lg border border-[color:var(--color-bad)] bg-[color:var(--color-bad)]/10 px-4 py-3 text-sm font-medium text-[color:var(--color-bad)]"
        >
          {t(state.formError)}
        </p>
      ) : null}

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold text-[color:var(--color-ink)]">
          {t("campaigns.new.section_client")}
        </legend>

        <div className="flex flex-wrap gap-4 text-sm text-[color:var(--color-ink)]">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="clientMode"
              value="existing"
              checked={clientMode === "existing"}
              onChange={() => setClientMode("existing")}
              disabled={clients.length === 0}
            />
            {t("campaigns.new.client_existing")}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="clientMode"
              value="new"
              checked={clientMode === "new"}
              onChange={() => setClientMode("new")}
            />
            {t("campaigns.new.client_new")}
          </label>
        </div>

        {clients.length === 0 ? (
          <p className="text-xs text-[color:var(--color-muted)]">{t("campaigns.new.no_clients_hint")}</p>
        ) : null}

        {clientMode === "existing" ? (
          <SelectField
            id="clientId"
            name="clientId"
            label={t("campaigns.new.client_select_label")}
            placeholder={t("campaigns.new.client_select_placeholder")}
            options={clients}
            error={errorFor("clientId")}
            required
          />
        ) : (
          <TextField
            id="newClientName"
            name="newClientName"
            label={t("campaigns.new.new_client_name_label")}
            error={errorFor("newClientName")}
            required
          />
        )}
      </fieldset>

      <TextField
        id="name"
        name="name"
        label={t("campaigns.new.name_label")}
        error={errorFor("name")}
        required
      />

      <TextField
        id="campaignType"
        name="campaignType"
        label={t("campaigns.new.type_label")}
        hint={t("campaigns.new.type_hint")}
        error={errorFor("campaignType")}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="startsOn"
          name="startsOn"
          type="date"
          label={t("campaigns.new.starts_on_label")}
          error={errorFor("startsOn")}
          required
        />
        <TextField
          id="endsOn"
          name="endsOn"
          type="date"
          label={t("campaigns.new.ends_on_label")}
          error={errorFor("endsOn")}
          required
        />
      </div>

      <TextArea
        id="dressCode"
        name="dressCode"
        label={t("campaigns.new.dress_code_label")}
        rows={2}
        error={errorFor("dressCode")}
      />

      <TextField
        id="rateEuros"
        name="rateEuros"
        inputMode="decimal"
        label={t("campaigns.new.rate_label")}
        hint={t("campaigns.new.rate_hint")}
        error={errorFor("rateEuros")}
        required
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-[color:var(--color-ink)]">
          {t("campaigns.new.skills_label")}
        </legend>
        <p className="text-xs text-[color:var(--color-muted)]">{t("campaigns.new.skills_hint")}</p>
        {skills.length === 0 ? (
          <p className="text-sm text-[color:var(--color-muted)]">{t("campaigns.new.skills_none")}</p>
        ) : (
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {skills.map((skill) => (
              <label key={skill.id} className="flex items-center gap-2 text-sm text-[color:var(--color-ink)]">
                <input type="checkbox" name="skillIds" value={skill.id} />
                {skill.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div>
        <SubmitButton label={t("campaigns.new.submit")} pendingLabel={t("campaigns.new.submitting")} />
      </div>
    </form>
  );
}
