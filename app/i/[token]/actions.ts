"use server";

import { revalidatePath } from "next/cache";
import { respondToInvitation } from "@/lib/invitations";

export type RespondState = { status: "idle" | "accepted" | "declined" | "error"; reason?: string };

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
