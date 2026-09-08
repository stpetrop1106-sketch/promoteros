import type { ZodError } from "zod";
import type { BadgeVariant } from "@/components/ui";
import type { TranslationKey } from "@/lib/i18n";

/**
 * Shared formatting/mapping helpers for the campaigns parcel. Kept here instead of `lib/**`
 * because this lane may only write inside `app/campaigns/**` — see docs/status/README.md and
 * the P4 handoff. Nothing here talks to the database.
 */

export type CampaignStatus = "draft" | "active" | "completed" | "cancelled";
export type ShiftStatus = "open" | "partially_filled" | "filled" | "completed" | "cancelled";

export const CAMPAIGN_STATUS_BADGE: Record<CampaignStatus, BadgeVariant> = {
  draft: "neutral",
  active: "info",
  completed: "ok",
  cancelled: "bad",
};

export const CAMPAIGN_STATUS_KEY: Record<CampaignStatus, TranslationKey> = {
  draft: "campaigns.status.draft",
  active: "campaigns.status.active",
  completed: "campaigns.status.completed",
  cancelled: "campaigns.status.cancelled",
};

export const SHIFT_STATUS_BADGE: Record<ShiftStatus, BadgeVariant> = {
  open: "warn",
  partially_filled: "warn",
  filled: "ok",
  completed: "neutral",
  cancelled: "bad",
};

export const SHIFT_STATUS_KEY: Record<ShiftStatus, TranslationKey> = {
  open: "campaigns.shift_status.open",
  partially_filled: "campaigns.shift_status.partially_filled",
  filled: "campaigns.shift_status.filled",
  completed: "campaigns.shift_status.completed",
  cancelled: "campaigns.shift_status.cancelled",
};

/** cents -> "12,50" style EUR amount for display (no currency symbol; callers add it via i18n). */
export function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return (cents / 100).toLocaleString("el-GR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** "12.50" or "12,50" (user input) -> integer cents. Returns null if not a valid non-negative amount. */
export function parseEurosToCents(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const normalised = trimmed.replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalised)) return null;
  const value = Number.parseFloat(normalised);
  if (Number.isNaN(value) || value < 0) return null;
  return Math.round(value * 100);
}

export function formatDateRange(startsOn: string, endsOn: string): string {
  return startsOn === endsOn ? startsOn : `${startsOn} → ${endsOn}`;
}

export function timeLabel(value: string): string {
  return value.slice(0, 5);
}

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const; // ISO: 1 = Monday .. 7 = Sunday

export const WEEKDAY_KEY: Record<(typeof WEEKDAYS)[number], TranslationKey> = {
  1: "campaigns.weekday.mon",
  2: "campaigns.weekday.tue",
  3: "campaigns.weekday.wed",
  4: "campaigns.weekday.thu",
  5: "campaigns.weekday.fri",
  6: "campaigns.weekday.sat",
  7: "campaigns.weekday.sun",
};

/** ISO weekday (1=Mon..7=Sun) for a "YYYY-MM-DD" date string, computed in UTC to avoid TZ drift. */
export function isoWeekday(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  return day === 0 ? 7 : day;
}

/** All "YYYY-MM-DD" dates from start to end (inclusive) whose ISO weekday is in `weekdays`. */
export function expandSeriesDates(
  startDate: string,
  endDate: string,
  weekdays: Set<number>,
): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  // Hard safety cap — a coordinator mistyping a year should get a validation error, not a
  // multi-thousand-row insert.
  let guard = 0;
  while (cursor.getTime() <= end.getTime() && guard < 370) {
    const iso = cursor.toISOString().slice(0, 10);
    if (weekdays.has(isoWeekday(iso))) dates.push(iso);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard += 1;
  }
  return dates;
}

/**
 * Shared `useActionState` shape for every form in this parcel. `TField` is the union of field
 * names that can carry an inline, next-to-the-field error; `fieldErrors` values are translation
 * keys, never raw strings, so every zod `.refine`/`.min`/`.max` call in an `actions.ts` file must
 * pass an explicit `TranslationKey` string as its message — see `fieldErrorsFromZodError` below.
 */
export type FormState<TField extends string> = {
  status: "idle" | "error";
  fieldErrors?: Partial<Record<TField, TranslationKey>>;
  formError?: TranslationKey;
};

/**
 * Flattens a zod validation error into `{ field: translationKey }`, keeping only the first issue
 * per field (one message next to a field at a time). Every message in this codebase's campaign
 * schemas is authored as a `TranslationKey` string on purpose, so the cast is safe as long as
 * every `.refine`/`.min`/`.max`/`.regex` call supplies one explicitly — a bare zod default
 * message would otherwise flow through here untranslated.
 */
export function fieldErrorsFromZodError<TField extends string>(
  error: ZodError,
): Partial<Record<TField, TranslationKey>> {
  const out: Partial<Record<TField, TranslationKey>> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "") as TField;
    if (!field || out[field]) continue;
    out[field] = issue.message as TranslationKey;
  }
  return out;
}

/** FormData text value, trimmed, with blank treated as absent so optional zod fields behave. */
export function optionalText(value: FormDataEntryValue | null): string | undefined {
  if (value === null) return undefined;
  const text = String(value).trim();
  return text === "" ? undefined : text;
}

/** FormData text value, required-but-possibly-empty — validation of emptiness is zod's job. */
export function requiredText(value: FormDataEntryValue | null): string {
  return value === null ? "" : String(value);
}
