import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { EMAIL_PATTERN, normalizeEmail } from "@/lib/team";

/**
 * Agency identity: the legal facts `/privacy/promoters` needs and cannot invent.
 *
 * `agencies.legal_name`, `agencies.privacy_contact_email` and `agencies.promoter_retention_months`
 * were added by migration 0014 (see its comments — they are the reasoning for every field below)
 * with nothing in the product able to set them. `/privacy/promoters` refuses to render without a
 * real legal name and a real contact email rather than show a placeholder, so a real agency with
 * these columns empty gets a 500 on the one page its own promoters are told to read.
 *
 * Same shape as `lib/team.ts`: the owner check re-derives the caller's role from `app_users` on
 * every write, never from a prop or a cached claim, and every query goes through the RLS-scoped
 * client — never the admin client. `lib/team.ts` owns `ownerContext()`; this file does not import
 * it because `ownerContext()`'s return type is specific to the team screens' call sites, and
 * duplicating six lines here is cheaper than coupling two lanes' owner-gate types together.
 */

export type AgencyIdentity = {
  id: string;
  /** Display name — not the controller. Shown for context only; this screen never edits it. */
  name: string;
  legalName: string | null;
  privacyContactEmail: string | null;
  retentionMonths: number | null;
};

type AgencyIdentityRow = {
  id: string;
  name: string;
  legal_name: string | null;
  privacy_contact_email: string | null;
  promoter_retention_months: number | null;
};

const IDENTITY_COLUMNS = "id, name, legal_name, privacy_contact_email, promoter_retention_months";

/** 0014's check constraint: `promoter_retention_months is null or between 1 and 240`. */
export const RETENTION_MONTHS_MIN = 1;
export const RETENTION_MONTHS_MAX = 240;

/**
 * 0014's proposed-and-unconfirmed default: two seasonal cycles, the shortest window that does not
 * throw away a usable roster for work that is seasonal by nature. Not a recommendation — the
 * agency confirms the real number with its own accountant/lawyer. See 0014's comment on
 * `agencies.promoter_retention_months` for the full reasoning and the competing 60-month figure.
 */
export const RETENTION_MONTHS_DEFAULT = 24;

const MAX_LEGAL_NAME_LENGTH = 200;

/** What `/privacy/promoters` needs present before it will render. Both fields, not just one. */
export function identityComplete(identity: Pick<AgencyIdentity, "legalName" | "privacyContactEmail">): boolean {
  return Boolean(identity.legalName && identity.privacyContactEmail);
}

/** Read the caller's own agency identity. Any active team member may view this screen. */
export async function loadAgencyIdentity(): Promise<AgencyIdentity | null> {
  const user = await requireUser();
  const db = await createServerSupabase();

  const { data } = await db
    .from("agencies")
    .select(IDENTITY_COLUMNS)
    .eq("id", user.agencyId)
    .maybeSingle<AgencyIdentityRow>();

  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    legalName: data.legal_name,
    privacyContactEmail: data.privacy_contact_email,
    retentionMonths: data.promoter_retention_months,
  };
}

export type AgencyIdentityOwnerContext = { userId: string; agencyId: string };

/**
 * Gate for the write below. Signed out redirects (via `requireUser`). Signed in but not an active
 * owner returns null, and the caller turns that into `not_owner`. Freshly read from the database
 * every call, exactly like `lib/team.ts`'s `ownerContext()` — a role change takes effect on the
 * very next request, never waiting on a session to expire.
 */
export async function agencyIdentityOwnerContext(): Promise<AgencyIdentityOwnerContext | null> {
  const user = await requireUser();
  const db = await createServerSupabase();

  const { data } = await db
    .from("app_users")
    .select("id, agency_id, role, active")
    .eq("id", user.userId)
    .maybeSingle<{ id: string; agency_id: string; role: string; active: boolean }>();

  if (!data || !data.active || data.role !== "owner") return null;

  return { userId: data.id, agencyId: data.agency_id };
}

