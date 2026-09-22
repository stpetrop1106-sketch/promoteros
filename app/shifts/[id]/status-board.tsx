import {
  Avatar,
  Badge,
  EmptyState,
  Icon,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
  type BadgeVariant,
} from "@/components/ui";
import type { TranslationKey } from "@/lib/i18n";
import { formatAthens } from "./time";
import type { BoardRow, BoardRowState } from "./board";
import { CancelAssignmentButton } from "./cancel-assignment-button";
import { MarkNoShowButton } from "./mark-no-show-button";
import { CheckinLinkButton } from "./checkin-link-button";
import { InvitationLinkButton } from "./invitation-link-button";

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

const STATE_KEY: Record<BoardRowState, TranslationKey> = {
  awaiting_reply: "shifts.board.state.awaiting_reply",
  expired: "shifts.board.state.expired",
  declined: "shifts.board.state.declined",
  confirmed: "shifts.board.state.confirmed",
  checked_in: "shifts.board.state.checked_in",
  checked_in_manual: "shifts.board.state.checked_in_manual",
  no_show: "shifts.board.state.no_show",
  cancelled: "shifts.board.state.cancelled",
};

/** Badge colour follows urgency (`tier`), not the raw state — an "awaiting reply" 10 minutes
 *  before the shift is a different colour from one three days out, even though the state label
 *  reads the same. This is the whole point of P10: exceptions carry a colour that means
 *  something, not just a status word. */
function badgeVariant(row: BoardRow): BadgeVariant {
  if (row.tier === 0) return "bad";
  if (row.tier === 1) return "warn";
  if (row.tier === 3) return "neutral";
  // Arrived, but the phone put them far from the store. Still a check-in — location never decides
  // whether someone is paid (CLAUDE.md §3) — yet it must not wear the same green as an arrival
  // five metres from the door. The dashboard raises it as `checked_in_outside_geofence`; this
  // makes the shift page agree with it.
  if (row.state === "checked_in" && row.withinGeofence === false) return "warn";
  return row.state === "checked_in" || row.state === "confirmed" ? "ok" : "neutral";
}

function DetailLines({ row, t }: { row: BoardRow; t: T }) {
  const lines: string[] = [];

  if (row.sentAt) lines.push(t("shifts.board.sent_at", { when: formatAthens(row.sentAt) }));
  if (row.state === "awaiting_reply" || row.state === "expired") {
    if (row.expiresAt) lines.push(t("shifts.board.expires_at", { when: formatAthens(row.expiresAt) }));
  }
  if (row.respondedAt) lines.push(t("shifts.board.responded_at", { when: formatAthens(row.respondedAt) }));
  if (row.declineReason) lines.push(t("shifts.board.reason_label", { reason: row.declineReason }));
  if (row.confirmedAt && row.state !== "checked_in" && row.state !== "checked_in_manual") {
    lines.push(t("shifts.board.confirmed_at", { when: formatAthens(row.confirmedAt) }));
  }
  if (row.checkedInAt) {
    lines.push(t("shifts.board.checked_in_at", { when: formatAthens(row.checkedInAt) }));
    if (row.distanceM !== null && row.distanceM !== undefined) {
      lines.push(t("shifts.board.distance", { m: row.distanceM }));
    }
    if (row.withinGeofence !== null && row.withinGeofence !== undefined) {
      lines.push(t(row.withinGeofence ? "shifts.board.within_geofence" : "shifts.board.outside_geofence"));
    }
  }
  if (row.cancelledAt) lines.push(t("shifts.board.cancelled_at", { when: formatAthens(row.cancelledAt) }));
  if (row.cancelReason) lines.push(t("shifts.board.reason_label", { reason: row.cancelReason }));
  if (row.tier === 0 && row.state === "confirmed") lines.push(t("shifts.board.started_no_checkin"));

  return (
    <div className="flex flex-col gap-0.5 text-xs text-[color:var(--color-muted)]">
      {lines.map((line, i) => (
        <span key={i}>{line}</span>
      ))}
    </div>
  );
}

export function StatusBoard({ shiftId, rows, t }: { shiftId: string; rows: BoardRow[]; t: T }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Icon name="users" size={24} />}
        title={t("shifts.board.none_title")}
        description={t("shifts.board.none_description")}
      />
    );
  }

  return (
    <Table label={t("shifts.board.title")} layout="fluid">
      <TableHead>
        <TableRow>
          <TableHeaderCell>{t("shifts.board.column.promoter")}</TableHeaderCell>
          <TableHeaderCell>{t("shifts.board.column.state")}</TableHeaderCell>
          <TableHeaderCell>{t("shifts.board.column.detail")}</TableHeaderCell>
          <TableHeaderCell className="text-right">{t("shifts.board.column.actions")}</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.assignmentId ?? row.promoterId}>
            <TableCell className="font-medium text-[color:var(--color-ink)]">
              <div className="flex items-center gap-2.5">
                <Avatar name={row.fullName} size="sm" />
                {row.fullName}
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={badgeVariant(row)} dot>{t(STATE_KEY[row.state])}</Badge>
            </TableCell>
            <TableCell>
              <DetailLines row={row} t={t} />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex flex-col items-end gap-2">
                {/* A2 finding 7 — an `awaiting_reply` row used to have nothing here at all. */}
                {row.state === "awaiting_reply" && row.invitationId ? (
                  <InvitationLinkButton
                    shiftId={shiftId}
                    invitationId={row.invitationId}
                    fullName={row.fullName}
                    phone={row.phone}
                  />
                ) : null}
                {row.checkinLinkAvailable && row.assignmentId ? (
                  <CheckinLinkButton
                    shiftId={shiftId}
                    assignmentId={row.assignmentId}
                    phone={row.phone}
                    label={t("shifts.board.checkin_link_action")}
                  />
                ) : null}
                {row.markableNoShow && row.assignmentId ? (
                  <MarkNoShowButton
                    shiftId={shiftId}
                    assignmentId={row.assignmentId}
                    label={t("shifts.board.no_show_action")}
                    confirmText={t("shifts.board.no_show_confirm", { name: row.fullName })}
                    confirmLabel={t("shifts.board.no_show_confirm_yes")}
                    cancelLabel={t("shifts.board.confirm_no")}
                  />
                ) : null}
                {row.cancellable && row.assignmentId ? (
                  <CancelAssignmentButton
                    shiftId={shiftId}
                    assignmentId={row.assignmentId}
                    label={t("shifts.board.cancel_action")}
                    confirmText={t("shifts.board.cancel_confirm", { name: row.fullName })}
                    confirmLabel={t("shifts.board.cancel_confirm_yes")}
                    cancelLabel={t("shifts.board.confirm_no")}
                    reasonLabel={t("shifts.board.cancel_reason_label")}
                    reasonPlaceholder={t("shifts.board.cancel_reason_placeholder")}
                  />
                ) : null}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
