"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Icon } from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { sendAvailabilityLinksNow } from "./actions";
import { SEND_NOW_IDLE, type SendNowState } from "./state";
import { ERROR_KEYS } from "./auto-switch-form";

const t = translatorFor(DEFAULT_LOCALE);

function ConfirmButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending} iconLeft={<Icon name="message" size={14} />}>
      {t("messaging.send_now.confirm", { count })}
    </Button>
  );
}

/**
 * "Στείλε τώρα σε όλους", in two steps: the first tap says exactly how many people will get an
 * email, the second sends. Owner only — the page does not render this for anyone else, and the
 * action re-checks.
 */
export function SendNow({
  reachable,
  alreadySentToday,
  unreachable,
}: {
  /** Active promoters with a usable email address. */
  reachable: number;
  /** Of those, already emailed by an earlier "send now" today — they will not get a second one. */
  alreadySentToday: number;
  /** Promoters the email cannot reach; listed below the button. */
  unreachable: number;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction] = useActionState<SendNowState, FormData>(
    sendAvailabilityLinksNow,
    SEND_NOW_IDLE,
  );

  const willReceive = Math.max(0, reachable - alreadySentToday);

  if (state.status === "started") {
    return (
      <div
        role="status"
        className="flex items-start gap-2.5 rounded-xl border border-[color:var(--color-ok-line)] bg-[color:var(--color-ok-subtle)] px-4 py-3 text-sm leading-5 text-[color:var(--color-ok-ink)]"
      >
        <Icon name="check" size={18} className="mt-0.5 shrink-0" />
        <span>{t("messaging.send_now.started", { count: willReceive })}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {!confirming ? (
        <div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={willReceive === 0}
            onClick={() => setConfirming(true)}
            iconLeft={<Icon name="message" size={14} />}
          >
            {t("messaging.send_now.button")}
          </Button>
          {willReceive === 0 ? (
            <p className="mt-2 text-xs leading-5 text-[color:var(--color-muted)]">
              {reachable === 0 ? t("messaging.send_now.nobody") : t("messaging.send_now.all_sent_today")}
            </p>
          ) : null}
        </div>
      ) : (
        <form
          action={formAction}
          className="flex flex-col gap-3 rounded-xl border border-[color:var(--color-line-strong)] bg-[color:var(--color-n-25)] p-4"
        >
          <p className="text-sm font-semibold text-[color:var(--color-ink)]">
            {t("messaging.send_now.confirm_title", { count: willReceive })}
          </p>
          <ul className="flex flex-col gap-1 text-sm leading-5 text-[color:var(--color-muted)]">
            {alreadySentToday > 0 ? (
              <li>{t("messaging.send_now.confirm_already", { count: alreadySentToday })}</li>
            ) : null}
            {unreachable > 0 ? (
              <li>{t("messaging.send_now.confirm_unreachable", { count: unreachable })}</li>
            ) : null}
            <li>{t("messaging.send_now.confirm_once")}</li>
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            <ConfirmButton count={willReceive} />
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      )}

      {state.status === "error" ? (
        <p role="alert" className="flex items-start gap-2 text-sm leading-5 text-[color:var(--color-bad-ink)]">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
          {t(ERROR_KEYS[state.code])}
        </p>
      ) : null}
    </div>
  );
}
