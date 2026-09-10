/**
 * Plain data and action state for the onboarding screens.
 *
 * These live outside `app/onboarding/actions.ts` deliberately. A module carrying the `"use
 * server"` directive may only export async functions — every other export is replaced by
 * `undefined` on the client rather than rejected at build time. `agency-form.tsx` passes
 * `CREATE_AGENCY_IDLE` to `useActionState` and reads `TIMEZONES` to build the dropdown, so
 * exporting either from the actions module made them `undefined` on the client: the form's
 * initial state would be missing and the timezone select would have no options.
 *
 * `TIMEZONES` is not action state — it is a static list of offered timezones — but it is
 * `app/onboarding`-only data (used solely by `agency-form.tsx`), so it lives here rather than in
 * a shared `lib/` module.
 *
 * Same failure as `app/waitlist-state.ts` documents. Keep plain values and types here; keep
 * server actions there.
 */

/**
 * Timezones offered at signup. A short, honest list beats a 400-entry dropdown: the market is
 * Greek agencies, and anyone outside it can be moved by support rather than by scrolling.
 */
export const TIMEZONES = [
  "Europe/Athens",
  "Europe/Nicosia",
  "Europe/Bucharest",
  "Europe/Berlin",
  "Europe/London",
  "UTC",
] as const;

export type Timezone = (typeof TIMEZONES)[number];

export type CreateAgencyErrors = Partial<Record<"name" | "city" | "timezone" | "general", string>>;

export type CreateAgencyState = {
  status: "idle" | "error";
  errors?: CreateAgencyErrors;
};

export const CREATE_AGENCY_IDLE: CreateAgencyState = { status: "idle" };
