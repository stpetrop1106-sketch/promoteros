"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Icon } from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";
import { acceptInvitation } from "./actions";
import { ACCEPT_IDLE, type AcceptState } from "./state";
import type { TeamErrorCode } from "@/lib/team";

const t = translatorFor(DEFAULT_LOCALE);

/**
 * Every code the accept path can produce gets its own sentence. "Something went wrong" is
 * banned (docs/commercial-architecture.md §6), and each of these tells the reader what to do
 * next rather than only what failed.
 */
const ERROR_KEYS: Partial<Record<TeamErrorCode, TranslationKey>> = {
  invitation_not_found: "team.errors.invitation_not_found",
  invitation_used: "team.errors.invitation_used",
  invitation_expired: "team.errors.invitation_expired",
  invitation_email_mismatch: "team.errors.invitation_email_mismatch",
  already_in_agency: "team.errors.already_in_agency",
  seat_limit_reached: "team.errors.seat_limit_reached_accept",
  not_authenticated: "team.errors.not_authenticated",
  no_email: "team.errors.no_email",
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {pending ? t("onboarding.join.accepting") : t("onboarding.join.accept")}
    </Button>
  );
}

export function AcceptForm({ token }: { token: string }) {
  const [state, formAction] = useActionState<AcceptState, FormData>(
    acceptInvitation,
    ACCEPT_IDLE,
  );

  const errorKey = state.code ? ERROR_KEYS[state.code] : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />

      {state.status === "error" ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-[color:var(--color-bad-line)] bg-[color:var(--color-bad-subtle)] px-4 py-3 text-sm leading-5 text-[color:var(--color-bad-ink)]"
        >
          <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">{errorKey ? t(errorKey) : t("team.errors.unknown")}</p>
            <Link href="/onboarding" className="mt-1 inline-block font-semibold underline hover:no-underline">
              {t("onboarding.join.error_way_out")}
            </Link>
          </div>
        </div>
      ) : null}

      <SubmitButton />
    </form>
  );
}
