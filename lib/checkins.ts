import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { mintToken, verifyToken, linkFor } from "@/lib/tokens";
import { distanceMetres, type Coordinates } from "@/lib/geo";

/**
 * Check-in and field report for the day of the shift.
 *
 * Mirrors `lib/invitations.ts`: the promoter never logs in, the signed token minted by
 * `lib/tokens.ts` (purpose `"checkin"`) is the credential, and the admin (service-role)
 * client is reached only after that token has been verified.
 *
 * The legal shape of this file is fixed by CLAUDE.md §3 and docs/decisions.md D4: geolocation
 * is one-shot and foreground only, capturing a position exists only for the instant it takes
 * to compute a distance, and only the derived `distance_from_store_m` / `within_geofence`
 * pair is ever persisted. `check_ins` has no lat/lng columns on purpose — do not add any here.
 * A manual override always exists so location is never the sole gate on getting paid.
 */

const DEFAULT_TTL_HOURS = 24 * 3;

/** Radius within which an automatic check-in counts as "at the store". Configurable later —
 *  per-store or per-agency — but a single constant is the right amount of v1. */
export const DEFAULT_GEOFENCE_RADIUS_M = 200;

const PHOTO_BUCKET = "field-report-photos";
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type CheckinView = {
  assignmentId: string;
  promoterName: string;
  campaignName: string;
  storeName: string;
  storeAddress: string | null;
  onDate: string;
  startTime: string;
  endTime: string;
  briefSummary: string | null;
  checkedIn: boolean;
  checkinMethod: "geolocation" | "manual_override" | "coordinator" | null;
  withinGeofence: boolean | null;
  hasReport: boolean;
};

type ShiftRow = {
  campaign_id: string;
  on_date: string;
  start_time: string;
  end_time: string;
  campaigns: { name: string } | null;
  stores: { name: string; address: string | null; lat: number; lng: number } | null;
};

type AssignmentRow = {
  id: string;
  agency_id: string;
  shift_id: string;
  status: string;
  promoters: { full_name: string } | null;
  shifts: ShiftRow | null;
};

/** Mint a check-in link for a confirmed assignment. Used by the coordinator side (out of
 *  this parcel's UI) and by anyone minting a test link by hand — see docs/status/P9.md. */
export async function createCheckinLink(
  assignmentId: string,
  ttlHours = DEFAULT_TTL_HOURS,
): Promise<{ url: string }> {
  const db = createAdminClient();

  const { data: assignment, error } = await db
    .from("assignments")
    .select("id")
    .eq("id", assignmentId)
    .single();
  if (error || !assignment) throw new Error("Assignment not found");

  const { token } = mintToken("checkin", assignment.id, ttlHours * 3600);
  return { url: linkFor(token, "checkin") };
}

