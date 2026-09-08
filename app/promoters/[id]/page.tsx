import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { PageHeader, Card, Badge, ScoreBar, Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui";
import type { BadgeVariant } from "@/components/ui";
import { LinkButton } from "../link-button";

export const dynamic = "force-dynamic";

type PromoterStatus = "active" | "paused" | "archived" | "blocklisted";

type PromoterDetail = {
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
  status: PromoterStatus;
  reliability_score: number;
  promoter_areas: { area: { id: string; name: string; city: string } | null }[];
  promoter_skills: { level: number; skill: { id: string; name: string } | null }[];
};

type ClientHistoryRow = {
  client_id: string;
  shifts_completed: number;
  last_worked_on: string | null;
  avg_rating: number | null;
  client: { name: string } | null;
};

type AssignmentRow = {
  id: string;
  status: string;
  shift: {
    id: string;
    on_date: string;
    start_time: string;
    end_time: string;
    store: { name: string } | null;
    campaign: { name: string } | null;
  } | null;
};

const STATUS_BADGE: Record<PromoterStatus, BadgeVariant> = {
  active: "ok",
  paused: "warn",
  archived: "neutral",
  blocklisted: "bad",
};

export default async function PromoterProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = translatorFor(DEFAULT_LOCALE);
  await requireUser();
  const db = await createServerSupabase();

  const [{ data: promoter }, { data: history }, { data: assignments }] = await Promise.all([
    db
      .from("promoters")
      .select(
        `id, full_name, phone, email, birth_year, home_lat, home_lng, has_car, has_licence,
         transport_notes, status, reliability_score,
         promoter_areas ( area:areas ( id, name, city ) ),
         promoter_skills ( level, skill:skills ( id, name ) )`,
      )
      .eq("id", id)
      .maybeSingle(),
    db
      .from("promoter_client_history")
      .select("client_id, shifts_completed, last_worked_on, avg_rating, client:clients(name)")
      .eq("promoter_id", id),
    db
      .from("assignments")
      .select(
        `id, status, shift:shifts ( id, on_date, start_time, end_time, store:stores(name), campaign:campaigns(name) )`,
      )
      .eq("promoter_id", id),
  ]);

  if (!promoter) notFound();

  const p = promoter as unknown as PromoterDetail;
  const clientHistory = (history ?? []) as unknown as ClientHistoryRow[];
  const allAssignments = (assignments ?? []) as unknown as AssignmentRow[];

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = allAssignments
    .filter((a) => a.shift && a.shift.on_date >= today)
    .sort((a, b) => (a.shift!.on_date < b.shift!.on_date ? -1 : 1));
  const past = allAssignments
    .filter((a) => a.shift && a.shift.on_date < today)
    .sort((a, b) => (a.shift!.on_date > b.shift!.on_date ? -1 : 1));

  const missingCoords = p.home_lat == null || p.home_lng == null;

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <PageHeader
        title={p.full_name}
        subtitle={`${p.phone}`}
        actions={
          <>
            <LinkButton href={`/promoters/${p.id}/edit`} variant="secondary">
              {t("promoters.profile.edit_button")}
            </LinkButton>
            <LinkButton href={`/promoters/${p.id}/availability`} variant="secondary">
              {t("promoters.profile.availability_button")}
            </LinkButton>
          </>
        }
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge variant={STATUS_BADGE[p.status]}>{t(`promoters.status.${p.status}`)}</Badge>
      </div>

      {missingCoords ? (
        <div className="mt-4 rounded-lg border border-[color:var(--color-warn)] bg-[color:var(--color-warn)]/10 px-4 py-3 text-sm text-[color:var(--color-ink)]">
          {t("promoters.profile.missing_coordinates_banner")}{" "}
          <Link href={`/promoters/${p.id}/edit`} className="font-medium text-[color:var(--color-accent)] hover:underline">
            {t("promoters.profile.edit_button")}
          </Link>
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <Card header={<h2 className="text-sm font-semibold">{t("promoters.profile.details_title")}</h2>}>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[color:var(--color-muted)]">{t("promoters.form.email")}</dt>
              <dd className="text-[color:var(--color-ink)]">{p.email ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[color:var(--color-muted)]">{t("promoters.form.birth_year")}</dt>
              <dd className="text-[color:var(--color-ink)]">{p.birth_year ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[color:var(--color-muted)]">{t("promoters.form.has_car_label")}</dt>
              <dd className="text-[color:var(--color-ink)]">{p.has_car ? t("promoters.value_yes") : t("promoters.value_no")}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[color:var(--color-muted)]">{t("promoters.form.has_licence_label")}</dt>
              <dd className="text-[color:var(--color-ink)]">{p.has_licence ? t("promoters.value_yes") : t("promoters.value_no")}</dd>
            </div>
            {p.transport_notes ? (
              <div className="flex flex-col gap-1">
                <dt className="text-[color:var(--color-muted)]">{t("promoters.form.transport_notes_label")}</dt>
                <dd className="text-[color:var(--color-ink)]">{p.transport_notes}</dd>
              </div>
            ) : null}
            <div className="flex flex-col gap-1 pt-2">
              <dt className="text-[color:var(--color-muted)]">{t("promoters.profile.reliability_label")}</dt>
              <dd>
                <ScoreBar value={p.reliability_score} size="sm" label={t("promoters.table.reliability_aria", { name: p.full_name })} />
              </dd>
            </div>
          </dl>
        </Card>

        <Card header={<h2 className="text-sm font-semibold">{t("promoters.profile.areas_title")}</h2>}>
          {p.promoter_areas.length === 0 ? (
            <p className="text-sm text-[color:var(--color-muted)]">{t("promoters.profile.no_areas")}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {p.promoter_areas.map((pa) =>
                pa.area ? (
                  <Badge key={pa.area.id} variant="neutral">
                    {pa.area.name}
                  </Badge>
                ) : null,
              )}
            </div>
          )}
        </Card>

        <Card header={<h2 className="text-sm font-semibold">{t("promoters.profile.skills_title")}</h2>} className="sm:col-span-2">
          {p.promoter_skills.length === 0 ? (
            <p className="text-sm text-[color:var(--color-muted)]">{t("promoters.profile.no_skills")}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {p.promoter_skills.map((ps) =>
                ps.skill ? (
                  <Badge key={ps.skill.id} variant="info">
                    {ps.skill.name} · {t(`promoters.form.level_${ps.level as 1 | 2 | 3}`)}
                  </Badge>
                ) : null,
              )}
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-6" header={<h2 className="text-sm font-semibold">{t("promoters.profile.client_history_title")}</h2>}>
        {clientHistory.length === 0 ? (
          <p className="text-sm text-[color:var(--color-muted)]">{t("promoters.profile.client_history_empty")}</p>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t("promoters.profile.table.client")}</TableHeaderCell>
                <TableHeaderCell>{t("promoters.profile.table.shifts_completed")}</TableHeaderCell>
                <TableHeaderCell>{t("promoters.profile.table.last_worked")}</TableHeaderCell>
                <TableHeaderCell>{t("promoters.profile.table.avg_rating")}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {clientHistory.map((h) => (
                <TableRow key={h.client_id}>
                  <TableCell>{h.client?.name ?? "—"}</TableCell>
                  <TableCell>{h.shifts_completed}</TableCell>
                  <TableCell>{h.last_worked_on ?? "—"}</TableCell>
                  <TableCell>{h.avg_rating != null ? h.avg_rating.toFixed(1) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card className="mt-6" header={<h2 className="text-sm font-semibold">{t("promoters.profile.upcoming_shifts_title")}</h2>}>
        {upcoming.length === 0 ? (
          <p className="text-sm text-[color:var(--color-muted)]">{t("promoters.profile.upcoming_empty")}</p>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t("shifts.date")}</TableHeaderCell>
                <TableHeaderCell>{t("shifts.campaign")}</TableHeaderCell>
                <TableHeaderCell>{t("shifts.store")}</TableHeaderCell>
                <TableHeaderCell>{t("promoters.profile.table.assignment_status")}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {upcoming.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Link href={`/shifts/${a.shift!.id}`} className="text-[color:var(--color-accent)] hover:underline">
                      {a.shift!.on_date} · {a.shift!.start_time.slice(0, 5)}–{a.shift!.end_time.slice(0, 5)}
                    </Link>
                  </TableCell>
                  <TableCell>{a.shift?.campaign?.name ?? "—"}</TableCell>
                  <TableCell>{a.shift?.store?.name ?? "—"}</TableCell>
                  <TableCell>{a.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card className="mt-6" header={<h2 className="text-sm font-semibold">{t("promoters.profile.past_shifts_title")}</h2>}>
        {past.length === 0 ? (
          <p className="text-sm text-[color:var(--color-muted)]">{t("promoters.profile.past_empty")}</p>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t("shifts.date")}</TableHeaderCell>
                <TableHeaderCell>{t("shifts.campaign")}</TableHeaderCell>
                <TableHeaderCell>{t("shifts.store")}</TableHeaderCell>
                <TableHeaderCell>{t("promoters.profile.table.assignment_status")}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {past.slice(0, 20).map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    {a.shift!.on_date} · {a.shift!.start_time.slice(0, 5)}–{a.shift!.end_time.slice(0, 5)}
                  </TableCell>
                  <TableCell>{a.shift?.campaign?.name ?? "—"}</TableCell>
                  <TableCell>{a.shift?.store?.name ?? "—"}</TableCell>
                  <TableCell>{a.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </main>
  );
}
