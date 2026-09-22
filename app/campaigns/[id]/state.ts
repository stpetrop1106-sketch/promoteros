import type { TranslationKey } from "@/lib/i18n";

/**
 * State type and idle constant for `setCampaignStatus`, kept out of `actions.ts` on purpose —
 * CLAUDE.md's server/client boundary rule: a `"use server"` module may export only async
 * functions, so the constant a client component needs to seed `useActionState` has to live
 * beside it instead. Same split as `app/shifts/sections/state.ts` and `app/waitlist-state.ts`.
 */
export type CampaignStatusState = {
  status: "idle" | "done" | "error";
  error?: TranslationKey;
};

export const CAMPAIGN_STATUS_IDLE: CampaignStatusState = { status: "idle" };