/** Read a check-in from its raw token, for the promoter-facing page. */
export async function loadCheckin(
  token: string,
): Promise<{ ok: true; view: CheckinView } | { ok: false; reason: string }> {
  const verified = verifyToken(token, "checkin");
  if (!verified.ok) return { ok: false, reason: verified.reason };

  const db = createAdminClient();
  const { data, error } = await db
    .from("assignments")
    .select(
      "id, agency_id, shift_id, status, promoters(full_name), shifts(campaign_id, on_date, start_time, end_time, campaigns(name), stores(name, address, lat, lng))",
    )
    .eq("id", verified.recordId)
    .single();

  if (error || !data) return { ok: false, reason: "not_found" };
  const row = data as unknown as AssignmentRow;
  const shift = row.shifts;
  if (!shift) return { ok: false, reason: "not_found" };
  if (row.status === "cancelled") return { ok: false, reason: "cancelled" };

  const [{ data: checkin }, { data: report }, { data: brief }] = await Promise.all([
    db
      .from("check_ins")
      .select("method, within_geofence")
      .eq("assignment_id", row.id)
      .maybeSingle(),
    db.from("field_reports").select("id").eq("assignment_id", row.id).maybeSingle(),
    db
      .from("briefs")
      .select("body_md")
      .eq("campaign_id", shift.campaign_id)
      .not("published_at", "is", null)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const briefSummary = summarize(brief?.body_md ?? null);

  return {
    ok: true,
    view: {
      assignmentId: row.id,
      promoterName: row.promoters?.full_name ?? "",
      campaignName: shift.campaigns?.name ?? "",
      storeName: shift.stores?.name ?? "",
      storeAddress: shift.stores?.address ?? null,
      onDate: shift.on_date,
      startTime: String(shift.start_time).slice(0, 5),
      endTime: String(shift.end_time).slice(0, 5),
      briefSummary,
      checkedIn: !!checkin,
      checkinMethod: (checkin?.method as CheckinView["checkinMethod"]) ?? null,
      withinGeofence: checkin?.within_geofence ?? null,
      hasReport: !!report,
    },
  };
}

function summarize(bodyMd: string | null): string | null {
  if (!bodyMd) return null;
  const trimmed = bodyMd.trim();
  if (trimmed.length === 0) return null;
  const LIMIT = 220;
  return trimmed.length > LIMIT ? `${trimmed.slice(0, LIMIT)}…` : trimmed;
}

export type CheckinSubmission =
  | { kind: "geo"; lat: number; lng: number }
  | { kind: "override"; reason: string | null };

/**
 * Record arrival.
 *
 * The coordinate pair in `submission` lives only in this function's stack frame — it is used
 * once, to compute a distance, and never reaches a database column or a log line. A geo
 * submission is never rejected for being outside the geofence: `within_geofence` is recorded
 * as data for the coordinator, not used to block the promoter. See CLAUDE.md §3.
 */
export async function submitCheckin(
  token: string,
  submission: CheckinSubmission,
): Promise<
  | { ok: true; withinGeofence: boolean | null; distanceM: number | null }
  | { ok: false; reason: string }
> {
  const verified = verifyToken(token, "checkin");
  if (!verified.ok) return { ok: false, reason: verified.reason };

  const db = createAdminClient();
  const { data, error } = await db
    .from("assignments")
    .select("id, agency_id, status, shifts(stores(lat, lng))")
    .eq("id", verified.recordId)
    .single();
  if (error || !data) return { ok: false, reason: "not_found" };

  const assignment = data as unknown as {
    id: string;
    agency_id: string;
    status: string;
    shifts: { stores: { lat: number; lng: number } | null } | null;
  };
  if (assignment.status === "cancelled") return { ok: false, reason: "cancelled" };

  const { data: existing } = await db
    .from("check_ins")
    .select("id")
    .eq("assignment_id", assignment.id)
    .maybeSingle();
  if (existing) return { ok: false, reason: "already_checked_in" };

  let distanceM: number | null = null;
  let withinGeofence: boolean | null = null;
  const method: "geolocation" | "manual_override" =
    submission.kind === "geo" ? "geolocation" : "manual_override";
  const overrideReason = submission.kind === "override" ? submission.reason : null;

  if (submission.kind === "geo") {
    const store = assignment.shifts?.stores;
    if (store) {
      const here: Coordinates = { lat: submission.lat, lng: submission.lng };
      distanceM = distanceMetres(here, { lat: store.lat, lng: store.lng });
      withinGeofence = distanceM <= DEFAULT_GEOFENCE_RADIUS_M;
    }
    // The coordinate pair (`submission.lat/lng`, `here`) goes out of scope here and is never
    // written anywhere below — only the derived numbers are.
  }

  const { error: insertErr } = await db.from("check_ins").insert({
    agency_id: assignment.agency_id,
    assignment_id: assignment.id,
    distance_from_store_m: distanceM,
    within_geofence: withinGeofence,
    method,
    override_reason: overrideReason,
  });
  if (insertErr) return { ok: false, reason: "save_failed" };

  return { ok: true, withinGeofence, distanceM };
}

export type FieldReportInput = {
  unitsPromoted: number | null;
  salesCount: number | null;
  interactionsCount: number | null;
  stockIssues: string | null;
  storeManagerName: string | null;
  notes: string | null;
};

/** Submit the post-shift field report. Requires a check-in to already exist. */
export async function submitFieldReport(
  token: string,
  input: FieldReportInput,
): Promise<{ ok: true; fieldReportId: string } | { ok: false; reason: string }> {
  const verified = verifyToken(token, "checkin");
  if (!verified.ok) return { ok: false, reason: verified.reason };

  const db = createAdminClient();
  const { data: assignment, error } = await db
    .from("assignments")
    .select("id, agency_id, shift_id, status")
    .eq("id", verified.recordId)
    .single();
  if (error || !assignment) return { ok: false, reason: "not_found" };
  if (assignment.status === "cancelled") return { ok: false, reason: "cancelled" };

  const { data: checkin } = await db
    .from("check_ins")
    .select("id")
    .eq("assignment_id", assignment.id)
    .maybeSingle();
  if (!checkin) return { ok: false, reason: "checkin_required" };

  const { data: existing } = await db
    .from("field_reports")
    .select("id")
    .eq("assignment_id", assignment.id)
    .maybeSingle();
  if (existing) return { ok: false, reason: "already_submitted" };

  const { data: report, error: insertErr } = await db
    .from("field_reports")
    .insert({
      agency_id: assignment.agency_id,
      assignment_id: assignment.id,
      shift_id: assignment.shift_id,
      units_promoted: input.unitsPromoted,
      sales_count: input.salesCount,
      interactions_count: input.interactionsCount,
      stock_issues: input.stockIssues,
      store_manager_name: input.storeManagerName,
      notes: input.notes,
    })
    .select("id")
    .single();
  if (insertErr || !report) return { ok: false, reason: "save_failed" };

  return { ok: true, fieldReportId: report.id };
}

/**
 * Attach a photo to an already-submitted field report.
 *
 * Deliberately separate from `submitFieldReport`: the report text must be saved first so a
 * failed photo upload never loses the rest of the report (quality bar in the P9 brief).
 * Storage policies cannot evaluate our HMAC token scheme (see migration 0009's comment), so
 * this — like every write in this file — verifies the token in application code and only then
 * reaches the service-role client.
 */
export async function attachReportPhoto(
  token: string,
  fieldReportId: string,
  file: File,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const verified = verifyToken(token, "checkin");
  if (!verified.ok) return { ok: false, reason: verified.reason };

  if (!ALLOWED_PHOTO_TYPES.has(file.type)) return { ok: false, reason: "invalid_type" };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, reason: "too_large" };

  const db = createAdminClient();
  const { data: report, error } = await db
    .from("field_reports")
    .select("id, agency_id, assignment_id")
    .eq("id", fieldReportId)
    .eq("assignment_id", verified.recordId)
    .single();
  if (error || !report) return { ok: false, reason: "not_found" };

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${report.agency_id}/${report.assignment_id}/${Date.now()}.${ext}`;

  const { error: uploadErr } = await db.storage.from(PHOTO_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadErr) return { ok: false, reason: "upload_failed" };

  const { error: insertErr } = await db.from("report_photos").insert({
    agency_id: report.agency_id,
    field_report_id: report.id,
    storage_path: path,
  });
  if (insertErr) return { ok: false, reason: "save_failed" };

  return { ok: true };
}
