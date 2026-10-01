"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { sendWelcomeAvailabilityLink } from "@/lib/dispatch/run";
import { requireUser } from "@/lib/auth";
import { getGeocoder, type GeocodeResult } from "@/lib/geocoding";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";
import { checkBillingFor, lookupEntitlement } from "@/lib/billing/subscription";
// S1 — moved out of this file so the bulk importer can apply the identical rule. A `"use server"`
// module may export only async functions, so it could not be exported from here.
import { normalizePhone } from "@/lib/promoters/phone";
import type { PlanId } from "@/lib/billing/plans";
import type { FieldErrors, PromoterFormState } from "./state";

// Every user-facing string still goes through t() — see CLAUDE.md's i18n rule — even though
// this file is server-only. Validation messages are shown in the reference locale: the app has
// no locale switcher for coordinator pages yet (that lands in P12), and the rest of this codebase
// (app/shifts, app/login) already renders unconditionally in DEFAULT_LOCALE.
const t = translatorFor(DEFAULT_LOCALE);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CURRENT_YEAR = new Date().getFullYear();

// Reuses P17's plan-name keys (`billing.plan.*`) rather than adding new ones for the same three
// names — see lib/i18n's append-only rule in CLAUDE.md.
const PLAN_LABEL_KEY: Record<PlanId, TranslationKey> = {
  starter: "billing.plan.starter",
  agency: "billing.plan.agency",
  multi_brand: "billing.plan.multi_brand",
};

function parseOptionalInt(raw: FormDataEntryValue | null): number | undefined | "invalid" {
  if (typeof raw !== "string") return undefined;
  const s = raw.trim();
  if (s === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : "invalid";
}

function parseOptionalFloat(raw: FormDataEntryValue | null): number | undefined | "invalid" {
  if (typeof raw !== "string") return undefined;
  const s = raw.trim();
  if (s === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : "invalid";
}

const ScalarSchema = z.object({
  fullName: z.string().trim().min(2, t("promoters.errors.full_name_required")).max(120),
  email: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || EMAIL_RE.test(v), t("promoters.errors.email_invalid"))
    .optional(),
  birthYear: z
    .number()
    .int()
    .min(1940, t("promoters.errors.birth_year_invalid"))
    .max(CURRENT_YEAR - 14, t("promoters.errors.birth_year_invalid"))
    .optional(),
  lat: z.number().min(-90, t("promoters.errors.coordinates_invalid")).max(90, t("promoters.errors.coordinates_invalid")).optional(),
  lng: z.number().min(-180, t("promoters.errors.coordinates_invalid")).max(180, t("promoters.errors.coordinates_invalid")).optional(),
  hasCar: z.boolean(),
  hasLicence: z.boolean(),
  transportNotes: z.string().trim().max(500).optional(),
  status: z.enum(["active", "paused", "archived", "blocklisted"]),
  areaIds: z.array(z.string().uuid()).max(50),
  skills: z
    .array(z.object({ id: z.string().uuid(), level: z.number().int().min(1).max(3) }))
    .max(50),
});

type ParsedInput = {
  scalars: z.infer<typeof ScalarSchema>;
  phoneNormalized: string;
  fieldErrors: FieldErrors;
};

/**
 * Shared parsing for create and edit: pulls every field out of `FormData`, does the
 * presence/shape coercion zod can't do on raw strings (empty → optional, non-numeric → its own
 * error), then runs the range/shape checks through zod. Returns field errors keyed exactly like
 * the form's inputs so the client component can render them next to the right field.
 */
function parseForm(formData: FormData): ParsedInput {
  const fieldErrors: FieldErrors = {};

  const phoneRaw = String(formData.get("phone") ?? "").trim();
  if (phoneRaw.length < 6) fieldErrors.phone = t("promoters.errors.phone_required");
  const phoneNormalized = normalizePhone(phoneRaw);

  const birthYear = parseOptionalInt(formData.get("birthYear"));
  if (birthYear === "invalid") fieldErrors.birthYear = t("promoters.errors.birth_year_invalid");

  const lat = parseOptionalFloat(formData.get("lat"));
  if (lat === "invalid") fieldErrors.lat = t("promoters.errors.coordinates_invalid");

  const lng = parseOptionalFloat(formData.get("lng"));
  if (lng === "invalid") fieldErrors.lng = t("promoters.errors.coordinates_invalid");

  // Exactly one of lat/lng provided is a broken pin, not a valid "no coordinates" state.
  if ((lat === undefined) !== (lng === undefined)) {
    fieldErrors.lat = t("promoters.errors.coordinates_incomplete");
    fieldErrors.lng = t("promoters.errors.coordinates_incomplete");
  }

  const areaIds = formData.getAll("area_id").map(String).filter(Boolean);

  const skillIds = formData.getAll("skill_id").map(String).filter(Boolean);
  const skills = skillIds.map((id) => {
    const levelRaw = formData.get(`skill_level_${id}`);
    const level = typeof levelRaw === "string" ? Number(levelRaw) : 1;
    return { id, level: Number.isFinite(level) && level >= 1 && level <= 3 ? Math.trunc(level) : 1 };
  });

  const candidate = {
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
    birthYear: birthYear === "invalid" ? undefined : birthYear,
    lat: lat === "invalid" ? undefined : lat,
    lng: lng === "invalid" ? undefined : lng,
    hasCar: formData.get("hasCar") != null,
    hasLicence: formData.get("hasLicence") != null,
    transportNotes: String(formData.get("transportNotes") ?? "").trim() || undefined,
    status: String(formData.get("status") ?? "active"),
    areaIds,
    skills,
  };

  const parsed = ScalarSchema.safeParse(candidate);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === "fullName") fieldErrors.fullName ??= issue.message;
      if (key === "email") fieldErrors.email ??= issue.message;
      if (key === "birthYear") fieldErrors.birthYear ??= issue.message;
      if (key === "lat") fieldErrors.lat ??= issue.message;
      if (key === "lng") fieldErrors.lng ??= issue.message;
    }
  }

  return {
    scalars: parsed.success
      ? parsed.data
      : {
          fullName: candidate.fullName,
          email: candidate.email,
          hasCar: candidate.hasCar,
          hasLicence: candidate.hasLicence,
          transportNotes: candidate.transportNotes,
          status: (candidate.status as "active" | "paused") ?? "active",
          areaIds: candidate.areaIds,
          skills: candidate.skills,
        },
    phoneNormalized,
    fieldErrors,
  };
}

