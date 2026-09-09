"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button, SelectField, TextField } from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";
import { ASSIGNABLE_ROLES, type TeamErrorCode, type TeamRole } from "@/lib/team";
import {
  inviteTeamMember,
  changeMemberRole,
  removeMember,
  revokeInvitation,
  INVITE_IDLE,
  MUTATION_IDLE,
  type InviteState,
  type MutationState,
} from "./actions";

const t = translatorFor(DEFAULT_LOCALE);

/**
 * One sentence per failure. `unknown` is the only generic one and it still says what to do
 * next — "Something went wrong" on its own is banned by commercial-architecture §6.
 */
const ERROR_KEYS: Record<TeamErrorCode, TranslationKey> = {
  not_authenticated: "team.errors.not_authenticated",
  not_owner: "team.errors.not_owner",
  no_agency: "team.errors.no_agency",
  no_email: "team.errors.no_email",
  email_invalid: "team.errors.email_invalid",
  role_invalid: "team.errors.role_invalid",
  token_invalid: "team.errors.token_invalid",
  expiry_invalid: "team.errors.token_invalid",
  already_member: "team.errors.already_member",
  belongs_to_other_agency: "team.errors.belongs_to_other_agency",
  seat_limit_reached: "team.errors.seat_limit_reached",
  invitation_not_found: "team.errors.invitation_not_found",
  invitation_used: "team.errors.invitation_used",
  invitation_expired: "team.errors.invitation_expired",
  invitation_email_mismatch: "team.errors.invitation_email_mismatch",
  already_in_agency: "team.errors.already_in_agency",
  member_not_found: "team.errors.member_not_found",
  member_inactive: "team.errors.member_inactive",
  cannot_change_own_role: "team.errors.cannot_change_own_role",
  cannot_remove_self: "team.errors.cannot_remove_self",
  last_owner: "team.errors.last_owner",
  name_too_short: "team.errors.unknown",
  signing_secret_missing: "team.errors.signing_secret_missing",
  unknown: "team.errors.unknown",
};

const ROLE_LABEL: Record<TeamRole, TranslationKey> = {
  owner: "team.role.owner",
  coordinator: "team.role.coordinator",
  supervisor: "team.role.supervisor",
  admin: "team.role.admin",
};

function ErrorNote({ code }: { code: TeamErrorCode }) {
  return (
    <p role="alert" className="text-xs font-medium text-[color:var(--color-bad)]">
      {t(ERROR_KEYS[code] ?? "team.errors.unknown")}
    </p>
  );
}

function Submit({ label, busyLabel, variant = "primary", size = "md" }: {
  label: string;
  busyLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} loading={pending}>
      {pending && busyLabel ? busyLabel : label}
    </Button>
  );
}

function roleOptions() {
  return ASSIGNABLE_ROLES.map((role) => ({ value: role, label: t(ROLE_LABEL[role]) }));
}

/* ------------------------------------------------------------------ invite */

