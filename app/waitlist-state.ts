import type { TranslationKey } from "@/lib/i18n";

/**
 * The waitlist form's action state.
 *
 * This lives outside `app/actions.ts` deliberately. A module carrying the `"use server"`
 * directive may only export async functions — every other export is replaced by `undefined`
 * on the client rather than rejected at build time. `initialWaitlistState` was exported from
 * there, so `useActionState` received `undefined`, `state.message` was `undefined`, and
 * `t(undefined)` threw on every render of the public landing page.
 *
 * Keep plain values and types here; keep server actions there.
 */
export type WaitlistState = {
  status: "idle" | "success" | "already_joined" | "error";
  message: TranslationKey;
};

export const initialWaitlistState: WaitlistState = {
  status: "idle",
  message: "waitlist.status.idle",
};
