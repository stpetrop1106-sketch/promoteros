import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { PageHeader } from "@/components/ui";
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
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href={`/campaigns/${id}`} className="text-sm text-[color:var(--color-accent)] hover:underline">
        {t("campaigns.shifts_new.back")}
      </Link>

      <PageHeader
        className="mt-4"
        title={t("campaigns.shifts_new.title")}
        subtitle={t("campaigns.shifts_new.subtitle", { campaign: campaign.name })}
      />

      <div className="mt-8">
        <ShiftSeriesForm t={t} campaignId={id} stores={storeOptions} />
      </div>
    </main>
  );
}
