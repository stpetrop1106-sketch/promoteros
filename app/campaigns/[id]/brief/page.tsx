import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { PageHeader } from "@/components/ui";
import { BriefForm } from "./brief-form";

export const dynamic = "force-dynamic";

export default async function CampaignBriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = translatorFor(DEFAULT_LOCALE);
  await requireUser();
  const db = await createServerSupabase();

  const { data: campaign } = await db.from("campaigns").select("id, name").eq("id", id).maybeSingle();
  if (!campaign) notFound();

  const { data: brief } = await db
    .from("briefs")
    .select("title, body_md")
    .eq("campaign_id", id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href={`/campaigns/${id}`} className="text-sm text-[color:var(--color-accent)] hover:underline">
        {t("campaigns.brief.back")}
      </Link>

      <PageHeader
        className="mt-4"
        title={t("campaigns.brief.title")}
        subtitle={t("campaigns.brief.subtitle", { campaign: campaign.name })}
      />

      <div className="mt-8">
        <BriefForm
          t={t}
          campaignId={id}
          initialTitle={brief?.title ?? t("campaigns.brief.default_title", { campaign: campaign.name })}
          initialBody={brief?.body_md ?? ""}
        />
      </div>
    </main>
  );
}
