"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { TextField, SelectField, TextArea, Button, Badge } from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { geocodeAddress, IDLE_STATE, type PromoterFormState } from "./actions";
import type { GeocodeResult } from "@/lib/geocoding";

const t = translatorFor(DEFAULT_LOCALE);

export type AreaOption = { id: string; name: string; city: string };
export type SkillOption = { id: string; name: string; category: string | null };

export type PromoterFormInitial = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  birthYear: number | null;
  lat: number | null;
  lng: number | null;
  hasCar: boolean;
  hasLicence: boolean;
  transportNotes: string;
  status: "active" | "paused" | "archived" | "blocklisted";
  areaIds: string[];
  skills: { id: string; level: number }[];
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}

function GeocodeResultBox({ result }: { result: GeocodeResult }) {
  const low = result.confidence === "low";
  return (
    <div
      className={
        "rounded-lg border px-3 py-2 text-sm " +
        (low
          ? "border-[color:var(--color-warn)] bg-[color:var(--color-warn)]/10"
          : "border-[color:var(--color-ok)] bg-[color:var(--color-ok)]/10")
      }
    >
      <p className="font-medium text-[color:var(--color-ink)]">
        {low ? t("promoters.form.geocode_found_low") : t("promoters.form.geocode_found")}
      </p>
      <p className="mt-0.5 text-[color:var(--color-muted)]">{result.formattedAddress}</p>
      <p className="mt-0.5 text-xs text-[color:var(--color-muted)]">
        {result.coordinates.lat.toFixed(5)}, {result.coordinates.lng.toFixed(5)}
      </p>
    </div>
  );
}

