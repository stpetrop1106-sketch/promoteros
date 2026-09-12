import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { PageHeader, Card, LinkButton } from "@/components/ui";
import { ShiftSeriesForm } from "./shift-series-form";

export const dynamic = "force-dynamic";

export default async function NewShiftsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = translatorFor(DEFAULT_LOCALE);
  await requireUser();
  const db = await createServerSupabase();

  const { data: campaign } = await db.from("campaigns").select("id, name, client_id").eq("id", id).maybeSingle();
  if (!campaign) notFound();

  const { data: stores, error: storesErr } = await db
    .from("stores")
    .select("id, name, address")
    .or(`client_id.eq.${campaign.client_id},client_id.is.null`)
    .order("name", { ascending: true });

  if (storesErr) throw new Error(storesErr.message);

  const storeOptions = (stores ?? []).map((s) => ({
    value: s.id,
    label: s.address ? `${s.name} — ${s.address}` : s.name,
  }));

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
        <ShiftSeriesForm campaignId={id} stores={storeOptions} />
      </Card>
    </main>
  );
}
