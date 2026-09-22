import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { athensDate } from "@/lib/exceptions";
import { EmptyState, Icon, LinkButton, PageHeader } from "@/components/ui";
import {
  buildProgrammeSummaries,
  buildUnsectionedGroup,
  campaignOptionsFrom,
  clientOptionsFrom,
  fetchProgrammeBoard,
  filterProgrammeSummaries,
  filterUnsectionedGroup,
  sortProgrammeSummaries,
  type ProgrammeWhenFilter,
} from "@/lib/programmes";
import { ImportShifts } from "@/app/shifts/import/import-shifts";
import { NewSectionForm } from "./sections/new-section-form";
import { FiltersBar } from "./sections/filters-bar";
import { SectionCard } from "./sections/section-card";
import { UnsectionedSection } from "./sections/unsectioned-section";

export const dynamic = "force-dynamic";

function readWhen(value: string | undefined): ProgrammeWhenFilter {
  return value === "upcoming" || value === "past" ? value : "all";
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * P37a — the Shifts screen as sections ("ενότητες"), one per client programme, instead of one
 * flat table. `/campaigns/[id]/page.tsx` still shows one campaign's own shifts inline; this screen
 * is the agency-wide view across every campaign, grouped the way a coordinator actually thinks
 * about the work — by the schedule a client sent, not by date.
 */
export default async function ShiftsPage({ searchParams }: { searchParams: SearchParams }) {
  const t = translatorFor(DEFAULT_LOCALE);
  await requireUser();
  const db = await createServerSupabase();

  const sp = await searchParams;
  const clientName = typeof sp.client === "string" && sp.client !== "" ? sp.client : null;
  const campaignId = typeof sp.campaign === "string" && sp.campaign !== "" ? sp.campaign : null;
  const when = readWhen(typeof sp.when === "string" ? sp.when : undefined);
  const showArchived = sp.archived === "1" || sp.archived === "true";

  const today = athensDate(new Date());

  // Two queries for the whole board (see lib/programmes.ts), plus one more here for the campaign
  // picker on "Νέα ενότητα" — every campaign the agency has, not only the ones with a section yet.
  const [{ programmes, shifts }, { data: campaignRows, error: campaignError }] = await Promise.all([
    fetchProgrammeBoard(db),
    db.from("campaigns").select("id, name").order("name", { ascending: true }),
  ]);

  if (campaignError) throw new Error(campaignError.message);

  const allSummaries = sortProgrammeSummaries(buildProgrammeSummaries(programmes, shifts, today));
  const visibleSummaries = filterProgrammeSummaries(allSummaries, {
    clientName,
    campaignId,
    when,
    showArchived,
  });

  const unsectioned = filterUnsectionedGroup(
    buildUnsectionedGroup(shifts, today),
    { clientName, campaignId, when },
    today,
  );

  const campaignOptions = (campaignRows ?? []).map((c) => ({ value: c.id, label: c.name }));
  const filterCampaignOptions = campaignOptionsFrom(programmes);
  const filterClientOptions = clientOptionsFrom(programmes);

  // A2 finding 16 — the subtitle used to pass `visibleSummaries.length` (a number of
  // *sections*) into a string that said "βάρδιες", so four sections holding 25 shifts read
  // "4 βάρδιες". Count both, each with its own singular, and say which is which. The old key
  // also promised chronological order, which `sortProgrammeSummaries` does not produce (it
  // ranks by upcoming-ness, then by descending end date) — that claim is gone with it.
  const visibleShiftCount =
    visibleSummaries.reduce((n, s) => n + s.shiftCount, 0) + unsectioned.shifts.length;

  const hasAnySection = programmes.length > 0;
  const hasVisibleContent = visibleSummaries.length > 0 || unsectioned.shifts.length > 0;
  const filtersActive = Boolean(clientName || campaignId || when !== "all" || showArchived);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 sm:py-12">
      <div className="flex flex-col gap-6">
        <PageHeader
          title={t("shifts.title")}
          subtitle={
            visibleShiftCount > 0
              ? [
                  visibleShiftCount === 1
                    ? t("shifts.list.subtitle_shifts_one")
                    : t("shifts.list.subtitle_shifts_many", { count: visibleShiftCount }),
                  visibleSummaries.length === 1
                    ? t("shifts.list.subtitle_sections_one")
                    : t("shifts.list.subtitle_sections_many", { count: visibleSummaries.length }),
                ].join(" ")
              : undefined
          }
          icon={<Icon name="calendar" size={20} />}
          actions={
            <>
              <ImportShifts />
              <NewSectionForm campaigns={campaignOptions} />
            </>
          }
        />

        {hasAnySection ? (
          <FiltersBar
            clients={filterClientOptions}
            campaigns={filterCampaignOptions}
            clientName={clientName ?? ""}
            campaignId={campaignId ?? ""}
            when={when}
            showArchived={showArchived}
          />
        ) : null}

        {!hasAnySection ? (
          <EmptyState
            icon={<Icon name="calendar" size={24} />}
            title={t("shifts.sections.empty.title")}
            description={t("shifts.sections.empty.body")}
            action={<NewSectionForm campaigns={campaignOptions} />}
          />
        ) : !hasVisibleContent ? (
          <EmptyState
            icon={<Icon name="filter" size={24} />}
            title={t("shifts.sections.filtered_empty.title")}
            description={t("shifts.sections.filtered_empty.body")}
            action={
              filtersActive ? (
                <LinkButton href="/shifts" variant="secondary">
                  {t("shifts.sections.filtered_empty.cta")}
                </LinkButton>
              ) : undefined
            }
          />
        ) : (
          <div className="flex flex-col gap-5">
            {visibleSummaries.map((section) => (
              <SectionCard key={section.id} section={section} />
            ))}
            <UnsectionedSection group={unsectioned} />
          </div>
        )}
      </div>
    </main>
  );
}
