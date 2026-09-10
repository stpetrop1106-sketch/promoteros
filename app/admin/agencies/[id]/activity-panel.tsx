"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Card, TextArea } from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";
import { REASON_MIN_LENGTH, type AdminErrorCode } from "@/lib/admin/errors";
import { formatAdminDate } from "@/lib/admin/labels";
import { loadAgencyActivity } from "./actions";
import { ACTIVITY_IDLE, type ActivityState } from "./state";

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

function Submit({ label, busyLabel }: { label: string; busyLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {pending ? busyLabel : label}
    </Button>
  );
}

/**
 * "A customer's operational data requires a typed reason and writes an audit row before the
 * data is shown — not after, not optionally" (commercial-architecture.md §5).
 *
 * That ordering is enforced in the database (`admin_view_agency_activity` writes the audit row,
 * then selects), and it is enforced here structurally too: this component has exactly two
 * states — the reason form, or the loaded data — and there is no code path that renders the
 * second without `loadAgencyActivity` having already returned a successful, already-logged
 * result.
 */
export function ActivityPanel({ agencyId }: { agencyId: string }) {
  const boundLoad = loadAgencyActivity.bind(null, agencyId);
  const [state, formAction] = useActionState<ActivityState, FormData>(boundLoad, ACTIVITY_IDLE);

  if (state.status === "loaded") {
    const { recentCampaigns, recentShifts } = state.activity;

    return (
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card
          header={
            <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">
              {t("admin.agency.recent_campaigns")}
            </h2>
          }
        >
          {recentCampaigns.length === 0 ? (
            <p className="text-sm text-[color:var(--color-muted)]">
              {t("admin.agency.no_recent_campaigns")}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-[color:var(--color-line)]">
              {recentCampaigns.map((c) => (
                <li key={c.id} className="py-2 text-sm first:pt-0 last:pb-0">
                  <p className="font-medium text-[color:var(--color-ink)]">{c.name}</p>
                  <p className="text-xs text-[color:var(--color-muted)]">
                    {c.status} · {formatAdminDate(c.startsOn)} – {formatAdminDate(c.endsOn)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          header={
            <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">
              {t("admin.agency.recent_shifts")}
            </h2>
          }
        >
          {recentShifts.length === 0 ? (
            <p className="text-sm text-[color:var(--color-muted)]">
              {t("admin.agency.no_recent_shifts")}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-[color:var(--color-line)]">
              {recentShifts.map((s) => (
                <li key={s.id} className="py-2 text-sm first:pt-0 last:pb-0">
                  <p className="font-medium text-[color:var(--color-ink)]">
                    {s.campaignName} · {s.storeName}
                  </p>
                  <p className="text-xs text-[color:var(--color-muted)]">
                    {formatAdminDate(s.onDate)}, {s.startTime}–{s.endTime} · {s.status}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    );
  }

  return (
    <Card
      className="mt-6"
      header={
        <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">
          {t("admin.agency.reason_gate_title")}
        </h2>
      }
    >
      <p className="text-sm text-[color:var(--color-muted)]">{t("admin.agency.reason_gate_body")}</p>
      <form action={formAction} className="mt-4 flex flex-col gap-3">
        <TextArea
          id="activity-reason"
          name="reason"
          label={t("admin.agency.reason_label")}
          hint={t("admin.agency.reason_hint")}
          placeholder={t("admin.agency.reason_placeholder")}
          required
          minLength={REASON_MIN_LENGTH}
          rows={2}
        />
        {state.status === "error" ? (
          <p role="alert" className="text-xs font-medium text-[color:var(--color-bad)]">
            {t(ERROR_KEYS[state.code ?? "unknown"])}
          </p>
        ) : null}
        <div>
          <Submit
            label={t("admin.agency.reason_submit")}
            busyLabel={t("admin.agency.reason_submitting")}
          />
        </div>
      </form>
    </Card>
  );
}
