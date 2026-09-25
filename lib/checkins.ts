import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  mintToken,
  verifyToken,
  verifyTokenSignature,
  acceptedInvitationStillReadable,
  linkFor,
  hashToken,
} from "@/lib/tokens";
import { distanceMetres, type Coordinates } from "@/lib/geo";
import { isActivePromoterStatus } from "@/lib/promoter-status";

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
  /** A3-06 — false once the coordinator has archived or blocklisted this promoter. */
  promoterActive: boolean;
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
  promoters: { full_name: string; status: string } | null;
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

// ---------------------------------------------------------------------------------------------
// P38 additions — nothing above this line changed shape or signature.
//
// `createCheckinLink` above has one caller anywhere in the product before P38: nobody. A
// promoter who accepted an invitation reached a dead end, and this working page had no link
// pointing at it. The two helpers below are how a check-in link actually reaches someone:
// `createCheckinLinkForInvitation` for the promoter's own accepted-invitation page
// (`app/i/[token]/page.tsx`), and `checkinLinkTtlHours` for the coordinator's shift board
// (`app/shifts/[id]/actions.ts`), which mints one on demand for a confirmed assignment.
// ---------------------------------------------------------------------------------------------

/**
 * Europe/Athens wall-clock arithmetic, in the same "as if UTC" representation
 * `app/shifts/[id]/time.ts` and `lib/exceptions.ts` each keep their own copy of — this file
 * cannot import across either ownership line, and both of those file comments explain why a
 * fourth copy here is the right call rather than a shared import: `new Date("2026-09-10")`
 * parses as UTC midnight, which is the wrong Athens instant, so `on_date` + a time-of-day string
 * are never handed to the `Date` constructor directly. Only used below to compute a TTL — never
 * to gate or reject anything, so a wrong guess here can only make a link's expiry too generous or
 * too short, never break check-in itself.
 */
const ATHENS_TZ = "Europe/Athens";

function athensNowMs(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ATHENS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
}

function athensWallClockMs(onDate: string, timeOfDay: string): number {
  const [y, mo, d] = onDate.split("-").map(Number);
  const [h, mi] = timeOfDay.split(":").map(Number);
  return Date.UTC(y ?? 0, (mo ?? 1) - 1, d ?? 1, h ?? 0, mi ?? 0, 0);
}

/** However long past the shift's own end a minted link should keep working — a promoter running
 *  late, or filing the field report a little after closing, must not find a dead link. */
const CHECKIN_LINK_TAIL_HOURS = 12;

/**
 * A check-in link's TTL, computed so it is still valid at the end of the shift day even when
 * minted the moment an invitation is accepted — which can be days or weeks before the shift
 * itself. `createCheckinLink`'s own `DEFAULT_TTL_HOURS` (72h) assumes it is minted close to the
 * shift, which is true for the coordinator pressing a button that morning but not for a promoter
 * accepting an invitation for a shift three weeks out — so this is computed from the shift's own
 * end time instead of ever changing that default.
 *
 * Never shorter than `DEFAULT_TTL_HOURS`: a same-day accept must get at least the same working
 * window `createCheckinLink` always gave a coordinator-minted link.
 */
export function checkinLinkTtlHours(onDate: string, endTime: string, now: Date = new Date()): number {
  const coveredUntilMs = athensWallClockMs(onDate, endTime) + CHECKIN_LINK_TAIL_HOURS * 3_600_000;
  const hoursUntilCovered = Math.ceil((coveredUntilMs - athensNowMs(now)) / 3_600_000);
  return Math.max(hoursUntilCovered, DEFAULT_TTL_HOURS);
}

/**
 * The promoter's own check-in link, derived from their already-accepted invitation token — never
 * from an id in the URL, so this page can never be pointed at anyone else's assignment.
 *
 * Stateless and safe to call every time the promoter (re)opens `/i/[token]`, exactly like
 * `AvailabilityLink`'s own minting (`app/promoters/[id]/availability-link.tsx`): `createCheckinLink`
 * writes nothing to the database, so issuing a fresh one on every page view costs nothing and
 * simply extends how long the link the promoter is looking at keeps working.
 */
