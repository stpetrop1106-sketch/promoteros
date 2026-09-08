import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { PageHeader, Card } from "@/components/ui";
import { updatePromoter } from "../../actions";
import { PromoterForm, type PromoterFormInitial } from "../../promoter-form";
import { ArchiveControl } from "./archive-control";

export const dynamic = "force-dynamic";

type PromoterEditRow = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  birth_year: number | null;
  home_lat: number | null;
  home_lng: number | null;
  has_car: boolean;
  has_licence: boolean;
  transport_notes: string | null;
  status: "active" | "paused" | "archived" | "blocklisted";
  promoter_areas: { area_id: string }[];
  promoter_skills: { skill_id: string; level: number }[];
};

export default async function EditPromoterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = translatorFor(DEFAULT_LOCALE);
  await requireUser();
  const db = await createServerSupabase();

  const [{ data: promoter }, { data: areas }, { data: skills }] = await Promise.all([
    db
      .from("promoters")
      .select(
        `id, full_name, phone, email, birth_year, home_lat, home_lng, has_car, has_licence,
         transport_notes, status,
         promoter_areas ( area_id ),
         promoter_skills ( skill_id, level )`,
      )
      .eq("id", id)
      .maybeSingle(),
    db.from("areas").select("id, name, city").order("name"),
    db.from("skills").select("id, name, category").order("name"),
  ]);

  if (!promoter) notFound();
  const p = promoter as unknown as PromoterEditRow;

  const initial: PromoterFormInitial = {
    id: p.id,
    fullName: p.full_name,
    phone: p.phone,
    email: p.email ?? "",
    birthYear: p.birth_year,
    lat: p.home_lat,
    lng: p.home_lng,
    hasCar: p.has_car,
    hasLicence: p.has_licence,
    transportNotes: p.transport_notes ?? "",
    status: p.status,
    areaIds: p.promoter_areas.map((a) => a.area_id),
    skills: p.promoter_skills.map((s) => ({ id: s.skill_id, level: s.level })),
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader title={t("promoters.edit.title", { name: p.full_name })} />

      <Card className="mt-6">
        <PromoterForm mode="edit" action={updatePromoter} areas={areas ?? []} skills={skills ?? []} initial={initial} />
      </Card>

      {p.status !== "archived" ? (
        <Card
          className="mt-6"
          header={<h2 className="text-sm font-semibold text-[color:var(--color-ink)]">{t("promoters.edit.archive_section_title")}</h2>}
        >
          <p className="text-sm text-[color:var(--color-muted)]">{t("promoters.edit.archive_description")}</p>
          <div className="mt-3">
            <ArchiveControl
              promoterId={p.id}
              labels={{
                start: t("promoters.edit.archive_button"),
                prompt: t("promoters.edit.archive_confirm_prompt"),
                confirm: t("promoters.edit.archive_confirm_yes"),
                cancel: t("promoters.edit.archive_confirm_cancel"),
              }}
            />
          </div>
        </Card>
      ) : (
        <p className="mt-6 text-sm text-[color:var(--color-muted)]">{t("promoters.edit.archived_notice")}</p>
      )}
    </main>
  );
}
