/**
 * Action state for the field-report form.
 *
 * This lives outside `app/c/[token]/report/actions.ts` deliberately. A module carrying the
 * `"use server"` directive may only export async functions — every other export is replaced by
 * `undefined` on the client rather than rejected at build time. `report-form.tsx` passes
 * `IDLE_STATE` to `useActionState`, so exporting it from the actions module made the initial
 * state `undefined` and the component crashed on its first render.
 *
 * Same failure as `app/waitlist-state.ts` documents. Keep plain values and types here; keep
 * server actions there.
 */
export type ReportFieldName =
  | "unitsPromoted"
  | "salesCount"
  | "interactionsCount"
  | "stockIssues"
  | "storeManagerName"
  | "notes";

export type ReportFieldErrors = Partial<Record<ReportFieldName | "general", string>>;

/**
 * What the promoter typed, echoed back so a failed submit never costs them their work.
 *
 * React resets an uncontrolled form once its action completes, and it resets each field to its
 * `defaultValue` — so the values have to travel back through the state for the reset to put them
 * where they were. Before A3-01 the transport failure produced no state at all, which meant React
 * never reset the form either and the values happened to survive; the moment a rejection became a
 * state, that accident stopped protecting them. Found by actually stopping the dev server and
 * watching the fields go blank.
 */
export type ReportFieldValues = Partial<Record<ReportFieldName, string>>;

/**
 * `offline` is A3-01. It is the one member of this union the server action can never return:
 * it is produced in `report-form.tsx` by catching the rejection of the action call itself.
 * A dropped connection between the tap and the server is not an error the server can report,
 * because the server was never reached — before this the page simply did nothing, and the
 * promoter walked away believing the report was filed.
 */
export type ReportActionState =
  | { status: "idle" }
  | { status: "offline"; values: ReportFieldValues }
  | { status: "error"; errors: ReportFieldErrors; values: ReportFieldValues }
  | { status: "success"; photosSaved: number; photosFailed: number };

/** The text fields, in the order the form renders them. Photos are not echoed — a file input
 *  cannot be re-filled from script, and `shrink-photo.ts` would have to re-run anyway. */
export const REPORT_FIELD_NAMES: readonly ReportFieldName[] = [
  "unitsPromoted",
  "salesCount",
  "interactionsCount",
  "storeManagerName",
  "stockIssues",
  "notes",
];

export function readReportValues(formData: FormData): ReportFieldValues {
  const values: ReportFieldValues = {};
  for (const name of REPORT_FIELD_NAMES) {
    const raw = formData.get(name);
    if (raw !== null && typeof raw === "string") values[name] = raw;
  }
  return values;
}

export const IDLE_STATE: ReportActionState = { status: "idle" };
