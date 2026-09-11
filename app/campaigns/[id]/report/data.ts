import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildCampaignReport,
  type CampaignReport,
  type CampaignStatus,
  type ReportAssignment,
  type ReportCheckIn,
  type ReportFieldReport,
  type ReportPhoto,
  type ReportPhotoEntry,
  type ReportShift,
  type ReportStore,
  type AssignmentStatus,
  type CheckInMethod,
  type ShiftStatus,
} from "@/lib/reporting";

/**
 * P29 — the one place the report's rows are read.
 *
 * The page and the CSV route both call `loadCampaignReport`, so the screen a coordinator reads at
 * midnight and the file they send the client are computed from the same query and the same
 * aggregation. Two fetch paths would eventually disagree, and the first person to notice would be
 * the client.
 *
 * **Not one `agency_id` filter anywhere below, deliberately.** Every table here is tenant-scoped
 * with an RLS policy from `0002_rls.sql`, so the policies supply the filter and a mistake in this
 * file returns fewer rows rather than another agency's campaign (CLAUDE.md §4).
 */

const PHOTO_BUCKET = "field-report-photos";

/** Long enough to read a report and scroll a gallery, short enough that a copied URL dies fast. */
const PHOTO_URL_TTL_SECONDS = 15 * 60;

/**
 * PostgREST caps a response at 1000 rows. A six-month campaign across forty stores clears that,
 * and a silently truncated report is exactly the confident-but-wrong number this parcel exists to
 * prevent — so every list is paged rather than fetched once.
 */
const PAGE_SIZE = 1000;

/** A ceiling so one pathological campaign cannot hold a request open indefinitely. */
const MAX_ROWS = 20_000;

type Db = Awaited<ReturnType<typeof createServerSupabase>>;

/**
 * Read every row of a query, a page at a time.
 *
 * Returns `truncated: true` if the ceiling was hit, and the caller says so on the page instead of
 * quietly publishing a rollup over an arbitrary prefix of the data.
 */
