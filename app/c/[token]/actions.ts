"use server";

import { revalidatePath } from "next/cache";
import { submitCheckin } from "@/lib/checkins";

export type CheckinActionState =
  | { status: "success"; withinGeofence: boolean | null }
  | { status: "error"; reason: string };

/**
 * Anonymous on purpose, same as `app/i/[token]/actions.ts`: the signed token in the URL is
 * the promoter's only credential. Called directly from client event handlers (not only via a
 * `<form action>`), because the geolocation prompt has to happen first, in the browser.
 */

export async function checkinWithGeo(
  token: string,
  lat: number,
  lng: number,
): Promise<CheckinActionState> {
  const result = await submitCheckin(token, { kind: "geo", lat, lng });
  if (!result.ok) return { status: "error", reason: result.reason };

  revalidatePath(`/c/${token}`);
  return { status: "success", withinGeofence: result.withinGeofence };
}

export async function checkinWithOverride(
  token: string,
  reason: string,
): Promise<CheckinActionState> {
  const result = await submitCheckin(token, {
    kind: "override",
    reason: reason.trim() === "" ? null : reason.trim(),
  });
  if (!result.ok) return { status: "error", reason: result.reason };

  revalidatePath(`/c/${token}`);
  return { status: "success", withinGeofence: null };
}
