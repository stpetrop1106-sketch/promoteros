import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { PageHeader, Card, LinkButton, Icon } from "@/components/ui";
import { createPromoter } from "../actions";
import { PromoterForm } from "../promoter-form";

export const dynamic = "force-dynamic";

export default async function NewPromoterPage() {
  const t = translatorFor(DEFAULT_LOCALE);
  await requireUser();
  const db = await createServerSupabase();

  const [{ data: areas }, { data: skills }] = await Promise.all([
    db.from("areas").select("id, name, city").order("name"),
    db.from("skills").select("id, name, category").order("name"),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <PageHeader
        title={t("promoters.new.title")}
        subtitle={t("promoters.new.subtitle")}
        actions={
          <LinkButton href="/promoters" variant="ghost" size="sm" iconLeft={<Icon name="chevronLeft" size={16} />}>
            {t("promoters.new.back")}
          </LinkButton>
        }
      />

      <Card className="mt-8" elevation="raised">
        <PromoterForm mode="create" action={createPromoter} areas={areas ?? []} skills={skills ?? []} />
      </Card>
    </main>
  );
}