/** Only ids the agency actually owns are ever written to `promoter_areas` / `promoter_skills` — a
 * hidden form field is not a trusted source, it only ever contained ids the UI itself rendered
 * from an RLS-scoped select, but a tampered request must not be able to graft another agency's
 * area/skill row onto a promoter (those join tables have no `agency_id` of their own to fall
 * back on for RLS). */
async function keepOwnedIds(
  db: Awaited<ReturnType<typeof createServerSupabase>>,
  table: "areas" | "skills",
  ids: string[],
): Promise<string[]> {
  if (ids.length === 0) return [];
  const { data } = await db.from(table).select("id").in("id", ids);
  const owned = new Set((data ?? []).map((r) => (r as { id: string }).id));
  return ids.filter((id) => owned.has(id));
}

async function findDuplicate(
  db: Awaited<ReturnType<typeof createServerSupabase>>,
  phone: string,
  excludeId?: string,
) {
  let query = db.from("promoters").select("id, full_name").eq("phone", phone);
  if (excludeId) query = query.neq("id", excludeId);
  const { data } = await query.maybeSingle<{ id: string; full_name: string }>();
  return data;
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  await requireUser();
  if (!address.trim()) return null;
  return getGeocoder().geocode(address, { country: "gr" });
}

/**
 * P22 — the one enforcement point for `docs/commercial-architecture.md` §3's promoter-limit and
 * read-only rules, on the one write path this parcel owns. `checkBilling()` (`lib/billing/
 * subscription.ts`) already encodes both: a read-only agency is blocked from every write
 * regardless of how many promoters it has, and an agency under its limit is never blocked at
 * all — only *adding* the next promoter past the limit is. Editing and archiving an existing
 * promoter never call this, on purpose: the limit blocks growth, never what already exists.
 *
 * Checked before the form is even parsed: there is no reason to validate fields the request is
 * going to be refused anyway, and it gives the coordinator the real reason immediately.
 */