export function InviteForm({ seatsRemaining }: { seatsRemaining: number }) {
  const [state, formAction] = useActionState<InviteState, FormData>(inviteTeamMember, INVITE_IDLE);
  const [copied, setCopied] = useState(false);

  if (seatsRemaining <= 0 && state.status !== "sent") {
    return (
      <div className="rounded-lg border border-[color:var(--color-warn)] bg-[color:var(--color-warn)]/10 px-4 py-3 text-sm text-[color:var(--color-ink)]">
        <p className="font-medium">{t("team.invite.no_seats_title")}</p>
        <p className="mt-1 text-[color:var(--color-muted)]">{t("team.invite.no_seats_body")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4">
        <TextField
          id="invite-email"
          name="email"
          type="email"
          label={t("team.invite.email_label")}
          hint={t("team.invite.email_hint")}
          placeholder={t("team.invite.email_placeholder")}
          error={
            state.status === "error" && state.code === "email_invalid"
              ? t("team.errors.email_invalid")
              : undefined
          }
          required
          maxLength={200}
          autoComplete="off"
        />

        <SelectField
          id="invite-role"
          name="role"
          label={t("team.invite.role_label")}
          hint={t("team.invite.role_hint")}
          defaultValue="coordinator"
          options={roleOptions()}
        />

        {state.status === "error" && state.code !== "email_invalid" ? (
          <ErrorNote code={state.code ?? "unknown"} />
        ) : null}

        <div>
          <Submit label={t("team.invite.submit")} busyLabel={t("team.invite.submitting")} />
        </div>
      </form>

      {state.status === "sent" && state.url ? (
        <div className="rounded-lg border border-[color:var(--color-ok)] bg-[color:var(--color-ok)]/10 px-4 py-3 text-sm">
          <p className="font-medium text-[color:var(--color-ink)]">
            {t("team.invite.sent_title", { email: state.email ?? "" })}
          </p>
          <p className="mt-1 text-[color:var(--color-muted)]">{t("team.invite.sent_body")}</p>
          <p className="mt-2 break-all rounded border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-2 py-1 font-mono text-xs text-[color:var(--color-ink)]">
            {state.url}
          </p>
          <div className="mt-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                navigator.clipboard?.writeText(state.url ?? "").then(
                  () => setCopied(true),
                  () => setCopied(false),
                );
              }}
            >
              {copied ? t("team.invite.copied") : t("team.invite.copy_link")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------- role change */

export function RoleControl({
  userId,
  currentRole,
  disabledReasonKey,
}: {
  userId: string;
  currentRole: TeamRole;
  /** Set when this row's role may not be changed — the reason is shown instead of the control. */
  disabledReasonKey?: TranslationKey;
}) {
  const [state, formAction] = useActionState<MutationState, FormData>(
    changeMemberRole,
    MUTATION_IDLE,
  );

  if (disabledReasonKey) {
    return <p className="text-xs text-[color:var(--color-muted)]">{t(disabledReasonKey)}</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex flex-wrap items-end gap-2">
        <SelectField
          id={`role-${userId}`}
          name="role"
          label={t("team.role_change.label")}
          defaultValue={currentRole === "admin" ? "coordinator" : currentRole}
          options={roleOptions()}
          containerClassName="w-44"
        />
        <Submit label={t("team.role_change.submit")} size="sm" variant="secondary" />
      </div>
      {state.status === "error" ? <ErrorNote code={state.code ?? "unknown"} /> : null}
      {state.status === "done" ? (
        <p className="text-xs font-medium text-[color:var(--color-ok)]">
          {t("team.role_change.done")}
        </p>
      ) : null}
    </form>
  );
}

/* ------------------------------------------------------------------ removal */

/**
 * Destructive, so it is deliberately not adjacent to the ordinary controls and never one click:
 * the button opens a panel that spells out the consequences before the danger button appears.
 */
export function RemoveControl({
  userId,
  name,
  blockedReasonKey,
}: {
  userId: string;
  name: string;
  blockedReasonKey?: TranslationKey;
}) {
  const [state, formAction] = useActionState<MutationState, FormData>(removeMember, MUTATION_IDLE);
  const [open, setOpen] = useState(false);

  if (blockedReasonKey) {
    return <p className="text-xs text-[color:var(--color-muted)]">{t(blockedReasonKey)}</p>;
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-1">
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
          {t("team.remove.action")}
        </Button>
        {state.status === "error" ? <ErrorNote code={state.code ?? "unknown"} /> : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[color:var(--color-bad)] bg-[color:var(--color-bad)]/5 p-3">
      <p className="text-sm font-medium text-[color:var(--color-ink)]">
        {t("team.remove.confirm_title", { name })}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[color:var(--color-muted)]">
        <li>{t("team.remove.consequence_access")}</li>
        <li>{t("team.remove.consequence_history")}</li>
        <li>{t("team.remove.consequence_seat")}</li>
      </ul>
      <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
        <input type="hidden" name="userId" value={userId} />
        <Submit label={t("team.remove.confirm")} variant="danger" size="sm" />
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          {t("team.remove.cancel")}
        </Button>
      </form>
      {state.status === "error" ? <ErrorNote code={state.code ?? "unknown"} /> : null}
    </div>
  );
}

/* -------------------------------------------------------- invitation revoke */

export function RevokeControl({ invitationId }: { invitationId: string }) {
  const [state, formAction] = useActionState<MutationState, FormData>(
    revokeInvitation,
    MUTATION_IDLE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="invitationId" value={invitationId} />
      <Submit label={t("team.pending.revoke")} size="sm" variant="ghost" />
      {state.status === "error" ? <ErrorNote code={state.code ?? "unknown"} /> : null}
    </form>
  );
}