export function PromoterForm({
  mode,
  action,
  areas,
  skills,
  initial,
}: {
  mode: "create" | "edit";
  action: (state: PromoterFormState, formData: FormData) => Promise<PromoterFormState>;
  areas: AreaOption[];
  skills: SkillOption[];
  initial?: PromoterFormInitial;
}) {
  const [state, formAction] = useActionState<PromoterFormState, FormData>(action, IDLE_STATE);

  const [address, setAddress] = useState("");
  const [lat, setLat] = useState(initial?.lat != null ? String(initial.lat) : "");
  const [lng, setLng] = useState(initial?.lng != null ? String(initial.lng) : "");
  const [geocodeState, setGeocodeState] = useState<
    { status: "idle" } | { status: "loading" } | { status: "found"; result: GeocodeResult } | { status: "not_found" }
  >({ status: "idle" });
  const [isPending, startTransition] = useTransition();

  function handleGeocode() {
    if (!address.trim()) return;
    setGeocodeState({ status: "loading" });
    startTransition(async () => {
      const result = await geocodeAddress(address);
      if (result) {
        setLat(String(result.coordinates.lat));
        setLng(String(result.coordinates.lng));
        setGeocodeState({ status: "found", result });
      } else {
        setGeocodeState({ status: "not_found" });
      }
    });
  }

  const initialSkillLevels = new Map((initial?.skills ?? []).map((s) => [s.id, s.level]));
  const statusOptions =
    initial?.status === "archived" || initial?.status === "blocklisted"
      ? (["active", "paused", "archived", "blocklisted"] as const)
      : (["active", "paused"] as const);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {mode === "edit" && initial ? <input type="hidden" name="promoterId" value={initial.id} /> : null}

      {state.status === "duplicate" && state.duplicate ? (
        <div className="rounded-lg border border-[color:var(--color-bad)] bg-[color:var(--color-bad)]/10 px-4 py-3 text-sm text-[color:var(--color-ink)]">
          <p>{t("promoters.errors.duplicate_phone")}</p>
          <Link
            href={`/promoters/${state.duplicate.id}`}
            className="mt-1 inline-block font-medium text-[color:var(--color-accent)] hover:underline"
          >
            {state.duplicate.fullName} — {t("promoters.errors.duplicate_phone_link")}
          </Link>
        </div>
      ) : null}

      {state.status === "error" && state.errors?.general ? (
        <div className="rounded-lg border border-[color:var(--color-bad)] bg-[color:var(--color-bad)]/10 px-4 py-3 text-sm text-[color:var(--color-ink)]">
          {state.errors.general}
        </div>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">{t("promoters.form.section_basics")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="fullName"
            name="fullName"
            label={t("promoters.form.full_name")}
            required
            defaultValue={initial?.fullName}
            error={state.status === "error" ? state.errors?.fullName : undefined}
          />
          <TextField
            id="phone"
            name="phone"
            label={t("promoters.form.phone")}
            hint={t("promoters.form.phone_hint")}
            required
            defaultValue={initial?.phone}
            error={state.status === "error" ? state.errors?.phone : undefined}
          />
          <TextField
            id="email"
            name="email"
            type="email"
            label={t("promoters.form.email")}
            defaultValue={initial?.email}
            error={state.status === "error" ? state.errors?.email : undefined}
          />
          <TextField
            id="birthYear"
            name="birthYear"
            type="number"
            inputMode="numeric"
            label={t("promoters.form.birth_year")}
            defaultValue={initial?.birthYear ?? undefined}
            error={state.status === "error" ? state.errors?.birthYear : undefined}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4 border-t border-[color:var(--color-line)] pt-6">
        <div>
          <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">{t("promoters.form.section_address")}</h2>
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">{t("promoters.form.address_intro")}</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <TextField
            id="address"
            label={t("promoters.form.address_label")}
            placeholder={t("promoters.form.address_placeholder")}
            containerClassName="flex-1"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <Button
            type="button"
            variant="secondary"
            loading={isPending}
            disabled={!address.trim()}
            onClick={handleGeocode}
          >
            {t("promoters.form.geocode_button")}
          </Button>
        </div>

        {geocodeState.status === "found" ? <GeocodeResultBox result={geocodeState.result} /> : null}

        {geocodeState.status === "not_found" ? (
          <p className="text-sm text-[color:var(--color-muted)]">{t("promoters.form.geocode_not_found")}</p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="lat"
            name="lat"
            type="number"
            step="any"
            label={t("promoters.form.lat_label")}
            hint={t("promoters.form.manual_coords_hint")}
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            error={state.status === "error" ? state.errors?.lat : undefined}
          />
          <TextField
            id="lng"
            name="lng"
            type="number"
            step="any"
            label={t("promoters.form.lng_label")}
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            error={state.status === "error" ? state.errors?.lng : undefined}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4 border-t border-[color:var(--color-line)] pt-6">
        <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">{t("promoters.form.section_transport")}</h2>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm text-[color:var(--color-ink)]">
            <input
              type="checkbox"
              name="hasCar"
              defaultChecked={initial?.hasCar}
              className="size-4 rounded border-[color:var(--color-line)] accent-[color:var(--color-accent)]"
            />
            {t("promoters.form.has_car_label")}
          </label>
          <label className="flex items-center gap-2 text-sm text-[color:var(--color-ink)]">
            <input
              type="checkbox"
              name="hasLicence"
              defaultChecked={initial?.hasLicence}
              className="size-4 rounded border-[color:var(--color-line)] accent-[color:var(--color-accent)]"
            />
            {t("promoters.form.has_licence_label")}
          </label>
        </div>
        <TextArea
          id="transportNotes"
          name="transportNotes"
          label={t("promoters.form.transport_notes_label")}
          defaultValue={initial?.transportNotes}
          rows={2}
        />
      </section>

      <section className="flex flex-col gap-3 border-t border-[color:var(--color-line)] pt-6">
        <div>
          <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">{t("promoters.form.section_areas")}</h2>
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">{t("promoters.form.areas_hint")}</p>
        </div>
        {areas.length === 0 ? (
          <p className="text-sm text-[color:var(--color-muted)]">{t("promoters.form.no_areas_configured")}</p>
        ) : (
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {areas.map((area) => (
              <label key={area.id} className="flex items-center gap-2 text-sm text-[color:var(--color-ink)]">
                <input
                  type="checkbox"
                  name="area_id"
                  value={area.id}
                  defaultChecked={initial?.areaIds.includes(area.id)}
                  className="size-4 rounded border-[color:var(--color-line)] accent-[color:var(--color-accent)]"
                />
                {area.name}
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-[color:var(--color-line)] pt-6">
        <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">{t("promoters.form.section_skills")}</h2>
        {skills.length === 0 ? (
          <p className="text-sm text-[color:var(--color-muted)]">{t("promoters.form.no_skills_configured")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {skills.map((skill) => (
              <div key={skill.id} className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex min-w-48 flex-1 items-center gap-2 text-[color:var(--color-ink)]">
                  <input
                    type="checkbox"
                    name="skill_id"
                    value={skill.id}
                    defaultChecked={initialSkillLevels.has(skill.id)}
                    className="size-4 rounded border-[color:var(--color-line)] accent-[color:var(--color-accent)]"
                  />
                  {skill.name}
                </label>
                <select
                  name={`skill_level_${skill.id}`}
                  defaultValue={String(initialSkillLevels.get(skill.id) ?? 2)}
                  aria-label={t("promoters.form.level_label")}
                  className="h-8 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-2 text-sm text-[color:var(--color-ink)]"
                >
                  <option value="1">{t("promoters.form.level_1")}</option>
                  <option value="2">{t("promoters.form.level_2")}</option>
                  <option value="3">{t("promoters.form.level_3")}</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4 border-t border-[color:var(--color-line)] pt-6">
        <SelectField
          id="status"
          name="status"
          label={t("promoters.form.status_label")}
          defaultValue={initial?.status ?? "active"}
          containerClassName="max-w-xs"
          options={statusOptions.map((value) => ({ value, label: t(`promoters.status.${value}`) }))}
        />
        {initial && (initial.status === "archived" || initial.status === "blocklisted") ? (
          <Badge variant="warn" className="w-fit">
            {t("promoters.form.reactivate_hint")}
          </Badge>
        ) : null}
      </section>

      <div className="flex items-center gap-3 border-t border-[color:var(--color-line)] pt-6">
        <SubmitButton label={mode === "create" ? t("promoters.form.save_new") : t("promoters.form.save_changes")} />
        <Link
          href={initial ? `/promoters/${initial.id}` : "/promoters"}
          className="text-sm text-[color:var(--color-muted)] hover:underline"
        >
          {t("common.cancel")}
        </Link>
      </div>
    </form>
  );
}
