import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { translatorFor, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import {
  addDays,
  athensDate,
  detectExceptions,
  summariseToday,
  type DetectionInput,
  type ExceptionAssignment,
  type ExceptionCheckIn,
  type ExceptionFieldReport,
  type ExceptionInvitation,
  type ExceptionShift,
} from "@/lib/exceptions";
import { ExceptionList } from "./exception-list";

export const dynamic = "force-dynamic";

/** How far the check looks. Backwards for missing check-ins and reports, forwards for coverage. */
const LOOKBACK_DAYS = 7;
const LOOKAHEAD_DAYS = 14;
/** A hard ceiling so one very busy agency cannot turn the home screen into an unbounded query. */
const MAX_SHIFTS = 300;

const INTL_LOCALE: Record<Locale, string> = { el: "el-GR", en: "en-GB" };

function formatDay(now: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: "Europe/Athens",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
}

/**
 * "YYYY-MM-DD" (already an Athens calendar date) rendered short. Reformatted from its own parts
 * rather than through a `Date`, because `new Date("2026-09-10")` parses as UTC midnight and would
 * print the previous day for anyone west of Greenwich — the exact trap CLAUDE.md names.
 */
function formatDateString(onDate: string): string {
  const [y, m, d] = onDate.split("-");
  return `${d}/${m}/${y}`;
}

type ShiftRow = {
  id: string;
  on_date: string;
  start_time: string;
  end_time: string;
  promoters_required: number;
  status: ExceptionShift["status"];
  stores: { name: string } | null;
  campaigns: { name: string } | null;
};

type AssignmentRow = {
  id: string;
  shift_id: string;
  promoter_id: string;
  status: ExceptionAssignment["status"];
  cancelled_at: string | null;
  promoters: { full_name: string } | null;
};

type InvitationRow = {
  id: string;
  shift_id: string;
  promoter_id: string;
  status: ExceptionInvitation["status"];
  sent_at: string;
  expires_at: string;
  responded_at: string | null;
  promoters: { full_name: string } | null;
};

type CheckInRow = {
  assignment_id: string;
  checked_in_at: string;
  distance_from_store_m: number | null;
  within_geofence: boolean | null;
  method: ExceptionCheckIn["method"];
};

/**
 * P28 — the coordinator's home screen.
 *
 * `docs/product-spec.md` §8: surface **only the cases needing human attention**. `/shifts` answers
 * "show me the thing I asked for"; this answers "what is on fire", which is the question the day
 * actually starts with.
 *
 * Five queries, no matter how many shifts are in the window: one for the window of shifts, then
 * one each for the assignments, invitations, check-ins and field reports behind them. Everything
 * after that is derived in TypeScript by `lib/exceptions.ts`, which is pure and unit-tested. No
 * new table and no new column — every case in §8 is already derivable from 0001–0013.
 *
 * Not one `agency_id` filter anywhere below, deliberately: the RLS policies from `0002_rls.sql`
 * supply them, so a mistake in this file returns fewer rows rather than another agency's roster
 * (CLAUDE.md §4). The service-role client is not reachable from this page at all.
 */
export default async function DashboardPage() {
  const locale = DEFAULT_LOCALE;
  const t = translatorFor(locale);
  await requireUser();
  const db = await createServerSupabase();

  const now = new Date();
  const today = athensDate(now);
  const fromDate = addDays(today, -LOOKBACK_DAYS);
  const toDate = addDays(today, LOOKAHEAD_DAYS);

  const { data: shiftData, error: shiftError } = await db
    .from("shifts")
    .select(
      "id, on_date, start_time, end_time, promoters_required, status, stores(name), campaigns(name)",
    )
    .gte("on_date", fromDate)
    .lte("on_date", toDate)
    .order("on_date", { ascending: true })
    .limit(MAX_SHIFTS);

  if (shiftError) throw new Error(shiftError.message);

  const shiftRows = (shiftData ?? []) as unknown as ShiftRow[];
  const shiftIds = shiftRows.map((s) => s.id);

  const shifts: ExceptionShift[] = shiftRows.map((s) => ({
    id: s.id,
    onDate: s.on_date,
    startTime: String(s.start_time),
    endTime: String(s.end_time),
    promotersRequired: s.promoters_required,
    status: s.status,
    storeName: s.stores?.name ?? "—",
    campaignName: s.campaigns?.name ?? "—",
  }));

  let assignments: ExceptionAssignment[] = [];
  let invitations: ExceptionInvitation[] = [];
  let checkIns: ExceptionCheckIn[] = [];
  let fieldReports: ExceptionFieldReport[] = [];

  if (shiftIds.length > 0) {
    const [{ data: assignmentData }, { data: invitationData }, { data: reportData }] =
      await Promise.all([
        db
          .from("assignments")
          .select("id, shift_id, promoter_id, status, cancelled_at, promoters(full_name)")
          .in("shift_id", shiftIds),
        db
          .from("invitations")
          .select(
            "id, shift_id, promoter_id, status, sent_at, expires_at, responded_at, promoters(full_name)",
          )
          .in("shift_id", shiftIds),
        db.from("field_reports").select("assignment_id").in("shift_id", shiftIds),
      ]);

    const assignmentRows = (assignmentData ?? []) as unknown as AssignmentRow[];

    assignments = assignmentRows.map((a) => ({
      id: a.id,
      shiftId: a.shift_id,
      promoterId: a.promoter_id,
      fullName: a.promoters?.full_name ?? "—",
      status: a.status,
      cancelledAt: a.cancelled_at,
    }));

    invitations = ((invitationData ?? []) as unknown as InvitationRow[]).map((i) => ({
      id: i.id,
      shiftId: i.shift_id,
      promoterId: i.promoter_id,
      fullName: i.promoters?.full_name ?? "—",
      status: i.status,
      sentAt: i.sent_at,
      expiresAt: i.expires_at,
      respondedAt: i.responded_at,
    }));

    fieldReports = ((reportData ?? []) as unknown as Array<{ assignment_id: string }>).map((r) => ({
      assignmentId: r.assignment_id,
    }));

    const assignmentIds = assignmentRows.map((a) => a.id);
    if (assignmentIds.length > 0) {
      const { data: checkInData } = await db
        .from("check_ins")
        .select("assignment_id, checked_in_at, distance_from_store_m, within_geofence, method")
        .in("assignment_id", assignmentIds);

      checkIns = ((checkInData ?? []) as unknown as CheckInRow[]).map((c) => ({
        assignmentId: c.assignment_id,
        checkedInAt: c.checked_in_at,
        distanceFromStoreM: c.distance_from_store_m,
        withinGeofence: c.within_geofence,
        method: c.method,
      }));
    }
  }

  const input: DetectionInput = { now, shifts, assignments, invitations, checkIns, fieldReports };
  const exceptions = detectExceptions(input);
  const todaySummary = summariseToday(input);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <PageHeader
        title={t("dashboard.title")}
        subtitle={t("dashboard.subtitle", { date: formatDay(now, locale) })}
        actions={
          <Link
            href="/shifts"
            className="text-sm font-medium text-[color:var(--color-accent)] hover:underline"
          >
            {t("dashboard.all_shifts")} →
          </Link>
        }
      />

      <section className="mt-8">
        <h2 className="text-base font-medium text-[color:var(--color-ink)]">
          {t("dashboard.exceptions.title")}
        </h2>

        <div className="mt-3">
          {shifts.length === 0 ? (
            // A brand-new agency has nothing to be wrong yet. Teaching the next step beats an
            // empty board (docs/commercial-architecture.md §6: empty states teach; no dead ends).
            <EmptyState
              title={t("dashboard.empty.no_shifts.title")}
              description={t("dashboard.empty.no_shifts.body")}
              action={
                <Link
                  href="/campaigns/new"
                  className="text-sm font-medium text-[color:var(--color-accent)] hover:underline"
                >
                  {t("dashboard.empty.no_shifts.cta")} →
                </Link>
              }
            />
          ) : exceptions.length === 0 ? (
            // Nothing wrong is the SUCCESS case. It gets a real screen saying so, because the
            // whole point of this product is that the coordinator can stop worrying — a blank
            // page would read as "not loaded yet" instead.
            <EmptyState
              icon={<span className="text-xl">✓</span>}
              title={t("dashboard.empty.title")}
              description={t("dashboard.empty.body")}
              action={
                <p className="text-xs text-[color:var(--color-muted)]">
                  {t("dashboard.empty.hint", {
                    from: formatDateString(fromDate),
                    to: formatDateString(toDate),
                  })}
                </p>
              }
            />
          ) : (
            <ExceptionList exceptions={exceptions} t={t} />
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-base font-medium text-[color:var(--color-ink)]">
          {t("dashboard.today.title")}
        </h2>
        <div className="mt-3">
          <Card>
            {todaySummary.shiftCount === 0 ? (
              <p className="text-sm text-[color:var(--color-muted)]">{t("dashboard.today.none")}</p>
            ) : (
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
                    {t("dashboard.today.shifts")}
                  </dt>
                  <dd className="mt-1 text-xl font-semibold text-[color:var(--color-ink)]">
                    {todaySummary.shiftCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
                    {t("dashboard.today.coverage")}
                  </dt>
                  <dd className="mt-1 text-xl font-semibold text-[color:var(--color-ink)]">
                    {t("dashboard.today.of", {
                      done: todaySummary.confirmedCount,
                      total: todaySummary.requiredCount,
                    })}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
                    {t("dashboard.today.checked_in")}
                  </dt>
                  <dd className="mt-1 text-xl font-semibold text-[color:var(--color-ink)]">
                    {t("dashboard.today.of", {
                      done: todaySummary.checkedInCount,
                      total: todaySummary.confirmedCount,
                    })}
                  </dd>
                </div>
              </dl>
            )}
          </Card>
        </div>
      </section>
    </main>
  );
}
