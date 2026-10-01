import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { matchPromoters, type Candidate } from "@/lib/matching";
import { getAdapter, getAdapterFor } from "@/lib/messaging";
import {
  mintToken,
  hashToken,
  verifyToken,
  verifyTokenSignature,
  acceptedInvitationStillReadable,
  linkFor,
} from "@/lib/tokens";
import { getEntitlement, checkBilling } from "@/lib/billing/subscription";
import { isActivePromoterStatus } from "@/lib/promoter-status";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { formatEuroCents, formatShiftWhen } from "@/lib/shift-format";
import { shiftPayCents } from "@/lib/shift-pay";

const DEFAULT_TTL_HOURS = 24;
const t = translatorFor(DEFAULT_LOCALE);

/**
 * A1-10 — why this is a class and not just an Error with a message.
 *
 * `createInvitation` refused a read-only agency by throwing the translated sentence, and both
 * callers caught it, could not tell it apart from "Shift not found" or a Postgres error, and
 * rendered one generic "the invitation was not sent". So a coordinator whose subscription had
 * lapsed was told the feature was broken, and never told to go and pay — the enforcement worked
 * and the only person who needed to understand it was the one person kept in the dark.
 *
 * The message stays human for the server log; `code` is what the callers switch on.
 */
export class InvitationBlockedError extends Error {
  constructor(readonly code: "blocked_read_only", message: string) {
    super(message);
    this.name = "InvitationBlockedError";
  }
}

export type InvitationView = {
  invitationId: string;
  promoterName: string;
  /** A3-12 — who the invitation is from. A promoter working for three agencies could not tell. */
  agencyName: string;
  /**
   * A3-06 — false once the coordinator has archived or blocklisted this promoter.
   *
   * Archiving is the product's stated way to cut someone off, and until now it stopped exactly one
   * of their four links: `app/a/[token]/data.ts` gates on `promoters.status` and calls it "the
   * closest thing we have to revocation", while this loader, `respondToInvitation` and every
   * function in `lib/checkins.ts` never selected the column at all. So an archived promoter kept a
   * working invitation page with a live Accept button. The page reads this to replace that button
   * with a sentence; `respondToInvitation` is the gate that actually holds.
   */
  promoterActive: boolean;
  campaignName: string;
  storeName: string;
  /** A3-13 — "ΑΒ Βασιλόπουλος" is not an answer to "can you work this?"; how far away it is, is. */
  storeAddress: string | null;
  onDate: string;
  startTime: string;
  endTime: string;
  dressCode: string | null;
  rateCents: number;
  status: string;
};

/**
 * Offer a shift to one promoter.
 *
 * The match breakdown is frozen onto the invitation on purpose: months later we must still be
 * able to say why this person was offered this shift — to the client, and to the promoter.
 */
