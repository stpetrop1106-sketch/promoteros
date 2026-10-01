"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEntitlement, checkBilling } from "@/lib/billing/subscription";
import { createProgramme } from "@/lib/programmes";
import { getGeocoder, type GeocodeResult } from "@/lib/geocoding";
import { isSaneCoordinate, readCoordinates } from "./coordinates";
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

/**
 * Turn a typed address into coordinates, for the "Εύρεση στον χάρτη" button on the form.
 *
 * Same shape and same provider as `app/promoters/actions.ts`'s `geocodeAddress` — one adapter
 * (`lib/geocoding/`), never a provider SDK, and `null` for every failure because the provider
 * contract says it never throws. `requireUser()` first: this is a signed-in coordinator's tool,
 * not an open geocoding proxy paid for by our LocationIQ quota.
 */
export async function geocodeStoreAddress(address: string): Promise<GeocodeResult | null> {
  await requireUser();
  if (!address.trim()) return null;
  return getGeocoder().geocode(address, { country: "gr" });
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
  // The address is what the store is created from now — it is geocoded below, and lat/lng are the
  // override, not the input. So the address is required where the coordinates used to be.
  .refine((v) => v.storeMode !== "new" || (v.newStoreAddress?.trim().length ?? 0) >= 4, {
    message: "campaigns.validation.address_required",
    path: ["newStoreAddress"],
  })
  // Blank coordinates are fine and normal: the server geocodes the address. What is not fine is a
  // pair that is half-filled, unparseable, or not a point on Earth — see `isSaneCoordinate`.
  .refine((v) => v.storeMode !== "new" || readCoordinates(v.newStoreLat, v.newStoreLng).kind !== "invalid", {
    message: "campaigns.validation.coords_invalid",
    path: ["newStoreLat"],
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
    const address = data.newStoreAddress!.trim();

    /**
     * G1 — the coordinator used to be asked for `newStoreLat` / `newStoreLng` by hand, i.e. to go
     * to Google Maps, right-click the store and copy two numbers back into this form. Nobody does
     * that under pressure, so stores arrived with wrong or transposed coordinates, and because
     * distance decay is the first term of the matching score (CLAUDE.md § Matching) every ranking
     * for that store was quietly wrong from then on. Nothing ever flagged it.
     *
     * So the address is geocoded here, through the same `lib/geocoding/` adapter the promoter form
     * and the Excel importer already use. Typed coordinates still win when they are there — that
     * is the manual override, matching `app/promoters/promoter-form.tsx` exactly — but the normal
     * path is now: type the address, get a located store.
     *
     * Geocoded BEFORE anything is written, like `app/shifts/import/commit.ts` does, so a failure
     * leaves no half-made store behind. There is no fallback coordinate: `stores.lat/lng` are
     * `not null`, and a placeholder would be indistinguishable from a real location for the rest
     * of the store's life.
     */
    const typed = readCoordinates(data.newStoreLat, data.newStoreLng);
    let point: { lat: number; lng: number };

    if (typed.kind === "ok") {
      point = { lat: typed.lat, lng: typed.lng };
    } else {
      const located = await getGeocoder().geocode(address, { country: "gr" });
      // The provider contract is "null on every failure, never throws", and the sanity check is
      // repeated here rather than trusted: this is the last point before a row is written.
      if (!located || !isSaneCoordinate(located.coordinates.lat, located.coordinates.lng)) {
        return { status: "error", formError: "campaigns.shifts_new.error.geocode_failed" };
      }
      point = { lat: located.coordinates.lat, lng: located.coordinates.lng };
    }

    const { data: store, error: storeErr } = await db
      .from("stores")
      .insert({
        agency_id: user.agencyId,
        client_id: campaign.client_id,
        name: data.newStoreName!.trim(),
        // The address the coordinator typed, not the provider's formatted one. `stores` has a
        // single free-text `address` column and no place to keep both (see docs/status/G1.md);
        // this column is what the promoter is shown on `/i/[token]`, and "Λ. Βουλιαγμένης 100,
        // Γλυφάδα" is more use to someone finding the door than Nominatim's full administrative
        // chain. The formatted address is shown on the form so it can be confirmed.
        address,
        lat: point.lat,
        lng: point.lng,
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
