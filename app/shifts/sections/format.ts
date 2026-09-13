import type { TranslationKey } from "@/lib/i18n";

/**
 * "YYYY-MM-DD" → "09/09/2026", rebuilt from its own parts. Never through a `Date`:
 * `new Date("2026-09-09")` parses as UTC midnight and prints the previous day for anyone west of
 * Greenwich. Same reasoning as `app/shifts/page.tsx`'s own copy and `app/dashboard/page.tsx`'s.
 */
export function formatDateString(onDate: string): string {
  const [y, m, d] = onDate.split("-");
  return `${d}/${m}/${y}`;
}

/** "{count} shift(s) still need people" — Greek and English both split one/many. */
export function needsPeopleKey(count: number): TranslationKey {
  return count === 1 ? "shifts.sections.needs_people_one" : "shifts.sections.needs_people_many";
}

/** The collapsible toggle label, "Shift(s) (N)". */
export function shiftsToggleKey(count: number): TranslationKey {
  return count === 1 ? "shifts.sections.shifts_toggle_one" : "shifts.sections.shifts_toggle_many";
}
