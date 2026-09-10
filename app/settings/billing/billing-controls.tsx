"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";
import type { BillingInterval, PlanId } from "@/lib/billing/plans";
import { startCheckout, openBillingPortal } from "./actions";
import { BILLING_IDLE, type BillingActionState, type BillingErrorCode } from "./state";

const t = translatorFor(DEFAULT_LOCALE);

/**
 * One sentence per failure, each saying what to do next. "Something went wrong" is banned by
 * `docs/commercial-architecture.md` §6, and a payment screen is the worst possible place for it:
 * a customer who cannot tell "we are not set up yet" from "your card was declined" writes to
 * support either way.
 */
const ERROR_KEYS: Record<BillingErrorCode, TranslationKey> = {
  not_owner: "billing.errors.not_owner",
  no_agency: "billing.errors.no_agency",
  not_configured: "billing.errors.not_configured",
  price_missing: "billing.errors.price_missing",
  plan_invalid: "billing.errors.plan_invalid",
  no_customer: "billing.errors.no_customer",
  stripe_unavailable: "billing.errors.stripe_unavailable",
  unknown: "billing.errors.unknown",
};

function ErrorNote({ state }: { state: BillingActionState }) {
  if (state.status !== "error") return null;

  return (
    <p role="alert" className="mt-2 text-xs font-medium text-[color:var(--color-bad)]">
      {t(ERROR_KEYS[state.code ?? "unknown"])}
    </p>
  );
}

function Submit({
  label,
  variant = "primary",
  disabled,
}: {
  label: string;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}) {
  // `useFormStatus` must be read from inside the form, hence a child component. Checkout ends in
  // a redirect to Stripe, so this spinner covers a real network hop and is not decorative.
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={variant} loading={pending} disabled={disabled}>
      {pending ? t("billing.cta.working") : label}
    </Button>
  );
}

export function SubscribeButton({
  planId,
  interval,
  label,
  disabled,
  variant = "primary",
}: {
  planId: PlanId;
  interval: BillingInterval;
  label: string;
  disabled?: boolean;
  variant?: "primary" | "secondary";
}) {
  const [state, action] = useActionState(startCheckout, BILLING_IDLE);

  return (
    <form action={action}>
      <input type="hidden" name="plan" value={planId} />
      <input type="hidden" name="interval" value={interval} />
      <Submit label={label} variant={variant} disabled={disabled} />
      <ErrorNote state={state} />
    </form>
  );
}

export function PortalButton({ label, disabled }: { label: string; disabled?: boolean }) {
  const [state, action] = useActionState(openBillingPortal, BILLING_IDLE);

  return (
    <form action={action}>
      <Submit label={label} variant="secondary" disabled={disabled} />
      <ErrorNote state={state} />
    </form>
  );
}
