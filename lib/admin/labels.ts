import type { BadgeVariant } from "@/components/ui";
import type { TranslationKey } from "@/lib/i18n";

/**
 * Shared between the agency list table (client component) and the agency detail page (server
 * component), so plan/status labelling never drifts between the two screens. No `server-only`
 * import here on purpose — plain data, safe on either side.
 */

export const PLAN_LABEL: Record<string, TranslationKey> = {
  starter: "admin.plan.starter",
  agency: "admin.plan.agency",
  multi_brand: "admin.plan.multi_brand",
};

export const STATUS_LABEL: Record<string, TranslationKey> = {
  trialing: "admin.status.trialing",
  active: "admin.status.active",
  past_due: "admin.status.past_due",
  canceled: "admin.status.canceled",
  paused: "admin.status.paused",
};

export const STATUS_VARIANT: Record<string, BadgeVariant> = {
  trialing: "info",
  active: "ok",
  past_due: "warn",
  canceled: "neutral",
  paused: "neutral",
};

export function formatAdminDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
}
