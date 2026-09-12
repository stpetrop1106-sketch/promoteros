"use server";

import { revalidatePath } from "next/cache";
import { respondToInvitation } from "@/lib/invitations";
import { acknowledgeBriefForInvitation } from "@/lib/briefs";

export type RespondState = { status: "idle" | "accepted" | "declined" | "error"; reason?: string };

export type AcknowledgeBriefState =
  | { status: "idle" }
  | { status: "acknowledged"; acknowledgedAt: string }
  | { status: "error"; reason: string };

/**
 * Anonymous on purpose — and this is the one path that stays that way.
 *
 * A promoter has no account (CLAUDE.md, Messaging): the signed, single-use, expiring token in the
 * URL *is* the credential. `respondToInvitation` verifies the signature and re-checks the stored
 * hash before it reaches the service-role client, so the service role is never reachable here
 * without a token that this server minted. Adding `requireUser()` would break the product.
 */

export async function respond(
  _prev: RespondState,
  formData: FormData,
): Promise<RespondState> {
  const token = String(formData.get("token") ?? "");
  const answer = String(formData.get("answer") ?? "");

  if (answer !== "accept" && answer !== "decline") {
    return { status: "error", reason: "bad_answer" };
  }

  const result = await respondToInvitation(token, answer);
  if (!result.ok) return { status: "error", reason: result.reason };

  revalidatePath(`/i/${token}`);
  return { status: result.answer === "accept" ? "accepted" : "declined" };
}

/**
 * "I've read this brief" — anonymous, same shape as `respond` above. Idempotent on the database
 * side (`lib/briefs.ts`), so this never needs to distinguish a first tap from a retry.
 */
export async function acknowledgeBrief(
  _prev: AcknowledgeBriefState,
  formData: FormData,
): Promise<AcknowledgeBriefState> {
  const token = String(formData.get("token") ?? "");

  const result = await acknowledgeBriefForInvitation(token);
  if (!result.ok) return { status: "error", reason: result.reason };

  revalidatePath(`/i/${token}`);
  return { status: "acknowledged", acknowledgedAt: result.acknowledgedAt };
}