export async function createCheckinLinkForInvitation(
  token: string,
): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  // Signature now, expiry below: this only ever serves an ACCEPTED invitation, and the promoter
  // opens it again on the day of the shift, long after the one-day response window has closed.
  const verified = verifyTokenSignature(token, "invitation");
  if (!verified.ok) return { ok: false, reason: verified.reason };

  const db = createAdminClient();
  const { data: invitation, error } = await db
    .from("invitations")
    .select("id, status, token_hash, shift_id, promoter_id, shifts(on_date, end_time)")
    .eq("id", verified.recordId)
    .single();
  if (error || !invitation) return { ok: false, reason: "not_found" };
  // Defence in depth, same as `lib/invitations.ts`'s `loadInvitation`: a valid signature must
  // also match the stored hash.
  if (invitation.token_hash !== hashToken(token)) return { ok: false, reason: "bad_signature" };
  if (invitation.status !== "accepted") return { ok: false, reason: "not_accepted" };

  const shift = invitation.shifts as unknown as { on_date: string; end_time: string } | null;
  if (!shift) return { ok: false, reason: "not_found" };
  if (verified.expired && !acceptedInvitationStillReadable(shift.on_date)) {
    return { ok: false, reason: "expired" };
  }

  const { data: assignment, error: assignmentErr } = await db
    .from("assignments")
    .select("id, status")
    .eq("shift_id", invitation.shift_id)
    .eq("promoter_id", invitation.promoter_id)
    .maybeSingle();
  if (assignmentErr || !assignment) return { ok: false, reason: "not_found" };
  if (assignment.status === "cancelled") return { ok: false, reason: "cancelled" };

  const ttlHours = checkinLinkTtlHours(shift.on_date, String(shift.end_time).slice(0, 5));
  const { url } = await createCheckinLink(assignment.id, ttlHours);
  return { ok: true, url };
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
      // A3-06 adds `promoters.status` to an embed that was already here.
      "id, agency_id, shift_id, status, promoters(full_name, status), shifts(campaign_id, on_date, start_time, end_time, campaigns(name), stores(name, address, lat, lng))",
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
      promoterActive: isActivePromoterStatus(row.promoters?.status),
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
    // A3-06 — `promoters(status)` is the only addition.
    .select("id, agency_id, status, promoters(status), shifts(stores(lat, lng))")
    .eq("id", verified.recordId)
    .single();
  if (error || !data) return { ok: false, reason: "not_found" };

  const assignment = data as unknown as {
    id: string;
    agency_id: string;
    status: string;
    promoters: { status: string } | null;
    shifts: { stores: { lat: number; lng: number } | null } | null;
  };
  if (assignment.status === "cancelled") return { ok: false, reason: "cancelled" };
  // A3-06 — recording an arrival is a write, and an arrival is what a shift is paid against. A
  // promoter the agency has blocklisted must not be able to put one on the record.
  if (!isActivePromoterStatus(assignment.promoters?.status)) {
    return { ok: false, reason: "inactive" };
  }

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

/**
 * Submit the post-shift field report. Requires a check-in to already exist.
 *
 * A3-06 — deliberately NOT gated on `promoters.status`, unlike `submitCheckin` above and
 * `respondToInvitation`. A report can only exist behind a check-in, so by definition this person
 * already stood in the store and did the work; refusing their report after the coordinator
 * archives them throws away the CLIENT's data to punish the promoter, and the client's report is
 * the thing the agency is paid for. The audit's own suggested fix says the same. See
 * `lib/promoter-status.ts`.
 */
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
 * Ungated on `promoters.status` for the same reason as `submitFieldReport` — and it cannot run
 * without a `field_reports` row, which cannot exist without a check-in.
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
