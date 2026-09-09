"use client";

import { useState, useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, Card, TextField, SelectField, TextArea } from "@/components/ui";
import type { ButtonVariant } from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";
import { REASON_MIN_LENGTH, type AdminErrorCode } from "@/lib/admin/errors";
import { ASSIGNABLE_PLANS, type AssignablePlan } from "@/lib/admin/agencies";
import { PLAN_LABEL, formatAdminDate } from "@/lib/admin/labels";
import {
  runExtendTrial,
  runChangePlan,
  runSuspend,
  runUnsuspend,
  runMarkDeletion,
  runClearDeletion,
  MUTATION_IDLE,
  type MutationState,
} from "./actions";

const t = translatorFor(DEFAULT_LOCALE);

const ERROR_KEYS: Record<AdminErrorCode, TranslationKey> = {
  not_platform_admin: "admin.errors.unknown",
  action_required: "admin.errors.unknown",
  reason_required: "admin.errors.reason_required",
  agency_not_found: "admin.errors.agency_not_found",
  invalid_days: "admin.errors.invalid_days",
  invalid_plan: "admin.errors.invalid_plan",
  already_suspended: "admin.errors.already_suspended",
  not_suspended: "admin.errors.not_suspended",
  unknown: "admin.errors.unknown",
};

function ErrorNote({ code }: { code: AdminErrorCode }) {
  return (
    <p role="alert" className="text-xs font-medium text-[color:var(--color-bad)]">
      {t(ERROR_KEYS[code] ?? "admin.errors.unknown")}
    </p>
  );
}

