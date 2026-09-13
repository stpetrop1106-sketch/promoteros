"use client";

import { useActionState, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { SelectField, TextField, Section, Icon, type SelectOption } from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { SubmitButton } from "@/app/campaigns/submit-button";
import { WEEKDAYS, WEEKDAY_KEY, expandSeriesDates } from "@/app/campaigns/_shared";
import { createShifts, type ShiftFormState } from "./actions";

const INITIAL_STATE: ShiftFormState = { status: "idle" };

// Same fix as `app/campaigns/new/campaign-form.tsx`: a Server Component cannot pass a plain
// function prop to a Client Component. `t` used to arrive that way from
// `app/campaigns/[id]/shifts/new/page.tsx` and crashed every real request with "Functions cannot
// be passed directly to Client Components" — invisible to `npm run build` because this route is
// fully dynamic and Next never serializes its RSC payload at build time. Creating the translator
// here instead matches every other client form in this codebase.
const t = translatorFor(DEFAULT_LOCALE);

/** Same shape as `app/promoters/promoter-form.tsx`'s `Banner` and `app/campaigns/new/campaign-form.tsx`'s
 * `ErrorBanner` — kept local because `components/ui/**` is frozen. */
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

function OptionChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <label
      className={
        "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3.5 text-sm text-[color:var(--color-ink)] transition-colors duration-150 ease-[var(--ease-out-soft)] hover:border-[color:var(--color-line-strong)] hover:bg-[color:var(--color-surface-hover)] has-[:checked]:border-[color:var(--color-accent-line)] has-[:checked]:bg-[color:var(--color-accent-subtle)] has-[:checked]:text-[color:var(--color-accent-ink)] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:shadow-[var(--focus-ring)] " +
        (className ?? "flex-1")
      }
    >
      {children}
    </label>
  );
}

const RADIO_CLASS = "size-4 shrink-0 accent-[color:var(--color-accent)] outline-none";

