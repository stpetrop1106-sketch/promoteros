import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { PageHeader, Card, LinkButton } from "@/components/ui";
import { listCampaignProgrammes } from "@/lib/programmes";
import { ShiftSeriesForm } from "./shift-series-form";

export const dynamic = "force-dynamic";

type NewShiftsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewShiftsPage({ params, searchParams }: NewShiftsPageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const t = translatorFor(DEFAULT_LOCALE);
  await requireUser();
  const db = await createServerSupabase();

  const { data: campaign } = await db.from("campaigns").select("id, name, client_id").eq("id", id).maybeSingle();
  if (!campaign) notFound();

  const [{ data: stores, error: storesErr }, programmes] = await Promise.all([
    db
      .from("stores")
      .select("id, name, address")
      .or(`client_id.eq.${campaign.client_id},client_id.is.null`)
      .order("name", { ascending: true }),
    listCampaignProgrammes(db, id),
  ]);

  if (storesErr) throw new Error(storesErr.message);

  const storeOptions = (stores ?? []).map((s) => ({
    value: s.id,
    label: s.address ? `${s.name} — ${s.address}` : s.name,
  }));

  const programmeOptions = programmes.map((p) => ({ value: p.id, label: p.name }));

  // `?programme=` from a section's own "add shifts" button wins when it is still a real,
  // non-archived section of this campaign; otherwise default to the most recent one
  // (`listCampaignProgrammes` orders newest first), so the common case — "add more to the
  // section I was just looking at" — never makes the coordinator pick again.
  const requestedProgramme = typeof sp.programme === "string" ? sp.programme : undefined;
  const defaultProgrammeId =
    requestedProgramme && programmes.some((p) => p.id === requestedProgramme)
      ? requestedProgramme
      : (programmes[0]?.id ?? undefined);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <PageHeader
        title={t("campaigns.shifts_new.title")}
        subtitle={t("campaigns.shifts_new.subtitle", { campaign: campaign.name })}
        actions={
          <LinkButton href={`/campaigns/${id}`} variant="ghost" size="sm">
            {t("campaigns.shifts_new.back")}
          </LinkButton>
        }
      />

      <Card className="mt-8" elevation="raised">
        <ShiftSeriesForm
          campaignId={id}
          stores={storeOptions}
          programmes={programmeOptions}
          defaultProgrammeId={defaultProgrammeId}
        />
      </Card>
    </main>
  );
}
