/**
 * Action state for the promoter create/edit form.
 *
 * This lives outside `app/promoters/actions.ts` deliberately. A module carrying the `"use
 * server"` directive may only export async functions — every other export is replaced by
 * `undefined` on the client rather than rejected at build time. `promoter-form.tsx` passes
 * `IDLE_STATE` to `useActionState`, so exporting it from the actions module made the initial
 * state `undefined` and the component crashed on its first render.
 *
 * Same failure as `app/waitlist-state.ts` documents. Keep plain values and types here; keep
 * server actions there.
 */
export type FieldErrors = Partial<
  Record<
    "fullName" | "phone" | "email" | "birthYear" | "lat" | "lng" | "areas" | "skills" | "general",
    string
  >
>;

export type PromoterFormState = {
  status: "idle" | "error" | "duplicate" | "success";
  errors?: FieldErrors;
  duplicate?: { id: string; fullName: string };
};

export const IDLE_STATE: PromoterFormState = { status: "idle" };