export async function createInvitation(
  shiftId: string,
  promoterId: string,
  ttlHours = DEFAULT_TTL_HOURS,
): Promise<{ url: string; manualBody: string | null; delivered: boolean }> {
  const db = createAdminClient();

  const { data: shift, error: shiftErr } = await db
    .from("shifts")
    // `rate_cents_override` is new here: the message body now quotes what the shift pays, and the
    // shift's own rate is what it pays when one is set — the same resolution `loadInvitation`
    // already did for the page. Quoting the campaign rate in the message and the override on the
    // page would have been two different numbers for the same shift.
    .select(
      "id, agency_id, on_date, start_time, end_time, rate_cents_override, campaigns(name, rate_cents), stores(name)",
    )
    .eq("id", shiftId)
    .single();
  if (shiftErr || !shift) throw new Error("Shift not found");

  // P24 — a read-only agency (canceled subscription, or past its 14-day grace) must not be able
  // to offer new shifts; docs/commercial-architecture.md §3 and checkBilling's own "write"
  // contract ("send an invitation" is its own example). Checked here rather than in the
  // coordinator's `invite()` action (app/shifts/[id]/actions.ts) because this is the one place
  // every invitation is actually created — an admin client, so `getEntitlement` is scoped by
  // `shift.agency_id` just fetched, not by trusting an id from the caller. Any future caller of
  // `createInvitation` inherits the same guard for free, the same way `checkBilling` itself is
  // meant to be the single source of truth rather than copied into every call site.
  const entitlement = await getEntitlement(shift.agency_id);
  if (entitlement && !checkBilling(entitlement, "write").allowed) {
    throw new InvitationBlockedError(
      "blocked_read_only",
      t("enforcement.invitations.blocked_read_only"),
    );
  }

  const { data: promoter, error: promoterErr } = await db
    .from("promoters")
    .select("id, full_name, phone, email")
    .eq("id", promoterId)
    .single();
  if (promoterErr || !promoter) throw new Error("Promoter not found");

  const candidate: Candidate | undefined = (await matchPromoters(shiftId, 100)).find(
    (c) => c.promoterId === promoterId,
  );

  // Insert first so the token can carry the real invitation id.
  const { data: invitation, error: insertErr } = await db
    .from("invitations")
    .insert({
      agency_id: shift.agency_id,
      shift_id: shiftId,
      promoter_id: promoterId,
      token_hash: "pending",
      match_score: candidate?.score ?? null,
      match_breakdown: candidate?.breakdown ?? null,
      channel: getAdapter().channel,
      expires_at: new Date(Date.now() + ttlHours * 3600_000).toISOString(),
    })
    .select("id")
    .single();
  if (insertErr || !invitation) throw new Error(insertErr?.message ?? "Could not create invitation");

  const { token, tokenHash } = mintToken("invitation", invitation.id, ttlHours * 3600);
  await db.from("invitations").update({ token_hash: tokenHash }).eq("id", invitation.id);

  const campaign = shift.campaigns as unknown as { name: string; rate_cents: number } | null;
  const store = shift.stores as unknown as { name: string } | null;
  const url = linkFor(token, "invitation");

  // A3-17 — these two lines were string literals in this file: the only user-facing strings in
  // the product not behind a key, in a module that already holds a `t`. They also addressed
  // everyone in the feminine ("Είσαι διαθέσιμη;"), which the roster makes wrong for a good share
  // of the people receiving it. Both are keys now, and the question is phrased without a gender.
  // What the shift pays, not what an hour of it pays. A promoter reading a message on their phone
  // should not have to work out 7,00 € × 7½ h before they can answer. `shiftPayCents` returns null
  // when the campaign carries no rate or the hours do not parse, and a null line is dropped by the
  // `.filter(Boolean)` below — silence is right there, an invented "0,00 €" is not.
  const payCents = shiftPayCents(
    shift.rate_cents_override ?? campaign?.rate_cents ?? null,
    String(shift.start_time),
    String(shift.end_time),
  );

  const body = [
    t("invitation.message.title"),
    campaign?.name ?? "",
    store?.name ?? "",
    formatShiftWhen(shift.on_date, String(shift.start_time), String(shift.end_time)),
    payCents === null ? "" : t("invitation.message.pay", { total: formatEuroCents(payCents) }),
    "",
    t("invitation.message.question"),
  ]
    .filter(Boolean)
    .join("\n");

  // P39: emailed when Resend is configured and the promoter has a usable address; otherwise the
  // manual result, exactly as before. The adapter decides — no channel branching here.
  const result = await getAdapterFor().send({
    to: { name: promoter.full_name, phone: promoter.phone, email: promoter.email },
    body,
    url,
    subject: t("messaging.email.invitation.subject"),
    actionLabel: t("messaging.email.invitation.action"),
    idempotencyKey: `promoteros-invitation-${invitation.id}`,
  });

  // The row was inserted with the manual channel (the one that is always valid for the
  // `invitation_channel` enum). Record the channel it really went out on. Best effort: until
  // 0017 adds 'email' to that enum this update fails, and the invitation is unaffected.
  if (result.delivered && result.channel !== getAdapter().channel) {
    await db.from("invitations").update({ channel: result.channel }).eq("id", invitation.id);
  }

  return {
    url,
    delivered: result.delivered,
    manualBody: result.delivered ? null : result.manualBody,
  };
}

/** Read an invitation from its raw token, for the promoter-facing page. */
export async function loadInvitation(token: string): Promise<
  { ok: true; view: InvitationView } | { ok: false; reason: string }
