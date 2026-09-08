import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import {
  PageHeader,
  Button,
  Badge,
  EmptyState,
  ScoreBar,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
  TextField,
  SelectField,
} from "@/components/ui";
import type { BadgeVariant } from "@/components/ui";
import { LinkButton } from "./link-button";

export const dynamic = "force-dynamic";

type PromoterStatus = "active" | "paused" | "archived" | "blocklisted";

type PromoterRow = {
  id: string;
  full_name: string;
  phone: string;
  status: PromoterStatus;
  has_car: boolean;
  has_licence: boolean;
  home_lat: number | null;
  home_lng: number | null;
  reliability_score: number;
  promoter_areas: { area: { id: string; name: string } | null }[];
  promoter_skills: { level: number; skill: { id: string; name: string } | null }[];
};

type AreaOption = { id: string; name: string };
type SkillOption = { id: string; name: string };

const STATUS_BADGE: Record<PromoterStatus, BadgeVariant> = {
  active: "ok",
  paused: "warn",
  archived: "neutral",
  blocklisted: "bad",
};

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function PromotersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const t = translatorFor(DEFAULT_LOCALE);
  await requireUser();
  const db = await createServerSupabase();

  const q = first(sp.q).trim().toLowerCase();
  const statusFilter = first(sp.status);
  const areaFilter = first(sp.area);
  const skillFilter = first(sp.skill);
  const carFilter = first(sp.car); // "" | "yes" | "no"

  const [{ data: promoters, error }, { data: areas }, { data: skills }] = await Promise.all([
    db
      .from("promoters")
      .select(
        `id, full_name, phone, status, has_car, has_licence, home_lat, home_lng, reliability_score,
         promoter_areas ( area:areas ( id, name ) ),
         promoter_skills ( level, skill:skills ( id, name ) )`,
      )
      .order("full_name")
      .limit(1000),
    db.from("areas").select("id, name").order("name"),
    db.from("skills").select("id, name").order("name"),
  ]);

  if (error) throw new Error(error.message);

  const all = (promoters ?? []) as unknown as PromoterRow[];
  const areaOptions = (areas ?? []) as unknown as AreaOption[];
  const skillOptions = (skills ?? []) as unknown as SkillOption[];

  const filtered = all.filter((p) => {
    if (q && !(p.full_name.toLowerCase().includes(q) || p.phone.toLowerCase().includes(q))) return false;
    if (statusFilter && p.status !== statusFilter) return false;
    if (areaFilter && !p.promoter_areas.some((pa) => pa.area?.id === areaFilter)) return false;
    if (skillFilter && !p.promoter_skills.some((ps) => ps.skill?.id === skillFilter)) return false;
    if (carFilter === "yes" && !p.has_car) return false;
    if (carFilter === "no" && p.has_car) return false;
    return true;
  });

  const hasAnyFilter = Boolean(q || statusFilter || areaFilter || skillFilter || carFilter);
  const totalCount = all.length;

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <PageHeader
        title={t("nav.promoters")}
        subtitle={
          totalCount > 0
            ? t("promoters.list.subtitle", { count: totalCount })
            : undefined
        }
        actions={<LinkButton href="/promoters/new">{t("promoters.add")}</LinkButton>}
      />

      {totalCount > 0 && totalCount < 5 ? (
        <p className="mt-3 text-sm text-[color:var(--color-warn)]">{t("promoters.list.low_count_hint")}</p>
      ) : null}

      {totalCount > 0 ? (
        <form className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4" method="get">
          <TextField
            id="q"
            name="q"
            label={t("promoters.filter.search_label")}
            placeholder={t("promoters.filter.search_placeholder")}
            defaultValue={q}
            containerClassName="w-56"
          />
          <SelectField
            id="status"
            name="status"
            label={t("promoters.filter.status_label")}
            defaultValue={statusFilter}
            containerClassName="w-44"
            options={[
              { value: "", label: t("promoters.filter.all_statuses") },
              { value: "active", label: t("promoters.status.active") },
              { value: "paused", label: t("promoters.status.paused") },
              { value: "archived", label: t("promoters.status.archived") },
              { value: "blocklisted", label: t("promoters.status.blocklisted") },
            ]}
          />
          <SelectField
            id="area"
            name="area"
            label={t("promoters.filter.area_label")}
            defaultValue={areaFilter}
            containerClassName="w-44"
            options={[
              { value: "", label: t("promoters.filter.all_areas") },
              ...areaOptions.map((a) => ({ value: a.id, label: a.name })),
            ]}
          />
          <SelectField
            id="skill"
            name="skill"
            label={t("promoters.filter.skill_label")}
            defaultValue={skillFilter}
            containerClassName="w-44"
            options={[
              { value: "", label: t("promoters.filter.all_skills") },
              ...skillOptions.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
          <SelectField
            id="car"
            name="car"
            label={t("promoters.filter.car_label")}
            defaultValue={carFilter}
            containerClassName="w-36"
            options={[
              { value: "", label: t("promoters.filter.car_any") },
              { value: "yes", label: t("promoters.filter.car_yes") },
              { value: "no", label: t("promoters.filter.car_no") },
            ]}
          />
          <Button type="submit" variant="secondary">
            {t("promoters.filter.apply")}
          </Button>
          {hasAnyFilter ? (
            <Link href="/promoters" className="text-sm text-[color:var(--color-muted)] hover:underline">
              {t("promoters.filter.clear")}
            </Link>
          ) : null}
        </form>
      ) : null}

      <div className="mt-6">
        {totalCount === 0 ? (
          <EmptyState
            title={t("promoters.empty.title")}
            description={t("promoters.empty.description")}
            action={<LinkButton href="/promoters/new">{t("promoters.add")}</LinkButton>}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={t("promoters.empty_filtered.title")}
            description={t("promoters.empty_filtered.description")}
            action={
              <Link href="/promoters" className="text-sm font-medium text-[color:var(--color-accent)] hover:underline">
                {t("promoters.filter.clear")}
              </Link>
            }
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t("promoters.table.name")}</TableHeaderCell>
                <TableHeaderCell>{t("promoters.table.phone")}</TableHeaderCell>
                <TableHeaderCell>{t("promoters.table.areas")}</TableHeaderCell>
                <TableHeaderCell>{t("promoters.table.transport")}</TableHeaderCell>
                <TableHeaderCell>{t("promoters.table.skills")}</TableHeaderCell>
                <TableHeaderCell>{t("promoters.table.reliability")}</TableHeaderCell>
                <TableHeaderCell>{t("promoters.table.status")}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((p) => {
                const missingCoords = p.home_lat == null || p.home_lng == null;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/promoters/${p.id}`} className="font-medium text-[color:var(--color-accent)] hover:underline">
                        {p.full_name}
                      </Link>
                      {missingCoords ? (
                        <div className="mt-1">
                          <Badge variant="warn">{t("promoters.missing_coordinates")}</Badge>
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>{p.phone}</TableCell>
                    <TableCell>
                      {p.promoter_areas.length === 0
                        ? "—"
                        : p.promoter_areas.map((pa) => pa.area?.name).filter(Boolean).join(", ")}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {p.has_car ? <Badge variant="info">{t("promoters.form.has_car_label")}</Badge> : null}
                        {p.has_licence ? <Badge variant="neutral">{t("promoters.form.has_licence_label")}</Badge> : null}
                        {!p.has_car && !p.has_licence ? "—" : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {p.promoter_skills.length === 0
                        ? "—"
                        : p.promoter_skills.map((ps) => ps.skill?.name).filter(Boolean).join(", ")}
                    </TableCell>
                    <TableCell>
                      <ScoreBar
                        value={p.reliability_score}
                        size="sm"
                        label={t("promoters.table.reliability_aria", { name: p.full_name })}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[p.status]}>{t(`promoters.status.${p.status}`)}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </main>
  );
}