async function checkPromoterWriteAllowed(
  agencyId: string,
  action: "add_promoter" | "write",
): Promise<string | null> {
  const gate = await checkBillingFor(agencyId, action);
  if (gate.allowed) return null;

  if (gate.block === "promoter_limit_reached") {
    const lookup = await lookupEntitlement(agencyId);
    if (!lookup.ok) return t("enforcement.promoters.blocked_read_only");
    return t("enforcement.promoters.blocked_limit", {
      plan: t(PLAN_LABEL_KEY[lookup.entitlement.planId]),
      limit: lookup.entitlement.promoterLimit,
    });
  }

  // "subscription_read_only" — the account is read-only, unrelated to how many promoters it has.
  // The two wordings differ because the coordinator is doing two different things: being told
  // "you cannot add a promoter" while trying to correct someone's phone number would read as a
  // bug rather than as a billing state.
  return t(
    action === "write"
      ? "enforcement.promoters.blocked_read_only_edit"
      : "enforcement.promoters.blocked_read_only",
  );
}

export async function createPromoter(
  _prev: PromoterFormState,
  formData: FormData,
): Promise<PromoterFormState> {
  const user = await requireUser();

  const blockedMessage = await checkPromoterWriteAllowed(user.agencyId, "add_promoter");
  if (blockedMessage) {
    return { status: "error", errors: { general: blockedMessage } };
  }

  const db = await createServerSupabase();

  const { scalars, phoneNormalized, fieldErrors } = parseForm(formData);
  if (Object.keys(fieldErrors).length > 0) return { status: "error", errors: fieldErrors };

  const existing = await findDuplicate(db, phoneNormalized);
  if (existing) {
    return { status: "duplicate", duplicate: { id: existing.id, fullName: existing.full_name } };
  }

  const [areaIds, skills] = await Promise.all([
    keepOwnedIds(db, "areas", scalars.areaIds),
    (async () => {
      const owned = await keepOwnedIds(db, "skills", scalars.skills.map((s) => s.id));
      return scalars.skills.filter((s) => owned.includes(s.id));
    })(),
  ]);

  const { data: inserted, error } = await db
    .from("promoters")
    .insert({
      agency_id: user.agencyId,
      full_name: scalars.fullName,
      phone: phoneNormalized,
      email: scalars.email || null,
      birth_year: scalars.birthYear ?? null,
      home_lat: scalars.lat ?? null,
      home_lng: scalars.lng ?? null,
      has_car: scalars.hasCar,
      has_licence: scalars.hasLicence,
      transport_notes: scalars.transportNotes ?? null,
      status: scalars.status,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    // 23505 = unique_violation: a race with another tab/coordinator saving the same phone
    // between our check above and this insert.
    if (error?.code === "23505") {
      const raced = await findDuplicate(db, phoneNormalized);
      if (raced) return { status: "duplicate", duplicate: { id: raced.id, fullName: raced.full_name } };
    }
    return { status: "error", errors: { general: t("promoters.errors.save_failed") } };
  }

  const promoterId = inserted.id as string;

  if (areaIds.length > 0) {
    await db.from("promoter_areas").insert(areaIds.map((area_id) => ({ promoter_id: promoterId, area_id })));
  }
  if (skills.length > 0) {
    await db
      .from("promoter_skills")
      .insert(skills.map((s) => ({ promoter_id: promoterId, skill_id: s.id, level: s.level })));
  }

  // P39 — the first availability link goes out by itself. `after()` runs once the response (the
  // redirect below) is on its way, so email can be slow, retrying or down and the coordinator
  // still sees their saved promoter immediately. `sendWelcomeAvailabilityLink` never throws, and
  // the extra catch is for the one thing it cannot guard: failing to load at all.
  after(async () => {
    try {
      await sendWelcomeAvailabilityLink(promoterId);
    } catch {
      // Nothing to tell anyone: the promoter appears in /settings/messaging's manual list.
    }
  });

  revalidatePath("/promoters");
  redirect(`/promoters/${promoterId}`);
}

export async function updatePromoter(
  _prev: PromoterFormState,
  formData: FormData,
): Promise<PromoterFormState> {
  const user = await requireUser();

  // A1-05. Editing a promoter is an ordinary write, and commercial-architecture.md §3 says a
  // read-only agency does not write. Deliberately NOT applied to `archivePromoter` below: that
  // one FREES a promoter slot, and blocking it would trap a read-only agency with a roster it
  // cannot shrink — the same reasoning P27 used for `revokeInvitation` and `removeMember`.
  const blockedMessage = await checkPromoterWriteAllowed(user.agencyId, "write");
  if (blockedMessage) return { status: "error", errors: { general: blockedMessage } };

  const db = await createServerSupabase();

  const promoterId = String(formData.get("promoterId") ?? "");
  if (!promoterId) return { status: "error", errors: { general: t("promoters.errors.save_failed") } };

  const { scalars, phoneNormalized, fieldErrors } = parseForm(formData);
  if (Object.keys(fieldErrors).length > 0) return { status: "error", errors: fieldErrors };

  const existing = await findDuplicate(db, phoneNormalized, promoterId);
  if (existing) {
    return { status: "duplicate", duplicate: { id: existing.id, fullName: existing.full_name } };
  }

  const [areaIds, skills] = await Promise.all([
    keepOwnedIds(db, "areas", scalars.areaIds),
    (async () => {
      const owned = await keepOwnedIds(db, "skills", scalars.skills.map((s) => s.id));
      return scalars.skills.filter((s) => owned.includes(s.id));
    })(),
  ]);

  // RLS scopes this update to the caller's own agency; a tampered `promoterId` for another
  // tenant simply updates zero rows rather than leaking a write across the boundary.
  const { data: updated, error } = await db
    .from("promoters")
    .update({
      full_name: scalars.fullName,
      phone: phoneNormalized,
      email: scalars.email || null,
      birth_year: scalars.birthYear ?? null,
      home_lat: scalars.lat ?? null,
      home_lng: scalars.lng ?? null,
      has_car: scalars.hasCar,
      has_licence: scalars.hasLicence,
      transport_notes: scalars.transportNotes ?? null,
      status: scalars.status,
    })
    .eq("id", promoterId)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      const raced = await findDuplicate(db, phoneNormalized, promoterId);
      if (raced) return { status: "duplicate", duplicate: { id: raced.id, fullName: raced.full_name } };
    }
    return { status: "error", errors: { general: t("promoters.errors.save_failed") } };
  }
  if (!updated) return { status: "error", errors: { general: t("promoters.errors.not_found") } };

  // Resync the join tables: delete-then-insert is simplest and correct at this scale (a
  // promoter works a handful of areas/skills, not hundreds), and RLS on both tables is enforced
  // through the promoter row so this cannot touch another agency's rows.
  await db.from("promoter_areas").delete().eq("promoter_id", promoterId);
  if (areaIds.length > 0) {
    await db.from("promoter_areas").insert(areaIds.map((area_id) => ({ promoter_id: promoterId, area_id })));
  }

  await db.from("promoter_skills").delete().eq("promoter_id", promoterId);
  if (skills.length > 0) {
    await db
      .from("promoter_skills")
      .insert(skills.map((s) => ({ promoter_id: promoterId, skill_id: s.id, level: s.level })));
  }

  revalidatePath("/promoters");
  revalidatePath(`/promoters/${promoterId}`);
  redirect(`/promoters/${promoterId}`);
}

/**
 * Archive, never delete — a promoter with shift/invitation history must never be hard-deleted
 * (CLAUDE.md, build-plan.md §2.1). Bound with the promoter id via `.bind(null, id)` from a plain
 * `<form action={...}>`, so the destructive step needs no client JS beyond the confirmation
 * toggle around the button.
 */
export async function archivePromoter(promoterId: string): Promise<void> {
  await requireUser();
  const db = await createServerSupabase();

  await db.from("promoters").update({ status: "archived" }).eq("id", promoterId);

  revalidatePath("/promoters");
  revalidatePath(`/promoters/${promoterId}`);
  redirect(`/promoters/${promoterId}`);
}
