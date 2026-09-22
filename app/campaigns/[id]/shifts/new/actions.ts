"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEntitlement, checkBilling } from "@/lib/billing/subscription";
import { createProgramme } from "@/lib/programmes";
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
  | "programmeId"
  | "newProgrammeName"
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
    programmeMode: z.enum(["existing", "new"]),
    programmeId: z.string().optional(),
    newProgrammeName: z.string().max(120, "campaigns.validation.too_long").optional(),
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
  .refine((v) => v.programmeMode !== "existing" || Boolean(v.programmeId), {
    message: "campaigns.validation.programme_required",
    path: ["programmeId"],
  })
  .refine((v) => v.programmeMode !== "new" || (v.newProgrammeName?.trim().length ?? 0) >= 1, {
    message: "campaigns.validation.new_programme_name",
    path: ["newProgrammeName"],
  })
  .refine((v) => !v.rateOverrideEuros || parseEurosToCents(v.rateOverrideEuros) !== null, {
    message: "campaigns.validation.rate_invalid",
    path: ["rateOverrideEuros"],
  })
  // A2 finding 6 — "no dates at all" used to be checked *after* the new store and the new
  // section had already been inserted, so every retry of a Tue–Fri range with only the weekend
  // ticked left another junk store in the importer's known-store list and another empty section
  // on the coordinator's home screen, neither of which can be deleted. It depends on nothing but
  // the form, so it belongs here with the rest of the validation — and as a field error on
  // `weekdays`, which is the control the coordinator has to change.
  .refine(
    (v) =>
      !DATE_RE.test(v.fromDate) ||
      !DATE_RE.test(v.toDate) ||
      v.toDate < v.fromDate ||
      expandSeriesDates(v.fromDate, v.toDate, new Set(v.weekdays.map(Number))).length > 0,
    { message: "campaigns.validation.no_dates", path: ["weekdays"] },
  );

export async function createShifts(_prev: ShiftFormState, formData: FormData): Promise<ShiftFormState> {
  const user = await requireUser();

  // P24 — creating shifts (and, along the way, possibly a new store) is new operational
  // commitment, same reasoning as app/campaigns/new/actions.ts's createCampaign.
  const entitlement = await getEntitlement(user.agencyId);
  if (entitlement && !checkBilling(entitlement, "write").allowed) {
    return { status: "error", formError: "enforcement.campaigns.blocked_read_only_shifts" };
  }

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
    programmeMode: requiredText(formData.get("programmeMode")) || "existing",
    programmeId: optionalText(formData.get("programmeId")),
    newProgrammeName: optionalText(formData.get("newProgrammeName")),
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

  let programmeId: string;

  if (data.programmeMode === "new") {
    const result = await createProgramme(db, {
      agencyId: user.agencyId,
      campaignId: data.campaignId,
      name: data.newProgrammeName!,
    });
    if (!result.ok) {
      return { status: "error", formError: "campaigns.shifts_new.error.programme_save_failed" };
    }
    programmeId = result.id;
  } else {
    // Re-verified through RLS, and against this campaign specifically — the composite FK in
    // 0016_shift_programmes.sql only forbids the mismatch at the database level, this is the
    // earlier, friendlier check that turns it into a field error instead of a 500.
    const { data: prog } = await db
      .from("shift_programmes")
      .select("id")
      .eq("id", data.programmeId!)
      .eq("campaign_id", data.campaignId)
      .maybeSingle();
    if (!prog) {
      return {
        status: "error",
        fieldErrors: { programmeId: "campaigns.validation.programme_required" },
      };
    }
    programmeId = prog.id;
  }

  const weekdaySet = new Set(data.weekdays.map(Number));
  const dates = expandSeriesDates(data.fromDate, data.toDate, weekdaySet);

  // Unreachable now that the schema refines on it above — kept as the last line of defence, so
  // an empty insert can never be attempted if that refine is ever weakened.
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
      programme_id: programmeId,
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
  revalidatePath("/shifts");
  redirect(`/campaigns/${data.campaignId}`);
}
