"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  expandSeriesDates,
  fieldErrorsFromZodError,
  optionalText,
  parseEurosToCents,
  requiredText,
  type FormState,
} from "@/app/campaigns/_shared";

type ShiftField =
  | "storeId"
  | "newStoreName"
  | "newStoreAddress"
  | "newStoreLat"
  | "newStoreLng"
  | "fromDate"
  | "toDate"
  | "weekdays"
  | "startTime"
  | "endTime"
  | "promotersRequired"
  | "rateOverrideEuros";

export type ShiftFormState = FormState<ShiftField>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

/** Coordinates copy-pasted from Google Maps use a dot, but tolerate a Greek comma decimal too. */
function parseCoordinate(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const schema = z
  .object({
    campaignId: z.string(),
    storeMode: z.enum(["existing", "new"]),
    storeId: z.string().optional(),
    newStoreName: z.string().max(200, "campaigns.validation.too_long").optional(),
    newStoreAddress: z.string().max(500, "campaigns.validation.too_long").optional(),
    newStoreLat: z.string().optional(),
    newStoreLng: z.string().optional(),
    fromDate: z.string().regex(DATE_RE, "campaigns.validation.date_invalid"),
    toDate: z.string().regex(DATE_RE, "campaigns.validation.date_invalid"),
    weekdays: z.array(z.string()).min(1, "campaigns.validation.weekdays_none"),
    startTime: z.string().regex(TIME_RE, "campaigns.validation.time_invalid"),
    endTime: z.string().regex(TIME_RE, "campaigns.validation.time_invalid"),
    promotersRequired: z
      .string()
      .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1, "campaigns.validation.promoters_required"),
    rateOverrideEuros: z.string().optional(),
  })
  .refine((v) => v.toDate >= v.fromDate, { message: "campaigns.validation.date_order", path: ["toDate"] })
  .refine((v) => v.endTime > v.startTime, { message: "campaigns.validation.time_order", path: ["endTime"] })
  .refine((v) => v.storeMode !== "existing" || Boolean(v.storeId), {
    message: "campaigns.validation.store_required",
    path: ["storeId"],
  })
  .refine((v) => v.storeMode !== "new" || (v.newStoreName?.trim().length ?? 0) >= 2, {
    message: "campaigns.validation.new_store_name",
    path: ["newStoreName"],
  })
  .refine((v) => v.storeMode !== "new" || parseCoordinate(v.newStoreLat) !== null, {
    message: "campaigns.validation.coords_invalid",
    path: ["newStoreLat"],
  })
  .refine((v) => v.storeMode !== "new" || parseCoordinate(v.newStoreLng) !== null, {
    message: "campaigns.validation.coords_invalid",
    path: ["newStoreLng"],
  })
  .refine((v) => !v.rateOverrideEuros || parseEurosToCents(v.rateOverrideEuros) !== null, {
    message: "campaigns.validation.rate_invalid",
    path: ["rateOverrideEuros"],
  });

export async function createShifts(_prev: ShiftFormState, formData: FormData): Promise<ShiftFormState> {
  const user = await requireUser();
  const db = await createServerSupabase();

  const campaignId = requiredText(formData.get("campaignId"));

  const parsed = schema.safeParse({
    campaignId,
    storeMode: requiredText(formData.get("storeMode")) || "existing",
    storeId: optionalText(formData.get("storeId")),
    newStoreName: optionalText(formData.get("newStoreName")),
    newStoreAddress: optionalText(formData.get("newStoreAddress")),
    newStoreLat: optionalText(formData.get("newStoreLat")),
    newStoreLng: optionalText(formData.get("newStoreLng")),
    fromDate: requiredText(formData.get("fromDate")),
    toDate: requiredText(formData.get("toDate")),
    weekdays: formData.getAll("weekdays").map(String),
    startTime: requiredText(formData.get("startTime")),
    endTime: requiredText(formData.get("endTime")),
    promotersRequired: requiredText(formData.get("promotersRequired")),
    rateOverrideEuros: optionalText(formData.get("rateOverrideEuros")),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFromZodError<ShiftField>(parsed.error) };
  }

  const data = parsed.data;

  // The campaign id travels through a hidden field — re-verify it through RLS before trusting it
  // for anything, the same way every mutating action in this app does.
  const { data: campaign } = await db
    .from("campaigns")
    .select("id, client_id")
    .eq("id", data.campaignId)
    .maybeSingle();

  if (!campaign) {
    return { status: "error", formError: "campaigns.validation.campaign_not_found" };
  }

  let storeId: string;

  if (data.storeMode === "new") {
    const { data: store, error: storeErr } = await db
      .from("stores")
      .insert({
        agency_id: user.agencyId,
        client_id: campaign.client_id,
        name: data.newStoreName!.trim(),
        address: data.newStoreAddress ?? null,
        lat: parseCoordinate(data.newStoreLat),
        lng: parseCoordinate(data.newStoreLng),
      })
      .select("id")
      .single();

    if (storeErr || !store) {
      return { status: "error", formError: "campaigns.shifts_new.error.store_save_failed" };
    }
    storeId = store.id;
  } else {
    const { data: store } = await db.from("stores").select("id").eq("id", data.storeId!).maybeSingle();
    if (!store) {
      return {
        status: "error",
        fieldErrors: { storeId: "campaigns.validation.store_required" },
      };
    }
    storeId = store.id;
  }

  const weekdaySet = new Set(data.weekdays.map(Number));
  const dates = expandSeriesDates(data.fromDate, data.toDate, weekdaySet);

  if (dates.length === 0) {
    return { status: "error", formError: "campaigns.validation.no_dates" };
  }

  const rateOverrideCents = data.rateOverrideEuros ? parseEurosToCents(data.rateOverrideEuros) : null;
  const promotersRequired = Number(data.promotersRequired);

  const { error: insertErr } = await db.from("shifts").insert(
    dates.map((onDate) => ({
      agency_id: user.agencyId,
      campaign_id: data.campaignId,
      store_id: storeId,
      on_date: onDate,
      start_time: data.startTime,
      end_time: data.endTime,
      promoters_required: promotersRequired,
      rate_cents_override: rateOverrideCents,
    })),
  );

  if (insertErr) {
    return { status: "error", formError: "campaigns.shifts_new.error.save_failed" };
  }

  revalidatePath(`/campaigns/${data.campaignId}`);
  revalidatePath("/campaigns");
  redirect(`/campaigns/${data.campaignId}`);
}
