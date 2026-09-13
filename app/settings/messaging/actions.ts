"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { ownerContext } from "@/lib/team";
import { createServerSupabase } from "@/lib/supabase/server";
import { automaticDeliveryConfigured } from "@/lib/messaging";
import { checkEmailAddress } from "@/lib/messaging/email-address";
import { manualPeriodKey } from "@/lib/dispatch/period";
import { runAvailabilityLinks } from "@/lib/dispatch/run";
import type { AutoSwitchState, SendNowState } from "./state";

/**
 * The two owner actions on /settings/messaging. Only async functions are exported.
 *
 * A server action is a public endpoint, so the owner check happens inside each one against a fresh
 * database read (`ownerContext()`), never trusted from the page that rendered the button.
 */

/** Turn the automatic availability links on or off for the caller's own agency. */
export async function saveAutoAvailabilityLinks(
  _prev: AutoSwitchState,
  formData: FormData,
): Promise<AutoSwitchState> {
  const owner = await ownerContext();
  if (!owner) return { status: "error", code: "not_owner" };

  const enabled = String(formData.get("enabled") ?? "") === "true";

  // RLS-scoped client, and 0017's column grant is the only reason this can succeed: Postgres
  // refuses the update if it touches any other column of `agencies`.
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("agencies")
    .update({ auto_availability_links: enabled })
    .eq("id", owner.agencyId)
    .select("id");

  if (error) {
    if (/permission denied/i.test(error.message)) return { status: "error", code: "write_not_permitted" };
    if (/auto_availability_links/i.test(error.message) || error.code === "42703" || error.code === "PGRST204") {
      return { status: "error", code: "migration_missing" };
    }
    return { status: "error", code: "unknown" };
  }
  if (!data || data.length === 0) return { status: "error", code: "write_not_permitted" };

  revalidatePath("/settings/messaging");
  return { status: "saved", enabled };
}

/**
 * "Send to everyone now". The confirm step is on the client; this is the send.
 *
 * Idempotent per Athens day: the period key is `manual-YYYY-MM-DD`, so pressing it again the same
 * day re-tries only people who were skipped or failed, and never re-emails someone already sent.
 * The run itself happens in `after()` — at Resend's 2 requests/second a roster of 120 takes about a
 * minute, and the owner should not stare at a spinner for it. The page shows the results.
 */
export async function sendAvailabilityLinksNow(
  _prev: SendNowState,
  _formData: FormData,
): Promise<SendNowState> {
  const owner = await ownerContext();
  if (!owner) return { status: "error", code: "not_owner" };
  if (!automaticDeliveryConfigured()) return { status: "error", code: "email_not_configured" };

  const db = await createServerSupabase();

  // The claim table must exist before anything is sent: no claim, no send.
  const probe = await db.from("message_dispatches").select("id", { head: true, count: "exact" }).limit(1);
  if (probe.error) return { status: "error", code: "migration_missing" };

  const { data, error } = await db.from("promoters").select("email").eq("status", "active");
  if (error) return { status: "error", code: "unknown" };
  const recipients = (data ?? []).filter((p) => checkEmailAddress((p as { email: string | null }).email).ok).length;

  const agencyId = owner.agencyId;
  const periodKey = manualPeriodKey();

  after(async () => {
    try {
      await runAvailabilityLinks({
        periodKey,
        agencyIds: [agencyId],
        respectAutoSwitch: false,
        deadline: Date.now() + 240_000,
      });
    } catch {
      // Every per-promoter outcome is already in message_dispatches; a failure to even start
      // shows on the page as "no run yet".
    }
  });

  revalidatePath("/settings/messaging");
  return { status: "started", recipients };
}