> {
  // Expiry is decided below, once we know whether this invitation was already accepted — an
  // accepted one stays readable so the promoter can come back for the check-in link on the day.
  const verified = verifyTokenSignature(token, "invitation");
  if (!verified.ok) return { ok: false, reason: verified.reason };

  const db = createAdminClient();
  const { data, error } = await db
    .from("invitations")
    .select(
      // A2 finding 4 — `shifts.rate_cents_override` is written by
      // `app/campaigns/[id]/shifts/new/actions.ts` and, until this line, was read by nothing:
      // the coordinator set "Αμοιβή για αυτές τις βάρδιες" and the promoter was still quoted the
      // campaign's own rate. The override is what the shift pays when it is set.
      // A3-12 adds `agencies(name)` and A3-13 adds `stores(address)`. Both are already visible to
      // this promoter by other means (the agency is named in the privacy notice they can reach
      // from this page; the address is on the arrival page they get after accepting) — no new
      // class of data reaches the link, it is only shown at the moment the decision is made.
      // A3-06 adds `promoters.status` — one more column on an embed that was already here.
      "id, status, token_hash, expires_at, agencies(name), promoters(full_name, status), shifts(on_date, start_time, end_time, rate_cents_override, campaigns(name, dress_code, rate_cents), stores(name, address))",
    )
    .eq("id", verified.recordId)
    .single();

  if (error || !data) return { ok: false, reason: "not_found" };
  // Defence in depth: a valid signature must also match the stored hash.
  if (data.token_hash !== hashToken(token)) return { ok: false, reason: "bad_signature" };

  const shift = data.shifts as unknown as {
    on_date: string;
    start_time: string;
    end_time: string;
    rate_cents_override: number | null;
    campaigns: { name: string; dress_code: string | null; rate_cents: number } | null;
    stores: { name: string; address: string | null } | null;
  } | null;
  const promoter = data.promoters as unknown as { full_name: string; status: string } | null;
  const agency = data.agencies as unknown as { name: string } | null;

  if (!shift) return { ok: false, reason: "not_found" };
  if (
    verified.expired &&
    !(data.status === "accepted" && acceptedInvitationStillReadable(shift.on_date))
  ) {
    return { ok: false, reason: "expired" };
  }

  return {
    ok: true,
    view: {
      invitationId: data.id,
      promoterName: promoter?.full_name ?? "",
      agencyName: agency?.name ?? "",
      promoterActive: isActivePromoterStatus(promoter?.status),
      campaignName: shift.campaigns?.name ?? "",
      storeName: shift.stores?.name ?? "",
      storeAddress: shift.stores?.address ?? null,
      onDate: shift.on_date,
      startTime: String(shift.start_time).slice(0, 5),
      endTime: String(shift.end_time).slice(0, 5),
      dressCode: shift.campaigns?.dress_code ?? null,
      rateCents: shift.rate_cents_override ?? shift.campaigns?.rate_cents ?? 0,
      status: data.status,
    },
  };
}

/**
 * Record a promoter's answer.
 *
 * A decline immediately re-ranks and returns the next candidates, because the whole point of
 * the product is that the coordinator does not go looking for a replacement by hand.
 */
export async function respondToInvitation(
  token: string,
  answer: "accept" | "decline",
  declineReason?: string,
): Promise<
  | { ok: true; answer: "accept" }
  | { ok: true; answer: "decline"; replacements: Candidate[] }
  | { ok: false; reason: string }
> {
  const verified = verifyToken(token, "invitation");
  if (!verified.ok) return { ok: false, reason: verified.reason };

  const db = createAdminClient();
  const { data: invitation, error } = await db
    .from("invitations")
    .select("id, agency_id, shift_id, promoter_id, status, token_hash")
    .eq("id", verified.recordId)
    .single();

  if (error || !invitation) return { ok: false, reason: "not_found" };
  if (invitation.token_hash !== hashToken(token)) return { ok: false, reason: "bad_signature" };
  if (invitation.status !== "pending") return { ok: false, reason: "already_answered" };

  // A3-06 — the gate that actually holds. `loadInvitation` hides the Accept button for an
  // archived or blocklisted promoter, but a hidden button is not a rule: this URL is a plain
  // POST and the page is the only thing between it and an `assignments` row. A promoter the
  // agency has cut off, possibly after an incident, must not be able to put themselves back on
  // a shift by reposting a form they still have open.
  const { data: promoter } = await db
    .from("promoters")
    .select("status")
    .eq("id", invitation.promoter_id)
    .maybeSingle<{ status: string }>();
  if (!isActivePromoterStatus(promoter?.status)) return { ok: false, reason: "inactive" };

  if (answer === "decline") {
    await db
      .from("invitations")
      .update({
        status: "declined",
        responded_at: new Date().toISOString(),
        decline_reason: declineReason ?? null,
      })
      .eq("id", invitation.id);

    // The decliner is excluded automatically — match_promoters skips anyone with a
    // declined invitation for this shift.
    const replacements = await matchPromoters(invitation.shift_id, 3);
    return { ok: true, answer: "decline", replacements };
  }

  await db
    .from("invitations")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("id", invitation.id);

  await db.from("assignments").upsert(
    {
      agency_id: invitation.agency_id,
      shift_id: invitation.shift_id,
      promoter_id: invitation.promoter_id,
      status: "confirmed",
    },
    { onConflict: "shift_id,promoter_id" },
  );

  await refreshShiftStatus(invitation.shift_id);
  return { ok: true, answer: "accept" };
}

/** Keep `shifts.status` consistent with confirmed assignments. */
export async function refreshShiftStatus(shiftId: string): Promise<void> {
  const db = createAdminClient();

  const { data: shift } = await db
    .from("shifts")
    .select("promoters_required")
    .eq("id", shiftId)
    .single();
  if (!shift) return;

  const { count } = await db
    .from("assignments")
    .select("id", { count: "exact", head: true })
    .eq("shift_id", shiftId)
    .eq("status", "confirmed");

  const filled = count ?? 0;
  const status =
    filled === 0 ? "open" : filled >= shift.promoters_required ? "filled" : "partially_filled";

  await db.from("shifts").update({ status }).eq("id", shiftId);
}
