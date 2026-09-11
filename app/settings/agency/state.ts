import type { AgencyIdentityErrorCode } from "@/lib/agency-settings";

/**
 * Action state and client-shared constants for the agency identity form.
 *
 * The state type lives here rather than in `actions.ts` for the reason `app/settings/team/state.ts`
 * and `app/onboarding/state.ts` both document: a `"use server"` module may only export async
 * functions, so `IDENTITY_IDLE` exported from `actions.ts` would reach `useActionState` as
 * `undefined` on the client instead of failing the build. The type import above is erased at
 * compile time, so it does not pull `lib/agency-settings.ts` — `server-only` — into the client
 * bundle.
 *
 * `RETENTION_MONTHS_MIN`/`MAX` below are a second instance of the same CLAUDE.md rule: a
 * `server-only` module must never be imported by a client component for a *value* (only a
 * type-only import is erased and safe). `agency-identity-form.tsx` needs these two numbers for
 * its `<input min max>` attributes, so they are duplicated here — plain numbers, not re-exports —
 * rather than imported as values from `lib/agency-settings.ts`, which is exactly what broke
 * `npm run build` the first time this file was written. Keep both copies in sync with 0014's
 * check constraint (`promoter_retention_months between 1 and 240`) if it ever changes.
 */
export type AgencyIdentityFormState = {
  status: "idle" | "saved" | "error";
  code?: AgencyIdentityErrorCode;
};

export const IDENTITY_IDLE: AgencyIdentityFormState = { status: "idle" };

export const RETENTION_MONTHS_MIN = 1;
export const RETENTION_MONTHS_MAX = 240;
