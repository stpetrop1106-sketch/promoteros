"use client";

import { useEffect } from "react";
import { SelectField, TextField } from "@/components/ui";
import { parseEurosToCents } from "@/app/campaigns/_shared";
import type { ImportContext } from "./types";
import { Banner, OptionChip, RADIO_CLASS, StepHeading, t } from "./wizard-ui";

export type DestinationDraft = {
  campaignMode: "existing" | "new";
  campaignId: string;
  clientMode: "existing" | "new";
  clientId: string;
  newClientName: string;
  newCampaignName: string;
  startsOn: string;
  endsOn: string;
  rateEuros: string;
  programmeMode: "existing" | "new";
  programmeId: string;
  newProgrammeName: string;
};

export function emptyDestination(sectionName: string): DestinationDraft {
  return {
    campaignMode: "existing",
    campaignId: "",
    clientMode: "existing",
    clientId: "",
    newClientName: "",
    newCampaignName: "",
    startsOn: "",
    endsOn: "",
    rateEuros: "",
    programmeMode: "new",
    programmeId: "",
    newProgrammeName: sectionName,
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function sameName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase("el") === b.trim().toLocaleLowerCase("el");
}

function openProgrammes(context: ImportContext, campaignId: string) {
  return context.programmes.filter((p) => p.campaignId === campaignId && !p.archived);
}

/** The first thing stopping "Επόμενο", in words — the same checks the server makes. */
export function destinationProblem(d: DestinationDraft, context: ImportContext): string | null {
  if (d.campaignMode === "existing") {
    if (!context.campaigns.some((c) => c.id === d.campaignId)) return t("shifts.import.destination.problem.campaign");
  } else {
    if (d.clientMode === "existing") {
      if (!context.clients.some((c) => c.id === d.clientId)) return t("shifts.import.destination.problem.client");
    } else {
      if (d.newClientName.trim().length < 2) return t("shifts.import.destination.problem.client_name");
      const existing = context.clients.find((c) => sameName(c.name, d.newClientName));
      if (existing) return t("shifts.import.destination.problem.client_exists", { name: existing.name });
    }
    if (d.newCampaignName.trim().length < 2) return t("shifts.import.destination.problem.campaign_name");
    if (!DATE_RE.test(d.startsOn) || !DATE_RE.test(d.endsOn)) return t("shifts.import.destination.problem.dates");
    if (d.endsOn < d.startsOn) return t("shifts.import.destination.problem.date_order");
    if (parseEurosToCents(d.rateEuros) === null) return t("shifts.import.destination.problem.rate");
  }

  if (d.campaignMode === "existing" && d.programmeMode === "existing") {
    if (!openProgrammes(context, d.campaignId).some((p) => p.id === d.programmeId)) {
      return t("shifts.import.destination.problem.section");
    }
  } else {
    const name = d.newProgrammeName.trim();
    if (name.length < 1 || name.length > 120) return t("shifts.import.destination.problem.section_name");
  }
  return null;
}

export function DestinationStep({
  context,
  draft,
  onChange,
  span,
}: {
  context: ImportContext;
  draft: DestinationDraft;
  onChange: (next: DestinationDraft) => void;
  span: { from: string; to: string } | null;
}) {
  const set = (patch: Partial<DestinationDraft>) => onChange({ ...draft, ...patch });

  // Sensible starting points, once: a new campaign when there is none, its dates from the file.
  useEffect(() => {
    const patch: Partial<DestinationDraft> = {};
    if (context.campaigns.length === 0 && draft.campaignMode === "existing") patch.campaignMode = "new";
    if (context.clients.length === 0 && draft.clientMode === "existing") patch.clientMode = "new";
    if (span && !draft.startsOn && !draft.endsOn) {
      patch.startsOn = span.from;
      patch.endsOn = span.to;
    }
    if (Object.keys(patch).length > 0) onChange({ ...draft, ...patch });
  }, []);

  const programmes = draft.campaignMode === "existing" ? openProgrammes(context, draft.campaignId) : [];
  const canUseExistingSection = draft.campaignMode === "existing" && programmes.length > 0 && !context.programmesUnavailable;
  const programmeMode = canUseExistingSection ? draft.programmeMode : "new";
  const clientExists =
    draft.campaignMode === "new" && draft.clientMode === "new"
      ? context.clients.find((c) => sameName(c.name, draft.newClientName))
      : undefined;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <StepHeading title={t("shifts.import.destination.campaign_title")} description={t("shifts.import.destination.campaign_description")} />
        <fieldset className="flex flex-col gap-2 sm:flex-row">
          <legend className="sr-only">{t("shifts.import.destination.campaign_title")}</legend>
          <OptionChip className="flex-1">
            <input
              type="radio"
              name="import-campaign-mode"
              checked={draft.campaignMode === "existing"}
              disabled={context.campaigns.length === 0}
              onChange={() => set({ campaignMode: "existing" })}
              className={RADIO_CLASS}
            />
            {t("shifts.import.destination.campaign_existing")}
          </OptionChip>
          <OptionChip className="flex-1">
            <input
              type="radio"
              name="import-campaign-mode"
              checked={draft.campaignMode === "new"}
              onChange={() => set({ campaignMode: "new", programmeMode: "new" })}
              className={RADIO_CLASS}
            />
            {t("shifts.import.destination.campaign_new")}
          </OptionChip>
        </fieldset>

        {draft.campaignMode === "existing" ? (
          <SelectField
            id="import-campaign"
            label={t("shifts.import.destination.campaign_label")}
            placeholder={t("shifts.import.destination.campaign_placeholder")}
            value={draft.campaignId}
            onChange={(event) => {
              const id = event.target.value;
              const first = openProgrammes(context, id)[0];
              set({ campaignId: id, programmeId: first?.id ?? "", programmeMode: "new" });
            }}
            options={context.campaigns.map((c) => ({
              value: c.id,
              label: c.clientName ? `${c.name} — ${c.clientName}` : c.name,
            }))}
          />
        ) : (
          <div className="flex flex-col gap-4 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4">
            <fieldset className="flex flex-col gap-2 sm:flex-row">
              <legend className="mb-2 text-sm font-medium text-[color:var(--color-ink)]">{t("shifts.import.destination.client_title")}</legend>
              <OptionChip className="flex-1">
                <input
                  type="radio"
                  name="import-client-mode"
                  checked={draft.clientMode === "existing"}
                  disabled={context.clients.length === 0}
                  onChange={() => set({ clientMode: "existing" })}
                  className={RADIO_CLASS}
                />
                {t("shifts.import.destination.client_existing")}
              </OptionChip>
              <OptionChip className="flex-1">
                <input
                  type="radio"
                  name="import-client-mode"
                  checked={draft.clientMode === "new"}
                  onChange={() => set({ clientMode: "new" })}
                  className={RADIO_CLASS}
                />
                {t("shifts.import.destination.client_new")}
              </OptionChip>
            </fieldset>

            {draft.clientMode === "existing" ? (
              <SelectField
                id="import-client"
                label={t("shifts.import.destination.client_label")}
                placeholder={t("shifts.import.destination.client_placeholder")}
                value={draft.clientId}
                onChange={(event) => set({ clientId: event.target.value })}
                options={context.clients.map((c) => ({ value: c.id, label: c.name }))}
              />
            ) : (
              <TextField
                id="import-client-name"
                label={t("shifts.import.destination.client_name_label")}
                value={draft.newClientName}
                onChange={(event) => set({ newClientName: event.target.value })}
                error={clientExists ? t("shifts.import.destination.problem.client_exists", { name: clientExists.name }) : undefined}
                maxLength={200}
              />
            )}

            <TextField
              id="import-campaign-name"
              label={t("shifts.import.destination.campaign_name_label")}
              value={draft.newCampaignName}
              onChange={(event) => set({ newCampaignName: event.target.value })}
              maxLength={200}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField
                id="import-starts-on"
                type="date"
                label={t("shifts.import.destination.starts_on")}
                value={draft.startsOn}
                onChange={(event) => set({ startsOn: event.target.value })}
              />
              <TextField
                id="import-ends-on"
                type="date"
                label={t("shifts.import.destination.ends_on")}
                value={draft.endsOn}
                onChange={(event) => set({ endsOn: event.target.value })}
              />
              <TextField
                id="import-rate"
                inputMode="decimal"
                label={t("shifts.import.destination.rate_label")}
                hint={t("shifts.import.destination.rate_hint")}
                value={draft.rateEuros}
                onChange={(event) => set({ rateEuros: event.target.value })}
              />
            </div>
            {span ? <p className="text-xs text-[color:var(--color-muted)]">{t("shifts.import.destination.dates_from_file")}</p> : null}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <StepHeading title={t("shifts.import.destination.section_title")} description={t("shifts.import.destination.section_description")} />
        {context.programmesUnavailable ? <Banner tone="warn">{t("shifts.import.destination.sections_unavailable")}</Banner> : null}
        <fieldset className="flex flex-col gap-2 sm:flex-row">
          <legend className="sr-only">{t("shifts.import.destination.section_title")}</legend>
          <OptionChip className="flex-1">
            <input
              type="radio"
              name="import-section-mode"
              checked={programmeMode === "existing"}
              disabled={!canUseExistingSection}
              onChange={() => set({ programmeMode: "existing", programmeId: draft.programmeId || programmes[0]?.id || "" })}
              className={RADIO_CLASS}
            />
            {t("shifts.import.destination.section_existing")}
          </OptionChip>
          <OptionChip className="flex-1">
            <input
              type="radio"
              name="import-section-mode"
              checked={programmeMode === "new"}
              onChange={() => set({ programmeMode: "new" })}
              className={RADIO_CLASS}
            />
            {t("shifts.import.destination.section_new")}
          </OptionChip>
        </fieldset>

        {programmeMode === "existing" ? (
          <SelectField
            id="import-section"
            label={t("shifts.import.destination.section_label")}
            value={draft.programmeId}
            onChange={(event) => set({ programmeId: event.target.value })}
            options={programmes.map((p) => ({ value: p.id, label: p.name }))}
          />
        ) : (
          <TextField
            id="import-section-name"
            label={t("shifts.import.destination.section_name_label")}
            hint={t("shifts.import.destination.section_name_hint")}
            value={draft.newProgrammeName}
            onChange={(event) => set({ newProgrammeName: event.target.value, programmeMode: "new" })}
            maxLength={120}
          />
        )}
      </section>
    </div>
  );
}
