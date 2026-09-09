import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { matchPromoters } from "@/lib/matching";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { Badge, PageHeader } from "@/components/ui";
import { buildBoard, summariseCoverage, type RawAssignment, type RawCheckIn, type RawInvitation } from "./board";
import { StatusBoard } from "./status-board";
import { ReplacementPanel } from "./replacement-panel";

export const dynamic = "force-dynamic";

type PromoterRef = { full_name: string } | null;

export default async function ShiftDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = translatorFor(DEFAULT_LOCALE);
  await requireUser();
  const db = await createServerSupabase();

  // Scoped by RLS: a shift belonging to another agency returns no row and this page 404s,
  // which is also the right answer to give — it does not confirm the id exists.
  const { data: shift } = await db
    .from("shifts")
    .select(
      "id, on_date, start_time, end_time, promoters_required, stores(name, address), campaigns(name, dress_code)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!shift) notFound();

  const store = shift.stores as unknown as { name: string; address: string } | null;
  const campaign = shift.campaigns as unknown as { name: string } | null;
  const startTime = String(shift.start_time).slice(0, 5);
  const endTime = String(shift.end_time).slice(0, 5);

  // Everyone who has ever been invited or assigned to this shift, plus their check-in if any.
  // All three queries go through the same RLS-scoped client as the shift above — no service
  // role is reachable from this page at all.
  const [{ data: assignmentsData }, { data: invitationsData }] = await Promise.all([
    db
      .from("assignments")
      .select("id, promoter_id, status, confirmed_at, cancelled_at, cancel_reason, promoters(full_name)")
      .eq("shift_id", id),
    db
      .from("invitations")
      .select("id, promoter_id, status, sent_at, expires_at, responded_at, decline_reason, promoters(full_name)")
      .eq("shift_id", id)
      .order("sent_at", { ascending: false }),
  ]);

  const assignmentRows = assignmentsData ?? [];
  const assignmentIds = assignmentRows.map((a) => a.id);

  const { data: checkInsData } =
    assignmentIds.length > 0
      ? await db
          .from("check_ins")
          .select("assignment_id, checked_in_at, distance_from_store_m, within_geofence, method")
          .in("assignment_id", assignmentIds)
      : { data: [] };

  const assignments: RawAssignment[] = assignmentRows.map((a) => ({
    id: a.id,
    promoterId: a.promoter_id,
    fullName: (a.promoters as unknown as PromoterRef)?.full_name ?? "—",
    status: a.status,
    confirmedAt: a.confirmed_at,
    cancelledAt: a.cancelled_at,
    cancelReason: a.cancel_reason,
  }));

  const invitations: RawInvitation[] = (invitationsData ?? []).map((i) => ({
    id: i.id,
    promoterId: i.promoter_id,
    fullName: (i.promoters as unknown as PromoterRef)?.full_name ?? "—",
    status: i.status,
    sentAt: i.sent_at,
    expiresAt: i.expires_at,
    respondedAt: i.responded_at,
    declineReason: i.decline_reason,
  }));

  const checkIns: RawCheckIn[] = (checkInsData ?? []).map((c) => ({
    assignmentId: c.assignment_id,
    checkedInAt: c.checked_in_at,
    distanceFromStoreM: c.distance_from_store_m,
    withinGeofence: c.within_geofence,
    method: c.method,
  }));

  const coverage = summariseCoverage(shift.promoters_required, assignments, invitations);
  const boardRows = buildBoard(shift.on_date, startTime, assignments, invitations, checkIns);

  // The shift id above was proved to belong to this agency by RLS, and `match_promoters` only
  // ever considers promoters with the shift's own `agency_id`, so this cannot cross a tenant
  // boundary. It is still the last call on a coordinator path reaching the service role —
  // `lib/matching` is another lane's file. See "Requests to other lanes" in docs/status/P1.md.
  const replacementCandidates = coverage.coverageMet ? [] : await matchPromoters(id, 3);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <PageHeader
        title={campaign?.name ?? "—"}
        subtitle={`${store?.name ?? ""} · ${shift.on_date} · ${startTime}–${endTime}`}
        actions={
          <Badge variant={coverage.coverageMet ? "ok" : "warn"}>
            {t("shifts.coverage.filled", {
              filled: coverage.confirmedCount,
              required: coverage.requiredCount,
            })}
          </Badge>
        }
      />

      <section className="mt-8">
        <h2 className="text-base font-medium">{t("shifts.board.title")}</h2>
        <div className="mt-3">
          <StatusBoard shiftId={id} rows={boardRows} t={t} />
        </div>
      </section>

      {!coverage.coverageMet ? (
        <ReplacementPanel shiftId={id} coverage={coverage} candidates={replacementCandidates} t={t} />
      ) : (
        <p className="mt-6 text-sm text-[color:var(--color-muted)]">{t("shifts.coverage.full")}</p>
      )}
    </main>
  );
}
