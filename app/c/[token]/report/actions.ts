"use server";

import { submitFieldReport, attachReportPhoto, type FieldReportInput } from "@/lib/checkins";
import { translatorFor, type Locale } from "@/lib/i18n";
import { readReportValues } from "./state";
import type { ReportActionState, ReportFieldErrors } from "./state";

/**
 * A3-16 — the locale is now bound by the page (`submitReport.bind(null, token, locale)`) rather
 * than pinned to `DEFAULT_LOCALE`, so a promoter reading the form in English gets its validation
 * messages in English too.
 */

/** `value` is always present so a caller never needs to cast after checking `ok` on a sibling
 *  field — it is simply ignored (left `null`) when parsing failed. */
type ParsedNumber = { ok: boolean; value: number | null; reason?: "too_large" };
type ParsedText = { ok: boolean; value: string | null };

/**
 * A3-07 — the upper bound is the point. `field_reports.units_promoted` and its siblings are
 * Postgres `integer` (0001_init.sql), and `1e24` satisfies `Number.isInteger` and `>= 0`, so it
 * used to pass the browser, pass this function, and then fail at the database with
 * `save_failed` — a generic "try again" that could never work, on a form that cannot be edited
 * afterwards. Named here, on the field, instead.
 */
const MAX_PG_INT = 2_147_483_647;

function parseOptionalNonNegativeInt(raw: FormDataEntryValue | null): ParsedNumber {
  if (raw === null) return { ok: true, value: null };
  const s = String(raw).trim();
  if (s === "") return { ok: true, value: null };
  const n = Number(s);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return { ok: false, value: null };
  if (n > MAX_PG_INT) return { ok: false, value: null, reason: "too_large" };
  return { ok: true, value: n };
}

function parseOptionalText(raw: FormDataEntryValue | null, maxLen: number): ParsedText {
  if (raw === null) return { ok: true, value: null };
  const s = String(raw).trim();
  if (s === "") return { ok: true, value: null };
  if (s.length > maxLen) return { ok: false, value: null };
  return { ok: true, value: s };
}

function submitErrorMessage(t: ReturnType<typeof translatorFor>, reason: string): string {
  switch (reason) {
    case "checkin_required":
      return t("report.error.checkin_required");
    case "already_submitted":
      return t("report.error.already_submitted");
    case "cancelled":
      return t("report.error.cancelled");
    case "not_found":
    case "malformed":
    case "bad_signature":
    case "expired":
    case "wrong_purpose":
      return t("checkin.expired");
    default:
      return t("report.error.save_failed");
  }
}

/**
 * Save the field report, then attach any photos.
 *
 * Deliberately sequential and deliberately tolerant of photo failure: `submitFieldReport` is
 * awaited and returns before a single photo is touched, so a promoter's units/sales/notes are
 * durable in `field_reports` regardless of what happens next. A failed or slow upload on a weak
 * supermarket connection degrades to "report saved, some photos didn't make it" — never to a
 * lost report. See CLAUDE.md's quality bar and docs/status/P9.md.
 *
 * Bound with the token as the first argument (`submitReport.bind(null, token)`) so the resulting
 * function matches `useActionState`'s `(state, formData) => state` shape — the same pattern
 * `app/promoters/[id]/edit/archive-control.tsx` uses for `archivePromoter`.
 */
export async function submitReport(
  token: string,
  locale: Locale,
  _prevState: ReportActionState,
  formData: FormData,
): Promise<ReportActionState> {
  const t = translatorFor(locale);
  const errors: ReportFieldErrors = {};
  const numberError = (parsed: ParsedNumber) =>
    parsed.reason === "too_large"
      ? t("report.validation.number_too_large")
      : t("report.validation.number_invalid");

  const units = parseOptionalNonNegativeInt(formData.get("unitsPromoted"));
  if (!units.ok) errors.unitsPromoted = numberError(units);

  const sales = parseOptionalNonNegativeInt(formData.get("salesCount"));
  if (!sales.ok) errors.salesCount = numberError(sales);

  const interactions = parseOptionalNonNegativeInt(formData.get("interactionsCount"));
  if (!interactions.ok) errors.interactionsCount = numberError(interactions);

  const stockIssues = parseOptionalText(formData.get("stockIssues"), 2000);
  if (!stockIssues.ok) errors.stockIssues = t("report.validation.too_long");

  const storeManagerName = parseOptionalText(formData.get("storeManagerName"), 200);
  if (!storeManagerName.ok) errors.storeManagerName = t("report.validation.too_long");

  const notes = parseOptionalText(formData.get("notes"), 4000);
  if (!notes.ok) errors.notes = t("report.validation.too_long");

  if (Object.keys(errors).length > 0) {
    return { status: "error", errors, values: readReportValues(formData) };
  }

  const input: FieldReportInput = {
    unitsPromoted: units.value,
    salesCount: sales.value,
    interactionsCount: interactions.value,
    stockIssues: stockIssues.value,
    storeManagerName: storeManagerName.value,
    notes: notes.value,
  };

  const result = await submitFieldReport(token, input);
  if (!result.ok) {
    return {
      status: "error",
      errors: { general: submitErrorMessage(t, result.reason) },
      values: readReportValues(formData),
    };
  }

  // The report is saved as of this line. Everything below is best-effort — see the
  // function-level comment above.
  const photos = formData
    .getAll("photos")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  let photosSaved = 0;
  let photosFailed = 0;
  for (const photo of photos) {
    // Best effort means best effort: `attachReportPhoto` returns a reason for the failures it
    // expects, but a storage call can also throw, and an escaped throw here would take down a
    // report that is ALREADY SAVED and show the promoter a server error instead. Counted as a
    // failed photo, which the success message already accounts for.
    try {
      const photoResult = await attachReportPhoto(token, result.fieldReportId, photo);
      if (photoResult.ok) photosSaved += 1;
      else photosFailed += 1;
    } catch {
      photosFailed += 1;
    }
  }

  // A3-08 — there is deliberately NO `revalidatePath` here. It used to run before this return,
  // which re-rendered `page.tsx` with `hasReport` already true; the page then returned its
  // terminal "already submitted" screen and unmounted the form together with the success state
  // this line produces. The consequence was that a promoter whose photo the server rejected was
  // never told: the warning string existed and was unreachable. The page is `force-dynamic`, so
  // nothing is cached and a reload still shows the terminal screen — the revalidate bought
  // nothing and cost the only message that mattered.
  return { status: "success", photosSaved, photosFailed };
}