function DoneNote({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium text-[color:var(--color-ok)]">{children}</p>;
}

function Submit({
  label,
  variant = "primary",
}: {
  label: string;
  variant?: ButtonVariant;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size="sm" loading={pending}>
      {label}
    </Button>
  );
}

function ReasonField({ id }: { id: string }) {
  return (
    <TextArea
      id={id}
      name="reason"
      label={t("admin.agency.reason_label")}
      hint={t("admin.agency.reason_hint")}
      placeholder={t("admin.agency.reason_placeholder")}
      required
      minLength={REASON_MIN_LENGTH}
      rows={2}
    />
  );
}

/* -------------------------------------------------------------- extend trial */

function ExtendTrialForm({ agencyId }: { agencyId: string }) {
  const bound = runExtendTrial.bind(null, agencyId);
  const [state, formAction] = useActionState<MutationState, FormData>(bound, MUTATION_IDLE);

  return (
    <Card
      header={
        <h3 className="text-sm font-semibold text-[color:var(--color-ink)]">
          {t("admin.agency.extend_trial.title")}
        </h3>
      }
    >
      <form action={formAction} className="flex flex-col gap-3">
        <TextField
          id="extend-days"
          name="days"
          type="number"
          min={1}
          max={365}
          defaultValue={7}
          label={t("admin.agency.extend_trial.days_label")}
          required
          containerClassName="max-w-[10rem]"
        />
        <ReasonField id="extend-reason" />
        {state.status === "error" ? <ErrorNote code={state.code ?? "unknown"} /> : null}
        {state.status === "done" && state.value ? (
          <DoneNote>
            {t("admin.agency.extend_trial.done", { when: formatAdminDate(state.value) })}
          </DoneNote>
        ) : null}
        <div>
          <Submit label={t("admin.agency.extend_trial.submit")} />
        </div>
      </form>
    </Card>
  );
}

/* --------------------------------------------------------------- change plan */

function ChangePlanForm({ agencyId, currentPlan }: { agencyId: string; currentPlan: string }) {
  const bound = runChangePlan.bind(null, agencyId);
  const [state, formAction] = useActionState<MutationState, FormData>(bound, MUTATION_IDLE);

  const options = ASSIGNABLE_PLANS.map((plan: AssignablePlan) => ({
    value: plan,
    label: t(PLAN_LABEL[plan] ?? "admin.plan.starter"),
  }));

  return (
    <Card
      header={
        <h3 className="text-sm font-semibold text-[color:var(--color-ink)]">
          {t("admin.agency.change_plan.title")}
        </h3>
      }
    >
      <form action={formAction} className="flex flex-col gap-3">
        <SelectField
          id="change-plan"
          name="plan"
          label={t("admin.agency.change_plan.plan_label")}
          defaultValue={currentPlan}
          options={options}
          containerClassName="max-w-xs"
        />
        <ReasonField id="plan-reason" />
        {state.status === "error" ? <ErrorNote code={state.code ?? "unknown"} /> : null}
        {state.status === "done" && state.value ? (
          <DoneNote>
            {t("admin.agency.change_plan.done", { plan: t(PLAN_LABEL[state.value] ?? "admin.plan.starter") })}
          </DoneNote>
        ) : null}
        <div>
          <Submit label={t("admin.agency.change_plan.submit")} />
        </div>
      </form>
    </Card>
  );
}

/* -------------------------------------------------------------------- suspend */

function SuspendForm({
  agencyId,
  agencyName,
  suspended,
  userCount,
  promoterCount,
}: {
  agencyId: string;
  agencyName: string;
  suspended: boolean;
  userCount: number;
  promoterCount: number;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const boundSuspend = runSuspend.bind(null, agencyId);
  const boundUnsuspend = runUnsuspend.bind(null, agencyId);
  const [suspendState, suspendAction] = useActionState<MutationState, FormData>(
    boundSuspend,
    MUTATION_IDLE,
  );
  const [unsuspendState, unsuspendAction] = useActionState<MutationState, FormData>(
    boundUnsuspend,
    MUTATION_IDLE,
  );

  if (suspended) {
    return (
      <Card
        header={
          <h3 className="text-sm font-semibold text-[color:var(--color-ink)]">
            {t("admin.agency.unsuspend.title")}
          </h3>
        }
      >
        <form action={unsuspendAction} className="flex flex-col gap-3">
          <ReasonField id="unsuspend-reason" />
          {unsuspendState.status === "error" ? (
            <ErrorNote code={unsuspendState.code ?? "unknown"} />
          ) : null}
          {unsuspendState.status === "done" ? (
            <DoneNote>{t("admin.agency.action_done")}</DoneNote>
          ) : null}
          <div>
            <Submit label={t("admin.agency.unsuspend.submit")} />
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card
      header={
        <h3 className="text-sm font-semibold text-[color:var(--color-ink)]">
          {t("admin.agency.suspend.title")}
        </h3>
      }
    >
      <p className="text-sm text-[color:var(--color-muted)]">{t("admin.agency.suspend.body")}</p>

      {!confirmOpen ? (
        <div className="mt-3">
          <Button variant="danger" size="sm" onClick={() => setConfirmOpen(true)}>
            {t("admin.agency.suspend.title")}
          </Button>
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-[color:var(--color-bad)] bg-[color:var(--color-bad)]/5 p-3">
          {/* Confirmation shows consequences with counts — commercial-architecture.md §6. */}
          <p className="text-sm font-medium text-[color:var(--color-ink)]">
            {t("admin.agency.suspend.confirm_title", {
              name: agencyName,
              users: userCount,
              promoters: promoterCount,
            })}
          </p>
          <form action={suspendAction} className="mt-3 flex flex-col gap-3">
            <ReasonField id="suspend-reason" />
            {suspendState.status === "error" ? (
              <ErrorNote code={suspendState.code ?? "unknown"} />
            ) : null}
            <div className="flex items-center gap-2">
              <Submit label={t("admin.agency.suspend.submit")} variant="danger" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmOpen(false)}
              >
                {t("admin.agency.suspend.cancel")}
              </Button>
            </div>
          </form>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ deletion */

function DeletionForm({
  agencyId,
  deletionRequested,
}: {
  agencyId: string;
  deletionRequested: boolean;
}) {
  const boundMark = runMarkDeletion.bind(null, agencyId);
  const boundClear = runClearDeletion.bind(null, agencyId);
  const [markState, markAction] = useActionState<MutationState, FormData>(boundMark, MUTATION_IDLE);
  const [clearState, clearAction] = useActionState<MutationState, FormData>(
    boundClear,
    MUTATION_IDLE,
  );

  return (
    <Card
      header={
        <h3 className="text-sm font-semibold text-[color:var(--color-ink)]">
          {t("admin.agency.deletion.title")}
        </h3>
      }
    >
      <p className="text-sm text-[color:var(--color-muted)]">{t("admin.agency.deletion.body")}</p>

      {deletionRequested ? (
        <form action={clearAction} className="mt-3 flex flex-col gap-3">
          <ReasonField id="clear-deletion-reason" />
          {clearState.status === "error" ? <ErrorNote code={clearState.code ?? "unknown"} /> : null}
          {clearState.status === "done" ? <DoneNote>{t("admin.agency.action_done")}</DoneNote> : null}
          <div>
            <Submit label={t("admin.agency.deletion.clear_submit")} variant="secondary" />
          </div>
        </form>
      ) : (
        <form action={markAction} className="mt-3 flex flex-col gap-3">
          <ReasonField id="mark-deletion-reason" />
          {markState.status === "error" ? <ErrorNote code={markState.code ?? "unknown"} /> : null}
          {markState.status === "done" ? <DoneNote>{t("admin.agency.action_done")}</DoneNote> : null}
          <div>
            <Submit label={t("admin.agency.deletion.mark_submit")} variant="secondary" />
          </div>
        </form>
      )}
    </Card>
  );
}

/* --------------------------------------------------------------------- panel */

/**
 * Read-only by default; acting requires an explicit, visible mode change
 * (commercial-architecture.md §6). Toggling this on is not itself logged — nothing has happened
 * yet — but every form inside it writes its own audit row before it mutates anything, via the
 * `_admin_write_audit` call inside each `0013_admin.sql` function.
 */
export function ActionsPanel({
  agencyId,
  agencyName,
  currentPlan,
  suspended,
  deletionRequested,
  userCount,
  promoterCount,
}: {
  agencyId: string;
  agencyName: string;
  currentPlan: string;
  suspended: boolean;
  deletionRequested: boolean;
  userCount: number;
  promoterCount: number;
}) {
  const [enabled, setEnabled] = useState(false);

  if (!enabled) {
    return (
      <div className="mt-6">
        <Button variant="secondary" onClick={() => setEnabled(true)}>
          {t("admin.agency.actions_toggle_on")}
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[color:var(--color-warn)] bg-[color:var(--color-warn)]/10 px-4 py-3">
        <p className="text-sm font-medium text-[color:var(--color-ink)]">
          {t("admin.agency.actions_mode_banner")}
        </p>
        <Button variant="ghost" size="sm" onClick={() => setEnabled(false)}>
          {t("admin.agency.actions_toggle_off")}
        </Button>
      </div>

      <ExtendTrialForm agencyId={agencyId} />
      <ChangePlanForm agencyId={agencyId} currentPlan={currentPlan} />
      <SuspendForm
        agencyId={agencyId}
        agencyName={agencyName}
        suspended={suspended}
        userCount={userCount}
        promoterCount={promoterCount}
      />
      <DeletionForm agencyId={agencyId} deletionRequested={deletionRequested} />

      <p className="text-xs text-[color:var(--color-muted)]">{t("admin.agency.enforcement_note")}</p>
    </div>
  );
}
