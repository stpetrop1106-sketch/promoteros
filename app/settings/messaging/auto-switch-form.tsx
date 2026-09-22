"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Badge, Button, Icon } from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";
import { saveAutoAvailabilityLinks } from "./actions";
import { AUTO_SWITCH_IDLE, type AutoSwitchState, type MessagingErrorCode } from "./state";

const t = translatorFor(DEFAULT_LOCALE);

export const ERROR_KEYS: Record<MessagingErrorCode, TranslationKey> = {
  subscription_read_only: "enforcement.messaging.blocked_read_only_auto",
  not_owner: "messaging.errors.not_owner",
  migration_missing: "messaging.errors.migration_missing",
  email_not_configured: "messaging.errors.email_not_configured",
  write_not_permitted: "messaging.errors.write_not_permitted",
  unknown: "messaging.errors.unknown",
};

function Toggle({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      name="enabled"
      value={enabled ? "false" : "true"}
      variant={enabled ? "secondary" : "primary"}
      size="sm"
      loading={pending}
    >
      {enabled ? t("messaging.auto.turn_off") : t("messaging.auto.turn_on")}
    </Button>
  );
}

/** Owner only — the page renders a read-only badge for everyone else. */
export function AutoSwitchForm({ enabled }: { enabled: boolean }) {
  const [state, formAction] = useActionState<AutoSwitchState, FormData>(
    saveAutoAvailabilityLinks,
    AUTO_SWITCH_IDLE,
  );

  // After a save the server re-renders with the new value, but the action state is the fresher
  // source for this one render.
  const current = state.status === "saved" ? state.enabled : enabled;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge variant={current ? "ok" : "neutral"} dot>
          {current ? t("messaging.auto.state_on") : t("messaging.auto.state_off")}
        </Badge>
        <Toggle enabled={current} />
      </div>

      {state.status === "error" ? (
        <p
          role="alert"
          className="flex items-start gap-2 text-sm leading-5 text-[color:var(--color-bad-ink)]"
        >
          <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
          {t(ERROR_KEYS[state.code])}
        </p>
      ) : null}
    </form>
  );
}
