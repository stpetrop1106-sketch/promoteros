import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { PageHeader, Card, LinkButton } from "@/components/ui";
import { CampaignForm } from "./campaign-form";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const t = translatorFor(DEFAULT_LOCALE);
  await requireUser();
  const db = await createServerSupabase();

  const [{ data: clients, error: clientsErr }, { data: skills, error: skillsErr }] = await Promise.all([
    db.from("clients").select("id, name").order("name", { ascending: true }),
    db.from("skills").select("id, name").order("name", { ascending: true }),
  ]);

  if (clientsErr) throw new Error(clientsErr.message);
  if (skillsErr) throw new Error(skillsErr.message);

  const clientOptions = (clients ?? []).map((c) => ({ value: c.id, label: c.name }));

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <PageHeader
        title={t("campaigns.new.title")}
        subtitle={t("campaigns.new.subtitle")}
        actions={
          <LinkButton href="/campaigns" variant="ghost" size="sm">
            {t("campaigns.detail.back")}
          </LinkButton>
        }
      />

      <Card className="mt-8" elevation="raised">
        <CampaignForm clients={clientOptions} skills={skills ?? []} />
      </Card>
    </main>
  );
}
