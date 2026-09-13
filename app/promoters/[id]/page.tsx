import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";
import {
  PageHeader,
  Card,
  Badge,
  DetailList,
  Detail,
  EmptyState,
  Icon,
  ScoreBar,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "@/components/ui";
import type { BadgeVariant } from "@/components/ui";
import { LinkButton } from "../link-button";
import { AvailabilityLink } from "./availability-link";

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

/** Raw `assignments.status` values, badged rather than printed verbatim — see docs/status/P35b.md. */
const ASSIGNMENT_STATUS_BADGE: Record<string, BadgeVariant> = {
  confirmed: "ok",
  completed: "neutral",
  cancelled: "bad",
  no_show: "bad",
};

const ASSIGNMENT_STATUS_KEY: Record<string, TranslationKey> = {
  confirmed: "promoters.profile.assignment_status.confirmed",
  completed: "promoters.profile.assignment_status.completed",
  cancelled: "promoters.profile.assignment_status.cancelled",
  no_show: "promoters.profile.assignment_status.no_show",
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
    <main className="mx-auto max-w-4xl px-6 py-10 sm:py-12">
      <div className="flex flex-col gap-8">
        <PageHeader
          eyebrow={
            <Link
              href="/promoters"
              className="inline-flex items-center gap-1 rounded-sm hover:text-[color:var(--color-ink)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            >
              <Icon name="chevronLeft" size={14} />
              {t("nav.promoters")}
            </Link>
          }
          title={p.full_name}
          subtitle={p.phone}
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

        {missingCoords ? (
          <p className="flex items-start gap-2 rounded-2xl border border-[color:var(--color-warn-line)] bg-[color:var(--color-warn-subtle)] px-4 py-3.5 text-sm text-[color:var(--color-warn-ink)]">
            <Icon name="alert" size={18} className="mt-px shrink-0 text-[color:var(--color-warn)]" />
            <span>
              {t("promoters.profile.missing_coordinates_banner")}{" "}
              <Link
                href={`/promoters/${p.id}/edit`}
                className="font-semibold underline underline-offset-2 hover:text-[color:var(--color-ink)]"
              >
                {t("promoters.profile.edit_button")}
              </Link>
            </span>
          </p>
        ) : null}

        {/* The identity card is the one thing this screen is about — reliability, contact and
            transport, at `elevation="raised"` while everything below sits at the default card
            depth. Areas, skills, history and the shift lists explain the promoter; they are not
            themselves the subject. */}
        <Card
          elevation="raised"
          header={
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">
                {t("promoters.profile.details_title")}
              </h2>
              <Badge variant={STATUS_BADGE[p.status]} dot>
                {t(`promoters.status.${p.status}`)}
              </Badge>
            </div>
          }
        >
          <DetailList columns={2}>
            <Detail label={t("promoters.form.email")}>{p.email ?? "—"}</Detail>
            <Detail label={t("promoters.form.birth_year")}>{p.birth_year ?? "—"}</Detail>
            <Detail label={t("promoters.form.has_car_label")}>
              {p.has_car ? t("promoters.value_yes") : t("promoters.value_no")}
            </Detail>
            <Detail label={t("promoters.form.has_licence_label")}>
              {p.has_licence ? t("promoters.value_yes") : t("promoters.value_no")}
            </Detail>
            {p.transport_notes ? (
              <Detail label={t("promoters.form.transport_notes_label")} wide>
                {p.transport_notes}
              </Detail>
            ) : null}
            <Detail label={t("promoters.profile.reliability_label")} wide>
              <ScoreBar
                value={p.reliability_score}
                size="md"
                className="max-w-xs"
                label={t("promoters.table.reliability_aria", { name: p.full_name })}
              />
            </Detail>
          </DetailList>
        </Card>

        <div className="grid gap-6 sm:grid-cols-2">
          <Card header={<h2 className="text-sm font-semibold text-[color:var(--color-ink)]">{t("promoters.profile.areas_title")}</h2>}>
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

          <Card header={<h2 className="text-sm font-semibold text-[color:var(--color-ink)]">{t("promoters.profile.skills_title")}</h2>}>
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

        {/* P30 mounted: the coordinator sends the promoter their own availability link.
            Minting writes nothing — it is an HMAC over the promoter id — so this is safe to reopen. */}
        <AvailabilityLink promoterId={p.id} promoterName={p.full_name} promoterPhone={p.phone} />

        <Card
          flush
          header={<h2 className="text-sm font-semibold text-[color:var(--color-ink)]">{t("promoters.profile.client_history_title")}</h2>}
        >
          {clientHistory.length === 0 ? (
            <EmptyState bare title={t("promoters.profile.client_history_empty")} />
          ) : (
            <Table bare>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{t("promoters.profile.table.client")}</TableHeaderCell>
                  <TableHeaderCell className="text-right">{t("promoters.profile.table.shifts_completed")}</TableHeaderCell>
                  <TableHeaderCell>{t("promoters.profile.table.last_worked")}</TableHeaderCell>
                  <TableHeaderCell className="text-right">{t("promoters.profile.table.avg_rating")}</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {clientHistory.map((h) => (
                  <TableRow key={h.client_id}>
                    <TableCell className="font-medium text-[color:var(--color-ink)]">{h.client?.name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{h.shifts_completed}</TableCell>
                    <TableCell>{h.last_worked_on ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {h.avg_rating != null ? h.avg_rating.toFixed(1) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card
          flush
          header={<h2 className="text-sm font-semibold text-[color:var(--color-ink)]">{t("promoters.profile.upcoming_shifts_title")}</h2>}
        >
          {upcoming.length === 0 ? (
            <EmptyState bare icon={<Icon name="calendar" size={22} />} title={t("promoters.profile.upcoming_empty")} />
          ) : (
            <Table bare>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{t("shifts.date")}</TableHeaderCell>
                  <TableHeaderCell>{t("shifts.campaign")}</TableHeaderCell>
                  <TableHeaderCell>{t("shifts.store")}</TableHeaderCell>
                  <TableHeaderCell className="text-right">{t("promoters.profile.table.assignment_status")}</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {upcoming.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link
                        href={`/shifts/${a.shift!.id}`}
                        className="rounded-sm font-medium text-[color:var(--color-accent)] hover:underline focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                      >
                        {a.shift!.on_date} · {a.shift!.start_time.slice(0, 5)}–{a.shift!.end_time.slice(0, 5)}
                      </Link>
                    </TableCell>
                    <TableCell>{a.shift?.campaign?.name ?? "—"}</TableCell>
                    <TableCell>{a.shift?.store?.name ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={ASSIGNMENT_STATUS_BADGE[a.status] ?? "neutral"} dot>
                        {t(ASSIGNMENT_STATUS_KEY[a.status] ?? "promoters.profile.assignment_status.confirmed")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card
          flush
          header={<h2 className="text-sm font-semibold text-[color:var(--color-ink)]">{t("promoters.profile.past_shifts_title")}</h2>}
        >
          {past.length === 0 ? (
            <EmptyState bare title={t("promoters.profile.past_empty")} />
          ) : (
            <Table bare>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{t("shifts.date")}</TableHeaderCell>
                  <TableHeaderCell>{t("shifts.campaign")}</TableHeaderCell>
                  <TableHeaderCell>{t("shifts.store")}</TableHeaderCell>
                  <TableHeaderCell className="text-right">{t("promoters.profile.table.assignment_status")}</TableHeaderCell>
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
                    <TableCell className="text-right">
                      <Badge variant={ASSIGNMENT_STATUS_BADGE[a.status] ?? "neutral"} dot>
                        {t(ASSIGNMENT_STATUS_KEY[a.status] ?? "promoters.profile.assignment_status.confirmed")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </main>
  );
}
