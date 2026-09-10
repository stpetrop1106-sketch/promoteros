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
export type ReportFieldErrors = Partial<
  Record<
    | "unitsPromoted"
    | "salesCount"
    | "interactionsCount"
    | "stockIssues"
    | "storeManagerName"
    | "notes"
    | "general",
    string
  >
>;

export type ReportActionState =
  | { status: "idle" }
  | { status: "error"; errors: ReportFieldErrors }
  | { status: "success"; photosSaved: number; photosFailed: number };

export const IDLE_STATE: ReportActionState = { status: "idle" };