export function ShiftSeriesForm({
  campaignId,
  stores,
  programmes,
  defaultProgrammeId,
}: {
  campaignId: string;
  stores: SelectOption[];
  /** This campaign's own, non-archived sections — the picker skips an archived one on purpose:
   * `docs/round-2-plan.md` P37a treats an archived section as hidden, not gone. */
  programmes: SelectOption[];
  /** `?programme=` from the URL when it named a real section, else the campaign's most recent
   * one. Undefined when the campaign has no section yet, which pins the mode to "new". */
  defaultProgrammeId?: string;
}) {
  const [state, formAction] = useActionState(createShifts, INITIAL_STATE);
  const [storeMode, setStoreMode] = useState<"existing" | "new">(stores.length > 0 ? "existing" : "new");
  const [programmeMode, setProgrammeMode] = useState<"existing" | "new">(
    programmes.length > 0 ? "existing" : "new",
  );
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  // Every day checked by default — the common case is "these three specific dates", not "every
  // Tuesday", so nothing should have to be unchecked to get a handful of shifts in one pass.
  const [weekdays, setWeekdays] = useState<Set<number>>(() => new Set(WEEKDAYS));

  const previewCount = useMemo(() => {
    if (!fromDate || !toDate || toDate < fromDate || weekdays.size === 0) return 0;
    return expandSeriesDates(fromDate, toDate, weekdays).length;
  }, [fromDate, toDate, weekdays]);

  function toggleWeekday(day: number) {
    setWeekdays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  const errorFor = (field: keyof NonNullable<ShiftFormState["fieldErrors"]>) =>
    state.fieldErrors?.[field] ? t(state.fieldErrors[field]!) : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-9">
      <input type="hidden" name="campaignId" value={campaignId} />

      {state.formError ? <ErrorBanner>{t(state.formError)}</ErrorBanner> : null}

      <Section title={t("campaigns.shifts_new.section_store")}>
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">{t("campaigns.shifts_new.section_store")}</legend>
            <OptionChip>
              <input
                type="radio"
                name="storeMode"
                value="existing"
                checked={storeMode === "existing"}
                onChange={() => setStoreMode("existing")}
                disabled={stores.length === 0}
                className={RADIO_CLASS}
              />
              {t("campaigns.shifts_new.store_existing")}
            </OptionChip>
            <OptionChip>
              <input
                type="radio"
                name="storeMode"
                value="new"
                checked={storeMode === "new"}
                onChange={() => setStoreMode("new")}
                className={RADIO_CLASS}
              />
              {t("campaigns.shifts_new.store_new")}
            </OptionChip>
          </fieldset>

          {stores.length === 0 ? (
            <p className="text-xs text-[color:var(--color-muted)]">{t("campaigns.shifts_new.no_stores_hint")}</p>
          ) : null}

          {storeMode === "existing" ? (
            <SelectField
              id="storeId"
              name="storeId"
              label={t("campaigns.shifts_new.store_select_label")}
              placeholder={t("campaigns.shifts_new.store_select_placeholder")}
              options={stores}
              error={errorFor("storeId")}
              required
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="newStoreName"
                name="newStoreName"
                label={t("campaigns.shifts_new.new_store_name_label")}
                error={errorFor("newStoreName")}
                required
                containerClassName="sm:col-span-2"
              />
              <TextField
                id="newStoreAddress"
                name="newStoreAddress"
                label={t("campaigns.shifts_new.new_store_address_label")}
                containerClassName="sm:col-span-2"
              />
              <TextField
                id="newStoreLat"
                name="newStoreLat"
                inputMode="decimal"
                label={t("campaigns.shifts_new.new_store_lat_label")}
                hint={t("campaigns.shifts_new.new_store_coords_hint")}
                error={errorFor("newStoreLat")}
                required
              />
              <TextField
                id="newStoreLng"
                name="newStoreLng"
                inputMode="decimal"
                label={t("campaigns.shifts_new.new_store_lng_label")}
                error={errorFor("newStoreLng")}
                required
              />
            </div>
          )}
        </div>
      </Section>

      <Section title={t("campaigns.shifts_new.section_programme")}>
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">{t("campaigns.shifts_new.section_programme")}</legend>
            <OptionChip>
              <input
                type="radio"
                name="programmeMode"
                value="existing"
                checked={programmeMode === "existing"}
                onChange={() => setProgrammeMode("existing")}
                disabled={programmes.length === 0}
                className={RADIO_CLASS}
              />
              {t("campaigns.shifts_new.programme_existing")}
            </OptionChip>
            <OptionChip>
              <input
                type="radio"
                name="programmeMode"
                value="new"
                checked={programmeMode === "new"}
                onChange={() => setProgrammeMode("new")}
                className={RADIO_CLASS}
              />
              {t("campaigns.shifts_new.programme_new")}
            </OptionChip>
          </fieldset>

          {programmes.length === 0 ? (
            <p className="text-xs text-[color:var(--color-muted)]">{t("campaigns.shifts_new.no_programmes_hint")}</p>
          ) : null}

          {programmeMode === "existing" ? (
            <SelectField
              id="programmeId"
              name="programmeId"
              label={t("campaigns.shifts_new.programme_select_label")}
              placeholder={t("campaigns.shifts_new.programme_select_placeholder")}
              options={programmes}
              defaultValue={defaultProgrammeId}
              error={errorFor("programmeId")}
              required
            />
          ) : (
            <TextField
              id="newProgrammeName"
              name="newProgrammeName"
              label={t("campaigns.shifts_new.new_programme_name_label")}
              error={errorFor("newProgrammeName")}
              required
            />
          )}
        </div>
      </Section>

      <Section title={t("campaigns.shifts_new.section_schedule")}>
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="fromDate"
              name="fromDate"
              type="date"
              label={t("campaigns.shifts_new.from_date_label")}
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              error={errorFor("fromDate")}
              required
            />
            <TextField
              id="toDate"
              name="toDate"
              type="date"
              label={t("campaigns.shifts_new.to_date_label")}
              hint={t("campaigns.shifts_new.to_date_hint")}
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              error={errorFor("toDate")}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium leading-5 text-[color:var(--color-ink)]">
              {t("campaigns.shifts_new.weekdays_label")}
            </p>
            <fieldset className="flex flex-wrap gap-1.5">
              <legend className="sr-only">{t("campaigns.shifts_new.weekdays_label")}</legend>
              {WEEKDAYS.map((day) => (
                <OptionChip key={day} className="min-w-14 flex-none justify-center px-2">
                  <input
                    type="checkbox"
                    name="weekdays"
                    value={day}
                    checked={weekdays.has(day)}
                    onChange={() => toggleWeekday(day)}
                    className="sr-only"
                  />
                  {t(WEEKDAY_KEY[day])}
                </OptionChip>
              ))}
            </fieldset>
            {errorFor("weekdays") ? (
              <p role="alert" className="text-xs font-medium leading-5 text-[color:var(--color-bad-ink)]">
                {errorFor("weekdays")}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="startTime"
              name="startTime"
              type="time"
              label={t("campaigns.shifts_new.start_time_label")}
              error={errorFor("startTime")}
              required
            />
            <TextField
              id="endTime"
              name="endTime"
              type="time"
              label={t("campaigns.shifts_new.end_time_label")}
              error={errorFor("endTime")}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="promotersRequired"
              name="promotersRequired"
              type="number"
              min={1}
              defaultValue={1}
              label={t("campaigns.shifts_new.promoters_required_label")}
              error={errorFor("promotersRequired")}
              required
            />
            <TextField
              id="rateOverrideEuros"
              name="rateOverrideEuros"
              inputMode="decimal"
              label={t("campaigns.shifts_new.rate_override_label")}
              hint={t("campaigns.shifts_new.rate_override_hint")}
              error={errorFor("rateOverrideEuros")}
            />
          </div>

          <p className="flex items-center gap-1.5 text-sm font-medium text-[color:var(--color-accent-ink)]">
            <Icon name="calendar" size={16} className="shrink-0" />
            {previewCount > 0
              ? t("campaigns.shifts_new.preview_count", { count: previewCount })
              : t("campaigns.shifts_new.preview_none")}
          </p>
        </div>
      </Section>

      <div className="border-t border-[color:var(--color-line)] pt-6">
        <SubmitButton
          label={t("campaigns.shifts_new.submit")}
          pendingLabel={t("campaigns.shifts_new.submitting")}
        />
      </div>
    </form>
  );
}
