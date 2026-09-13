"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SelectField } from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import type { FilterOption, ProgrammeWhenFilter } from "@/lib/programmes";

const t = translatorFor(DEFAULT_LOCALE);

const WHEN_OPTIONS: { value: ProgrammeWhenFilter; labelKey: Parameters<typeof t>[0] }[] = [
  { value: "all", labelKey: "shifts.sections.filters.when_all" },
  { value: "upcoming", labelKey: "shifts.sections.filters.when_upcoming" },
  { value: "past", labelKey: "shifts.sections.filters.when_past" },
];

/**
 * Client filters, driven by URL search params so they survive a reload — the page reads
 * `searchParams` on every request and passes the current values back in as plain data, never a
 * function, so this stays the only client piece involved.
 */
export function FiltersBar({
  clients,
  campaigns,
  clientName,
  campaignId,
  when,
  showArchived,
}: {
  clients: FilterOption[];
  campaigns: FilterOption[];
  clientName: string;
  campaignId: string;
  when: ProgrammeWhenFilter;
  showArchived: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(key: string, value: string | boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "" || value === false) params.delete(key);
    else params.set(key, String(value));
    const query = params.toString();
    router.push(query ? `/shifts?${query}` : "/shifts");
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <SelectField
        id="filter-client"
        label={t("shifts.sections.filters.client_label")}
        containerClassName="w-48"
        value={clientName}
        onChange={(e) => update("client", e.target.value)}
        options={[{ value: "", label: t("shifts.sections.filters.client_all") }, ...clients]}
      />
      <SelectField
        id="filter-campaign"
        label={t("shifts.sections.filters.campaign_label")}
        containerClassName="w-48"
        value={campaignId}
        onChange={(e) => update("campaign", e.target.value)}
        options={[{ value: "", label: t("shifts.sections.filters.campaign_all") }, ...campaigns]}
      />
      <SelectField
        id="filter-when"
        label={t("shifts.sections.filters.when_label")}
        containerClassName="w-40"
        value={when}
        onChange={(e) => update("when", e.target.value)}
        options={WHEN_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
      />
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-[color:var(--color-ink-soft)]">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => update("archived", e.target.checked)}
          className="size-4 shrink-0 accent-[color:var(--color-accent)]"
        />
        {t("shifts.sections.filters.show_archived")}
      </label>
    </div>
  );
}
