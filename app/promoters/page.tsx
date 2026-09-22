import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import {
  Avatar,
  PageHeader,
  Button,
  Badge,
  EmptyState,
  Icon,
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

/**
 * A2 finding 19 — this page used to fetch `.limit(1000)` promoters and filter them in memory.
 * Two consequences: every visit shipped the whole roster to render one screen, and an agency
 * with more than a thousand promoters could never find the rest — the search box simply would
 * not return them, with no warning. Filters now run in the query and the result is paged.
 */
const PAGE_SIZE = 50;

const PROMOTER_STATUSES: readonly PromoterStatus[] = ["active", "paused", "archived", "blocklisted"];

function readStatus(value: string): PromoterStatus | null {
  return (PROMOTER_STATUSES as readonly string[]).includes(value) ? (value as PromoterStatus) : null;
}

/**
 * PostgREST's `or=` takes a comma-separated list inside parentheses, so a comma, a bracket or a
 * quote in the search box would change the shape of the filter rather than be searched for.
 * Strip those, and `%`/`_`, which are `ilike` wildcards.
 */
function searchPattern(raw: string): string {
  return "%" + raw.replace(/[,()"'%_*\\]/g, " ").trim() + "%";
}

/** The current query string with `page` replaced — used by the two pager links. */
function pageHref(sp: Record<string, string | string[] | undefined>, page: number): string {
  const params = new URLSearchParams();
  for (const key of ["q", "status", "area", "skill", "car"]) {
    const value = first(sp[key]);
    if (value) params.set(key, value);
  }
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/promoters?${qs}` : "/promoters";
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
  const requestedPage = Math.trunc(Number(first(sp.page)));
  const page = Number.isFinite(requestedPage) && requestedPage > 1 ? requestedPage : 1;

  const [{ data: areas }, { data: skills }, { count: rosterCount }] = await Promise.all([
    db.from("areas").select("id, name").order("name"),
    db.from("skills").select("id, name").order("name"),
    db.from("promoters").select("id", { count: "exact", head: true }),
  ]);

  const areaOptions = (areas ?? []) as unknown as AreaOption[];
  const skillOptions = (skills ?? []) as unknown as SkillOption[];
  const totalCount = rosterCount ?? 0;

  // Area and skill are filters over join tables. Resolving them to a set of promoter ids first
  // — rather than using PostgREST's `!inner` embed — keeps the embedded area/skill lists the
  // table renders complete: an `!inner` join would return only the *matching* area next to a
  // promoter's name, which reads as "she only works in Γλυφάδα" when she works in four places.
  let idFilter: string[] | null = null;

  if (areaFilter) {
    const { data } = await db.from("promoter_areas").select("promoter_id").eq("area_id", areaFilter);
    idFilter = (data ?? []).map((r) => r.promoter_id as string);
  }
  if (skillFilter) {
    const { data } = await db.from("promoter_skills").select("promoter_id").eq("skill_id", skillFilter);
    const ids = new Set((data ?? []).map((r) => r.promoter_id as string));
    idFilter = idFilter === null ? [...ids] : idFilter.filter((id) => ids.has(id));
  }

  let query = db
    .from("promoters")
    .select(
      `id, full_name, phone, status, has_car, has_licence, home_lat, home_lng, reliability_score,
         promoter_areas ( area:areas ( id, name ) ),
         promoter_skills ( level, skill:skills ( id, name ) )`,
      { count: "exact" },
    )
    .order("full_name");

  if (q) {
    const pattern = searchPattern(q);
    query = query.or(`full_name.ilike.${pattern},phone.ilike.${pattern}`);
  }
  const status = readStatus(statusFilter);
  if (status) query = query.eq("status", status);
  if (carFilter === "yes") query = query.eq("has_car", true);
  if (carFilter === "no") query = query.eq("has_car", false);
  if (idFilter !== null) query = query.in("id", idFilter);

  const offset = (page - 1) * PAGE_SIZE;
  const { data: promoters, error, count } = await query.range(offset, offset + PAGE_SIZE - 1);

  if (error) throw new Error(error.message);

  const rows = (promoters ?? []) as unknown as PromoterRow[];
  const matchCount = count ?? rows.length;
  const pageCount = Math.max(1, Math.ceil(matchCount / PAGE_SIZE));

  const hasAnyFilter = Boolean(q || statusFilter || areaFilter || skillFilter || carFilter);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 sm:py-12">
      <div className="flex flex-col gap-6">
        <PageHeader
          title={t("nav.promoters")}
          subtitle={
            totalCount > 0
              ? totalCount === 1
                ? t("promoters.list.subtitle_one")
                : t("promoters.list.subtitle_many", { count: totalCount })
              : undefined
          }
          icon={<Icon name="users" size={20} />}
          actions={
            <LinkButton href="/promoters/new" iconLeft={<Icon name="plus" size={16} />}>
              {t("promoters.add")}
            </LinkButton>
          }
        />

        {totalCount > 0 && totalCount < 5 ? (
          <p className="flex items-start gap-2 rounded-xl border border-[color:var(--color-warn-line)] bg-[color:var(--color-warn-subtle)] px-4 py-3 text-sm text-[color:var(--color-warn-ink)]">
            <Icon name="alert" size={18} className="mt-px text-[color:var(--color-warn)]" />
            <span>{t("promoters.list.low_count_hint")}</span>
          </p>
        ) : null}

        {totalCount > 0 ? (
          /*
           * The filter bar used to be `flex-wrap` over fixed pixel widths — `w-56`, four × `w-44`,
           * `w-36`. Greek labels ("Περιοχή δραστηριοποίησης", "Όλες οι ειδικότητες") do not fit a
           * 176px select, so every label clipped; and the fixed widths wrapped into a ragged
           * two-and-a-half-row block at laptop width. A grid instead: the columns are equal and
           * the controls are fluid, so the labels get whatever the viewport can spare and the
           * rows are always full.
           */
          <form
            className="rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-5 py-5 shadow-[var(--elevation-card)] sm:px-6"
            method="get"
          >
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <TextField
                id="q"
                name="q"
                label={t("promoters.filter.search_label")}
                placeholder={t("promoters.filter.search_placeholder")}
                defaultValue={q}
                containerClassName="min-w-0"
              />
              <SelectField
                id="status"
                name="status"
                label={t("promoters.filter.status_label")}
                defaultValue={statusFilter}
                containerClassName="min-w-0"
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
                containerClassName="min-w-0"
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
                containerClassName="min-w-0"
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
                containerClassName="min-w-0"
                options={[
                  { value: "", label: t("promoters.filter.car_any") },
                  { value: "yes", label: t("promoters.filter.car_yes") },
                  { value: "no", label: t("promoters.filter.car_no") },
                ]}
              />
            </div>

            {/* The actions get their own row under a divider rather than sitting as a sixth
                "column" of the grid, where they lined up with the field *labels* instead of with
                the controls. */}
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[color:var(--color-line)] pt-4">
              <Button
                type="submit"
                variant="secondary"
                iconLeft={<Icon name="filter" size={16} />}
              >
                {t("promoters.filter.apply")}
              </Button>
              {hasAnyFilter ? (
                <>
                  <Link
                    href="/promoters"
                    className="rounded-sm text-sm font-medium text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)] hover:underline focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                  >
                    {t("promoters.filter.clear")}
                  </Link>
                  <span className="ml-auto text-xs tabular-nums text-[color:var(--color-muted)]">
                    {t("promoters.filter.result_count", {
                      shown: matchCount,
                      total: totalCount,
                    })}
                  </span>
                </>
              ) : null}
            </div>
          </form>
        ) : null}

        {totalCount === 0 ? (
          <EmptyState
            icon={<Icon name="users" size={24} />}
            title={t("promoters.empty.title")}
            description={t("promoters.empty.description")}
            action={
              <LinkButton href="/promoters/new" iconLeft={<Icon name="plus" size={16} />}>
                {t("promoters.add")}
              </LinkButton>
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Icon name="search" size={24} />}
            title={t("promoters.empty_filtered.title")}
            description={t("promoters.empty_filtered.description")}
            action={
              <LinkButton href="/promoters" variant="secondary">
                {t("promoters.filter.clear")}
              </LinkButton>
            }
          />
        ) : (
          // `fluid`, because two of these columns carry prose: a promoter with four areas and
          // four skills drags an intrinsic-width table several screens wide and buries the
          // score and status columns off the right-hand edge on a laptop.
          <Table label={t("nav.promoters")} layout="fluid">
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t("promoters.table.name")}</TableHeaderCell>
                <TableHeaderCell>{t("promoters.table.phone")}</TableHeaderCell>
                <TableHeaderCell>{t("promoters.table.areas")}</TableHeaderCell>
                <TableHeaderCell>{t("promoters.table.transport")}</TableHeaderCell>
                <TableHeaderCell>{t("promoters.table.skills")}</TableHeaderCell>
                {/* The score column is fixed-width so the bars form a single ruler down the
                    page — a column of bars that each start at a different x is unreadable as a
                    comparison, which is the only reason the column exists. */}
                <TableHeaderCell className="w-44">{t("promoters.table.reliability")}</TableHeaderCell>
                <TableHeaderCell className="text-right">{t("promoters.table.status")}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((p) => {
                const missingCoords = p.home_lat == null || p.home_lng == null;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      {/* The avatar is what makes a roster of thirty names scannable — the same
                          promoter is the same tint here, on the shift board and in a match list. */}
                      <div className="flex items-center gap-3">
                        <Avatar name={p.full_name} size="sm" />
                        <div className="min-w-0">
                          <Link
                            href={`/promoters/${p.id}`}
                            className="rounded-sm font-medium text-[color:var(--color-accent)] hover:underline focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                          >
                            {p.full_name}
                          </Link>
                          {missingCoords ? (
                            <div className="mt-1">
                              <Badge variant="warn" size="sm" dot>
                                {t("promoters.missing_coordinates")}
                              </Badge>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">{p.phone}</TableCell>
                    <TableCell>
                      {p.promoter_areas.length === 0
                        ? "—"
                        : p.promoter_areas.map((pa) => pa.area?.name).filter(Boolean).join(", ")}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {p.has_car ? (
                          <Badge variant="info" size="sm">
                            {t("promoters.form.has_car_label")}
                          </Badge>
                        ) : null}
                        {p.has_licence ? (
                          <Badge variant="neutral" size="sm">
                            {t("promoters.form.has_licence_label")}
                          </Badge>
                        ) : null}
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
                    <TableCell className="text-right">
                      <Badge variant={STATUS_BADGE[p.status]} dot>
                        {t(`promoters.status.${p.status}`)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* The pager only appears once there is a second page, so a small agency never sees it.
            Plain links, not a client island: the filters above are a GET form already, and this
            screen has no reason to ship JavaScript. */}
        {pageCount > 1 ? (
          <nav
            aria-label={t("promoters.page.nav_label")}
            className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--color-line)] pt-4"
          >
            <p className="text-xs tabular-nums text-[color:var(--color-muted)]">
              {t("promoters.page.range", {
                from: offset + 1,
                to: offset + rows.length,
                total: matchCount,
              })}
            </p>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <LinkButton href={pageHref(sp, page - 1)} variant="secondary" size="sm">
                  {t("promoters.page.prev")}
                </LinkButton>
              ) : null}
              <span className="text-xs tabular-nums text-[color:var(--color-muted)]">
                {t("promoters.page.of", { page, pages: pageCount })}
              </span>
              {page < pageCount ? (
                <LinkButton href={pageHref(sp, page + 1)} variant="secondary" size="sm">
                  {t("promoters.page.next")}
                </LinkButton>
              ) : null}
            </div>
          </nav>
        ) : null}
      </div>
    </main>
  );
}
