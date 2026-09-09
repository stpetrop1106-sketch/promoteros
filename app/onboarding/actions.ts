"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { teamErrorCode, type TeamErrorCode } from "@/lib/team";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";

// Same convention as app/promoters/actions.ts: server-only, but every user-facing string still
// goes through t() in the reference locale. There is no coordinator locale switcher yet (P12).
const t = translatorFor(DEFAULT_LOCALE);

/**
 * Timezones offered at signup. A short, honest list beats a 400-entry dropdown: the market is
 * Greek agencies, and anyone outside it can be moved by support rather than by scrolling.
 */
export const TIMEZONES = [
  "Europe/Athens",
  "Europe/Nicosia",
  "Europe/Bucharest",
  "Europe/Berlin",
  "Europe/London",
  "UTC",
] as const;

export type Timezone = (typeof TIMEZONES)[number];

export type CreateAgencyErrors = Partial<Record<"name" | "city" | "timezone" | "general", string>>;

export type CreateAgencyState = {
  status: "idle" | "error";
  errors?: CreateAgencyErrors;
};

export const CREATE_AGENCY_IDLE: CreateAgencyState = { status: "idle" };

const ERROR_KEYS: Partial<Record<TeamErrorCode, TranslationKey>> = {
  already_in_agency: "onboarding.errors.already_in_agency",
  name_too_short: "onboarding.errors.name_too_short",
  not_authenticated: "onboarding.errors.not_authenticated",
  no_email: "onboarding.errors.no_email",
};

function messageFor(code: TeamErrorCode): string {
  const key = ERROR_KEYS[code];
  return key ? t(key) : t("onboarding.errors.unknown");
}

/**
 * Create the signing-in user's agency and make them its owner.
 *
 * The whole write is one `create_agency_for_user` call because the two halves must not be able
 * to come apart: an agency with no owner is unrecoverable, and an owner row pointing at a
 * half-created agency is worse. The function is also where "a user belongs to exactly one
 * tenant" is enforced — this action cannot be the place, because a server action is a public
 * HTTP endpoint and PostgREST can be called without it.
 */
export async function createAgency(
  _prev: CreateAgencyState,
  formData: FormData,
): Promise<CreateAgencyState> {
  const name = String(formData.get("name") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();

  const errors: CreateAgencyErrors = {};

  if (name.length < 2) errors.name = t("onboarding.errors.name_too_short");
  if (name.length > 120) errors.name = t("onboarding.errors.name_too_long");
  if (city.length > 80) errors.city = t("onboarding.errors.city_too_long");
  if (!(TIMEZONES as readonly string[]).includes(timezone)) {
    errors.timezone = t("onboarding.errors.timezone_invalid");
  }

  if (Object.keys(errors).length > 0) return { status: "error", errors };

  const db = await createServerSupabase();

  const { error } = await db.rpc("create_agency_for_user", {
    p_name: name,
    p_city: city || null,
    p_timezone: timezone,
    p_full_name: fullName || null,
  });

  if (error) {
    return { status: "error", errors: { general: messageFor(teamErrorCode(error.message)) } };
  }

  revalidatePath("/onboarding");
  redirect("/onboarding");
}