export const AGENCY_IDENTITY_ERROR_CODES = [
  "not_owner",
  "legal_name_required",
  "legal_name_too_long",
  "email_required",
  "email_invalid",
  "retention_required",
  "retention_out_of_range",
  /**
   * `authenticated` currently holds only SELECT on `agencies` (`0006_auth.sql`), and
   * `0012_billing.sql` explicitly revokes insert/update/delete as a defensive restatement — there
   * is no RLS `update` policy on `agencies` either, only `own_agency`'s `select` (`0002_rls.sql`).
   * So this write fails with a Postgres permission-denied error today, before RLS is even
   * evaluated, until a migration grants `UPDATE (legal_name, privacy_contact_email,
   * promoter_retention_months)` to `authenticated` and adds an owner-scoped `update` policy. See
   * docs/status/P33.md. This code exists so that failure renders as a specific, honest sentence —
   * never a raw Postgres error and never "something went wrong".
   */
  "write_not_permitted",
  "unknown",
] as const;

export type AgencyIdentityErrorCode = (typeof AGENCY_IDENTITY_ERROR_CODES)[number];

const CODE_SET = new Set<string>(AGENCY_IDENTITY_ERROR_CODES);

export function agencyIdentityErrorCode(message: string | null | undefined): AgencyIdentityErrorCode {
  if (!message) return "unknown";

  const trimmed = message.trim();
  if (CODE_SET.has(trimmed)) return trimmed as AgencyIdentityErrorCode;

  // Postgres: "permission denied for table agencies" (grant-level) — see the comment on
  // "write_not_permitted" above. RLS would instead report 0 rows affected, not an error, so this
  // check is specifically for the missing table grant.
  if (/permission denied/i.test(trimmed)) return "write_not_permitted";

  for (const code of AGENCY_IDENTITY_ERROR_CODES) {
    if (code !== "unknown" && trimmed.includes(code)) return code;
  }

  return "unknown";
}

export type UpdateAgencyIdentityInput = {
  legalName: string;
  privacyContactEmail: string;
  retentionMonths: number;
};

function validate(input: UpdateAgencyIdentityInput): AgencyIdentityErrorCode | null {
  if (input.legalName.length === 0) return "legal_name_required";
  if (input.legalName.length > MAX_LEGAL_NAME_LENGTH) return "legal_name_too_long";
  if (input.privacyContactEmail.length === 0) return "email_required";
  if (!EMAIL_PATTERN.test(input.privacyContactEmail)) return "email_invalid";
  if (!Number.isInteger(input.retentionMonths)) return "retention_required";
  if (
    input.retentionMonths < RETENTION_MONTHS_MIN ||
    input.retentionMonths > RETENTION_MONTHS_MAX
  ) {
    return "retention_out_of_range";
  }
  return null;
}

/**
 * Write the controller identity. Owner-only, re-derived from the database on every call — see
 * `agencyIdentityOwnerContext()` above. Validated here before the database has to reject it
 * (0014's check constraint covers only the retention window), through the RLS-scoped client,
 * never the admin client — a write this parcel cannot make must fail honestly, not succeed
 * through a bypass.
 */
export async function updateAgencyIdentity(
  input: UpdateAgencyIdentityInput,
): Promise<{ ok: true } | { ok: false; code: AgencyIdentityErrorCode }> {
  const owner = await agencyIdentityOwnerContext();
  if (!owner) return { ok: false, code: "not_owner" };

  const legalName = input.legalName.trim();
  const privacyContactEmail = normalizeEmail(input.privacyContactEmail);
  const retentionMonths = input.retentionMonths;

  const invalid = validate({ legalName, privacyContactEmail, retentionMonths });
  if (invalid) return { ok: false, code: invalid };

  const db = await createServerSupabase();
  const { error } = await db
    .from("agencies")
    .update({
      legal_name: legalName,
      privacy_contact_email: privacyContactEmail,
      promoter_retention_months: retentionMonths,
    })
    .eq("id", owner.agencyId);

  if (error) return { ok: false, code: agencyIdentityErrorCode(error.message) };

  return { ok: true };
}
