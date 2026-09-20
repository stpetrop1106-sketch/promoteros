"use server";

import { revalidatePath } from "next/cache";
import { submitFieldReport, attachReportPhoto, type FieldReportInput } from "@/lib/checkins";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import type { ReportActionState, ReportFieldErrors } from "./state";

// Same shape as app/promoters/actions.ts's field-error pattern: server-rendered validation
// messages in the reference locale, since promoter-facing pages have no locale switcher yet.
const t = translatorFor(DEFAULT_LOCALE);

/** `value` is always present so a caller never needs to cast after checking `ok` on a sibling
 *  field — it is simply ignored (left `null`) when parsing failed. */
type ParsedNumber = { ok: boolean; value: number | null };
type ParsedText = { ok: boolean; value: string | null };

function parseOptionalNonNegativeInt(raw: FormDataEntryValue | null): ParsedNumber {
  if (raw === null) return { ok: true, value: null };
  const s = String(raw).trim();
  if (s === "") return { ok: true, value: null };
  const n = Number(s);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return { ok: false, value: null };
  return { ok: true, value: n };
}

function parseOptionalText(raw: FormDataEntryValue | null, maxLen: number): ParsedText {
  if (raw === null) return { ok: true, value: null };
  const s = String(raw).trim();
  if (s === "") return { ok: true, value: null };
  if (s.length > maxLen) return { ok: false, value: null };
  return { ok: true, value: s };
}

function submitErrorMessage(reason: string): string {
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
  _prevState: ReportActionState,
  formData: FormData,
): Promise<ReportActionState> {
  const errors: ReportFieldErrors = {};

  const units = parseOptionalNonNegativeInt(formData.get("unitsPromoted"));
  if (!units.ok) errors.unitsPromoted = t("report.validation.number_invalid");

  const sales = parseOptionalNonNegativeInt(formData.get("salesCount"));
  if (!sales.ok) errors.salesCount = t("report.validation.number_invalid");

  const interactions = parseOptionalNonNegativeInt(formData.get("interactionsCount"));
  if (!interactions.ok) errors.interactionsCount = t("report.validation.number_invalid");

  const stockIssues = parseOptionalText(formData.get("stockIssues"), 2000);
  if (!stockIssues.ok) errors.stockIssues = t("report.validation.too_long");

  const storeManagerName = parseOptionalText(formData.get("storeManagerName"), 200);
  if (!storeManagerName.ok) errors.storeManagerName = t("report.validation.too_long");

  const notes = parseOptionalText(formData.get("notes"), 4000);
  if (!notes.ok) errors.notes = t("report.validation.too_long");

  if (Object.keys(errors).length > 0) {
    return { status: "error", errors };
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
    return { status: "error", errors: { general: submitErrorMessage(result.reason) } };
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

  revalidatePath(`/c/${token}/report`);
  return { status: "success", photosSaved, photosFailed };
}
