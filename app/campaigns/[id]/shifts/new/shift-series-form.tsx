"use client";

import { useActionState, useMemo, useState } from "react";
import { SelectField, TextField, type SelectOption } from "@/components/ui";
import type { TranslationKey } from "@/lib/i18n";
import { SubmitButton } from "@/app/campaigns/submit-button";
import { WEEKDAYS, WEEKDAY_KEY, expandSeriesDates } from "@/app/campaigns/_shared";
import { createShifts, type ShiftFormState } from "./actions";

const INITIAL_STATE: ShiftFormState = { status: "idle" };

export function ShiftSeriesForm({
  t,
  campaignId,
  stores,
}: {
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  campaignId: string;
  stores: SelectOption[];
}) {
  const [state, formAction] = useActionState(createShifts, INITIAL_STATE);
  const [storeMode, setStoreMode] = useState<"existing" | "new">(stores.length > 0 ? "existing" : "new");
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

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold text-[color:var(--color-ink)]">
          {t("campaigns.shifts_new.section_store")}
        </legend>

        <div className="flex flex-wrap gap-4 text-sm text-[color:var(--color-ink)]">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="storeMode"
              value="existing"
              checked={storeMode === "existing"}
              onChange={() => setStoreMode("existing")}
              disabled={stores.length === 0}
            />
            {t("campaigns.shifts_new.store_existing")}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="storeMode"
              value="new"
              checked={storeMode === "new"}
              onChange={() => setStoreMode("new")}
            />
            {t("campaigns.shifts_new.store_new")}
          </label>
        </div>

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
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold text-[color:var(--color-ink)]">
          {t("campaigns.shifts_new.section_schedule")}
        </legend>

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

        <div>
          <p className="text-sm font-medium text-[color:var(--color-ink)]">{t("campaigns.shifts_new.weekdays_label")}</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {WEEKDAYS.map((day) => (
              <label key={day} className="flex items-center gap-1.5 text-sm text-[color:var(--color-ink)]">
                <input
                  type="checkbox"
                  name="weekdays"
                  value={day}
                  checked={weekdays.has(day)}
                  onChange={() => toggleWeekday(day)}
                />
                {t(WEEKDAY_KEY[day])}
              </label>
            ))}
          </div>
          {errorFor("weekdays") ? (
            <p role="alert" className="mt-1 text-xs font-medium text-[color:var(--color-bad)]">
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

        <p className="text-sm font-medium text-[color:var(--color-accent)]">
          {previewCount > 0
            ? t("campaigns.shifts_new.preview_count", { count: previewCount })
            : t("campaigns.shifts_new.preview_none")}
        </p>
      </fieldset>

      <div>
        <SubmitButton
          label={t("campaigns.shifts_new.submit")}
          pendingLabel={t("campaigns.shifts_new.submitting")}
        />
      </div>
    </form>
  );
}
