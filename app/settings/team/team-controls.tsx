"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button, SelectField, TextField, Icon } from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";
import { ASSIGNABLE_ROLES, type TeamRole } from "@/lib/team-shared";
import type { TeamErrorCode } from "@/lib/team";
import {
  inviteTeamMember,
  changeMemberRole,
  removeMember,
  revokeInvitation,
} from "./actions";
import { INVITE_IDLE, MUTATION_IDLE, type InviteState, type MutationState } from "./state";

const t = translatorFor(DEFAULT_LOCALE);

// P27 — `checkTeamWriteAllowed()` (lib/team.ts) returns a fully-resolved sentence, not a
// `TeamErrorCode` (see its note: a new code would break the exhaustive `ERROR_KEYS` map below).
// Same trick as `app/promoters/promoter-form.tsx`'s `GeneralError`: split the sentence on the
// word for "Billing" and turn just that word into a real link to /settings/billing, instead of
// naming it as inert prose.
const BILLING_WORD = t("enforcement.banner.billing_cta");

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

/**
 * `message` (a resolved sentence from `checkTeamWriteAllowed()`) takes priority over `code` when
 * both could apply — see the P27 note above `BILLING_WORD`. Every action still passes `code`
 * unconditionally, so this is the only branch point; nothing else in the file needs to know
 * about billing blocks specifically.
 */
/** A field-adjacent note, not a full banner — several of these render one per row in a dense
 * member list, where a banner's padding and border would overwhelm the row it belongs to. */
function ErrorNote({ code, message }: { code: TeamErrorCode; message?: string }) {
  if (message) {
    const at = message.indexOf(BILLING_WORD);
    return (
      <p role="alert" className="flex items-start gap-1.5 text-xs font-medium leading-5 text-[color:var(--color-bad-ink)]">
        <span aria-hidden="true" className="mt-1 size-1.5 shrink-0 rounded-full bg-[color:var(--color-bad)]" />
        <span>
          {at === -1 ? (
            message
          ) : (
            <>
              {message.slice(0, at)}
              <Link href="/settings/billing" className="font-semibold underline hover:no-underline">
                {BILLING_WORD}
              </Link>
              {message.slice(at + BILLING_WORD.length)}
            </>
          )}
        </span>
      </p>
    );
  }

  return (
    <p role="alert" className="flex items-start gap-1.5 text-xs font-medium leading-5 text-[color:var(--color-bad-ink)]">
      <span aria-hidden="true" className="mt-1 size-1.5 shrink-0 rounded-full bg-[color:var(--color-bad)]" />
      <span>{t(ERROR_KEYS[code] ?? "team.errors.unknown")}</span>
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
      <div
        role="status"
        className="flex items-start gap-2.5 rounded-xl border border-[color:var(--color-warn-line)] bg-[color:var(--color-warn-subtle)] px-4 py-3 text-sm leading-5 text-[color:var(--color-warn-ink)]"
      >
        <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">{t("team.invite.no_seats_title")}</p>
          <p className="mt-1 opacity-90">{t("team.invite.no_seats_body")}</p>
        </div>
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
          <ErrorNote code={state.code ?? "unknown"} message={state.message} />
        ) : null}

        <div>
          <Submit label={t("team.invite.submit")} busyLabel={t("team.invite.submitting")} />
        </div>
      </form>

      {state.status === "sent" && state.url ? (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-[color:var(--color-ok-line)] bg-[color:var(--color-ok-subtle)] px-4 py-3 text-sm leading-5 text-[color:var(--color-ok-ink)]"
        >
          <Icon name="check" size={18} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{t("team.invite.sent_title", { email: state.email ?? "" })}</p>
            <p className="mt-1 opacity-90">{t("team.invite.sent_body")}</p>
            <p className="mt-2 break-all rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-2 py-1 font-mono text-xs text-[color:var(--color-ink)]">
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
      {state.status === "error" ? <ErrorNote code={state.code ?? "unknown"} message={state.message} /> : null}
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
        {state.status === "error" ? <ErrorNote code={state.code ?? "unknown"} message={state.message} /> : null}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[color:var(--color-bad-line)] bg-[color:var(--color-bad-subtle)] p-4">
      <p className="text-sm font-semibold text-[color:var(--color-bad-ink)]">
        {t("team.remove.confirm_title", { name })}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-[color:var(--color-ink-soft)]">
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
      {state.status === "error" ? <ErrorNote code={state.code ?? "unknown"} message={state.message} /> : null}
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
      {state.status === "error" ? <ErrorNote code={state.code ?? "unknown"} message={state.message} /> : null}
    </form>
  );
}
