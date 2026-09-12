"use server";

import { revalidatePath } from "next/cache";
import { saveAvailabilityDay } from "./data";
import type { SaveDayState } from "./state";

/**
 * Anonymous on purpose, exactly like `app/i/[token]/actions.ts` and `app/c/[token]/actions.ts`:
 * a promoter has no account, and the signed token in the URL is the credential. `resolvePromoter`
 * inside `./data.ts` verifies the signature, the expiry, the namespace and the promoter's status
 * before the service-role client is used for anything, so this action is unreachable without a
 * token this server minted.
 *
 * Only async functions are exported from this module — CLAUDE.md, "the server/client boundary".
 * `SaveDayState` and `SAVE_DAY_IDLE` live in `./state.ts` for that reason.
 */
export async function saveDay(
  token: string,
  date: string,
  choice: string,
  fromTime: string | null,
  toTime: string | null,
): Promise<SaveDayState> {
  const result = await saveAvailabilityDay(token, date, choice, fromTime, toTime);
  if (!result.ok) return { status: "error", date, reason: result.reason };

  revalidatePath(`/a/${token}`);
  return { status: "saved", date };
}