async function fetchAllPages<T>(
  run: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await run(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

type CampaignRow = {
  id: string;
  name: string;
  campaign_type: string | null;
  starts_on: string;
  ends_on: string;
  status: CampaignStatus;
  clients: { name: string } | null;
};

type ShiftRow = {
  id: string;
  store_id: string;
  on_date: string;
  start_time: string;
  end_time: string;
  promoters_required: number;
  status: ShiftStatus;
  stores: { id: string; name: string; chain: string | null; address: string | null } | null;
};

type AssignmentRow = {
  id: string;
  shift_id: string;
  promoter_id: string;
  status: AssignmentStatus;
  promoters: { full_name: string } | null;
};

type CheckInRow = {
  assignment_id: string;
  checked_in_at: string;
  distance_from_store_m: number | null;
  within_geofence: boolean | null;
  method: CheckInMethod;
};

type FieldReportRow = {
  id: string;
  assignment_id: string;
  shift_id: string;
  units_promoted: number | null;
  sales_count: number | null;
  interactions_count: number | null;
  stock_issues: string | null;
  store_manager_name: string | null;
  notes: string | null;
  submitted_at: string;
};

type PhotoRow = {
  id: string;
  field_report_id: string;
  storage_path: string;
  caption: string | null;
  taken_at: string | null;
};

export type LoadedReport = {
  report: CampaignReport;
  /** True when a list hit the row ceiling. The page must say so rather than imply completeness. */
  truncated: boolean;
};

/**
 * Build the campaign report from the database, or return null if the campaign is not visible.
 *
 * "Not visible" covers both a bad id and another agency's campaign — RLS makes them the same
 * answer, which is the point: nothing here can distinguish "does not exist" from "not yours".
 */
export async function loadCampaignReport(
  campaignId: string,
  now: Date = new Date(),
): Promise<LoadedReport | null> {
  const db: Db = await createServerSupabase();

  const { data: campaignData } = await db
    .from("campaigns")
    .select("id, name, campaign_type, starts_on, ends_on, status, clients(name)")
    .eq("id", campaignId)
    .maybeSingle();

  if (!campaignData) return null;
  const c = campaignData as unknown as CampaignRow;

  const { rows: shiftRows, truncated: shiftsTruncated } = await fetchAllPages<ShiftRow>((from, to) =>
    db
      .from("shifts")
      .select(
        "id, store_id, on_date, start_time, end_time, promoters_required, status, stores(id, name, chain, address)",
      )
      .eq("campaign_id", campaignId)
      .order("on_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );

  const shiftIds = shiftRows.map((s) => s.id);

  let assignmentRows: AssignmentRow[] = [];
  let checkInRows: CheckInRow[] = [];
  let fieldReportRows: FieldReportRow[] = [];
  let photoRows: PhotoRow[] = [];
  let truncated = shiftsTruncated;

  if (shiftIds.length > 0) {
    const [assignments, reports] = await Promise.all([
      fetchAllPages<AssignmentRow>((from, to) =>
        db
          .from("assignments")
          .select("id, shift_id, promoter_id, status, promoters(full_name)")
          .in("shift_id", shiftIds)
          .order("id", { ascending: true })
          .range(from, to),
      ),
      fetchAllPages<FieldReportRow>((from, to) =>
        db
          .from("field_reports")
          .select(
            "id, assignment_id, shift_id, units_promoted, sales_count, interactions_count, stock_issues, store_manager_name, notes, submitted_at",
          )
          .in("shift_id", shiftIds)
          .order("id", { ascending: true })
          .range(from, to),
      ),
    ]);

    assignmentRows = assignments.rows;
    fieldReportRows = reports.rows;
    truncated = truncated || assignments.truncated || reports.truncated;

    const assignmentIds = assignmentRows.map((a) => a.id);
    const reportIds = fieldReportRows.map((r) => r.id);

    const [checkIns, photos] = await Promise.all([
      assignmentIds.length > 0
        ? fetchAllPages<CheckInRow>((from, to) =>
            db
              .from("check_ins")
              .select("assignment_id, checked_in_at, distance_from_store_m, within_geofence, method")
              .in("assignment_id", assignmentIds)
              .order("assignment_id", { ascending: true })
              .range(from, to),
          )
        : Promise.resolve({ rows: [] as CheckInRow[], truncated: false }),
      reportIds.length > 0
        ? fetchAllPages<PhotoRow>((from, to) =>
            db
              .from("report_photos")
              .select("id, field_report_id, storage_path, caption, taken_at")
              .in("field_report_id", reportIds)
              .order("id", { ascending: true })
              .range(from, to),
          )
        : Promise.resolve({ rows: [] as PhotoRow[], truncated: false }),
    ]);

    checkInRows = checkIns.rows;
    photoRows = photos.rows;
    truncated = truncated || checkIns.truncated || photos.truncated;
  }

  // The stores come from the shifts' own join, so the report can never name a store this
  // campaign never used.
  const storeById = new Map<string, ReportStore>();
  for (const row of shiftRows) {
    const store = row.stores;
    if (store && !storeById.has(store.id)) {
      storeById.set(store.id, {
        id: store.id,
        name: store.name,
        chain: store.chain,
        address: store.address,
      });
    }
  }

  const shifts: ReportShift[] = shiftRows.map((s) => ({
    id: s.id,
    storeId: s.store_id,
    onDate: s.on_date,
    startTime: String(s.start_time),
    endTime: String(s.end_time),
    promotersRequired: s.promoters_required,
    status: s.status,
  }));

  const assignments: ReportAssignment[] = assignmentRows.map((a) => ({
    id: a.id,
    shiftId: a.shift_id,
    promoterId: a.promoter_id,
    promoterName: a.promoters?.full_name ?? "—",
    status: a.status,
  }));

  const checkIns: ReportCheckIn[] = checkInRows.map((c) => ({
    assignmentId: c.assignment_id,
    checkedInAt: c.checked_in_at,
    distanceFromStoreM: c.distance_from_store_m,
    withinGeofence: c.within_geofence,
    method: c.method,
  }));

  const fieldReports: ReportFieldReport[] = fieldReportRows.map((r) => ({
    id: r.id,
    assignmentId: r.assignment_id,
    shiftId: r.shift_id,
    unitsPromoted: r.units_promoted,
    salesCount: r.sales_count,
    interactionsCount: r.interactions_count,
    stockIssues: r.stock_issues,
    storeManagerName: r.store_manager_name,
    notes: r.notes,
    submittedAt: r.submitted_at,
  }));

  const photos: ReportPhoto[] = photoRows.map((p) => ({
    id: p.id,
    fieldReportId: p.field_report_id,
    storagePath: p.storage_path,
    caption: p.caption,
    takenAt: p.taken_at,
  }));

  const report = buildCampaignReport({
    now,
    campaign: {
      id: c.id,
      name: c.name,
      clientName: c.clients?.name ?? null,
      campaignType: c.campaign_type,
      startsOn: c.starts_on,
      endsOn: c.ends_on,
      status: c.status,
    },
    stores: [...storeById.values()],
    shifts,
    assignments,
    checkIns,
    fieldReports,
    photos,
  });

  return { report, truncated };
}

/**
 * Short-lived signed URLs for the gallery, keyed by photo id.
 *
 * ## Why the service-role client appears here, and only here
 *
 * `field-report-photos` is a private bucket with **no `storage.objects` policy for the
 * `authenticated` role** — migration `0009_checkin.sql` says so explicitly, and explains why: a
 * storage policy is evaluated against Postgres auth context and cannot check the HMAC token a
 * promoter's upload arrives with, so writing one would have looked like a safeguard without being
 * one. Reads inherit that decision. A coordinator's RLS-scoped client therefore cannot sign an
 * object in this bucket at all, and the alternatives are worse: making the bucket public would put
 * every field photo behind a guessable URL, which CLAUDE.md forbids outright.
 *
 * So this follows the same "verify first, service role after" shape as `lib/checkins.ts` and the
 * `/i/[token]` pages, with the verification done by RLS rather than by a token:
 *
 *   1. the photo rows reached this function through `loadCampaignReport`'s RLS-scoped reads, so a
 *      row belonging to another agency was never returned in the first place, and
 *   2. every path is re-checked against the caller's own `agencyId` before it is signed —
 *      `lib/checkins.ts` writes objects as `<agency_id>/<assignment_id>/<ts>.<ext>`, so the prefix
 *      is a second, independent assertion of tenancy. A path that fails it is dropped, not signed.
 *
 * A failure to sign is never fatal: the gallery renders the photo's caption, store and date with
 * an honest "image unavailable" placeholder rather than 500-ing the whole report.
 *
 * **A request for a storage policy is filed in `docs/status/P29.md`.** With a
 * `storage.objects` select policy scoped to the caller's agency prefix, this function drops the
 * admin client entirely and becomes four lines against the RLS client.
 */
export async function signPhotoUrls(
  entries: readonly ReportPhotoEntry[],
  agencyId: string,
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (entries.length === 0) return urls;

  const prefix = `${agencyId}/`;
  const owned = entries.filter((e) => e.storagePath.startsWith(prefix));
  if (owned.length === 0) return urls;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(
        owned.map((e) => e.storagePath),
        PHOTO_URL_TTL_SECONDS,
      );

    if (error || !data) return urls;

    // `createSignedUrls` answers positionally, one result per requested path.
    data.forEach((result, index) => {
      const entry = owned[index];
      if (!entry || !result.signedUrl || result.error) return;
      urls.set(entry.id, result.signedUrl);
    });
  } catch {
    // No service-role key configured, or storage unreachable. The report is still worth reading.
    return urls;
  }

  return urls;
}
