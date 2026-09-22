import { isPastAthens, minutesUntil } from "./time";

/**
 * Shapes raw `assignments` / `invitations` / `check_ins` rows for one shift into the status
 * board (P10) and the "why is this shift under-covered" summary (P8). Pure data shaping, no
 * Supabase calls — the page fetches, this file decides what it means. Kept in `app/shifts/[id]/`
 * rather than `lib/**`, which this parcel does not own.
 */

export type RawAssignment = {
  id: string;
  promoterId: string;
  fullName: string;
  /** P38 — carried through to the board row so the check-in link control can offer
   *  "open in WhatsApp" without a second query. */
  phone: string | null;
  status: "confirmed" | "cancelled" | "no_show" | "completed";
  confirmedAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
};

export type RawInvitation = {
  id: string;
  promoterId: string;
  fullName: string;
  /** A2 finding 7 — carried onto the board row so the coordinator can re-copy the link. */
  phone?: string | null;
  status: "pending" | "accepted" | "declined" | "expired" | "superseded";
  sentAt: string;
  expiresAt: string;
  respondedAt: string | null;
  declineReason: string | null;
};

export type RawCheckIn = {
  assignmentId: string;
  checkedInAt: string;
  distanceFromStoreM: number | null;
  withinGeofence: boolean | null;
  method: "geolocation" | "manual_override" | "coordinator";
};

export type BoardRowState =
  | "awaiting_reply"
  | "expired"
  | "declined"
  | "confirmed"
  | "checked_in"
  | "checked_in_manual"
  | "no_show"
  | "cancelled";

export type BoardRow = {
  promoterId: string;
  fullName: string;
  /** P38 — only present on rows that came from an assignment; used to offer "open in WhatsApp"
   *  next to a freshly minted check-in link. */
  phone?: string | null;
  state: BoardRowState;
  /** 0 = most urgent, sorts first. */
  tier: 0 | 1 | 2 | 3;
  minutesUntilStart: number;
  assignmentId?: string;
  /** A2 finding 7 — present on an `awaiting_reply` row, so its link can be rebuilt and resent. */
  invitationId?: string;
  sentAt?: string;
  expiresAt?: string;
  respondedAt?: string;
  declineReason?: string | null;
  confirmedAt?: string;
  cancelledAt?: string;
  cancelReason?: string | null;
  checkedInAt?: string;
  distanceM?: number | null;
  withinGeofence?: boolean | null;
  /** Can this row's assignment be cancelled from the board right now? */
  cancellable: boolean;
  /** Can this row's assignment be marked a no-show right now? */
  markableNoShow: boolean;
  /** P38 — can the coordinator mint this row a check-in link right now? True exactly when the
   *  underlying assignment is `confirmed` (checked in or not) — the same condition `cancellable`
   *  happens to test, kept as its own field so the two controls can never silently drift apart if
   *  one of their conditions ever changes for an unrelated reason. */
  checkinLinkAvailable: boolean;
};

export type CoverageSummary = {
  confirmedCount: number;
  requiredCount: number;
  coverageMet: boolean;
  pendingCount: number;
  declines: Array<{ fullName: string; respondedAt: string | null; declineReason: string | null }>;
  cancellations: Array<{ fullName: string; cancelledAt: string | null; cancelReason: string | null }>;
};

const TIER: Record<BoardRowState, 0 | 1 | 2 | 3> = {
  no_show: 0,
  awaiting_reply: 2, // overridden to 0 below when the shift starts soon or has started
  expired: 1,
  declined: 1,
  checked_in_manual: 1,
  confirmed: 2,
  checked_in: 2,
  cancelled: 3,
};

/** A confirmed row that has not checked in and whose shift has already started is an exception,
 *  regardless of the base tier for "confirmed". */
const URGENT_REPLY_WINDOW_MIN = 60;

