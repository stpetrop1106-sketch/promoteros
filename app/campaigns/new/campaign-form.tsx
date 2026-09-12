"use client";

import { useActionState, useState } from "react";
import type { ReactNode } from "react";
import { SelectField, TextArea, TextField, Section, Icon, type SelectOption } from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { SubmitButton } from "@/app/campaigns/submit-button";
import { createCampaign, type CampaignFormState } from "./actions";

const INITIAL_STATE: CampaignFormState = { status: "idle" };

// A Server Component may not pass a function prop to a Client Component — only a Server Action
// serializes across that boundary, and `t` is a plain closure. The previous version accepted `t`
// as a prop from `app/campaigns/new/page.tsx`, which built without error (this route is fully
// dynamic, so Next never serializes its RSC payload at build time) but crashed on every real
// request with "Functions cannot be passed directly to Client Components". Creating the
// translator here instead — exactly like `app/promoters/promoter-form.tsx` already does — is the
// fix `app/promoters/[id]/edit/archive-control.tsx`'s sibling forms use throughout this codebase.
const t = translatorFor(DEFAULT_LOCALE);

/** Matches `app/promoters/promoter-form.tsx`'s `Banner` — the same subtle/line/ink triple
 * `Badge` and every status colour in `docs/design.md` use, so a form-level error reads as the
 * same system as the pill two inches above it instead of an opacity-tinted one-off. */
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

/** A radio option wearing a tappable chip instead of a bare browser dot — see the same helper
 * in `promoter-form.tsx`. Kept local rather than shared because `components/ui/**` is frozen. */
function OptionChip({ children }: { children: ReactNode }) {
  return (
    <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-2.5 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3.5 text-sm text-[color:var(--color-ink)] transition-colors duration-150 ease-[var(--ease-out-soft)] hover:border-[color:var(--color-line-strong)] hover:bg-[color:var(--color-surface-hover)] has-[:checked]:border-[color:var(--color-accent-line)] has-[:checked]:bg-[color:var(--color-accent-subtle)] has-[:checked]:text-[color:var(--color-accent-ink)] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:shadow-[var(--focus-ring)]">
      {children}
    </label>
  );
}

const RADIO_CLASS = "size-4 shrink-0 accent-[color:var(--color-accent)] outline-none";
const CHECK_CLASS = "size-4 shrink-0 rounded accent-[color:var(--color-accent)] outline-none";

export function CampaignForm({
  clients,
  skills,
}: {
  clients: SelectOption[];
  skills: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(createCampaign, INITIAL_STATE);
  const [clientMode, setClientMode] = useState<"existing" | "new">(clients.length > 0 ? "existing" : "new");

  const errorFor = (field: keyof NonNullable<CampaignFormState["fieldErrors"]>) =>
    state.fieldErrors?.[field] ? t(state.fieldErrors[field]!) : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-9">
      {state.formError ? <ErrorBanner>{t(state.formError)}</ErrorBanner> : null}

      <Section title={t("campaigns.new.section_client")}>
        <div className="flex flex-col gap-3">
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">{t("campaigns.new.section_client")}</legend>
            <OptionChip>
              <input
                type="radio"
                name="clientMode"
                value="existing"
                checked={clientMode === "existing"}
                onChange={() => setClientMode("existing")}
                disabled={clients.length === 0}
                className={RADIO_CLASS}
              />
              {t("campaigns.new.client_existing")}
            </OptionChip>
            <OptionChip>
              <input
                type="radio"
                name="clientMode"
                value="new"
                checked={clientMode === "new"}
                onChange={() => setClientMode("new")}
                className={RADIO_CLASS}
              />
              {t("campaigns.new.client_new")}
            </OptionChip>
          </fieldset>

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
        </div>
      </Section>

      <Section title={t("campaigns.new.section_details")}>
        <div className="flex flex-col gap-4">
          <TextField id="name" name="name" label={t("campaigns.new.name_label")} error={errorFor("name")} required />

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
            containerClassName="max-w-xs"
          />
        </div>
      </Section>

      <Section title={t("campaigns.new.skills_label")} description={t("campaigns.new.skills_hint")}>
        {skills.length === 0 ? (
          <p className="text-sm text-[color:var(--color-muted)]">{t("campaigns.new.skills_none")}</p>
        ) : (
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">{t("campaigns.new.skills_label")}</legend>
            {skills.map((skill) => (
              <OptionChip key={skill.id}>
                <input type="checkbox" name="skillIds" value={skill.id} className={CHECK_CLASS} />
                {skill.name}
              </OptionChip>
            ))}
          </fieldset>
        )}
      </Section>

      <div className="border-t border-[color:var(--color-line)] pt-6">
        <SubmitButton label={t("campaigns.new.submit")} pendingLabel={t("campaigns.new.submitting")} />
      </div>
    </form>
  );
}