export function buildBoard(
  onDate: string,
  startTime: string,
  assignments: RawAssignment[],
  invitations: RawInvitation[],
  checkIns: RawCheckIn[],
): BoardRow[] {
  const checkInByAssignment = new Map(checkIns.map((c) => [c.assignmentId, c]));
  const started = isPastAthens(onDate, startTime);
  const minsUntilStart = minutesUntil(onDate, startTime);
  const rows: BoardRow[] = [];
  const seenPromoterIds = new Set<string>();

  for (const a of assignments) {
    const checkIn = checkInByAssignment.get(a.id);

    if (a.status === "cancelled") {
      // Deliberately NOT added to `seenPromoterIds`: `match_promoters` only excludes a
      // *confirmed* assignment, so this exact promoter can be, and often is, re-invited for the
      // same shift straight after being cancelled. If that happens their new invitation must
      // still get its own row below rather than being hidden behind this historical one.
      rows.push({
        promoterId: a.promoterId,
        fullName: a.fullName,
        phone: a.phone,
        state: "cancelled",
        tier: TIER.cancelled,
        minutesUntilStart: minsUntilStart,
        assignmentId: a.id,
        cancelledAt: a.cancelledAt ?? undefined,
        cancelReason: a.cancelReason,
        cancellable: false,
        markableNoShow: false,
        checkinLinkAvailable: false,
      });
      continue;
    }

    seenPromoterIds.add(a.promoterId);

    if (a.status === "no_show") {
      rows.push({
        promoterId: a.promoterId,
        fullName: a.fullName,
        phone: a.phone,
        state: "no_show",
        tier: TIER.no_show,
        minutesUntilStart: minsUntilStart,
        assignmentId: a.id,
        confirmedAt: a.confirmedAt,
        cancellable: false,
        markableNoShow: false,
        checkinLinkAvailable: false,
      });
      continue;
    }

    if (a.status === "completed") {
      rows.push({
        promoterId: a.promoterId,
        fullName: a.fullName,
        phone: a.phone,
        state: checkIn ? "checked_in" : "confirmed",
        tier: 2,
        minutesUntilStart: minsUntilStart,
        assignmentId: a.id,
        confirmedAt: a.confirmedAt,
        checkedInAt: checkIn?.checkedInAt,
        distanceM: checkIn?.distanceFromStoreM,
        withinGeofence: checkIn?.withinGeofence,
        cancellable: false,
        markableNoShow: false,
        checkinLinkAvailable: false,
      });
      continue;
    }

    // status === "confirmed" — the one status P38's "Σύνδεσμος check-in" control appears for.
    if (checkIn) {
      const manual = checkIn.method === "manual_override";
      rows.push({
        promoterId: a.promoterId,
        fullName: a.fullName,
        phone: a.phone,
        state: manual ? "checked_in_manual" : "checked_in",
        tier: manual ? TIER.checked_in_manual : TIER.checked_in,
        minutesUntilStart: minsUntilStart,
        assignmentId: a.id,
        confirmedAt: a.confirmedAt,
        checkedInAt: checkIn.checkedInAt,
        distanceM: checkIn.distanceFromStoreM,
        withinGeofence: checkIn.withinGeofence,
        cancellable: true,
        markableNoShow: false,
        checkinLinkAvailable: true,
      });
      continue;
    }

    // Confirmed, not checked in: an exception once the shift has actually started.
    rows.push({
      promoterId: a.promoterId,
      fullName: a.fullName,
      phone: a.phone,
      state: "confirmed",
      tier: started ? 0 : TIER.confirmed,
      minutesUntilStart: minsUntilStart,
      assignmentId: a.id,
      confirmedAt: a.confirmedAt,
      cancellable: true,
      markableNoShow: started,
      checkinLinkAvailable: true,
    });
  }

  // Latest invitation per promoter who has no assignment (an accepted invitation always has a
  // matching assignment row above, so this branch only ever sees pending/declined/expired).
  const latestInvitationByPromoter = new Map<string, RawInvitation>();
  for (const inv of invitations) {
    if (seenPromoterIds.has(inv.promoterId)) continue;
    if (inv.status === "accepted" || inv.status === "superseded") continue;
    const existing = latestInvitationByPromoter.get(inv.promoterId);
    if (!existing || inv.sentAt > existing.sentAt) latestInvitationByPromoter.set(inv.promoterId, inv);
  }

  for (const inv of latestInvitationByPromoter.values()) {
    if (inv.status === "declined") {
      rows.push({
        promoterId: inv.promoterId,
        fullName: inv.fullName,
        state: "declined",
        tier: TIER.declined,
        minutesUntilStart: minsUntilStart,
        sentAt: inv.sentAt,
        respondedAt: inv.respondedAt ?? undefined,
        declineReason: inv.declineReason,
        cancellable: false,
        markableNoShow: false,
        checkinLinkAvailable: false,
      });
      continue;
    }

    const expired = inv.status === "expired" || (inv.status === "pending" && inv.expiresAt < new Date().toISOString());
    if (expired) {
      rows.push({
        promoterId: inv.promoterId,
        fullName: inv.fullName,
        state: "expired",
        tier: TIER.expired,
        minutesUntilStart: minsUntilStart,
        sentAt: inv.sentAt,
        expiresAt: inv.expiresAt,
        cancellable: false,
        markableNoShow: false,
        checkinLinkAvailable: false,
      });
      continue;
    }

    // Still pending, not expired: urgent if the shift starts soon or has already started.
    const urgent = started || minsUntilStart <= URGENT_REPLY_WINDOW_MIN;
    rows.push({
      promoterId: inv.promoterId,
      fullName: inv.fullName,
      phone: inv.phone ?? null,
      invitationId: inv.id,
      state: "awaiting_reply",
      tier: urgent ? 0 : TIER.awaiting_reply,
      minutesUntilStart: minsUntilStart,
      sentAt: inv.sentAt,
      expiresAt: inv.expiresAt,
      cancellable: false,
      markableNoShow: false,
      checkinLinkAvailable: false,
    });
  }

  return rows.sort((a, b) => a.tier - b.tier || a.minutesUntilStart - b.minutesUntilStart);
}

export function summariseCoverage(
  requiredCount: number,
  assignments: RawAssignment[],
  invitations: RawInvitation[],
): CoverageSummary {
  const confirmedCount = assignments.filter((a) => a.status === "confirmed").length;
  const nowIso = new Date().toISOString();

  return {
    confirmedCount,
    requiredCount,
    coverageMet: confirmedCount >= requiredCount,
    pendingCount: invitations.filter((i) => i.status === "pending" && i.expiresAt >= nowIso).length,
    declines: invitations
      .filter((i) => i.status === "declined")
      .map((i) => ({ fullName: i.fullName, respondedAt: i.respondedAt, declineReason: i.declineReason })),
    cancellations: assignments
      .filter((a) => a.status === "cancelled")
      .map((a) => ({ fullName: a.fullName, cancelledAt: a.cancelledAt, cancelReason: a.cancelReason })),
  };
}
